const {
  TicketType,
  Reservation,
  ReservationSeat,
  Concert,
  User,
  StatusGeneral,
  ConcertSeat,
  Seat,
  VenueSection,
  sequelize,
} = require("../models");  // ← Importar desde index.js
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
 * HELPER: Validar disponibilidad de asientos según matriz de estados
 */
const validateSeatAvailability = async (concertId, seatIds, userId, transaction) => {
  const results = {
    available: [],
    blocked: [],
    warnings: [],
  };

  // Obtener estados
  const availableStatus = await StatusGeneral.findOne({
    where: { dominio: "seat", descripcion: "available" },
    transaction,
  });

  const reservedStatus = await StatusGeneral.findOne({
    where: { dominio: "seat", descripcion: "reserved" },
    transaction,
  });

  const inCartStatus = await StatusGeneral.findOne({
    where: { dominio: "seat", descripcion: "in_cart" },
    transaction,
  });

  const occupiedStatus = await StatusGeneral.findOne({
    where: { dominio: "seat", descripcion: "occupied" },
    transaction,
  });

  // Obtener concert_seats con su información
  const concertSeats = await ConcertSeat.findAll({
    where: {
      concert_id: concertId,
      seat_id: seatIds,
    },
    include: [
      {
        model: Seat,
        as: "seat",
      },
    ],
    transaction,
  });

  for (const concertSeat of concertSeats) {
    const seatId = concertSeat.seat_id;
    const statusId = concertSeat.status_id;

    // AVAILABLE: Puede reservar
    if (statusId === availableStatus.id) {
      results.available.push({
        seat_id: seatId,
        concert_seat_id: concertSeat.id,
        seat_number: concertSeat.seat.seat_number,
      });
      continue;
    }

    // RESERVED: Verificar si es del usuario actual
    if (statusId === reservedStatus.id) {
      const existingReservation = await ReservationSeat.findOne({
        where: { concert_seat_id: concertSeat.id },
        include: [
          {
            model: Reservation,
            as: "reservation",
            where: {
              user_id: userId,
              status_id: (await StatusGeneral.findOne({
                where: { dominio: "reservation", descripcion: "held" },
                transaction,
              })).id,
            },
          },
        ],
        transaction,
      });

      if (existingReservation) {
        results.warnings.push({
          seat_id: seatId,
          seat_number: concertSeat.seat.seat_number,
          message: "Ya tienes este asiento reservado",
        });
      } else {
        results.blocked.push({
          seat_id: seatId,
          seat_number: concertSeat.seat.seat_number,
          reason: "Asiento reservado por otro usuario",
        });
      }
      continue;
    }

    // IN_CART: Advertencia pero puede reservar
    if (statusId === inCartStatus.id) {
      results.warnings.push({
        seat_id: seatId,
        seat_number: concertSeat.seat.seat_number,
        message: "Este asiento está en el carrito de otro usuario y podría ser comprado pronto",
      });
      results.available.push({
        seat_id: seatId,
        concert_seat_id: concertSeat.id,
        seat_number: concertSeat.seat.seat_number,
      });
      continue;
    }

    // OCCUPIED: No puede reservar
    if (statusId === occupiedStatus.id) {
      results.blocked.push({
        seat_id: seatId,
        seat_number: concertSeat.seat.seat_number,
        reason: "Asiento ya vendido",
      });
      continue;
    }
  }

  return results;
};

/**
 * NUEVA VERSIÓN: Crear reserva con asientos específicos
 */
