
// const { publishToQueue } = require("../../../ticket-service/src/workers/rabbitClient.cjs");
const orderService = require("../services/orderService");

/**
 * POST /order/
 * ✅ SIMPLIFICADO: Solo requiere reservation_id
 */
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reservation_id } = req.body;

    // Validación básica
    if (!reservation_id) {
      return res.status(400).json({ 
        message: "reservation_id es requerido" 
      });
    }

    const result = await orderService.createOrder(userId, { reservation_id });
    res.status(201).json(result);
  } catch (error) {

    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /order/:id/confirm
 * Confirmar orden (procesar pago y generar tickets)
 */
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await orderService.confirmOrder(id, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * GET /order/:id
 * Ver detalle de orden
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 1;
    
    const order = await orderService.getOrderById(id, userId, isAdmin);
    res.status(200).json(order);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * GET /order/orders/user/:userId
 * Ver órdenes del usuario
 */
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validar que el usuario solo pueda ver sus propias órdenes
    if (req.user.id !== parseInt(userId) && req.user.role !== 1) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const orders = await orderService.getUserOrders(userId);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /order/admin/orders
 * Ver todas las órdenes (Admin)
 */
const getAllOrders = async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /order/admin/concert/:id/sales
 * Ver ventas por concierto (Admin)
 */
const getSalesByConcert = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await orderService.getSalesByConcert(id);
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  confirmOrder,
  getUserOrders,
  getAllOrders,
  getSalesByConcert,
  getOrderById,
};