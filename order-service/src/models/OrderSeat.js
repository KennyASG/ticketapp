const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const OrderSeat = sequelize.define(
  "OrderSeat",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "orders",
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
    tableName: "order_seats",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = OrderSeat;