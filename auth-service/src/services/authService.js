const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateToken } = require("../utils/jwt");

async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error("User already exists");

  const hashed = await hashPassword(password);
  const user = await User.create({ name, email, password: hashed });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function loginUser({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new Error("Invalid credentials");

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const token = generateToken({ id: user.id, role: user.role });
  return { token };
}

async function listUsers() {
  return await User.findAll({ attributes: ["id", "name", "email", "role", "createdAt"] });
}

module.exports = { registerUser, loginUser, listUsers };
