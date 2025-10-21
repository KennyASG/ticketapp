const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Ticket = require("../models/Ticket");
const Payment = require("../models/Payment");
const Reservation = require("../models/Reservation");
const TicketType = require("../models/TicketType");
const ConcertSeat = require("../models/ConcertSeat");
const StatusGeneral = require("../models/StatusGeneral");
const sequelize = require("../db");
const { generateTicketCode } = require("../utils/codeGenerator");
const { Op } = require("sequelize");

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

    // 1. Verificar que la reserva existe, pertenece al usuario y está activa
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
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

    // 2. Verificar que no haya expirado
    if (new Date() > new Date(reservation.expires_at)) {
      throw new Error("La reserva ha expirado");
    }

    // 3. Obtener ticket type y calcular total
    const ticketType = await TicketType.findByPk(ticket_type_id, {
      transaction,
    });

    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado");
    }

    const total = ticketType.price * quantity;

    // 4. Obtener status 'pending' para orders
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
    });

    // 5. Crear orden
    const order = await Order.create(
      {
        user_id: userId,
        concert_id: reservation.concert_id,
        status_id: pendingStatus.id,
        total,
      },
      { transaction }
    );

    // 6. Crear order items
    await OrderItem.create(
      {
        order_id: order.id,
        ticket_type_id,
        seat_id: null, // Se asignarán al confirmar
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
    // 1. Obtener orden
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
      transaction,
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    // 2. Verificar que esté pending
    const pendingStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "pending" },
    });

    if (order.status_id !== pendingStatus.id) {
      throw new Error("La orden ya fue procesada");
    }

    // 3. Obtener order items
    const orderItems = await OrderItem.findAll({
      where: { order_id: orderId },
      transaction,
    });

    if (orderItems.length === 0) {
      throw new Error("Orden sin items");
    }

    // 4. Simular pago
    const paymentCapturedStatus = await StatusGeneral.findOne({
      where: { dominio: "payment", descripcion: "captured" },
    });

    const payment = await Payment.create(
      {
        order_id: orderId,
        provider: "mock",
        amount: order.total,
        status_id: paymentCapturedStatus.id,
      },
      { transaction }
    );

    // Simular fallo aleatorio (10% de probabilidad)
    const shouldFail = Math.random() < 0.1;
    if (shouldFail) {
      const failedStatus = await StatusGeneral.findOne({
        where: { dominio: "payment", descripcion: "failed" },
      });

      payment.status_id = failedStatus.id;
      await payment.save({ transaction });

      const orderFailedStatus = await StatusGeneral.findOne({
        where: { dominio: "order", descripcion: "failed" },
      });

      order.status_id = orderFailedStatus.id;
      await order.save({ transaction });

      await transaction.commit();
      throw new Error("El pago fue rechazado");
    }

    // 5. Pago exitoso - Confirmar orden
    const confirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "order", descripcion: "confirmed" },
    });

    order.status_id = confirmedStatus.id;
    await order.save({ transaction });

    // 6. Generar tickets con códigos únicos
    const ticketIssuedStatus = await StatusGeneral.findOne({
      where: { dominio: "ticket", descripcion: "issued" },
    });

    const occupiedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "occupied" },
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
        });

        // Obtener asientos reservados
        assignedSeats = await sequelize.query(
          `
          SELECT cs.id, cs.seat_id
          FROM concert_seats cs
          INNER JOIN seats s ON s.id = cs.seat_id
          WHERE cs.concert_id = :concertId
            AND s.section_id = :sectionId
            AND cs.status_id = :reservedStatusId
          LIMIT :quantity
          `,
          {
            replacements: {
              concertId: order.concert_id,
              sectionId: ticketType.section_id,
              reservedStatusId: reservedStatus.id,
              quantity: item.quantity,
            },
            type: sequelize.QueryTypes.SELECT,
            transaction,
          }
        );

        // Marcar asientos como ocupados
        const seatIds = assignedSeats.map((s) => s.id);
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

    // 7. Confirmar reserva
    const reservationConfirmedStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "confirmed" },
    });

    await Reservation.update(
      { status_id: reservationConfirmedStatus.id },
      {
        where: { concert_id: order.concert_id, user_id: userId },
        transaction,
      }
    );

    await transaction.commit();

    // 8. Trigger notificación (llamada externa)
    // TODO: Llamar a NOTIFICATIONS service
    // await notifyUser(userId, orderId);

    return {
      order,
      payment,
      tickets,
      message: "Compra confirmada exitosamente",
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

    const sales = await sequelize.query(
      `
      SELECT 
        o.id as order_id,
        o.user_id,
        o.total,
        o.created_at,
        COUNT(t.id) as tickets_count
      FROM orders o
      LEFT JOIN tickets t ON t.order_id = o.id
      WHERE o.concert_id = :concertId
        AND o.status_id = :confirmedStatusId
      GROUP BY o.id
      ORDER BY o.created_at DESC
      `,
      {
        replacements: {
          concertId,
          confirmedStatusId: confirmedStatus.id,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTickets = sales.reduce(
      (sum, sale) => sum + parseInt(sale.tickets_count),
      0
    );

    return {
      concert_id: concertId,
      total_orders: sales.length,
      total_tickets: totalTickets,
      total_revenue: totalRevenue,
      sales,
    };
  } catch (error) {
    throw new Error("Error al obtener ventas: " + error.message);
  }
};

/**
 * Obtener detalle de una orden
 */
const getOrderById = async (orderId, userId, isAdmin = false) => {
  try {
    const whereClause = isAdmin ? { id: orderId } : { id: orderId, user_id: userId };
    
    const order = await Order.findOne({
      where: whereClause,
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    // Obtener items
    const items = await OrderItem.findAll({
      where: { order_id: orderId },
    });

    // Obtener tickets
    const tickets = await Ticket.findAll({
      where: { order_id: orderId },
    });

    // Obtener payment
    const payment = await Payment.findOne({
      where: { order_id: orderId },
    });

    return {
      order,
      items,
      tickets,
      payment,
    };
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