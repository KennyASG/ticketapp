const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Ticket = sequelize.define(
  "Ticket",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ticket_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    seat_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "tickets",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Ticket;