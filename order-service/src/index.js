require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./db");
const orderRoutes = require("./routes/orderRoute");

const app = express();
app.use(express.json());
const port = process.env.PORT || 3004;

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));

app.use("/order", orderRoutes);

// Health check endpoint (agregar antes de iniciar el servidor)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'order-service',
    timestamp: new Date().toISOString()
  });
});


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