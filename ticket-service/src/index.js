require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const cors = require("cors");
const ticketRoutes = require("./routes/ticketRoute");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3003;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));



app.use("/", ticketRoutes);


app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ticket-service',
    timestamp: new Date().toISOString()
  });
});


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