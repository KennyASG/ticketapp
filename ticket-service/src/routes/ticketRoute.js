const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas públicas
// ===============================

// Ver tipos de tickets de un concierto
router.get("/concert/:id/ticket-types", ticketController.getTicketTypesByConcert);

// ===============================
//  Rutas de usuario autenticado
// ===============================

// Crear reserva temporal
router.post("/ticket/reserve", authenticate, ticketController.createReservation);

// Ver mis reservas
router.get("/ticket/reservations", authenticate, ticketController.getUserReservations);

// ===============================
//  Rutas de administración
// ===============================

// Crear tipo de ticket
router.post(
  "/admin/concert/:id/ticket-type",
  authenticate,
  isAdmin,
  ticketController.createTicketType
);

// Actualizar tipo de ticket
router.put(
  "/admin/ticket-type/:id",
  authenticate,
  isAdmin,
  ticketController.updateTicketType
);

// Eliminar tipo de ticket
router.delete(
  "/admin/ticket-type/:id",
  authenticate,
  isAdmin,
  ticketController.deleteTicketType
);

// Liberar reservas expiradas (para cron job)
router.post(
  "/admin/tickets/release-expired",
  authenticate,
  isAdmin,
  ticketController.releaseExpiredReservations
);

module.exports = router;