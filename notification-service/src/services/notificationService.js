const Notification = require("../models/Notification");
const StatusGeneral = require("../models/StatusGeneral");
const sequelize = require("../db");
const { createTransporter } = require("../utils/emailTransporter");
const { generateTicketsPDF } = require("../utils/pdfGenerator");
const {
  ticketsEmailTemplate,
  confirmationEmailTemplate,
} = require("../utils/emailTemplates");

/**
 * Enviar tickets por email
 */
const sendTickets = async (orderId) => {
  const transaction = await sequelize.transaction();
  try {
    // 1. Obtener datos de la orden
    const orderData = await sequelize.query(
      `
      SELECT 
        o.id,
        o.user_id,
        o.total,
        u.name as user_name,
        u.email as user_email,
        c.title as concert_title,
        c.date as concert_date,
        v.name as venue_name
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      INNER JOIN concerts c ON c.id = o.concert_id
      LEFT JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
      LEFT JOIN venues v ON v.id = cvd.venue_id
      WHERE o.id = :orderId
      LIMIT 1
      `,
      {
        replacements: { orderId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (!orderData || orderData.length === 0) {
      throw new Error("Orden no encontrada");
    }

    const order = orderData[0];

    // 2. Obtener tickets de la orden
    const tickets = await sequelize.query(
      `
      SELECT 
        t.id,
        t.code,
        tt.name as type_name,
        tt.price,
        s.seat_number,
        vs.name as section_name
      FROM tickets t
      INNER JOIN ticket_types tt ON tt.id = t.ticket_type_id
      LEFT JOIN seats s ON s.id = t.seat_id
      LEFT JOIN venue_sections vs ON vs.id = s.section_id
      WHERE t.order_id = :orderId
      ORDER BY t.id
      `,
      {
        replacements: { orderId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (!tickets || tickets.length === 0) {
      throw new Error("No se encontraron tickets para esta orden");
    }

    // 3. Generar PDF con los tickets
    const concertData = {
      title: order.concert_title,
      date: order.concert_date,
      venue: order.venue_name || "Por confirmar",
    };

    const pdfBuffer = await generateTicketsPDF(
      order,
      concertData,
      tickets
    );

    // 4. Preparar email
    const emailHTML = ticketsEmailTemplate(
      order.user_name,
      order.concert_title,
      order,
      tickets.length
    );

    // 5. Enviar email con PDF adjunto
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: order.user_email,
      subject: `🎫 Tus tickets para ${order.concert_title}`,
      html: emailHTML,
      attachments: [
        {
          filename: `tickets-order-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    // 6. Registrar notificación
    const sentStatus = await StatusGeneral.findOne({
      where: { dominio: "notification", descripcion: "sent" },
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
      message: `Tickets enviados a ${order.user_email}`,
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
          user_id: 0, // Sistema
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
    // 1. Obtener datos de la orden
    const orderData = await sequelize.query(
      `
      SELECT 
        o.id,
        o.user_id,
        o.total,
        u.name as user_name,
        u.email as user_email,
        c.title as concert_title
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      INNER JOIN concerts c ON c.id = o.concert_id
      WHERE o.id = :orderId
      LIMIT 1
      `,
      {
        replacements: { orderId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (!orderData || orderData.length === 0) {
      throw new Error("Orden no encontrada");
    }

    const order = orderData[0];

    // 2. Preparar email de confirmación
    const emailHTML = confirmationEmailTemplate(
      order.user_name,
      order.concert_title,
      order
    );

    // 3. Enviar email
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: order.user_email,
      subject: `✅ Confirmación de compra - Orden #${orderId}`,
      html: emailHTML,
    };

    await transporter.sendMail(mailOptions);

    // 4. Registrar notificación
    const sentStatus = await StatusGeneral.findOne({
      where: { dominio: "notification", descripcion: "sent" },
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
      message: `Confirmación enviada a ${order.user_email}`,
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
const getNotifications = async (userId = null) => {
  try {
    const whereClause = userId ? { user_id: userId } : {};

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      limit: 100,
    });

    return notifications;
  } catch (error) {
    throw new Error("Error al obtener notificaciones: " + error.message);
  }
};

module.exports = {
  sendTickets,
  sendConfirmation,
  getNotifications,
};