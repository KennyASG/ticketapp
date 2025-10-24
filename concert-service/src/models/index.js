const sequelize = require("../db");

// Importar todos los modelos
const Concert = require("./Concert");
const Venue = require("./Venue");
const VenueSection = require("./VenueSection");
const Seat = require("./Seat");
const ConcertVenueDetail = require("./ConcertVenueDetail");
const ConcertSeat = require("./ConcertSeat");
const StatusGeneral = require("./StatusGeneral");
const TicketType = require("./TicketType");

/**
 * DEFINICIÓN DE RELACIONES
 */

// Concert - StatusGeneral (Many to One)
Concert.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

StatusGeneral.hasMany(Concert, {
  foreignKey: "status_id",
  as: "concerts",
});

// Concert - Venue (Many to Many)
Concert.belongsToMany(Venue, {
  through: ConcertVenueDetail,
  foreignKey: "concert_id",
  otherKey: "venue_id",
  as: "venues",
});

Venue.belongsToMany(Concert, {
  through: ConcertVenueDetail,
  foreignKey: "venue_id",
  otherKey: "concert_id",
  as: "concerts",
});

// Concert - ConcertVenueDetail
Concert.hasMany(ConcertVenueDetail, {
  foreignKey: "concert_id",
  as: "venueDetails",
});

ConcertVenueDetail.belongsTo(Concert, {
  foreignKey: "concert_id",
  as: "concert",
});

ConcertVenueDetail.belongsTo(Venue, {
  foreignKey: "venue_id",
  as: "venue",
});

// Venue - VenueSection
Venue.hasMany(VenueSection, {
  foreignKey: "venue_id",
  as: "sections",
});

VenueSection.belongsTo(Venue, {
  foreignKey: "venue_id",
  as: "venue",
});

// VenueSection - Seat
VenueSection.hasMany(Seat, {
  foreignKey: "section_id",
  as: "seats",
});

Seat.belongsTo(VenueSection, {
  foreignKey: "section_id",
  as: "section",
});

// Concert - ConcertSeat
Concert.hasMany(ConcertSeat, {
  foreignKey: "concert_id",
  as: "concertSeats",
});

ConcertSeat.belongsTo(Concert, {
  foreignKey: "concert_id",
  as: "concert",
});

// Seat - ConcertSeat
Seat.hasMany(ConcertSeat, {
  foreignKey: "seat_id",
  as: "concertSeats",
});

ConcertSeat.belongsTo(Seat, {
  foreignKey: "seat_id",
  as: "seat",
});

// StatusGeneral - ConcertSeat
StatusGeneral.hasMany(ConcertSeat, {
  foreignKey: "status_id",
  as: "concertSeats",
});

ConcertSeat.belongsTo(StatusGeneral, {
  foreignKey: "status_id",
  as: "status",
});

// Concert - TicketType
Concert.hasMany(TicketType, {
  foreignKey: "concert_id",
  as: "ticketTypes",
});

TicketType.belongsTo(Concert, {
  foreignKey: "concert_id",
  as: "concert",
});

// VenueSection - TicketType
VenueSection.hasMany(TicketType, {
  foreignKey: "section_id",
  as: "ticketTypes",
});

TicketType.belongsTo(VenueSection, {
  foreignKey: "section_id",
  as: "section",
});

module.exports = {
  sequelize,
  Concert,
  Venue,
  VenueSection,
  Seat,
  ConcertVenueDetail,
  ConcertSeat,
  StatusGeneral,
  TicketType,
};