const { registerUser, loginUser, listUsers } = require("../services/authService");

async function register(req, res) {
  try {
    const user = await registerUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const result = await loginUser(req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function getUsers(req, res) {
  const users = await listUsers();
  res.json(users);
}

module.exports = { register, login, getUsers };
