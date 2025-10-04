const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "Token required" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Invalid token format" });

    const decoded = verifyToken(token);


    // opcional: traer usuario de la BD para validar que existe
    // const user = await User.findByPk(decoded.id);
    // if (!user) return res.status(401).json({ error: "User not found" });

    // console.log(user, '////////////////////')
    req.user = decoded; // inyectamos usuario en la request
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

function isAdmin(req, res, next) {
  console.log(req.user.role , '=============')
  if (req.user.role !== 1) {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}

module.exports = { authenticate, isAdmin };
