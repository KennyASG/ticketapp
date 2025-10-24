const { User, Role } = require("../models");
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateToken } = require("../utils/jwt");

/**
 * Registrar nuevo usuario
 */
async function registerUser({ name, email, password, role }) {
  const existing = await User.findOne({ where: { email } });
  
  if (existing) {
    throw new Error("User already exists");
  }

  const hashed = await hashPassword(password);

  const user = await User.create({ 
    name, 
    email, 
    password: hashed, 
    role_id: role 
  });

  await user.reload({
    include: [{
      model: Role,
      as: "role",
      attributes: ["id", "description"],
    }],
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * Login de usuario
 */
async function loginUser({ email, password }) {
  const user = await User.findOne({ 
    where: { email },
    include: [{
      model: Role,
      as: "role",
      attributes: ["id", "description"],
    }],
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken({ 
    id: user.id, 
    role: user.role_id 
  });

  return { 
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

/**
 * Listar todos los usuarios
 */
async function listUsers(options = {}) {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const { count, rows: users } = await User.findAndCountAll({
    attributes: ["id", "name", "email", "role_id", "created_at", "updated_at"],
    include: [{
      model: Role,
      as: "role",
      attributes: ["id", "description"],
    }],
    limit,
    offset,
    order: [["created_at", "DESC"]],
  });

  return {
    users,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}

/**
 * Obtener usuario por ID
 */
async function getUserById(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["password"] },
    include: [{
      model: Role,
      as: "role",
      attributes: ["id", "description"],
    }],
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

/**
 * Actualizar usuario
 */
async function updateUser(userId, data) {
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new Error("User not found");
  }

  if (data.email && data.email !== user.email) {
    const existing = await User.findOne({ where: { email: data.email } });
    
    if (existing) {
      throw new Error("Email already in use");
    }
  }

  if (data.password) {
    data.password = await hashPassword(data.password);
  }

  await user.update(data);

  await user.reload({
    include: [{
      model: Role,
      as: "role",
      attributes: ["id", "description"],
    }],
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * Eliminar usuario
 */
async function deleteUser(userId) {
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new Error("User not found");
  }

  await user.destroy();

  return { message: "User deleted successfully" };
}

module.exports = {
  registerUser,
  loginUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
};