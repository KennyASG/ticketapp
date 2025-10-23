const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const VenueSection = sequelize.define(
  "VenueSection",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    venue_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "venues",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "venue_sections",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = VenueSection;