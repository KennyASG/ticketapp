require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const venueRoutes = require("./routes/venueRoute");
const cors = require("cors");

const app = express();
app.use(express.json());
//test

const port = process.env.PORT || 3002;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));

app.use(express.json());

app.use("/venue", venueRoutes);

// Health check endpoint (agregar antes de iniciar el servidor)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'venue-service',
    timestamp: new Date().toISOString()
  });
});


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