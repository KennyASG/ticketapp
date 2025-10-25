// order-service/src/models/index.js
const sequelize = require("../db");

// Importar todos los modelos
const Order = require("./Order");
const OrderItem = require("./OrderItem");
const Ticket = require("./Ticket");
const Payment = require("./Payment");
const Reservation = require("./Reservation");
const ReservationSeat = require("./ReservationSeat"); // ✅ AGREGAR ESTO
const User = require("./User");
const Concert = require("./Concert");
const TicketType = require("./TicketType");
const Seat = require("./Seat");
const StatusGeneral = require("./StatusGeneral");
const ConcertSeat = require("./ConcertSeat");
const OrderSeat = require("./OrderSeat");

/**
 * DEFINICIÓN DE RELACIONES
 */

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

// StatusGeneral - Order (One to Many)
StatusGeneral.hasMany(Order, {
  foreignKey: "status_id",
  as: "orders",
});

Order.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

// Order - OrderItem (One to Many)
Order.hasMany(OrderItem, {
  foreignKey: "order_id",
  as: "items",
});

OrderItem.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// TicketType - OrderItem (One to Many)
TicketType.hasMany(OrderItem, {
  foreignKey: "ticket_type_id",
  as: "orderItems",
});

OrderItem.belongsTo(TicketType, {
  foreignKey: "ticket_type_id",
  as: "ticketType",
});

// Seat - OrderItem (One to Many)
Seat.hasMany(OrderItem, {
  foreignKey: "seat_id",
  as: "orderItems",
});

OrderItem.belongsTo(Seat, {
  foreignKey: "seat_id",
  as: "seat",
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

// TicketType - Ticket (One to Many)
TicketType.hasMany(Ticket, {
  foreignKey: "ticket_type_id",
  as: "tickets",
});

Ticket.belongsTo(TicketType, {
  foreignKey: "ticket_type_id",
  as: "ticketType",
});

// Seat - Ticket (One to Many)
Seat.hasMany(Ticket, {
  foreignKey: "seat_id",
  as: "tickets",
});

Ticket.belongsTo(Seat, {
  foreignKey: "seat_id",
  as: "seat",
});

// StatusGeneral - Ticket (One to Many)
StatusGeneral.hasMany(Ticket, {
  foreignKey: "status_id",
  as: "tickets",
});

Ticket.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

// Order - Payment (One to One)
Order.hasOne(Payment, {
  foreignKey: "order_id",
  as: "payment",
});

Payment.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// StatusGeneral - Payment (One to Many)
StatusGeneral.hasMany(Payment, {
  foreignKey: "status_id",
  as: "payments",
});

Payment.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

// User - Reservation (One to Many)
User.hasMany(Reservation, {
  foreignKey: "user_id",
  as: "reservations",
});

Reservation.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Concert - Reservation (One to Many)
Concert.hasMany(Reservation, {
  foreignKey: "concert_id",
  as: "reservations",
});

Reservation.belongsTo(Concert, {
  foreignKey: "concert_id",
  as: "concert",
});

// StatusGeneral - Reservation (One to Many)
StatusGeneral.hasMany(Reservation, {
  foreignKey: "status_id",
  as: "reservations",
});

Reservation.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

// ConcertSeat - Seat (Many to One)
ConcertSeat.belongsTo(Seat, {
  foreignKey: "seat_id",
  as: "seat",
});

Seat.hasMany(ConcertSeat, {
  foreignKey: "seat_id",
  as: "concertSeats",
});

// ConcertSeat - StatusGeneral (Many to One)
ConcertSeat.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

StatusGeneral.hasMany(ConcertSeat, {
  foreignKey: "status_id",
  as: "concertSeats",
});

// ============================================
// ✅ NUEVAS RELACIONES: ReservationSeat
// ============================================

// Reservation - ReservationSeat (One to Many)
Reservation.hasMany(ReservationSeat, {
  foreignKey: "reservation_id",
  as: "reservation_seats",
});

ReservationSeat.belongsTo(Reservation, {
  foreignKey: "reservation_id",
  as: "reservation",
});

// Seat - ReservationSeat (One to Many)
Seat.hasMany(ReservationSeat, {
  foreignKey: "seat_id",
  as: "reservation_seats",
});

ReservationSeat.belongsTo(Seat, {
  foreignKey: "seat_id",
  as: "seat",
});

// ConcertSeat - ReservationSeat (One to Many)
ConcertSeat.hasMany(ReservationSeat, {
  foreignKey: "concert_seat_id",
  as: "reservation_seats",
});

ReservationSeat.belongsTo(ConcertSeat, {
  foreignKey: "concert_seat_id",
  as: "concert_seat",
});

// ============================================
// RELACIONES: OrderSeat
// ============================================

// Order - OrderSeat (One to Many)
Order.hasMany(OrderSeat, {
  foreignKey: "order_id",
  as: "order_seats",
});

OrderSeat.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// Seat - OrderSeat (One to Many)
Seat.hasMany(OrderSeat, {
  foreignKey: "seat_id",
  as: "order_seats",
});

OrderSeat.belongsTo(Seat, {
  foreignKey: "seat_id",
  as: "seat",
});

// ConcertSeat - OrderSeat (One to Many)
ConcertSeat.hasMany(OrderSeat, {
  foreignKey: "concert_seat_id",
  as: "order_seats",
});

OrderSeat.belongsTo(ConcertSeat, {
  foreignKey: "concert_seat_id",
  as: "concert_seat",
});

// Exportar modelos y sequelize
module.exports = {
  sequelize,
  Order,
  OrderItem,
  Ticket,
  Payment,
  Reservation,
  ReservationSeat, // ✅ AGREGAR ESTO
  User,
  Concert,
  TicketType,
  Seat,
  StatusGeneral,
  ConcertSeat,
  OrderSeat,
};