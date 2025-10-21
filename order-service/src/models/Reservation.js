const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Reservation = sequelize.define(
  "Reservation",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    concert_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "concerts",
        key: "id",
      },
    },
    status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "status_generales",
        key: "id",
      },
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "reservations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Reservation;