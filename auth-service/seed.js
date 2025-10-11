require("dotenv").config();
const sequelize = require("./src/db");
const User = require("./src/models/User");
const { hashPassword } = require("./src/utils/hash");

async function seed() {
  try {
    await sequelize.sync({ force: true }); // elimina y recrea tablas
    console.log("Database synced");

    // Hashear contraseñasaas
    const adminPass = await hashPassword("admin123");
    const user1Pass = await hashPassword("user123");
    const user2Pass = await hashPassword("user123");

    // Crear usuarios
    await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: adminPass,
      role: "admin",
    });

    await User.create({
      name: "Juan Pérez",
      email: "juan@example.com",
      password: user1Pass,
      role: "user",
    });

    await User.create({
      name: "María López",
      email: "maria@example.com",
      password: user2Pass,
      role: "user",
    });

    console.log("Users seeded successfully ✅");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding users:", err);
    process.exit(1);
  }
}

seed();
