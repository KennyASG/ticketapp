const sequelize = require("../db");

// Importar todos los modelos
const Notification = require("./Notification");
const User = require("./User");
const Order = require("./Order");
const Concert = require("./Concert");
const Ticket = require("./Ticket");
const StatusGeneral = require("./StatusGeneral");

/**
 * DEFINICIÓN DE RELACIONES
 */

// User - Notification (One to Many)
User.hasMany(Notification, {
  foreignKey: "user_id",
  as: "notifications",
});

Notification.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Order - Notification (One to Many)
Order.hasMany(Notification, {
  foreignKey: "order_id",
  as: "notifications",
});

Notification.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// StatusGeneral - Notification (One to Many)
StatusGeneral.hasMany(Notification, {
  foreignKey: "status_id",
  as: "notifications",
});

Notification.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

// User - Order (One to Many)
User.hasMany(Order, {
  foreignKey: "user_id",
  as: "orders",
});

Order.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Concert - Order (One to Many)
Concert.hasMany(Order, {
  foreignKey: "concert_id",
  as: "orders",
});

Order.belongsTo(Concert, {
  foreignKey: "concert_id",
  as: "concert",
});

// Order - Ticket (One to Many)
Order.hasMany(Ticket, {
  foreignKey: "order_id",
  as: "tickets",
});

Ticket.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// Exportar modelos y sequelize
module.exports = {
  sequelize,
  Notification,
  User,
  Order,
  Concert,
  Ticket,
  StatusGeneral,
};