const concertService = require("../services/concertService");

/**
 * Obtener todos los conciertos
 * GET /admin/concerts
 */
const getAllConcerts = async (req, res) => {
  try {
    const concerts = await concertService.getAllConcerts();
    res.status(200).json(concerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener un concierto por ID
 * GET /admin/concerts/:id
 */
const getConcertById = async (req, res) => {
  try {
    const { id } = req.params;
    const concert = await concertService.getConcertById(id);
    res.status(200).json(concert);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * Crear un nuevo concierto
 * POST /admin/concerts
 */
const createConcert = async (req, res) => {
  try {
    const newConcert = await concertService.createConcert(req.body);
    res.status(201).json({
      message: "Concierto creado exitosamente",
      concert: newConcert,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Actualizar un concierto existente
 * PUT /admin/concerts/:id
 */
const updateConcert = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedConcert = await concertService.updateConcert(id, req.body);
    res.status(200).json({
      message: "Concierto actualizado correctamente",
      concert: updatedConcert,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Eliminar un concierto
 * DELETE /admin/concerts/:id
 */
const deleteConcert = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await concertService.deleteConcert(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAllConcerts,
  getConcertById,
  createConcert,
  updateConcert,
  deleteConcert,
};
