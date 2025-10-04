const Concert = require("../models/Concert");
const { Op } = require("sequelize");

/**
 * Obtener todos los conciertos
 */
const getAllConcerts = async () => {
  try {
    const concerts = await Concert.findAll({
      order: [["date", "ASC"]],
    });
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
    const concert = await Concert.findByPk(id);
    if (!concert) throw new Error("Concierto no encontrado");
    return concert;
  } catch (error) {
    throw new Error("Error al obtener el concierto: " + error.message);
  }
};

/**
 * Crear un nuevo concierto
 */
const createConcert = async (data) => {
  try {
    const { title, description, date, status_id } = data;

    if (!title || !description || !date || !status_id) {
      throw new Error("Faltan campos obligatorios");
    }

    const newConcert = await Concert.create({
      title,
      description,
      date,
      status_id,
    });

    return newConcert;
  } catch (error) {
    throw new Error("Error al crear el concierto: " + error.message);
  }
};

/**
 * Actualizar un concierto existente
 */
const updateConcert = async (id, data) => {
  try {
    const concert = await Concert.findByPk(id);
    if (!concert) throw new Error("Concierto no encontrado");

    await concert.update(data);
    return concert;
  } catch (error) {
    throw new Error("Error al actualizar el concierto: " + error.message);
  }
};

/**
 * Eliminar un concierto
 */
const deleteConcert = async (id) => {
  try {
    const concert = await Concert.findByPk(id);
    if (!concert) throw new Error("Concierto no encontrado");

    await concert.destroy();
    return { message: "Concierto eliminado correctamente" };
  } catch (error) {
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
