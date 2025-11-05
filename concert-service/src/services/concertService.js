const { 
  Concert, 
  Venue, 
  VenueSection, 
  Seat, 
  ConcertVenueDetail, 
  ConcertSeat, 
  StatusGeneral,
  TicketType,
  sequelize 
} = require("../models");
const { Op } = require("sequelize");
const redisClient = require("../utils/redis.config");

const CONCERT_DURATION_HOURS = 4;

// Constantes para el caché
const CACHE_KEY_PREFIX = 'concerts:list';
const CACHE_TTL = 300; // 5 minutos

/**
 * Invalidar caché de conciertos
 */
const invalidateConcertsCache = async () => {
  try {
    const keys = await redisClient.keys(`${CACHE_KEY_PREFIX}:*`);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`✓ Caché de conciertos invalidado (${keys.length} keys eliminadas)`);
    }
  } catch (error) {
    console.error('Error al invalidar caché de conciertos:', error);
  }
};

/**
 * Validar que no haya traslape de horarios
 */
const validateNoOverlap = async (venueId, date, excludeConcertId = null, transaction) => {
  const concertDate = new Date(date);
  const startDate = new Date(concertDate.getTime() - CONCERT_DURATION_HOURS * 60 * 60 * 1000);
  const endDate = new Date(concertDate.getTime() + CONCERT_DURATION_HOURS * 60 * 60 * 1000);

  const whereClause = {
    date: {
      [Op.or]: [
        { [Op.between]: [startDate, endDate] },
        {
          [Op.and]: [
            { [Op.lte]: startDate },
            { [Op.gte]: endDate },
          ],
        },
      ],
    },
  };

  if (excludeConcertId) {
    whereClause.id = { [Op.ne]: excludeConcertId };
  }

  const overlapping = await Concert.findAll({
    where: whereClause,
    include: [
      {
        model: Venue,
        as: "venues",
        where: { id: venueId },
        through: { attributes: [] },
        required: true,
      },
    ],
    attributes: ["id", "title", "date"],
    transaction,
  });

  if (overlapping.length > 0) {
    const conflict = overlapping[0];
    const conflictEnd = new Date(
      new Date(conflict.date).getTime() + CONCERT_DURATION_HOURS * 60 * 60 * 1000
    );
    throw new Error(
      `Traslape de horario detectado con el concierto "${
        conflict.title
      }" que se realiza de ${new Date(
        conflict.date
      ).toLocaleString()} a ${conflictEnd.toLocaleString()}`
    );
  }
};

/**
 * Obtener todos los conciertos (CON CACHÉ)
 */
const getAllConcerts = async (options = {}) => {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  // Generar key única basada en los parámetros
  const cacheKey = `${CACHE_KEY_PREFIX}:page${page}:limit${limit}`;

  try {
    // 1. Intentar obtener de Redis
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      console.log(`✓ Cache HIT: ${cacheKey}`);
      return JSON.parse(cached);
    }
    
    console.log(`✗ Cache MISS: ${cacheKey} - consultando BD...`);

    // 2. Consultar base de datos
    const { count, rows: concerts } = await Concert.findAndCountAll({
      include: [
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["id", "descripcion"],
        },
        {
          model: Venue,
          as: "venues",
          attributes: ["id", "name", "city", "country"],
          through: { attributes: [] },
        },
      ],
      limit,
      offset,
      order: [["date", "DESC"]],
    });

    const result = {
      concerts,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };

    // 3. Guardar en Redis
    await redisClient.setEx(
      cacheKey,
      CACHE_TTL,
      JSON.stringify(result)
    );
    
    console.log(`✓ Conciertos guardados en caché: ${cacheKey}`);

    return result;

  } catch (error) {
    console.error('Error en caché de conciertos:', error);
    
    // Fallback: consultar BD directamente si Redis falla
    const { count, rows: concerts } = await Concert.findAndCountAll({
      include: [
        {
          model: StatusGeneral,
          as: "status",
          attributes: ["id", "descripcion"],
        },
        {
          model: Venue,
          as: "venues",
          attributes: ["id", "name", "city", "country"],
          through: { attributes: [] },
        },
      ],
      limit,
      offset,
      order: [["date", "DESC"]],
    });

    return {
      concerts,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }
};

/**
 * Obtener concierto por ID
 */
const getConcertById = async (id) => {
  const concert = await Concert.findByPk(id, {
    include: [
      {
        model: StatusGeneral,
        as: "status",
        attributes: ["id", "descripcion"],
      },
      {
        model: Venue,
        as: "venues",
        attributes: ["id", "name", "address", "city", "country"],
        through: { attributes: [] },
        include: [
          {
            model: VenueSection,
            as: "sections",
            attributes: ["id", "name", "capacity"],
          },
        ],
      },
      {
        model: TicketType,
        as: "ticketTypes",
        attributes: ["id", "name", "price", "available"],
      },
    ],
  });

  if (!concert) {
    throw new Error("Concierto no encontrado");
  }

  return concert;
};

/**
 * Crear un nuevo concierto (INVALIDA CACHÉ)
 */
