const sequelize = require("../db");

// Importar todos los modelos
const User = require("./User");
const Role = require("./Role");
const PasswordReset = require("./PasswordReset");

/**
 * DEFINICIÓN DE RELACIONES
 */

// User - Role (Many to One)
User.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

Role.hasMany(User, {
  foreignKey: "role_id",
  as: "users",
});

// User - PasswordReset (One to Many)
User.hasMany(PasswordReset, {
  foreignKey: "user_id",
  as: "passwordResets",
});

PasswordReset.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Exportar modelos y sequelize
module.exports = {
  sequelize,
  User,
  Role,
  PasswordReset,
};