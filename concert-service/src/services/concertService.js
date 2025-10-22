const Concert = require("../models/Concert");
const sequelize = require("../db");
const { Op } = require("sequelize");

const CONCERT_DURATION_HOURS = 4; // Duración fija de 4 horas

/**
 * Obtener todos los conciertos
 */
const getAllConcerts = async () => {
  try {
    const concerts = await sequelize.query(
      `
      SELECT 
        c.*,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city
      FROM concerts c
      LEFT JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
      LEFT JOIN venues v ON v.id = cvd.venue_id
      ORDER BY c.date ASC
      `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    return concerts;
  } catch (error) {
    throw new Error("Error al obtener los conciertos: " + error.message);
  }
};

/**
 * Obtener un concierto por ID
 */
const getConcertById = async (id) => {
  try {
    const concerts = await sequelize.query(
      `
      SELECT 
        c.*,
        v.id as venue_id,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.country as venue_country
      FROM concerts c
      LEFT JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
      LEFT JOIN venues v ON v.id = cvd.venue_id
      WHERE c.id = :concertId
      LIMIT 1
      `,
      {
        replacements: { concertId: id },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!concerts || concerts.length === 0) {
      throw new Error("Concierto no encontrado");
    }

    return concerts[0];
  } catch (error) {
    throw new Error("Error al obtener el concierto: " + error.message);
  }
};

/**
 * Validar que no haya traslape de horarios en el venue
 */
const validateNoOverlap = async (venueId, concertDate, excludeConcertId = null, transaction) => {
  const startDate = new Date(concertDate);
  const endDate = new Date(startDate.getTime() + CONCERT_DURATION_HOURS * 60 * 60 * 1000);

  // Query para buscar conciertos que se traslapen
  let query = `
    SELECT c.id, c.title, c.date
    FROM concerts c
    INNER JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
    WHERE cvd.venue_id = :venueId
      AND (
        -- El nuevo concierto empieza durante otro concierto
        (c.date <= :startDate AND (c.date + INTERVAL '${CONCERT_DURATION_HOURS} hours') > :startDate)
        OR
        -- El nuevo concierto termina durante otro concierto
        (c.date < :endDate AND (c.date + INTERVAL '${CONCERT_DURATION_HOURS} hours') >= :endDate)
        OR
        -- El nuevo concierto engloba completamente a otro
        (c.date >= :startDate AND (c.date + INTERVAL '${CONCERT_DURATION_HOURS} hours') <= :endDate)
      )
  `;

  const replacements = {
    venueId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  // Si estamos actualizando, excluir el concierto actual
  if (excludeConcertId) {
    query += ` AND c.id != :excludeConcertId`;
    replacements.excludeConcertId = excludeConcertId;
  }

  const overlapping = await sequelize.query(query, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
    transaction,
  });

  if (overlapping && overlapping.length > 0) {
    const conflict = overlapping[0];
    const conflictEnd = new Date(new Date(conflict.date).getTime() + CONCERT_DURATION_HOURS * 60 * 60 * 1000);
    throw new Error(
      `Traslape de horario detectado con el concierto "${conflict.title}" que se realiza de ${new Date(conflict.date).toLocaleString()} a ${conflictEnd.toLocaleString()}`
    );
  }
};

/**
 * Crear un nuevo concierto
 */
const createConcert = async (data) => {
  const transaction = await sequelize.transaction();
  try {
    const { title, description, date, status_id, venue_id } = data;

    // Validaciones
    if (!title || !description || !date || !status_id) {
      throw new Error("Faltan campos obligatorios: title, description, date, status_id");
    }

    if (!venue_id) {
      throw new Error("El campo venue_id es obligatorio. Un concierto debe realizarse en un venue.");
    }

    // Validar que el venue exista
    const venueExists = await sequelize.query(
      `SELECT id FROM venues WHERE id = :venueId LIMIT 1`,
      {
        replacements: { venueId: venue_id },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (!venueExists || venueExists.length === 0) {
      throw new Error(`El venue con ID ${venue_id} no existe`);
    }

    // Validar que no haya traslape de horarios
    await validateNoOverlap(venue_id, date, null, transaction);

    // 1. Crear el concierto
    const newConcert = await Concert.create(
      {
        title,
        description,
        date,
        status_id,
      },
      { transaction }
    );

    // 2. Crear relación concert_venue_detail
    await sequelize.query(
      `INSERT INTO concert_venue_detail (concert_id, venue_id) VALUES (:concertId, :venueId)`,
      {
        replacements: {
          concertId: newConcert.id,
          venueId: venue_id,
        },
        type: sequelize.QueryTypes.INSERT,
        transaction,
      }
    );

    // 3. Obtener el status 'available' para seats
    const availableStatus = await sequelize.query(
      `SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available' LIMIT 1`,
      {
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (!availableStatus || availableStatus.length === 0) {
      throw new Error("Estado 'available' para seats no encontrado en status_generales");
    }

    const statusId = availableStatus[0].id;

    // 4. Copiar TODOS los asientos del venue a concert_seats con estado 'available'
    await sequelize.query(
      `
      INSERT INTO concert_seats (concert_id, seat_id, status_id)
      SELECT :concertId, s.id, :statusId
      FROM seats s
      INNER JOIN venue_sections vs ON vs.id = s.section_id
      WHERE vs.venue_id = :venueId
      `,
      {
        replacements: {
          concertId: newConcert.id,
          venueId: venue_id,
          statusId: statusId,
        },
        type: sequelize.QueryTypes.INSERT,
        transaction,
      }
    );

    await transaction.commit();

    // Devolver el concierto con información del venue
    return await getConcertById(newConcert.id);
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear el concierto: " + error.message);
  }
};

/**
 * Actualizar un concierto existente
 */
const updateConcert = async (id, data) => {
  const transaction = await sequelize.transaction();
  try {
    const concert = await Concert.findByPk(id, { transaction });
    if (!concert) throw new Error("Concierto no encontrado");

    // Si se está actualizando la fecha o el venue, validar traslapes
    if (data.date || data.venue_id) {
      // Obtener el venue actual si no viene en data
      let venueId = data.venue_id;
      
      if (!venueId) {
        const currentVenue = await sequelize.query(
          `SELECT venue_id FROM concert_venue_detail WHERE concert_id = :concertId LIMIT 1`,
          {
            replacements: { concertId: id },
            type: sequelize.QueryTypes.SELECT,
            transaction,
          }
        );
        venueId = currentVenue && currentVenue.length > 0 ? currentVenue[0].venue_id : null;
      }

      if (venueId) {
        const newDate = data.date || concert.date;
        await validateNoOverlap(venueId, newDate, id, transaction);
      }

      // Si se cambió el venue, actualizar concert_venue_detail y concert_seats
      if (data.venue_id && data.venue_id !== venueId) {
        // Validar que el nuevo venue exista
        const venueExists = await sequelize.query(
          `SELECT id FROM venues WHERE id = :venueId LIMIT 1`,
          {
            replacements: { venueId: data.venue_id },
            type: sequelize.QueryTypes.SELECT,
            transaction,
          }
        );

        if (!venueExists || venueExists.length === 0) {
          throw new Error(`El venue con ID ${data.venue_id} no existe`);
        }

        // Actualizar concert_venue_detail
        await sequelize.query(
          `UPDATE concert_venue_detail SET venue_id = :venueId WHERE concert_id = :concertId`,
          {
            replacements: {
              venueId: data.venue_id,
              concertId: id,
            },
            type: sequelize.QueryTypes.UPDATE,
            transaction,
          }
        );

        // Eliminar concert_seats antiguos
        await sequelize.query(
          `DELETE FROM concert_seats WHERE concert_id = :concertId`,
          {
            replacements: { concertId: id },
            type: sequelize.QueryTypes.DELETE,
            transaction,
          }
        );

        // Crear nuevos concert_seats del nuevo venue
        const availableStatus = await sequelize.query(
          `SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available' LIMIT 1`,
          {
            type: sequelize.QueryTypes.SELECT,
            transaction,
          }
        );

        if (availableStatus && availableStatus.length > 0) {
          const statusId = availableStatus[0].id;
          
          await sequelize.query(
            `
            INSERT INTO concert_seats (concert_id, seat_id, status_id)
            SELECT :concertId, s.id, :statusId
            FROM seats s
            INNER JOIN venue_sections vs ON vs.id = s.section_id
            WHERE vs.venue_id = :venueId
            `,
            {
              replacements: {
                concertId: id,
                venueId: data.venue_id,
                statusId: statusId,
              },
              type: sequelize.QueryTypes.INSERT,
              transaction,
            }
          );
        }
      }
    }

    // Actualizar los campos del concierto
    const { venue_id, ...concertData } = data; // Excluir venue_id ya que no está en la tabla concerts
    await concert.update(concertData, { transaction });

    await transaction.commit();

    return await getConcertById(id);
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al actualizar el concierto: " + error.message);
  }
};

/**
 * Eliminar un concierto
 */
const deleteConcert = async (id) => {
  const transaction = await sequelize.transaction();
  try {
    const concert = await Concert.findByPk(id, { transaction });
    if (!concert) throw new Error("Concierto no encontrado");

    // Verificar si hay órdenes confirmadas para este concierto
    const ordersExist = await sequelize.query(
      `
      SELECT COUNT(*) as count
      FROM orders
      WHERE concert_id = :concertId
        AND status_id IN (
          SELECT id FROM status_generales 
          WHERE dominio = 'order' AND descripcion = 'confirmed'
        )
      `,
      {
        replacements: { concertId: id },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (ordersExist && ordersExist[0].count > 0) {
      throw new Error("No se puede eliminar el concierto porque ya tiene órdenes confirmadas");
    }

    // Las relaciones se eliminan en cascada por las foreign keys
    await concert.destroy({ transaction });

    await transaction.commit();

    return { message: "Concierto eliminado correctamente" };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al eliminar el concierto: " + error.message);
  }
};

module.exports = {
  getAllConcerts,
  getConcertById,
  createConcert,
  updateConcert,
  deleteConcert,
};