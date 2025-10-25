const {
  Order,
  OrderItem,
  OrderSeat,
  Ticket,
  Payment,
  Reservation,
  ReservationSeat,
  User,
  Concert,
  TicketType,
  Seat,
  StatusGeneral,
  ConcertSeat,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

// Función para generar código único de ticket
const generateTicketCode = (orderId, ticketNumber) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `TKT-${orderId}-${ticketNumber}-${timestamp}-${random}`.toUpperCase();
};

/**
 * NUEVA VERSIÓN: Crear orden desde reserva con asientos específicos
 */
const createOrder = async (userId, data) => {
  const transaction = await sequelize.transaction();

  try {
    const { reservation_id, ticket_type_id, quantity } = data;

    if (!reservation_id || !ticket_type_id || !quantity) {
      throw new Error("Datos de orden inválidos");
    }

    // =============================================
    // 1. VERIFICAR QUE LA RESERVA EXISTE Y ES DEL USUARIO
    // =============================================
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    const reservation = await Reservation.findOne({
      where: {
        id: reservation_id,
        user_id: userId,
        status_id: heldStatus.id,
      },
      include: [
        {
          model: ReservationSeat,
          as: "reservation_seats",
          include: [
            {
              model: Seat,
              as: "seat",
            },
            {
              model: ConcertSeat,
              as: "concert_seat",
            },
          ],
        },
      ],
      transaction,
    });

    if (!reservation) {
      throw new Error("Reserva no encontrada o ya expiró");
    }

    // =============================================
    // 2. VERIFICAR QUE NO HAYA EXPIRADO
    // =============================================
    if (new Date() > new Date(reservation.expires_at)) {
      throw new Error("La reserva ha expirado");
    }

    // =============================================
    // 3. VERIFICAR QUE TENGA ASIENTOS RESERVADOS
    // =============================================
    if (!reservation.reservation_seats || reservation.reservation_seats.length === 0) {
      throw new Error("La reserva no tiene asientos asignados");
    }

    if (reservation.reservation_seats.length !== quantity) {
      throw new Error(
        `La reserva tiene ${reservation.reservation_seats.length} asientos, pero solicitaste ${quantity}`
      );
    }

    // =============================================
    // 4. VALIDAR QUE TODOS LOS ASIENTOS AÚN ESTÉN RESERVED
    // =============================================
    const reservedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "reserved" },
      transaction,
    });

    const occupiedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "occupied" },
      transaction,
    });

    const inCartStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "in_cart" },
      transaction,
    });

    for (const reservationSeat of reservation.reservation_seats) {
      const concertSeat = reservationSeat.concert_seat;

      // Si el asiento está OCCUPIED, alguien más lo compró
      if (concertSeat.status_id === occupiedStatus.id) {
        throw new Error(
          `El asiento ${reservationSeat.seat.seat_number} ya fue vendido a otro usuario`
        );
      }

      // Si el asiento está IN_CART de otro usuario
      if (concertSeat.status_id === inCartStatus.id) {
        // Verificar si es de otro usuario
        const existingOrderSeat = await OrderSeat.findOne({
          where: { concert_seat_id: concertSeat.id },
          include: [
            {
              model: Order,
              as: "order",
              where: { user_id: { [Op.ne]: userId } },
            },
          ],
          transaction,
        });

        if (existingOrderSeat) {
          throw new Error(
            `El asiento ${reservationSeat.seat.seat_number} ya está en el carrito de otro usuario`
          );
        }
      }

      // Si no está RESERVED, algo salió mal
      if (concertSeat.status_id !== reservedStatus.id) {
        throw new Error(
          `El asiento ${reservationSeat.seat.seat_number} no está en estado reservado`
        );
      }
    }

    // =============================================
    // 5. OBTENER TICKET TYPE Y CALCULAR TOTAL
    // =============================================
    const ticketType = await TicketType.findByPk(ticket_type_id, {
      transaction,
    });

    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado");
    }

    const total = ticketType.price * quantity;

    // =============================================
    // 6. OBTENER STATUS 'PENDING' PARA ORDERS
    // =============================================
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    // =============================================
    // 7. CREAR ORDEN
    // =============================================
    const order = await Order.create(
      {
        user_id: userId,
        concert_id: reservation.concert_id,
        status_id: pendingStatus.id,
        total,
      },
      { transaction }
    );

    // =============================================
    // 8. CREAR ORDER_SEATS (copiar de reservation_seats)
    // =============================================
    for (const reservationSeat of reservation.reservation_seats) {
      await OrderSeat.create(
        {
          order_id: order.id,
          seat_id: reservationSeat.seat_id,
          concert_seat_id: reservationSeat.concert_seat_id,
        },
        { transaction }
      );
    }

    // =============================================
    // 9. ACTUALIZAR CONCERT_SEATS → IN_CART
    // =============================================
    const concertSeatIds = reservation.reservation_seats.map(
      (rs) => rs.concert_seat_id
    );

    await ConcertSeat.update(
      { status_id: inCartStatus.id },
      {
        where: { id: concertSeatIds },
        transaction,
      }
    );

    // =============================================
    // 10. ACTUALIZAR RESERVATION → CONFIRMED
    // =============================================
    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "confirmed" },
      transaction,
    });

    await reservation.update({ status_id: confirmedStatus.id }, { transaction });

    // =============================================
    // 11. CREAR ORDER ITEMS
    // =============================================
    await OrderItem.create(
      {
        order_id: order.id,
        ticket_type_id,
        seat_id: null, // Los asientos están en order_seats
        quantity,
        unit_price: ticketType.price,
      },
      { transaction }
    );

    // =============================================
    // 12. TODO: RABBITMQ - Mover de RESERVA a CARRITO
    // =============================================
    // 1. CONSUMIR (ACK) mensaje de RESERVA_QUEUE con reservationId
    // 2. PUBLICAR mensaje en CARRITO_QUEUE:
    // const rabbitMQMessage = {
    //   orderId: order.id,
    //   reservationId: reservation.id,
    //   userId: userId,
    //   concertId: reservation.concert_id,
    //   seatIds: reservation.reservation_seats.map(rs => rs.seat_id),
    //   concertSeatIds: concertSeatIds,
    //   timestamp: new Date().toISOString(),
    // };
    // await consumeFromQueue('RESERVA_QUEUE', reservationId);
    // await publishToQueue('CARRITO_QUEUE', rabbitMQMessage);

    await transaction.commit();

    // =============================================
    // 13. RETORNAR RESPUESTA
    // =============================================
    const createdOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: Concert,
          as: "concert",
          attributes: ["id", "title", "date"],
        },
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["descripcion"],
        },
        {
          model: OrderSeat,
          as: "order_seats",
          include: [
            {
              model: Seat,
              as: "seat",
              attributes: ["id", "seat_number"],
            },
          ],
        },
      ],
    });

    return {
      order: createdOrder,
      total,
      seats: reservation.reservation_seats.map((rs) => rs.seat.seat_number),
      message: "Orden creada. Tienes 5 minutos para confirmar el pago.",
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear orden: " + error.message);
  }
};

