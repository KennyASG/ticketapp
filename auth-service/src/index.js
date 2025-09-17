require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const authRoutes = require("./routes/auth");

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);

const port = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.sync(); // crea tablas si no existen
    console.log("Database connected and synced");
    
    app.listen(port, () => {
      console.log(`Auth service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();
