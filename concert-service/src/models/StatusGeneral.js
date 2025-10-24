const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const StatusGeneral = sequelize.define(
  "StatusGeneral",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    dominio: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "status_generales",
    timestamps: false,
  }
);

module.exports = StatusGeneral;