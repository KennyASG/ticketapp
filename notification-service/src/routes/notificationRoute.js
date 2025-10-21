const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas de notificaciones
// ===============================

// Enviar tickets por email
router.post(
  "/orders/:id/send-tickets",
  authenticate,
  notificationController.sendTickets
);

// Enviar confirmación de compra
router.post(
  "/orders/:id/send-confirmation",
  authenticate,
  notificationController.sendConfirmation
);

// Ver historial de notificaciones
router.get(
  "/notifications",
  authenticate,
  notificationController.getNotifications
);

module.exports = router;