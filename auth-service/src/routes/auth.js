const express = require("express");
const { register, login, getUsers } = require("../controllers/authController");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// protegida: solo admin puede listar usuarios
router.get("/users", authenticate, isAdmin, getUsers);

module.exports = router;
