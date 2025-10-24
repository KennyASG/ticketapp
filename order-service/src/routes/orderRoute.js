const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas de usuario autenticado
// ===============================

// Crear orden
router.post("/", authenticate, orderController.createOrder);

// Confirmar orden (procesar pago)
router.post("/:id/confirm", authenticate, orderController.confirmOrder);

// Ver detalle de orden
router.get("/:id", authenticate, orderController.getOrderById);

// Ver mis órdenes
router.get("/orders/user/:userId", authenticate, orderController.getUserOrders);

// ===============================
//  Rutas de administración
// ===============================

// Ver todas las órdenes
router.get("/admin/orders", authenticate, isAdmin, orderController.getAllOrders);

// Ver ventas por concierto
router.get(
  "/admin/concert/:id/sales",
  authenticate,
  isAdmin,
  orderController.getSalesByConcert
);

module.exports = router;