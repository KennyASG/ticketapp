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
      references: {
        model: "orders",
        key: "id",
      },
    },
    ticket_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ticket_types",
        key: "id",
      },
    },
    seat_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "seats",
        key: "id",
      },
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
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
    tableName: "tickets",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Ticket;