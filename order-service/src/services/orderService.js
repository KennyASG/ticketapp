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
const { publishToQueue } = require('../workers/rabbitClient');
const { checkSeatsInQueue, removeSeatsFromQueue } = require('../utils/queueHelpers');

// Función para generar código único de ticket
const generateTicketCode = (orderId, ticketNumber) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `TKT-${orderId}-${ticketNumber}-${timestamp}-${random}`.toUpperCase();
};

/**
 * ✅ VERSIÓN SIMPLIFICADA: Crear orden solo con reservation_id
 */
const createOrder = async (userId, { reservation_id }) => {
  const transaction = await sequelize.transaction();

  try {
    // =============================================
    // 1. VALIDAR RESERVA (INCLUDE COMPLETO)
    // =============================================
    const reservation = await Reservation.findOne({
      where: { id: reservation_id, user_id: userId },
      include: [
        {
          model: ReservationSeat,
          as: "reservation_seats",
          include: [
            { 
              model: Seat, 
              as: "seat",
              attributes: ["id", "seat_number", "section_id"]  // ✅ Incluir section_id
            },
            { 
              model: ConcertSeat, 
              as: "concert_seat",
              include: [
                {
                  model: Seat,
                  as: "seat",
                  attributes: ["id", "seat_number", "section_id"]  // ✅ También aquí
                }
              ]
            },
          ],
        },
      ],
      transaction,
    });

    if (!reservation) {
      throw new Error("Reserva no encontrada");
    }

    if (new Date() > new Date(reservation.expires_at)) {
      throw new Error("La reserva ha expirado");
    }

    const activeStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    if (reservation.status_id !== activeStatus.id) {
      throw new Error("La reserva no está activa");
    }

    // Obtener seat_ids de la reserva
    const seatIds = reservation.reservation_seats.map(rs => rs.seat_id);
    const concertSeatIds = reservation.reservation_seats.map(rs => rs.concert_seat_id);

    // =============================================
    // 🆕 VALIDAR QUE NO ESTÉ EN carrito
    // =============================================
    console.log('🔍 [RabbitMQ] Verificando disponibilidad en carrito...');
    
    const queueStatus = await checkSeatsInQueue('carrito', seatIds);
    
    if (!queueStatus.canProceed) {
      await transaction.rollback();
      throw new Error(
        `Los siguientes asientos ya están en proceso de pago: ${queueStatus.inQueue.join(', ')}. ` +
        `No se puede crear otra orden con estos asientos.`
      );
    }
    
    console.log('✅ [RabbitMQ] Asientos disponibles para crear orden');

    // =============================================
    // 2. OBTENER CONCIERTO
    // =============================================
    const concert = await Concert.findByPk(reservation.concert_id, { transaction });
    if (!concert) {
      throw new Error("Concierto no encontrado");
    }

    // =============================================
    // 3. OBTENER TICKET TYPE (USANDO SECTION_ID DEL PRIMER ASIENTO)
    // =============================================
    // ✅ CORREGIDO: Obtener section_id directamente del seat
    const firstSeat = reservation.reservation_seats[0]?.seat;
    
    if (!firstSeat || !firstSeat.section_id) {
      throw new Error("No se pudo obtener la sección de los asientos reservados");
    }

    const ticketType = await TicketType.findOne({
      where: {
        concert_id: reservation.concert_id,
        section_id: firstSeat.section_id,  // ✅ Ahora section_id está definido
      },
      transaction,
    });

    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado para esta sección");
    }

    // =============================================
    // 4. CALCULAR TOTAL
    // =============================================
    const quantity = reservation.reservation_seats.length;
    const total = ticketType.price * quantity;

    // =============================================
    // 5. CREAR ORDEN
    // =============================================
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    const order = await Order.create(
      {
        user_id: userId,
        concert_id: reservation.concert_id,
        reservation_id: reservation_id,
        status_id: pendingStatus.id,
        total,
      },
      { transaction }
    );

    // =============================================
    // 6. CREAR ORDER_ITEMS
    // =============================================
    await OrderItem.create(
      {
        order_id: order.id,
        ticket_type_id: ticketType.id,
        quantity,
        unit_price: ticketType.price,
      },
      { transaction }
    );

    // =============================================
    // 7. CREAR ORDER_SEATS
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

    await transaction.commit();

    // =============================================
    // 🆕 OPERACIONES CON RABBITMQ (DESPUÉS DE COMMIT)
    // =============================================
    
    // 1️⃣ LIBERAR DE reserva
    try {
      console.log('🗑️ [RabbitMQ] Liberando asientos de reserva...');
      const removeResult = await removeSeatsFromQueue(
        'reserva',
        seatIds,
        reservation_id
      );
      console.log(`✅ [RabbitMQ] ${removeResult.removed} reservas liberadas de reserva`);
    } catch (error) {
      console.error('⚠️ [RabbitMQ] Error liberando de reserva:', error);
    }

    // 2️⃣ PUBLICAR EN carrito
    try {
      const cartMessage = {
        action: "ORDER_CREATED",
        orderId: order.id,
        userId: userId,
        concertId: reservation.concert_id,
        reservationId: reservation_id,
        seatIds: seatIds,
        concertSeatIds: concertSeatIds,
        ticketTypeId: ticketType.id,
        quantity: quantity,
        total: total,
        timestamp: new Date().toISOString(),
      };

      await publishToQueue('carrito', cartMessage);
      console.log('✅ [RabbitMQ] Orden publicada en carrito');
    } catch (error) {
      console.error('⚠️ [RabbitMQ] Error publicando en carrito:', error);
    }

    // =============================================
    // 8. RETORNAR RESPUESTA
    // =============================================
    return {
      message: "Orden creada. Procede a confirmar el pago.",
      order: {
        id: order.id,
        user_id: userId,
        concert_id: reservation.concert_id,
        reservation_id: reservation_id,
        status_id: pendingStatus.id,
        total,
      },
      total,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Confirmar orden (procesar pago)
 */
// ================================================
// ORDER SERVICE - CONFIRM ORDER
// ================================================

const confirmOrder = async (orderId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findOne({
      where: { id: orderId },
      include: [
        {
          model: OrderSeat,
          as: "order_seats",
          include: [
            { model: Seat, as: "seat" },
            { model: ConcertSeat, as: "concert_seat" },
          ],
        },
        {
          model: OrderItem,
          as: "items",  // ✅ CORREGIDO: es "items", no "order_items"
        },
      ],
      transaction,
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    if (order.user_id !== userId) {
      throw new Error("No tienes permiso para confirmar esta orden");
    }

    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    if (order.status_id !== pendingStatus.id) {
      throw new Error("La orden ya fue procesada");
    }

    const seatIds = order.order_seats.map(os => os.seat_id);

    const occupiedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "occupied" },
      transaction,
    });

    for (const orderSeat of order.order_seats) {
      await ConcertSeat.update(
        { status_id: occupiedStatus.id },
        { where: { id: orderSeat.concert_seat_id }, transaction }
      );
    }

    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "confirmed" },
      transaction,
    });

    await order.update({ status_id: confirmedStatus.id }, { transaction });

    const issuedTicketStatus = await StatusGeneral.findOne({
      where: { dominio: "ticket", descripcion: "issued" },
      transaction,
    });

    const tickets = [];
    let ticketIndex = 1;

    for (const orderSeat of order.order_seats) {
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const ticketCode = `TCK-${order.id}-${ticketIndex}-${randomCode}`;

      const ticket = await Ticket.create(
        {
          order_id: order.id,
          ticket_type_id: order.items[0]?.ticket_type_id,  // ✅ CORREGIDO: order.items
          seat_id: orderSeat.seat_id,
          code: ticketCode,
          status_id: issuedTicketStatus.id,
        },
        { transaction }
      );

      tickets.push({
        id: ticket.id,
        code: ticket.code,
        seat: { seat_number: orderSeat.seat?.seat_number },
        status: "issued",
      });

      ticketIndex++;
    }

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

    await transaction.commit();

    try {
      console.log('🗑️ [RabbitMQ] Liberando asientos de CARRITO_QUEUE...');
      const removeResult = await removeSeatsFromQueue('CARRITO_QUEUE', seatIds, orderId);
      console.log(`✅ [RabbitMQ] ${removeResult.removed} órdenes liberadas de CARRITO_QUEUE`);
    } catch (error) {
      console.error('⚠️ [RabbitMQ] Error liberando de CARRITO_QUEUE:', error);
    }

    try {
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
      await publishToQueue('NOTIFICATIONS_QUEUE', paymentCompleteMessage);
      console.log('📨 [RabbitMQ] Notificación de pago publicada');
    } catch (error) {
      console.error('⚠️ [RabbitMQ] Error publicando notificación:', error);
    }

    return {
      message: "¡Pago confirmado! Tus tickets han sido generados.",
      order: {
        id: order.id,
        status: { descripcion: confirmedStatus.descripcion },
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
    throw error;
  }
}


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