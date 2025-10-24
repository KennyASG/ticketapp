const {
  TicketType,
  Reservation,
  Concert,
  StatusGeneral,
  ConcertSeat,
  Seat,
  VenueSection,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

/**
 * Obtener tipos de tickets de un concierto
 */
const getTicketTypesByConcert = async (concertId) => {
  try {
    const ticketTypes = await TicketType.findAll({
      where: { concert_id: concertId },
      include: [
        {
          model: VenueSection,
          as: "section",
          attributes: ["id", "name"],
        },
      ],
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

    if (!name || price === undefined || !available) {
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
 */
const createReservation = async (userId, data) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { concert_id, ticket_type_id, quantity } = data;

    if (!concert_id || !ticket_type_id || !quantity || quantity <= 0) {
      throw new Error("Datos de reserva inválidos");
    }

    // Verificar disponibilidad
    const ticketType = await TicketType.findByPk(ticket_type_id, {
      include: [
        {
          model: Concert,
          as: "concert",
          attributes: ["id", "title", "date"],
        },
      ],
      transaction,
    });

    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado");
    }

    if (ticketType.available < quantity) {
      throw new Error(`Solo hay ${ticketType.available} tickets disponibles`);
    }

    // Obtener status 'held'
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    if (!heldStatus) {
      throw new Error("Estado 'held' no encontrado");
    }

    // Verificar reservas activas del usuario
    const activeReservation = await Reservation.findOne({
      where: {
        user_id: userId,
        concert_id,
        status_id: heldStatus.id,
        expires_at: { [Op.gt]: new Date() },
      },
      transaction,
    });

    if (activeReservation) {
      throw new Error("Ya tienes una reserva activa para este concierto");
    }

    // Crear reserva (expira en 15 minutos)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const reservation = await Reservation.create(
      {
        user_id: userId,
        concert_id,
        status_id: heldStatus.id,
        expires_at: expiresAt,
      },
      { transaction }
    );

    // Reducir disponibilidad
    await ticketType.decrement("available", {
      by: quantity,
      transaction,
    });

    // Si el ticket tiene sección, reservar asientos
    if (ticketType.section_id) {
      const availableStatus = await StatusGeneral.findOne({
        where: { dominio: "seat", descripcion: "available" },
        transaction,
      });

      const reservedStatus = await StatusGeneral.findOne({
        where: { dominio: "seat", descripcion: "reserved" },
        transaction,
      });

      // Obtener asientos disponibles de la sección
      const availableSeats = await ConcertSeat.findAll({
        where: {
          concert_id,
          status_id: availableStatus.id,
        },
        include: [
          {
            model: Seat,
            as: "seat",
            where: { section_id: ticketType.section_id },
            required: true,
          },
        ],
        limit: quantity,
        transaction,
      });

      if (availableSeats.length < quantity) {
        throw new Error("No hay suficientes asientos disponibles en esta sección");
      }

      // Marcar asientos como reservados
      const seatIds = availableSeats.map((cs) => cs.id);
      await ConcertSeat.update(
        { status_id: reservedStatus.id },
        {
          where: { id: seatIds },
          transaction,
        }
      );
    }

    await transaction.commit();

    // Recargar reserva con relaciones
    const createdReservation = await Reservation.findByPk(reservation.id, {
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
      ],
    });

    return {
      reservation: createdReservation,
      ticket_type: ticketType,
      quantity,
      expires_at: expiresAt,
      message: "Reserva creada exitosamente. Tienes 15 minutos para completar la compra.",
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear reserva: " + error.message);
  }
};

/**
 * Obtener reservas de un usuario
 */
const getUserReservations = async (userId) => {
  try {
    const reservations = await Reservation.findAll({
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
      ],
      order: [["created_at", "DESC"]],
    });

    return reservations;
  } catch (error) {
    throw new Error("Error al obtener reservas: " + error.message);
  }
};

/**
 * Liberar reservas expiradas (Admin/Cron)
 */
const releaseExpiredReservations = async () => {
  const transaction = await sequelize.transaction();

  try {
    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    const expiredStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "expired" },
      transaction,
    });

    // Encontrar reservas expiradas
    const expiredReservations = await Reservation.findAll({
      where: {
        status_id: heldStatus.id,
        expires_at: { [Op.lt]: new Date() },
      },
      include: [
        {
          model: Concert,
          as: "concert",
          attributes: ["id"],
        },
      ],
      transaction,
    });

    if (expiredReservations.length === 0) {
      await transaction.commit();
      return { message: "No hay reservas expiradas", released: 0 };
    }

    // Liberar asientos reservados
    const availableStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "available" },
      transaction,
    });

    const reservedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "reserved" },
      transaction,
    });

    for (const reservation of expiredReservations) {
      // Liberar asientos
      await ConcertSeat.update(
        { status_id: availableStatus.id },
        {
          where: {
            concert_id: reservation.concert_id,
            status_id: reservedStatus.id,
          },
          transaction,
        }
      );

      // Marcar reserva como expirada
      await reservation.update({ status_id: expiredStatus.id }, { transaction });
    }

    await transaction.commit();

    return {
      message: "Reservas expiradas liberadas correctamente",
      released: expiredReservations.length,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al liberar reservas: " + error.message);
  }
};

module.exports = {
  getTicketTypesByConcert,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  createReservation,
  getUserReservations,
  releaseExpiredReservations,
};