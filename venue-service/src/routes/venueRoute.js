const express = require("express");
const router = express.Router();
const venueController = require("../controllers/venueController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas públicas
// ===============================

router.get("/venues", venueController.getAllVenues);
router.get("/venues/:id", venueController.getVenueById);
router.get("/venues/:id/sections", venueController.getSectionsByVenue);

// ===============================
//  Rutas de administración
// ===============================

router.post("/admin/venues", authenticate, isAdmin, venueController.createVenue);
router.put("/admin/venues/:id", authenticate, isAdmin, venueController.updateVenue);
router.delete("/admin/venues/:id", authenticate, isAdmin, venueController.deleteVenue);

router.post("/admin/venues/:id/sections", authenticate, isAdmin, venueController.createSection);
router.put("/admin/venues/:id/sections/:sectionId", authenticate, isAdmin, venueController.updateSection);
router.delete("/admin/venues/:id/sections/:sectionId", authenticate, isAdmin, venueController.deleteSection);

module.exports = router;