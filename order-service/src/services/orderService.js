const {
  Order,
  OrderItem,
  Ticket,
  Payment,
  Reservation,
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
 * Crear orden a partir de una reserva
 */
const createOrder = async (userId, data) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { reservation_id, ticket_type_id, quantity } = data;

    if (!reservation_id || !ticket_type_id || !quantity) {
      throw new Error("Datos de orden inválidos");
    }

    // Verificar que la reserva existe y pertenece al usuario
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
      transaction,
    });

    if (!reservation) {
      throw new Error("Reserva no encontrada o ya expiró");
    }

    if (new Date() > new Date(reservation.expires_at)) {
      throw new Error("La reserva ha expirado");
    }

    // Obtener ticket type y calcular total
    const ticketType = await TicketType.findByPk(ticket_type_id, {
      transaction,
    });

    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado");
    }

    const total = ticketType.price * quantity;

    // Obtener status 'pending' para orders
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
      transaction,
    });

    // Crear orden
    const order = await Order.create(
      {
        user_id: userId,
        concert_id: reservation.concert_id,
        status_id: pendingStatus.id,
        total,
      },
      { transaction }
    );

    // Crear order items
    await OrderItem.create(
      {
        order_id: order.id,
        ticket_type_id,
        seat_id: null,
        quantity,
        unit_price: ticketType.price,
      },
      { transaction }
    );

    await transaction.commit();

    return {
      order,
      total,
      message: "Orden creada. Procede a confirmar el pago.",
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear orden: " + error.message);
  }
};

/**
 * Confirmar orden y procesar pago (simulado)
 */
const confirmOrder = async (orderId, userId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar que la orden existe y pertenece al usuario
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
      transaction,
    });

    if (!order) {
      throw new Error("Orden no encontrada o ya fue procesada");
    }

    // Obtener order items
    const orderItems = await OrderItem.findAll({
      where: { order_id: orderId },
      transaction,
    });

    // Simular pago
    const capturedStatus = await StatusGeneral.findOne({
      where: { dominio: "payment", descripcion: "captured" },
      transaction,
    });

    await Payment.create(
      {
        order_id: orderId,
        provider: "mock",
        amount: order.total,
        status_id: capturedStatus.id,
      },
      { transaction }
    );

    // Confirmar orden
    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "confirmed" },
      transaction,
    });

    order.status_id = confirmedStatus.id;
    await order.save({ transaction });

    // Generar tickets con códigos únicos
    const ticketIssuedStatus = await StatusGeneral.findOne({
      where: { dominio: "ticket", descripcion: "issued" },
      transaction,
    });

    const occupiedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "occupied" },
      transaction,
    });

    const tickets = [];
    let ticketNumber = 1;

    for (const item of orderItems) {
      const ticketType = await TicketType.findByPk(item.ticket_type_id, {
        transaction,
      });

      // Si tiene section_id, asignar asientos específicos
      let assignedSeats = [];
      if (ticketType.section_id) {
        const reservedStatus = await StatusGeneral.findOne({
          where: { dominio: "seat", descripcion: "reserved" },
          transaction,
        });

        // Obtener asientos reservados
        const concertSeats = await ConcertSeat.findAll({
          where: {
            concert_id: order.concert_id,
            status_id: reservedStatus.id,
          },
          include: [
            {
              model: Seat,
              as: "seat",
              where: { section_id: ticketType.section_id },
              required: true,
            },
          ],
          limit: item.quantity,
          transaction,
        });

        assignedSeats = concertSeats;

        // Marcar asientos como ocupados
        const seatIds = assignedSeats.map((cs) => cs.id);
        await ConcertSeat.update(
          { status_id: occupiedStatus.id },
          {
            where: { id: seatIds },
            transaction,
          }
        );
      }

      // Crear tickets
      for (let i = 0; i < item.quantity; i++) {
        const code = generateTicketCode(orderId, ticketNumber);
        const seatId = assignedSeats[i] ? assignedSeats[i].seat_id : null;

        const ticket = await Ticket.create(
          {
            order_id: orderId,
            ticket_type_id: item.ticket_type_id,
            seat_id: seatId,
            code,
            status_id: ticketIssuedStatus.id,
          },
          { transaction }
        );

        tickets.push(ticket);
        ticketNumber++;
      }
    }

    // Confirmar reserva
    const reservationConfirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "confirmed" },
      transaction,
    });

    await Reservation.update(
      { status_id: reservationConfirmedStatus.id },
      {
        where: { concert_id: order.concert_id, user_id: userId },
        transaction,
      }
    );

    await transaction.commit();

    // Recargar orden con relaciones
    const confirmedOrder = await Order.findByPk(orderId, {
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
          attributes: ["id", "code"],
        },
      ],
    });

    return {
      order: confirmedOrder,
      tickets,
      message: "Orden confirmada exitosamente",
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al confirmar orden: " + error.message);
  }
};

/**
 * Obtener órdenes de un usuario
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
          attributes: ["id", "code"],
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
const getAllOrders = async (options = {}) => {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  try {
    const { count, rows: orders } = await Order.findAndCountAll({
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
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      orders,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
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
          model: Ticket,
          as: "tickets",
          attributes: ["id", "code"],
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
      ],
      order: [["created_at", "DESC"]],
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalTickets = orders.reduce(
      (sum, order) => sum + order.tickets.length,
      0
    );

    return {
      concert_id: concertId,
      total_orders: orders.length,
      total_tickets: totalTickets,
      total_revenue: totalRevenue,
      orders: orders.map((order) => ({
        id: order.id,
        user: order.user,
        total: order.total,
        tickets_count: order.tickets.length,
        items: order.items,
        created_at: order.created_at,
      })),
    };
  } catch (error) {
    throw new Error("Error al obtener ventas: " + error.message);
  }
};

/**
 * Obtener orden por ID
 */
const getOrderById = async (orderId, userId = null) => {
  try {
    const whereClause = userId ? { id: orderId, user_id: userId } : { id: orderId };

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
          attributes: ["id", "code", "seat_id"],
        },
        {
          model: Payment,
          as: "payment",
          attributes: ["id", "provider", "amount"],
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