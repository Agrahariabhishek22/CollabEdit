// Authentication Controller
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { setSession, deleteSession, blacklistToken } from "../config/redis.js";
import { config } from "../config/env.js";
import { AppError, asyncHandler } from "../middlewares/errorHandler.js";


// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  });
};

// Signup Controller
export const signup = asyncHandler(async (req, res) => {
    console.log("inside signup controller");
    
  const { name, email, password, confirmPassword } = req.body;

  // Validation
  if (!name || !email || !password || !confirmPassword) {
    throw new AppError("Please provide all required fields", 400);
  }

  if (password !== confirmPassword) {
    throw new AppError("Passwords do not match", 400);
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError("User already exists with this email", 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  // Generate token
  const token = generateToken(user.id);

  // Store session in Redis
  await setSession(user.id, {
    userId: user.id,
    email: user.email,
    loginAt: new Date(),
  });

  // Set cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax",
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      user,
      token,
    },
  });
});

// Login Controller
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    throw new AppError("Please provide email and password", 400);
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Invalid password", 401);
  }

  // Generate token
  const token = generateToken(user.id);

  // Store session in Redis
  await setSession(user.id, {
    userId: user.id,
    email: user.email,
    loginAt: new Date(),
  });

  // Set cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax",
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    },
  });
});

// Logout Controller
export const logout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  // Blacklist token
  if (token) {
    await blacklistToken(token, config.SESSION_TTL);
  }

  // Delete session from Redis
  await deleteSession(userId);

  // Clear cookie
  res.clearCookie("token");

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

// Get Current User via id from token
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

// Verify Token
export const verifyToken = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token is valid",
    data: { user: req.user },
  });
});
