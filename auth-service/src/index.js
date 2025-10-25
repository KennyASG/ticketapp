require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./db");
const authRoutes = require("./routes/authRoute");
//redeploy
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));

app.use(express.json());

app.use("/auth", authRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "auth-service", timestamp: new Date().toISOString() });
});

(async () => {
  try {
    await sequelize.sync();
    console.log("Database connected and synced");
    app.listen(port, "0.0.0.0", () => console.log(`Auth service running on port ${port}`));
  } catch (err) {
    console.error("Unable to connect to DB, please check:", err);
  }
})();
