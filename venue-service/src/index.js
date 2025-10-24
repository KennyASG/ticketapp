require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const venueRoutes = require("./routes/venueRoute");

const app = express();
app.use(express.json());

app.use("/venue", venueRoutes);

const cors = require('cors');
app.use(cors());

const port = process.env.PORT || 3002;

(async () => {
  try {
    await sequelize.sync();
    console.log("Database connected and synced");
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`VENUE service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();