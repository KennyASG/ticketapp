const express = require("express");
const router = express.Router();
const concertController = require("../controllers/concertController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas para gestión de conciertos (Admin)
// ===============================

// Listar todos los conciertos
router.get("/concerts", authenticate, concertController.getAllConcerts);

// Obtener un concierto por ID
router.get("/:id", authenticate, concertController.getConcertById);

// Crear un nuevo concierto
router.post("/admin/concert", authenticate, isAdmin, concertController.createConcert);

// Actualizar un concierto existente
router.put("/admin/concert/:id", authenticate, isAdmin, concertController.updateConcert);

// Eliminar un concierto
router.delete("/admin/concert/:id", authenticate, isAdmin, concertController.deleteConcert);

module.exports = router;
