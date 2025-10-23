const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const TicketType = sequelize.define(
  "TicketType",
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
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "venue_sections",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    available: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "ticket_types",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = TicketType;