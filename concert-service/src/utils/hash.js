const bcrypt = require("bcrypt");

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function comparePassword(password, hashed) {
  return await bcrypt.compare(password, hashed);
}

module.exports = { hashPassword, comparePassword };
