const ticketService = require("../services/ticketService");
// const publishToQueue = require("../workers/rabbitClient.cjs");


/**
 * GET /concerts/:id/ticket-types
 */
const getTicketTypesByConcert = async (req, res) => {
  try {
    const { id } = req.params;
    const ticketTypes = await ticketService.getTicketTypesByConcert(id);
    res.status(200).json(ticketTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /admin/concerts/:id/ticket-types
 */
const createTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const newTicketType = await ticketService.createTicketType(id, req.body);
    res.status(201).json({
      message: "Tipo de ticket creado exitosamente",
      ticketType: newTicketType,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * PUT /admin/ticket-types/:id
 */
const updateTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTicketType = await ticketService.updateTicketType(
      id,
      req.body
    );
    res.status(200).json({
      message: "Tipo de ticket actualizado correctamente",
      ticketType: updatedTicketType,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /admin/ticket-types/:id
 */
const deleteTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ticketService.deleteTicketType(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /tickets/reserve
 */
const createReservation = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await ticketService.createReservation(userId, req.body);
    
  //  await publishToQueue('reserva', result.reservation.id.toString());
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * GET /tickets/reservations
 */
const getUserReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservations = await ticketService.getUserReservations(userId);
    res.status(200).json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /admin/tickets/release-expired
 */
const releaseExpiredReservations = async (req, res) => {
  try {
    const result = await ticketService.releaseExpiredReservations();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
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