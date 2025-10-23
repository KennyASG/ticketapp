const sequelize = require("../db");

// Importar todos los modelos
const Venue = require("./Venue");
const VenueSection = require("./VenueSection");
const Seat = require("./Seat");

/**
 * DEFINICIÓN DE RELACIONES
 */

// Venue - VenueSection (One to Many)
Venue.hasMany(VenueSection, {
  foreignKey: "venue_id",
  as: "sections",
  onDelete: "CASCADE",
});

VenueSection.belongsTo(Venue, {
  foreignKey: "venue_id",
  as: "venue",
});

// VenueSection - Seat (One to Many)
VenueSection.hasMany(Seat, {
  foreignKey: "section_id",
  as: "seats",
  onDelete: "CASCADE",
});

Seat.belongsTo(VenueSection, {
  foreignKey: "section_id",
  as: "section",
});

// Exportar modelos y sequelize
module.exports = {
  sequelize,
  Venue,
  VenueSection,
  Seat,
};