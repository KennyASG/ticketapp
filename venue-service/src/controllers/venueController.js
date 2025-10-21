const venueService = require("../services/venueService");

/**
 * GET /venues
 */
const getAllVenues = async (req, res) => {
  try {
    const venues = await venueService.getAllVenues();
    res.status(200).json(venues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /venues/:id
 */
const getVenueById = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await venueService.getVenueById(id);
    res.status(200).json(venue);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * POST /venues/admin
 */
const createVenue = async (req, res) => {
  try {
    const newVenue = await venueService.createVenue(req.body);
    res.status(201).json({
      message: "Venue creado exitosamente",
      venue: newVenue,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * PUT /venues/admin/:id
 */
const updateVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedVenue = await venueService.updateVenue(id, req.body);
    res.status(200).json({
      message: "Venue actualizado correctamente",
      venue: updatedVenue,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /venues/admin/:id
 */
const deleteVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await venueService.deleteVenue(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * GET /venues/:id/sections
 */
const getSectionsByVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const sections = await venueService.getSectionsByVenue(id);
    res.status(200).json(sections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /venues/admin/:id/sections
 */
const createSection = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await venueService.createSection(id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * PUT /venues/admin/:id/sections/:sectionId
 */
const updateSection = async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const updatedSection = await venueService.updateSection(
      id,
      sectionId,
      req.body
    );
    res.status(200).json({
      message: "Sección actualizada correctamente",
      section: updatedSection,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /venues/admin/:id/sections/:sectionId
 */
const deleteSection = async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const result = await venueService.deleteSection(id, sectionId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
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