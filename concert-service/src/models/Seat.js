const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Seat = sequelize.define(
  "Seat",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "venue_sections",
        key: "id",
      },
    },
    seat_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "seats",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Seat;