/**
 * NUEVA VERSIÓN: Confirmar orden y procesar pago con asientos específicos
 */
const confirmOrder = async (orderId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    // =============================================
    // 1. VERIFICAR QUE LA ORDEN EXISTE Y ES DEL USUARIO
    // =============================================
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    const order = await Order.findOne({
      where: {
        id: orderId,
        user_id: userId,
        status_id: pendingStatus.id,
      },
      include: [
        {
          model: OrderSeat,
          as: "order_seats",
          include: [
            {
              model: Seat,
              as: "seat",
            },
            {
              model: ConcertSeat,
              as: "concert_seat",
            },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: TicketType,
              as: "ticketType",
            },
          ],
        },
      ],
      transaction,
    });

    if (!order) {
      throw new Error("Orden no encontrada o ya fue procesada");
    }

    // =============================================
    // 2. VERIFICAR QUE TENGA ASIENTOS
    // =============================================
    if (!order.order_seats || order.order_seats.length === 0) {
      throw new Error("La orden no tiene asientos asignados");
    }

    // =============================================
    // 3. VALIDAR QUE TODOS LOS ASIENTOS ESTÉN IN_CART
    // =============================================
    const inCartStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "in_cart" },
      transaction,
    });

    const occupiedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "occupied" },
      transaction,
    });

    for (const orderSeat of order.order_seats) {
      const concertSeat = orderSeat.concert_seat;

      // Si ya está OCCUPIED, alguien más lo compró
      if (concertSeat.status_id === occupiedStatus.id) {
        throw new Error(
          `El asiento ${orderSeat.seat.seat_number} ya fue vendido a otro usuario`
        );
      }

      // Si no está IN_CART, algo salió mal
      if (concertSeat.status_id !== inCartStatus.id) {
        throw new Error(
          `El asiento ${orderSeat.seat.seat_number} no está en tu carrito`
        );
      }
    }

    // =============================================
    // 4. ACTUALIZAR CONCERT_SEATS → OCCUPIED (PERMANENTE)
    // =============================================
    const concertSeatIds = order.order_seats.map((os) => os.concert_seat_id);

    await ConcertSeat.update(
      { status_id: occupiedStatus.id },
      {
        where: { id: concertSeatIds },
        transaction,
      }
    );

    // =============================================
    // 5. ACTUALIZAR ORDER → CONFIRMED
    // =============================================
    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "confirmed" },
      transaction,
    });

    await order.update({ status_id: confirmedStatus.id }, { transaction });

    // =============================================
    // 6. CREAR TICKETS (uno por cada asiento)
    // =============================================
    const issuedStatus = await StatusGeneral.findOne({
      where: { dominio: "ticket", descripcion: "issued" },
      transaction,
    });

    const ticketType = order.items[0].ticketType;
    const tickets = [];

    for (let i = 0; i < order.order_seats.length; i++) {
      const orderSeat = order.order_seats[i];

      const ticket = await Ticket.create(
        {
          order_id: order.id,
          ticket_type_id: ticketType.id,
          seat_id: orderSeat.seat_id,
          code: generateTicketCode(order.id, i + 1),
          status_id: issuedStatus.id,
        },
        { transaction }
      );

      tickets.push(ticket);
    }

    // =============================================
    // 7. CREAR REGISTRO DE PAGO (SIMULADO)
    // =============================================
    const capturedStatus = await StatusGeneral.findOne({
      where: { dominio: "payment", descripcion: "captured" },
      transaction,
    });

    const payment = await Payment.create(
      {
        order_id: order.id,
        provider: "mock",
        amount: order.total,
        status_id: capturedStatus.id,
      },
      { transaction }
    );

    // =============================================
    // 8. TODO: RABBITMQ - CONSUMIR DE CARRITO_QUEUE
    // =============================================
    // await consumeFromQueue('CARRITO_QUEUE', orderId);
    // Esto marca el mensaje como procesado y no será expirado

    await transaction.commit();

    // =============================================
    // 9. RETORNAR RESPUESTA
    // =============================================
    const confirmedOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: Concert,
          as: "concert",
          attributes: ["id", "title", "date"],
        },
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["descripcion"],
        },
        {
          model: Ticket,
          as: "tickets",
          include: [
            {
              model: Seat,
              as: "seat",
              attributes: ["id", "seat_number"],
            },
          ],
        },
        {
          model: Payment,
          as: "payment",
        },
      ],
    });

    return {
      order: confirmedOrder,
      tickets,
      payment,
      message: "Orden confirmada exitosamente",
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al confirmar orden: " + error.message);
  }
};

