// order-service/src/services/orderService.js
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
 * ✅ VERSIÓN SIMPLIFICADA: Crear orden solo con reservation_id
 */
const createOrder = async (userId, data) => {
  const { reservation_id } = data;

  if (!reservation_id) {
    throw new Error("reservation_id es requerido");
  }

  const transaction = await sequelize.transaction();

  try {
    // =============================================
    // 1. OBTENER STATUS NECESARIOS
    // =============================================
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    const inCartStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "in_cart" },
      transaction,
    });

    const confirmedReservationStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "confirmed" },
      transaction,
    });

    // =============================================
    // 2. OBTENER RESERVA COMPLETA CON TODOS SUS DATOS
    // =============================================
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
              attributes: ["id", "seat_number", "section_id"],
            },
            {
              model: ConcertSeat,
              as: "concert_seat",
              attributes: ["id", "concert_id", "status_id"],
            },
          ],
        },
      ],
      transaction,
    });

    // =============================================
    // 3. VALIDACIONES
    // =============================================
    if (!reservation) {
      throw new Error(
        "Reserva no encontrada, ya expiró o no te pertenece"
      );
    }

    // Validar que no haya expirado
    if (new Date() > new Date(reservation.expires_at)) {
      throw new Error(
        `La reserva expiró el ${new Date(reservation.expires_at).toLocaleString()}`
      );
    }

    // Validar que tenga asientos reservados
    if (!reservation.reservation_seats || reservation.reservation_seats.length === 0) {
      throw new Error("La reserva no tiene asientos asignados");
    }

    // =============================================
    // 4. EXTRAER DATOS DE LA RESERVA
    // =============================================
    const quantity = reservation.reservation_seats.length;
    const concertId = reservation.concert_id;
    
    // Obtener section_id del primer asiento (todos deberían ser de la misma sección)
    const sectionId = reservation.reservation_seats[0].seat.section_id;

    // =============================================
    // 5. OBTENER TICKET TYPE BASADO EN CONCIERTO Y SECCIÓN
    // =============================================
    const ticketType = await TicketType.findOne({
      where: {
        concert_id: concertId,
        section_id: sectionId,
      },
      transaction,
    });

    if (!ticketType) {
      throw new Error(
        `No se encontró tipo de ticket para el concierto ${concertId} y sección ${sectionId}`
      );
    }

    // =============================================
    // 6. CALCULAR TOTAL
    // =============================================
    const total = ticketType.price * quantity;

    // =============================================
    // 7. CREAR ORDEN
    // =============================================
    const order = await Order.create(
      {
        user_id: userId,
        concert_id: concertId,
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
    await reservation.update(
      { status_id: confirmedReservationStatus.id },
      { transaction }
    );

    // =============================================
    // 11. CREAR ORDER ITEMS
    // =============================================
    await OrderItem.create(
      {
        order_id: order.id,
        ticket_type_id: ticketType.id,
        seat_id: null, // Los asientos están en order_seats
        quantity,
        unit_price: ticketType.price,
      },
      { transaction }
    );

    // =============================================
    // 12. TODO: RABBITMQ - Publicar en CARRITO_QUEUE
    // =============================================
    /*
    const rabbitMQMessage = {
      action: "ORDER_CREATED",
      orderId: order.id,
      userId: userId,
      concertId: concertId,
      reservationId: reservation_id,
      ticketTypeId: ticketType.id,
      quantity: quantity,
      total: total,
      seatIds: reservation.reservation_seats.map(rs => rs.seat_id),
      concertSeatIds: concertSeatIds,
      sectionId: sectionId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
      timestamp: new Date().toISOString(),
    };
    
    await publishToQueue("CARRITO_QUEUE", rabbitMQMessage);
    console.log("📨 Mensaje publicado en CARRITO_QUEUE:", rabbitMQMessage);
    */

    await transaction.commit();

    // =============================================
    // 13. RETORNAR RESPUESTA COMPLETA
    // =============================================
    const createdOrder = await Order.findByPk(order.id, {
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
              attributes: ["id", "name", "price"],
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
              attributes: ["id", "seat_number", "section_id"],
            },
          ],
        },
      ],
    });

    return {
      message: "Orden creada exitosamente. Procede a confirmar el pago.",
      order: createdOrder,
      total,
      ticket_type: {
        id: ticketType.id,
        name: ticketType.name,
        price: ticketType.price,
      },
      seats: reservation.reservation_seats.map((rs) => ({
        seat_number: rs.seat.seat_number,
        section_id: rs.seat.section_id,
      })),
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear orden: " + error.message);
  }
};

/**
 * Confirmar orden (procesar pago)
 */
