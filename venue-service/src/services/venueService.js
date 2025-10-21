const Venue = require("../models/Venue");
const VenueSection = require("../models/VenueSection");
const Seat = require("../models/Seat");
const sequelize = require("../db");

/**
 * Obtener todos los venues
 */
const getAllVenues = async () => {
  try {
    const venues = await Venue.findAll({
      order: [["created_at", "DESC"]],
    });
    return venues;
  } catch (error) {
    throw new Error("Error al obtener venues: " + error.message);
  }
};

/**
 * Obtener venue por ID
 */
const getVenueById = async (id) => {
  try {
    const venue = await Venue.findByPk(id);
    if (!venue) throw new Error("Venue no encontrado");
    return venue;
  } catch (error) {
    throw new Error("Error al obtener venue: " + error.message);
  }
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
    if (!venue) throw new Error("Venue no encontrado");

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
    if (!venue) throw new Error("Venue no encontrado");

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

    // Verificar que el venue existe
    const venue = await Venue.findByPk(venueId);
    if (!venue) throw new Error("Venue no encontrado");

    // Crear sección
    const newSection = await VenueSection.create(
      {
        venue_id: venueId,
        name,
        capacity,
      },
      { transaction }
    );

    // Generar asientos automáticamente
    const seats = [];
    for (let i = 1; i <= capacity; i++) {
      seats.push({
        section_id: newSection.id,
        seat_number: i,
      });
    }

    await Seat.bulkCreate(seats, { transaction });

    await transaction.commit();

    return {
      section: newSection,
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
      where: { id: sectionId, venue_id: venueId },
    });

    if (!section) throw new Error("Sección no encontrada");

    const oldCapacity = section.capacity;
    const newCapacity = data.capacity || oldCapacity;

    // Actualizar nombre si viene
    if (data.name) {
      section.name = data.name;
    }

    // Si la capacidad cambió, ajustar asientos
    if (newCapacity !== oldCapacity) {
      if (newCapacity > oldCapacity) {
        // Agregar asientos
        const seatsToAdd = [];
        for (let i = oldCapacity + 1; i <= newCapacity; i++) {
          seatsToAdd.push({
            section_id: sectionId,
            seat_number: i,
          });
        }
        await Seat.bulkCreate(seatsToAdd, { transaction });
      } else {
        // Eliminar asientos
        await Seat.destroy({
          where: {
            section_id: sectionId,
            seat_number: {
              [sequelize.Sequelize.Op.gt]: newCapacity,
            },
          },
          transaction,
        });
      }
      section.capacity = newCapacity;
    }

    await section.save({ transaction });
    await transaction.commit();

    return section;
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
      where: { id: sectionId, venue_id: venueId },
    });

    if (!section) throw new Error("Sección no encontrada");

    await section.destroy();
    return { message: "Sección eliminada correctamente" };
  } catch (error) {
    throw new Error("Error al eliminar sección: " + error.message);
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
};