const sequelize = require("../db");

// Importar todos los modelos
const TicketType = require("./TicketType");
const Reservation = require("./Reservation");
const Concert = require("./Concert");
const User = require("./User");
const StatusGeneral = require("./StatusGeneral");
const ConcertSeat = require("./ConcertSeat");
const Seat = require("./Seat");
const VenueSection = require("./VenueSection");

/**
 * DEFINICIÓN DE RELACIONES
 */

// Concert - TicketType (One to Many)
Concert.hasMany(TicketType, {
  foreignKey: "concert_id",
  as: "ticketTypes",
});

TicketType.belongsTo(Concert, {
  foreignKey: "concert_id",
  as: "concert",
});

// VenueSection - TicketType (One to Many)
VenueSection.hasMany(TicketType, {
  foreignKey: "section_id",
  as: "ticketTypes",
});

TicketType.belongsTo(VenueSection, {
  foreignKey: "section_id",
  as: "section",
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

// VenueSection - Seat (One to Many)
VenueSection.hasMany(Seat, {
  foreignKey: "section_id",
  as: "seats",
});

Seat.belongsTo(VenueSection, {
  foreignKey: "section_id",
  as: "section",
});

// Exportar modelos y sequelize
module.exports = {
  sequelize,
  TicketType,
  Reservation,
  Concert,
  User,
  StatusGeneral,
  ConcertSeat,
  Seat,
  VenueSection,
};