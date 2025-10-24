const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const ConcertVenueDetail = sequelize.define(
  "ConcertVenueDetail",
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
    venue_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "venues",
        key: "id",
      },
    },
  },
  {
    tableName: "concert_venue_detail",
    timestamps: false,
  }
);

module.exports = ConcertVenueDetail;