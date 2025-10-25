require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./db");
const concertRoutes = require("./routes/concertRoute");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));


app.use(express.json());

app.use("/concert", concertRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "concert-service",
    timestamp: new Date().toISOString()
  });
});

(async () => {
  try {
    await sequelize.sync();
    console.log("Database connected and synced");
    app.listen(port, "0.0.0.0", () => {
      console.log(`CONCERT service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();
