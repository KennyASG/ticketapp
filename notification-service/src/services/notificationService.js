const {
  Notification,
  User,
  Order,
  Concert,
  Ticket,
  StatusGeneral,
  sequelize,
} = require("../models");

// Nota: Estas funciones debes implementarlas en tu proyecto
// const { createTransporter } = require("../utils/emailTransporter");
// const { generateTicketsPDF } = require("../utils/pdfGenerator");
// const { ticketsEmailTemplate, confirmationEmailTemplate } = require("../utils/emailTemplates");

/**
 * Enviar tickets por email
 */
const sendTickets = async (orderId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Obtener datos de la orden con relaciones
    const order = await Order.findByPk(orderId, {
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
          model: Ticket,
          as: "tickets",
          attributes: ["id", "code", "seat_id"],
        },
      ],
      transaction,
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    if (!order.tickets || order.tickets.length === 0) {
      throw new Error("No se encontraron tickets para esta orden");
    }

    // Aquí deberías implementar:
    // 1. Generar PDF con los tickets
    // 2. Preparar email con template
    // 3. Enviar email con PDF adjunto
    
    // Ejemplo simplificado:
    console.log(`Enviando ${order.tickets.length} tickets a ${order.user.email}`);
    console.log(`Concierto: ${order.concert.title}`);
    console.log(`Tickets:`, order.tickets.map(t => t.code));

    // Registrar notificación
    const sentStatus = await StatusGeneral.findOne({
      where: { dominio: "notification", descripcion: "sent" },
      transaction,
    });

    const notification = await Notification.create(
      {
        user_id: order.user_id,
        order_id: orderId,
        type: "send_tickets",
        status_id: sentStatus.id,
      },
      { transaction }
    );

    await transaction.commit();

    return {
      success: true,
      notification,
      message: `Tickets enviados a ${order.user.email}`,
    };
  } catch (error) {
    await transaction.rollback();

    // Registrar fallo
    try {
      const failedStatus = await StatusGeneral.findOne({
        where: { dominio: "notification", descripcion: "failed" },
      });

      if (failedStatus) {
        await Notification.create({
          user_id: 0,
          order_id: orderId,
          type: "send_tickets",
          status_id: failedStatus.id,
        });
      }
    } catch (logError) {
      console.error("Error registrando fallo:", logError);
    }

    throw new Error("Error al enviar tickets: " + error.message);
  }
};

/**
 * Enviar confirmación de compra
 */
const sendConfirmation = async (orderId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Obtener datos de la orden
    const order = await Order.findByPk(orderId, {
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
      ],
      transaction,
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    // Aquí deberías implementar:
    // 1. Preparar email de confirmación
    // 2. Enviar email

    // Ejemplo simplificado:
    console.log(`Enviando confirmación a ${order.user.email}`);
    console.log(`Orden #${orderId} - Total: ${order.total}`);
    console.log(`Concierto: ${order.concert.title}`);

    // Registrar notificación
    const sentStatus = await StatusGeneral.findOne({
      where: { dominio: "notification", descripcion: "sent" },
      transaction,
    });

    const notification = await Notification.create(
      {
        user_id: order.user_id,
        order_id: orderId,
        type: "send_confirmation",
        status_id: sentStatus.id,
      },
      { transaction }
    );

    await transaction.commit();

    return {
      success: true,
      notification,
      message: `Confirmación enviada a ${order.user.email}`,
    };
  } catch (error) {
    await transaction.rollback();

    // Registrar fallo
    try {
      const failedStatus = await StatusGeneral.findOne({
        where: { dominio: "notification", descripcion: "failed" },
      });

      if (failedStatus) {
        await Notification.create({
          user_id: 0,
          order_id: orderId,
          type: "send_confirmation",
          status_id: failedStatus.id,
        });
      }
    } catch (logError) {
      console.error("Error registrando fallo:", logError);
    }

    throw new Error("Error al enviar confirmación: " + error.message);
  }
};

/**
 * Obtener historial de notificaciones
 */
const getNotifications = async (options = {}) => {
  const { userId, orderId, type, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  try {
    const whereClause = {};
    if (userId) whereClause.user_id = userId;
    if (orderId) whereClause.order_id = orderId;
    if (type) whereClause.type = type;

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        {
          model: Order,
          as: "order",
          attributes: ["id", "total"],
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
      notifications,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    throw new Error("Error al obtener notificaciones: " + error.message);
  }
};

module.exports = {
  sendTickets,
  sendConfirmation,
  getNotifications,
};