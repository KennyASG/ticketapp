require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const authRoutes = require("./routes/authRoute");

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);

// Health check endpoint (agregar antes de iniciar el servidor)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'auth-service', 
    timestamp: new Date().toISOString() 
  });
});

const port = process.env.PORT || 3000;

const cors = require('cors');
app.use(cors({
  origin: '*',  
}));

(async () => {
  try {
    await sequelize.sync(); // crea tablas si no existen
    console.log("Database connected and synced");
    
    app.listen(port,'0.0.0.0', () => {
      console.log(`Auth service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();