const createReservation = async (userId, data) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { concert_id, ticket_type_id, quantity } = data;

    if (!concert_id || !ticket_type_id || !quantity || quantity <= 0 || quantity > 5) {
      throw new Error("Datos de reserva inválidos");
    }

    // =============================================
    // 1. VALIDAR LÍMITE DE 5 ASIENTOS POR USUARIO
    // =============================================
    const activeStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    const convertedStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "confirmed" },
      transaction,
    });

    const activeReservations = await Reservation.findAll({
      where: {
        user_id: userId,
        status_id: [activeStatus.id, convertedStatus.id],
      },
      include: [
        {
          model: ReservationSeat,
          as: "reservation_seats",
        },
      ],
      transaction,
    });

    const totalSeatsReserved = activeReservations.reduce(
      (sum, reservation) => sum + (reservation.reservation_seats?.length || 0),
      0
    );

    if (totalSeatsReserved + quantity > 5) {
      throw new Error(
        `Límite excedido. Tienes ${totalSeatsReserved} asientos reservados. Máximo: 5 por usuario.`
      );
    }

    // =============================================
    // 2. VERIFICAR TIPO DE TICKET Y SECCIÓN
    // =============================================
    const ticketType = await TicketType.findOne({
      where :{
        id: ticket_type_id,
        concert_id
      }
    }, { transaction });
    if (!ticketType) {
      throw new Error("Tipo de ticket no encontrado o no asignado a este concierto");
    }

    if (!ticketType.section_id) {
      throw new Error("Este tipo de ticket no tiene sección asignada. Usa el flujo antiguo.");
    }

    // =============================================
    // 3. OBTENER ASIENTOS DISPONIBLES
    // =============================================
    const availableStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "available" },
      transaction,
    });

    const inCartStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "in_cart" },
      transaction,
    });

    // Buscar asientos disponibles O en carrito (permitimos reservar si alguien más los tiene en carrito)
    const candidateSeats = await ConcertSeat.findAll({
      where: {
        concert_id,
        status_id: [availableStatus.id, inCartStatus.id],
      },
      include: [
        {
          model: Seat,
          as: "seat",
          where: { section_id: ticketType.section_id },
          required: true,
        },
      ],
      limit: quantity * 2, // Traer más de los necesarios por si algunos están bloqueados
      transaction,
    });

    if (candidateSeats.length === 0) {
      throw new Error("No hay asientos disponibles en esta sección");
    }

    // Extraer IDs de los asientos candidatos
    const candidateSeatIds = candidateSeats.map((cs) => cs.seat_id);

    // =============================================
    // 4. VALIDAR DISPONIBILIDAD CON MATRIZ
    // =============================================
    const validation = await validateSeatAvailability(
      concert_id,
      candidateSeatIds,
      userId,
      transaction
    );

    if (validation.blocked.length > 0) {
      console.log("Algunos asientos bloqueados:", validation.blocked);
    }

    if (validation.available.length < quantity) {
      throw new Error(
        `Solo hay ${validation.available.length} asientos disponibles. Solicitaste ${quantity}.`
      );
    }

    // Tomar solo los asientos que necesitamos
    const seatsToReserve = validation.available.slice(0, quantity);

    // =============================================
    // 5. CREAR RESERVA
    // =============================================
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutos para RabbitMQ

    const reservation = await Reservation.create(
      {
        user_id: userId,
        concert_id,
        status_id: activeStatus.id,
        expires_at: expiresAt,
      },
      { transaction }
    );

    // =============================================
    // 6. CREAR RESERVATION_SEATS
    // =============================================
    const reservedStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "reserved" },
      transaction,
    });

    for (const seat of seatsToReserve) {
      // Crear registro en reservation_seats
      await ReservationSeat.create(
        {
          reservation_id: reservation.id,
          seat_id: seat.seat_id,
          concert_seat_id: seat.concert_seat_id,
        },
        { transaction }
      );

      // Actualizar concert_seat a 'reserved'
      await ConcertSeat.update(
        { status_id: reservedStatus.id },
        {
          where: { id: seat.concert_seat_id },
          transaction,
        }
      );
    }

    // =============================================
    // 7. REDUCIR DISPONIBILIDAD DEL TICKET TYPE (OPCIONAL - depende de tu lógica)
    // =============================================
    await ticketType.decrement("available", {
      by: quantity,
      transaction,
    });

    // =============================================
    // 8. TODO: PUBLICAR EN RABBITMQ (cola RESERVA)
    // =============================================
    // const rabbitMQMessage = {
    //   reservationId: reservation.id,
    //   userId: userId,
    //   concertId: concert_id,
    //   seatIds: seatsToReserve.map(s => s.seat_id),
    //   concertSeatIds: seatsToReserve.map(s => s.concert_seat_id),
    //   sectionId: ticketType.section_id,
    //   timestamp: new Date().toISOString(),
    // };
    // await publishToQueue('RESERVA_QUEUE', rabbitMQMessage);

    await transaction.commit();

    // =============================================
    // 9. RETORNAR RESPUESTA
    // =============================================
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
        {
          model: ReservationSeat,
          as: "reservation_seats",
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
      reservation: createdReservation,
      ticket_type: ticketType,
      quantity,
      seats_reserved: seatsToReserve.map((s) => s.seat_number),
      expires_at: expiresAt,
      warnings: validation.warnings,
      message: `Reserva creada exitosamente. Tienes 5 minutos para crear la orden. Asientos reservados: ${seatsToReserve.map(s => s.seat_number).join(", ")}`,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear reserva: " + error.message);
  }
};

/**
 * Obtener reservas del usuario
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
        {
          model: ReservationSeat,
          as: "reservation_seats",
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

    return reservations;
  } catch (error) {
    throw new Error("Error al obtener reservas: " + error.message);
  }
};

/**
 * Liberar reservas expiradas (Admin/Cron)
 * NOTA: Esto será manejado por RabbitMQ consumers, pero dejamos esta función por si acaso
 */
const releaseExpiredReservations = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    const now = new Date();

    const heldStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "held" },
      transaction,
    });

    const expiredStatus = await StatusGeneral.findOne({
      where: { dominio: "reservation", descripcion: "expired" },
      transaction,
    });

    const availableStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "available" },
      transaction,
    });

    // Buscar reservas expiradas
    const expiredReservations = await Reservation.findAll({
      where: {
        status_id: heldStatus.id,
        expires_at: { [Op.lt]: now },
      },
      include: [
        {
          model: ReservationSeat,
          as: "reservation_seats",
        },
      ],
      transaction,
    });

    let releasedCount = 0;

    for (const reservation of expiredReservations) {
      // Liberar asientos
      const concertSeatIds = reservation.reservation_seats.map(
        (rs) => rs.concert_seat_id
      );

      await ConcertSeat.update(
        { status_id: availableStatus.id },
        {
          where: { id: concertSeatIds },
          transaction,
        }
      );

      // Actualizar reserva
      await reservation.update({ status_id: expiredStatus.id }, { transaction });

      // Eliminar reservation_seats
      await ReservationSeat.destroy({
        where: { reservation_id: reservation.id },
        transaction,
      });

      releasedCount++;
    }

    await transaction.commit();

    return {
      message: `${releasedCount} reservas expiradas liberadas`,
      released_reservations: releasedCount,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al liberar reservas expiradas: " + error.message);
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