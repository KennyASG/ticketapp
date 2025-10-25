// order-service/src/models/ReservationSeat.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const ReservationSeat = sequelize.define(
  "ReservationSeat",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "reservations",
        key: "id",
      },
    },
    seat_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "seats",
        key: "id",
      },
    },
    concert_seat_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "concert_seats",
        key: "id",
      },
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "reservation_seats",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = ReservationSeat;