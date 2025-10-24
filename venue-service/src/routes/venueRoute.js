const express = require("express");
const router = express.Router();
const venueController = require("../controllers/venueController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// ===============================
//  Rutas públicas
// ===============================

router.get("/venues", venueController.getAllVenues);
router.get("/:id", venueController.getVenueById);
router.get("/:id/sections", venueController.getSectionsByVenue);

// ===============================
//  Rutas de administración
// ===============================

router.post("/admin/venue", authenticate, isAdmin, venueController.createVenue);
router.put("/admin/venue/:id", authenticate, isAdmin, venueController.updateVenue);
router.delete("/admin/venue/:id", authenticate, isAdmin, venueController.deleteVenue);

router.post("/admin/venue/:id/section", authenticate, isAdmin, venueController.createSection);
router.put("/admin/venue/:id/section/:sectionId", authenticate, isAdmin, venueController.updateSection);
router.delete("/admin/venue/:id/section/:sectionId", authenticate, isAdmin, venueController.deleteSection);

module.exports = router;