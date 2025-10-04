const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "changeme";

function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "1h" });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { generateToken, verifyToken };
