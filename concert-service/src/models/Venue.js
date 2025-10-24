const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Venue = sequelize.define(
  "Venue",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
  },
  {
    tableName: "venues",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Venue;