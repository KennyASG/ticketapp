const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const ConcertSeat = sequelize.define(
  "ConcertSeat",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    concert_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "concerts",
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
    status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "status_generales",
        key: "id",
      },
    },
  },
  {
    tableName: "concert_seats",
    timestamps: false,
    updatedAt: "updated_at",
  }
);

module.exports = ConcertSeat;