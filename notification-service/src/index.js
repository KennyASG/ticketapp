require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./db");
const notificationRoutes = require("./routes/notificationRoute");

const app = express();
const port = process.env.PORT || 3005;

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));

app.use(express.json());

app.use("/notification", notificationRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString()
  });
});

(async () => {
  try {
    await sequelize.sync();
    console.log("Database connected and synced");

    app.listen(port, "0.0.0.0", () => {
      console.log(`NOTIFICATIONS service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();
