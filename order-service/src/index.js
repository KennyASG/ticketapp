require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const orderRoutes = require("./routes/orderRoute");

const app = express();
app.use(express.json());

app.use("/order", orderRoutes);

const port = process.env.PORT || 3004;

(async () => {
  try {
    await sequelize.sync();
    console.log("Database connected and synced");
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`ORDERS service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();