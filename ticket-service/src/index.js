require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const ticketRoutes = require("./routes/ticketRoute");

const app = express();
app.use(express.json());

app.use("/", ticketRoutes);

const port = process.env.PORT || 3003;

(async () => {
  try {
    await sequelize.sync();
    console.log("Database connected and synced");
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`TICKETS service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();