const createConcert = async (data) => {
  const transaction = await sequelize.transaction();

  try {
    const { title, description, date, status_id, venue_id } = data;

    if (!title || !description || !date || !status_id) {
      throw new Error("Faltan campos obligatorios");
    }

    if (!venue_id) {
      throw new Error("El campo venue_id es obligatorio");
    }

    const venue = await Venue.findByPk(venue_id, { transaction });
    if (!venue) {
      throw new Error(`El venue con ID ${venue_id} no existe`);
    }

    await validateNoOverlap(venue_id, date, null, transaction);

    const newConcert = await Concert.create({
      title,
      description,
      date,
      status_id,
    }, { transaction });

    await ConcertVenueDetail.create({
      concert_id: newConcert.id,
      venue_id: venue_id,
    }, { transaction });

    const availableStatus = await StatusGeneral.findOne({
      where: { dominio: "seat", descripcion: "available" },
      transaction,
    });

    if (!availableStatus) {
      throw new Error("Estado 'available' no encontrado");
    }

    const seats = await Seat.findAll({
      include: [{
        model: VenueSection,
        as: "section",
        where: { venue_id: venue_id },
        required: true,
      }],
      transaction,
    });

    if (seats.length === 0) {
      throw new Error("El venue no tiene asientos configurados");
    }

    const concertSeatsData = seats.map((seat) => ({
      concert_id: newConcert.id,
      seat_id: seat.id,
      status_id: availableStatus.id,
    }));

    await ConcertSeat.bulkCreate(concertSeatsData, { transaction });

    await transaction.commit();

    // Invalidar caché después de crear
    await invalidateConcertsCache();

    const createdConcert = await Concert.findByPk(newConcert.id, {
      include: [
        { model: StatusGeneral, as: "status" },
        { model: Venue, as: "venues", through: { attributes: [] } },
      ],
    });

    return createdConcert;
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear concierto: " + error.message);
  }
};

/**
 * Actualizar un concierto (INVALIDA CACHÉ)
 */
const updateConcert = async (id, data) => {
  const transaction = await sequelize.transaction();

  try {
    const concert = await Concert.findByPk(id, { transaction });
    if (!concert) {
      throw new Error("Concierto no encontrado");
    }

    if (data.venue_id) {
      const concertVenueDetail = await ConcertVenueDetail.findOne({
        where: { concert_id: id },
        transaction,
      });

      if (concertVenueDetail && data.venue_id !== concertVenueDetail.venue_id) {
        const newVenue = await Venue.findByPk(data.venue_id, { transaction });
        if (!newVenue) {
          throw new Error(`El venue con ID ${data.venue_id} no existe`);
        }

        const dateToCheck = data.date || concert.date;
        await validateNoOverlap(data.venue_id, dateToCheck, id, transaction);

        await concertVenueDetail.update({ venue_id: data.venue_id }, { transaction });

        await ConcertSeat.destroy({ where: { concert_id: id }, transaction });

        const seats = await Seat.findAll({
          include: [{
            model: VenueSection,
            as: "section",
            where: { venue_id: data.venue_id },
            required: true,
          }],
          transaction,
        });

        const availableStatus = await StatusGeneral.findOne({
          where: { dominio: "seat", descripcion: "available" },
          transaction,
        });

        const concertSeatsData = seats.map((seat) => ({
          concert_id: id,
          seat_id: seat.id,
          status_id: availableStatus.id,
        }));

        await ConcertSeat.bulkCreate(concertSeatsData, { transaction });
      }
    }

    if (data.date && data.date !== concert.date) {
      const concertVenueDetail = await ConcertVenueDetail.findOne({
        where: { concert_id: id },
        transaction,
      });

      if (concertVenueDetail) {
        await validateNoOverlap(concertVenueDetail.venue_id, data.date, id, transaction);
      }
    }

    await concert.update(data, { transaction });

    await transaction.commit();

    // Invalidar caché después de actualizar
    await invalidateConcertsCache();

    const updatedConcert = await Concert.findByPk(id, {
      include: [
        { model: StatusGeneral, as: "status" },
        { model: Venue, as: "venues", through: { attributes: [] } },
      ],
    });

    return updatedConcert;
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al actualizar concierto: " + error.message);
  }
};

/**
 * Eliminar un concierto (INVALIDA CACHÉ)
 */
const deleteConcert = async (id) => {
  const transaction = await sequelize.transaction();

  try {
    const concert = await Concert.findByPk(id, { transaction });
    if (!concert) {
      throw new Error("Concierto no encontrado");
    }

    await concert.destroy({ transaction });
    await transaction.commit();

    // Invalidar caché después de eliminar
    await invalidateConcertsCache();

    return { message: "Concierto eliminado correctamente" };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al eliminar concierto: " + error.message);
  }
};

/**
 * Obtener asientos disponibles de un concierto
 */
const getAvailableSeats = async (concertId) => {
  const availableStatus = await StatusGeneral.findOne({
    where: { dominio: "seat", descripcion: "available" },
  });

  if (!availableStatus) {
    throw new Error("Estado 'available' no encontrado");
  }

  const availableSeats = await ConcertSeat.findAll({
    where: {
      concert_id: concertId,
      status_id: availableStatus.id,
    },
    include: [{
      model: Seat,
      as: "seat",
      attributes: ["id", "seat_number"],
      include: [{
        model: VenueSection,
        as: "section",
        attributes: ["id", "name", "capacity"],
      }],
    }],
    order: [
      [{ model: Seat, as: "seat" }, { model: VenueSection, as: "section" }, "name", "ASC"],
      [{ model: Seat, as: "seat" }, "seat_number", "ASC"],
    ],
  });

  const seatsBySection = {};

  availableSeats.forEach((concertSeat) => {
    const sectionName = concertSeat.seat.section.name;
    if (!seatsBySection[sectionName]) {
      seatsBySection[sectionName] = {
        section_id: concertSeat.seat.section.id,
        section_name: sectionName,
        capacity: concertSeat.seat.section.capacity,
        available_seats: [],
      };
    }
    seatsBySection[sectionName].available_seats.push({
      seat_id: concertSeat.seat.id,
      seat_number: concertSeat.seat.seat_number,
    });
  });

  return Object.values(seatsBySection);
};

module.exports = {
  getAllConcerts,
  getConcertById,
  createConcert,
  updateConcert,
  deleteConcert,
  getAvailableSeats,
};