const confirmOrder = async (orderId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    // =============================================
    // 1. OBTENER STATUS NECESARIOS
    // =============================================
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "confirmed" },
      transaction,
    });

    const occupiedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "occupied" },
      transaction,
    });

    const issuedStatus = await StatusGeneral.findOne({
      where: { dominio: "ticket", descripcion: "issued" },
      transaction,
    });

    const capturedStatus = await StatusGeneral.findOne({
      where: { dominio: "payment", descripcion: "captured" },
      transaction,
    });

    // =============================================
    // 2. OBTENER ORDEN COMPLETA
    // =============================================
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

    // =============================================
    // 3. VALIDACIONES
    // =============================================
    if (!order) {
      throw new Error(
        "Orden no encontrada, ya fue confirmada o no te pertenece"
      );
    }

    if (!order.order_seats || order.order_seats.length === 0) {
      throw new Error("La orden no tiene asientos asignados");
    }

    // =============================================
    // 4. ACTUALIZAR CONCERT_SEATS → OCCUPIED (permanente)
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
    // 5. ACTUALIZAR STATUS DE LA ORDEN → CONFIRMED
    // =============================================
    await order.update({ status_id: confirmedStatus.id }, { transaction });

    // =============================================
    // 6. GENERAR TICKETS (uno por asiento)
    // =============================================
    const tickets = [];
    const ticketType = order.items[0].ticketType;

    for (let i = 0; i < order.order_seats.length; i++) {
      const orderSeat = order.order_seats[i];
      const ticketCode = generateTicketCode(order.id, i + 1);

      const ticket = await Ticket.create(
        {
          order_id: order.id,
          ticket_type_id: ticketType.id,
          seat_id: orderSeat.seat_id,
          code: ticketCode,
          status_id: issuedStatus.id,
        },
        { transaction }
      );

      tickets.push({
        id: ticket.id,
        code: ticket.code,
        seat_number: orderSeat.seat.seat_number,
        section_id: orderSeat.seat.section_id,
      });
    }

    // =============================================
    // 7. CREAR REGISTRO DE PAGO (simulado)
    // =============================================
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
    // 8. TODO: RABBITMQ - Consumir mensaje de CARRITO_QUEUE
    // =============================================
    /*
    // Este endpoint debería ser disparado por el consumer de RabbitMQ
    // que escucha CARRITO_QUEUE y procesa pagos
    
    await acknowledgeMessage("CARRITO_QUEUE", orderId);
    console.log("✅ Mensaje consumido de CARRITO_QUEUE para order:", orderId);
    
    // Publicar evento de PAGO_COMPLETADO
    const paymentCompleteMessage = {
      action: "PAYMENT_COMPLETED",
      orderId: order.id,
      userId: userId,
      concertId: order.concert_id,
      total: order.total,
      ticketsGenerated: tickets.length,
      ticketCodes: tickets.map(t => t.code),
      timestamp: new Date().toISOString(),
    };
    
    await publishToQueue("NOTIFICATIONS_QUEUE", paymentCompleteMessage);
    console.log("📨 Mensaje publicado en NOTIFICATIONS_QUEUE:", paymentCompleteMessage);
    */

    await transaction.commit();

    // =============================================
    // 9. RETORNAR RESPUESTA COMPLETA
    // =============================================
    return {
      message: "¡Pago confirmado! Tickets generados exitosamente",
      order: {
        id: order.id,
        status: "confirmed",
        total: order.total,
      },
      tickets,
      payment: {
        id: payment.id,
        provider: payment.provider,
        amount: payment.amount,
        status: "captured",
      },
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al confirmar orden: " + error.message);
  }
};

/**
 * Obtener orden por ID
 */
const getOrderById = async (orderId, userId, isAdmin) => {
  try {
    const whereClause = { id: orderId };
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
              attributes: ["id", "name", "price"],
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
              attributes: ["id", "seat_number", "section_id"],
            },
          ],
        },
        {
          model: Ticket,
          as: "tickets",
          include: [
            {
              model: StatusGeneral,
              as: "status",
              attributes: ["descripcion"],
            },
          ],
        },
        {
          model: Payment,
          as: "payment",
          include: [
            {
              model: StatusGeneral,
              as: "status",
              attributes: ["descripcion"],
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
          model: OrderItem,
          as: "items",
          include: [
            {
              model: TicketType,
              as: "ticketType",
              attributes: ["id", "name", "price"],
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
              attributes: ["id", "name", "price"],
            },
          ],
        },
        {
          model: Ticket,
          as: "tickets",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalTicketsSold = orders.reduce(
      (sum, order) => sum + (order.tickets?.length || 0),
      0
    );

    return {
      concert_id: concertId,
      total_orders: orders.length,
      total_tickets_sold: totalTicketsSold,
      total_revenue: totalRevenue,
      orders,
    };
  } catch (error) {
    throw new Error("Error al obtener ventas: " + error.message);
  }
};

module.exports = {
  createOrder,
  confirmOrder,
  getOrderById,
  getUserOrders,
  getAllOrders,
  getSalesByConcert,
};