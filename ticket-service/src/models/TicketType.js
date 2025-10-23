const { Venue, VenueSection, Seat, sequelize } = require("../models");
const { Op } = require("sequelize");

/**
 * Obtener todos los venues
 */
const getAllVenues = async (options = {}) => {
  const { page = 1, limit = 20, includeSections = false } = options;
  const offset = (page - 1) * limit;

  const includes = [];
  if (includeSections) {
    includes.push({
      model: VenueSection,
      as: "sections",
      attributes: ["id", "name", "capacity"],
    });
  }

  const { count, rows: venues } = await Venue.findAndCountAll({
    include: includes,
    limit,
    offset,
    order: [["created_at", "DESC"]],
  });

  return {
    venues,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Obtener venue por ID
 */
const getVenueById = async (id, includeDetails = false) => {
  const includes = [];
  
  if (includeDetails) {
    includes.push({
      model: VenueSection,
      as: "sections",
      attributes: ["id", "name", "capacity"],
      include: [
        {
          model: Seat,
          as: "seats",
          attributes: ["id", "seat_number"],
          limit: 10,
        },
      ],
    });
  }

  const venue = await Venue.findByPk(id, {
    include: includes,
  });

  if (!venue) {
    throw new Error("Venue no encontrado");
  }

  return venue;
};

/**
 * Crear nuevo venue
 */
const createVenue = async (data) => {
  try {
    const { name, address, city, country } = data;

    if (!name) {
      throw new Error("El nombre del venue es obligatorio");
    }

    const newVenue = await Venue.create({
      name,
      address,
      city,
      country,
    });

    return newVenue;
  } catch (error) {
    throw new Error("Error al crear venue: " + error.message);
  }
};

/**
 * Actualizar venue
 */
const updateVenue = async (id, data) => {
  try {
    const venue = await Venue.findByPk(id);
    
    if (!venue) {
      throw new Error("Venue no encontrado");
    }

    await venue.update(data);
    return venue;
  } catch (error) {
    throw new Error("Error al actualizar venue: " + error.message);
  }
};

/**
 * Eliminar venue
 */
const deleteVenue = async (id) => {
  try {
    const venue = await Venue.findByPk(id);
    
    if (!venue) {
      throw new Error("Venue no encontrado");
    }

    await venue.destroy();
    return { message: "Venue eliminado correctamente" };
  } catch (error) {
    throw new Error("Error al eliminar venue: " + error.message);
  }
};

/**
 * Obtener secciones de un venue
 */
const getSectionsByVenue = async (venueId) => {
  try {
    const sections = await VenueSection.findAll({
      where: { venue_id: venueId },
      include: [
        {
          model: Venue,
          as: "venue",
          attributes: ["id", "name"],
        },
      ],
      order: [["name", "ASC"]],
    });

    return sections;
  } catch (error) {
    throw new Error("Error al obtener secciones: " + error.message);
  }
};

/**
 * Crear sección en un venue
 */
const createSection = async (venueId, data) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { name, capacity } = data;

    if (!name || !capacity) {
      throw new Error("Nombre y capacidad son obligatorios");
    }

    const venue = await Venue.findByPk(venueId, { transaction });
    
    if (!venue) {
      throw new Error("Venue no encontrado");
    }

    const existingSection = await VenueSection.findOne({
      where: {
        venue_id: venueId,
        name: name,
      },
      transaction,
    });

    if (existingSection) {
      throw new Error(`Ya existe una sección con el nombre "${name}" en este venue`);
    }

    const newSection = await VenueSection.create(
      {
        venue_id: venueId,
        name,
        capacity,
      },
      { transaction }
    );

    const seats = [];
    for (let i = 1; i <= capacity; i++) {
      seats.push({
        section_id: newSection.id,
        seat_number: i,
      });
    }

    await Seat.bulkCreate(seats, { transaction });

    await transaction.commit();

    const sectionWithSeats = await VenueSection.findByPk(newSection.id, {
      include: [
        {
          model: Seat,
          as: "seats",
          attributes: ["id", "seat_number"],
        },
      ],
    });

    return {
      section: sectionWithSeats,
      message: `Sección creada con ${capacity} asientos`,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al crear sección: " + error.message);
  }
};

/**
 * Actualizar sección
 */
const updateSection = async (venueId, sectionId, data) => {
  const transaction = await sequelize.transaction();
  
  try {
    const section = await VenueSection.findOne({
      where: { 
        id: sectionId, 
        venue_id: venueId 
      },
      transaction,
    });

    if (!section) {
      throw new Error("Sección no encontrada");
    }

    const oldCapacity = section.capacity;
    const newCapacity = data.capacity || oldCapacity;

    if (data.name) {
      const existingSection = await VenueSection.findOne({
        where: {
          venue_id: venueId,
          name: data.name,
          id: { [Op.ne]: sectionId },
        },
        transaction,
      });

      if (existingSection) {
        throw new Error(`Ya existe otra sección con el nombre "${data.name}" en este venue`);
      }

      section.name = data.name;
    }

    if (newCapacity !== oldCapacity) {
      if (newCapacity > oldCapacity) {
        const seatsToAdd = [];
        for (let i = oldCapacity + 1; i <= newCapacity; i++) {
          seatsToAdd.push({
            section_id: sectionId,
            seat_number: i,
          });
        }
        await Seat.bulkCreate(seatsToAdd, { transaction });
      } else {
        await Seat.destroy({
          where: {
            section_id: sectionId,
            seat_number: {
              [Op.gt]: newCapacity,
            },
          },
          transaction,
        });
      }
      section.capacity = newCapacity;
    }

    await section.save({ transaction });
    await transaction.commit();

    const updatedSection = await VenueSection.findByPk(sectionId, {
      include: [
        {
          model: Seat,
          as: "seats",
          attributes: ["id", "seat_number"],
        },
      ],
    });

    return updatedSection;
  } catch (error) {
    await transaction.rollback();
    throw new Error("Error al actualizar sección: " + error.message);
  }
};

/**
 * Eliminar sección
 */
const deleteSection = async (venueId, sectionId) => {
  try {
    const section = await VenueSection.findOne({
      where: { 
        id: sectionId, 
        venue_id: venueId 
      },
    });

    if (!section) {
      throw new Error("Sección no encontrada");
    }

    await section.destroy();
    return { message: "Sección eliminada correctamente" };
  } catch (error) {
    throw new Error("Error al eliminar sección: " + error.message);
  }
};

/**
 * Obtener asientos de una sección
 */
const getSeatsBySection = async (sectionId) => {
  try {
    const seats = await Seat.findAll({
      where: { section_id: sectionId },
      include: [
        {
          model: VenueSection,
          as: "section",
          attributes: ["id", "name", "capacity"],
        },
      ],
      order: [["seat_number", "ASC"]],
    });

    return seats;
  } catch (error) {
    throw new Error("Error al obtener asientos: " + error.message);
  }
};

module.exports = {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
  getSectionsByVenue,
  createSection,
  updateSection,
  deleteSection,
  getSeatsBySection,
};