/**
 * Obtener órdenes del usuario
 */
const getUserOrders = async (userId) => {
  try {
    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Concert,
          as: "concert",
          attributes: ["id", "title", "date"],
        },
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["descripcion"],
        },
        {
          model: Ticket,
          as: "tickets",
          include: [
            {
              model: Seat,
              as: "seat",
              attributes: ["id", "seat_number"],
            },
          ],
        },
        {
          model: OrderSeat,
          as: "order_seats",
          include: [
            {
              model: Seat,
              as: "seat",
              attributes: ["id", "seat_number"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return orders;
  } catch (error) {
    throw new Error("Error al obtener órdenes: " + error.message);
  }
};

/**
 * Obtener todas las órdenes (Admin)
 */
const getAllOrders = async () => {
  try {
    const orders = await Order.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        {
          model: Concert,
          as: "concert",
          attributes: ["id", "title", "date"],
        },
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["descripcion"],
        },
        {
          model: Ticket,
          as: "tickets",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return orders;
  } catch (error) {
    throw new Error("Error al obtener órdenes: " + error.message);
  }
};

/**
 * Obtener ventas por concierto (Admin)
 */
const getSalesByConcert = async (concertId) => {
  try {
    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "confirmed" },
    });

    const orders = await Order.findAll({
      where: {
        concert_id: concertId,
        status_id: confirmedStatus.id,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: TicketType,
              as: "ticketType",
              attributes: ["name", "price"],
            },
          ],
        },
        {
          model: Ticket,
          as: "tickets",
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const totalOrders = orders.length;
    const totalTickets = orders.reduce(
      (sum, order) => sum + order.tickets.length,
      0
    );
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

    return {
      concert_id: concertId,
      total_orders: totalOrders,
      total_tickets: totalTickets,
      total_revenue: totalRevenue,
      orders,
    };
  } catch (error) {
    throw new Error("Error al obtener ventas: " + error.message);
  }
};

/**
 * Obtener orden por ID
 */
const getOrderById = async (orderId, userId, isAdmin) => {
  try {
    const whereClause = { id: orderId };

    // Si no es admin, solo puede ver sus propias órdenes
    if (!isAdmin) {
      whereClause.user_id = userId;
    }

    const order = await Order.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        {
          model: Concert,
          as: "concert",
          attributes: ["id", "title", "date"],
        },
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["descripcion"],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: TicketType,
              as: "ticketType",
              attributes: ["name", "price"],
            },
          ],
        },
        {
          model: Ticket,
          as: "tickets",
          include: [
            {
              model: Seat,
              as: "seat",
              attributes: ["id", "seat_number"],
            },
          ],
        },
        {
          model: Payment,
          as: "payment",
        },
        {
          model: OrderSeat,
          as: "order_seats",
          include: [
            {
              model: Seat,
              as: "seat",
              attributes: ["id", "seat_number"],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    return order;
  } catch (error) {
    throw new Error("Error al obtener orden: " + error.message);
  }
};

module.exports = {
  createOrder,
  confirmOrder,
  getUserOrders,
  getAllOrders,
  getSalesByConcert,
  getOrderById,
};