const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas públicas
// ===============================

// Ver tipos de tickets de un concierto
router.get("/concerts/:id/ticket-types", ticketController.getTicketTypesByConcert);

// ===============================
//  Rutas de usuario autenticado
// ===============================

// Crear reserva temporal
router.post("/tickets/reserve", authenticate, ticketController.createReservation);

// Ver mis reservas
router.get("/tickets/reservations", authenticate, ticketController.getUserReservations);

// ===============================
//  Rutas de administración
// ===============================

// Crear tipo de ticket
router.post(
  "/admin/concerts/:id/ticket-types",
  authenticate,
  isAdmin,
  ticketController.createTicketType
);

// Actualizar tipo de ticket
router.put(
  "/admin/ticket-types/:id",
  authenticate,
  isAdmin,
  ticketController.updateTicketType
);

// Eliminar tipo de ticket
router.delete(
  "/admin/ticket-types/:id",
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