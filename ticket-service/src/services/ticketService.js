const TicketType = require("../models/TicketType");
const Reservation = require("../models/Reservation");
const ConcertSeat = require("../models/ConcertSeat");
const StatusGeneral = require("../models/StatusGeneral");
const sequelize = require("../db");
const { Op } = require("sequelize");

/**
 * Obtener tipos de tickets de un concierto
 */
const getTicketTypesByConcert = async (concertId) => {
  try {
    const ticketTypes = await TicketType.findAll({
      where: { concert_id: concertId },
      order: [["price", "ASC"]],
    });
    return ticketTypes;
  } catch (error) {
    throw new Error("Error al obtener tipos de tickets: " + error.message);
  }
};

/**
 * Crear tipo de ticket (Admin)
 */
const createTicketType = async (concertId, data) => {
  try {
    const { section_id, name, price, available } = data;

    if (!name || !price || !available) {
      throw new Error("Faltan campos obligatorios");
    }

    const newTicketType = await TicketType.create({
      concert_id: concertId,
      section_id: section_id || null,
      name,
      price,
      available,
    });

    return newTicketType;
  } catch (error) {
    throw new Error("Error al crear tipo de ticket: " + error.message);
  }
};

/**
 * Actualizar tipo de ticket (Admin)
 */
const updateTicketType = async (id, data) => {
  try {
    const ticketType = await TicketType.findByPk(id);
    if (!ticketType) throw new Error("Tipo de ticket no encontrado");

    await ticketType.update(data);
    return ticketType;
  } catch (error) {
    throw new Error("Error al actualizar tipo de ticket: " + error.message);
  }
};

/**
 * Eliminar tipo de ticket (Admin)
 */
const deleteTicketType = async (id) => {
  try {
    const ticketType = await TicketType.findByPk(id);
    if (!ticketType) throw new Error("Tipo de ticket no encontrado");

    await ticketType.destroy();
    return { message: "Tipo de ticket eliminado correctamente" };
  } catch (error) {
    throw new Error("Error al eliminar tipo de ticket: " + error.message);
  }
};

/**
 * Crear reserva temporal
 * Este es el core del sistema de tickets
 */
const createReservation = async (userId, data) => {
  const transaction = await sequelize.transaction();
  try {
    const { concert_id, ticket_type_id, quantity } = data;

    if (!concert_id || !ticket_type_id || !quantity || quantity <= 0) {
      throw new Error("Datos de reserva inválidos");
    }

    // 1. Verificar disponibilidad
    const ticketType = await TicketType.findByPk(ticket_type_id);
    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado");
    }

    if (ticketType.available < quantity) {
      throw new Error(
        `Solo hay ${ticketType.available} tickets disponibles`
      );
    }

    // 2. Obtener status 'held' para reservations
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
    });

    if (!heldStatus) {
      throw new Error("Estado de reserva no encontrado");
    }

    // 3. Calcular tiempo de expiración
    const expiryMinutes = parseInt(
      process.env.RESERVATION_EXPIRY_MINUTES || 15
    );
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // 4. Crear reserva
    const reservation = await Reservation.create(
      {
        user_id: userId,
        concert_id,
        status_id: heldStatus.id,
        expires_at: expiresAt,
      },
      { transaction }
    );

    // 5. Decrementar disponibilidad
    ticketType.available -= quantity;
    await ticketType.save({ transaction });

    // 6. Si hay section_id, marcar asientos como reservados
    if (ticketType.section_id) {
      const reservedStatus = await StatusGeneral.findOne({
        where: { dominio: "seat", descripcion: "reserved" },
      });

      // Obtener asientos disponibles de la sección
      const availableSeats = await sequelize.query(
        `
        SELECT cs.id, cs.seat_id
        FROM concert_seats cs
        INNER JOIN seats s ON s.id = cs.seat_id
        WHERE cs.concert_id = :concertId
          AND s.section_id = :sectionId
          AND cs.status_id = (
            SELECT id FROM status_generales 
            WHERE dominio = 'seat' AND descripcion = 'available'
          )
        LIMIT :quantity
        `,
        {
          replacements: {
            concertId: concert_id,
            sectionId: ticketType.section_id,
            quantity,
          },
          type: sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      if (availableSeats.length < quantity) {
        throw new Error("No hay suficientes asientos disponibles");
      }

      // Marcar asientos como reservados
      const seatIds = availableSeats.map((s) => s.id);
      await ConcertSeat.update(
        { status_id: reservedStatus.id },
        {
          where: { id: seatIds },
          transaction,
        }
      );
    }

    await transaction.commit();

    return {
      reservation,
      ticket_type: ticketType,
      quantity,
      expires_at: expiresAt,
      message: `Reserva creada. Expira en ${expiryMinutes} minutos`,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear reserva: " + error.message);
  }
};

/**
 * Liberar reservas expiradas
 * Se debe ejecutar periódicamente (cron job)
 */
const releaseExpiredReservations = async () => {
  const transaction = await sequelize.transaction();
  try {
    const now = new Date();

    // Buscar reservas expiradas
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
    });

    const expiredReservations = await Reservation.findAll({
      where: {
        status_id: heldStatus.id,
        expires_at: { [Op.lt]: now },
      },
      transaction,
    });

    if (expiredReservations.length === 0) {
      await transaction.commit();
      return { message: "No hay reservas expiradas", count: 0 };
    }

    // Obtener status
    const expiredStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "expired" },
    });

    const availableStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "available" },
    });

    let releasedCount = 0;

    for (const reservation of expiredReservations) {
      // Actualizar estado de reserva
      reservation.status_id = expiredStatus.id;
      await reservation.save({ transaction });

      // Liberar asientos
      await sequelize.query(
        `
        UPDATE concert_seats
        SET status_id = :availableStatusId
        WHERE concert_id = :concertId
          AND status_id = (
            SELECT id FROM status_generales 
            WHERE dominio = 'seat' AND descripcion = 'reserved'
          )
        `,
        {
          replacements: {
            availableStatusId: availableStatus.id,
            concertId: reservation.concert_id,
          },
          type: sequelize.QueryTypes.UPDATE,
          transaction,
        }
      );

      releasedCount++;
    }

    await transaction.commit();

    return {
      message: `${releasedCount} reservas expiradas liberadas`,
      count: releasedCount,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al liberar reservas: " + error.message);
  }
};

/**
 * Obtener reservas de un usuario
 */
const getUserReservations = async (userId) => {
  try {
    const reservations = await Reservation.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });
    return reservations;
  } catch (error) {
    throw new Error("Error al obtener reservas: " + error.message);
  }
};

module.exports = {
  getTicketTypesByConcert,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  createReservation,
  releaseExpiredReservations,
  getUserReservations,
};