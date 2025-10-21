const notificationService = require("../services/notificationService");

/**
 * POST /orders/:id/send-tickets
 */
const sendTickets = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await notificationService.sendTickets(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /orders/:id/send-confirmation
 */
const sendConfirmation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await notificationService.sendConfirmation(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.role === 1 ? null : req.user.id;
    const notifications = await notificationService.getNotifications(userId);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendTickets,
  sendConfirmation,
  getNotifications,
};