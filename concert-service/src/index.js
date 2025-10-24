require("dotenv").config();
const express = require("express");
const sequelize = require("./db");
const concertRoutes = require("./routes/concertRoute");

const app = express();
app.use(express.json());

app.use("/concert", concertRoutes);

// Health check endpoint (agregar antes de iniciar el servidor)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'concert-service', 
    timestamp: new Date().toISOString() 
  });
});

const port = process.env.PORT || 3001;

(async () => {
  try {
    await sequelize.sync(); // crea tablas si no existen
    console.log("Database connected and synced");
    
    app.listen(port, () => {
      console.log(`CONCERT service running on port ${port}`);
    });
  } catch (err) {
    console.error("Unable to connect to DB:", err);
  }
})();
