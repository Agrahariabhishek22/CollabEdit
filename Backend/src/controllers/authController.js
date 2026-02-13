// Authentication Controller
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { setSession, deleteSession, blacklistToken } from "../config/redis.js";
import { config } from "../config/env.js";
import { AppError, asyncHandler } from "../middlewares/errorHandler.js";

// Pehle: const generateToken = (id) => ...
// Ab: Aise likho
export const generateToken = (payload) => {
  return jwt.sign(
    payload, // Ab isme id, name, email teeno honge
    config.JWT_SECRET,
    { expiresIn: "7d" },
  );
};

// Signup Controller
// Signup Controller
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    throw new AppError("Bhai, saari details bharna zaroori hai!", 400);
  }

  if (password !== confirmPassword) {
    throw new AppError("Passwords match nahi kar rahe", 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("Is email se pehle hi account bana hua hai", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true }, // Password return nahi karna
  });

  const token = generateToken({
    id: user.id,
    name: user.name,
    email: user.email,
  });

  // Redis Session
  await setSession(user.id, {
    userId: user.id,
    email: user.email,
    loginAt: new Date(),
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });
  console.log(user, token);

  return res.status(201).json({
    success: true,
    message: "Account ban gaya bhai!",
    data: { user, token },
  });
});

// Login Controller
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email aur Password dono chahiye", 400);
  }

  // Pure user object ko fetch karein (taaki password mile)
  const user = await prisma.user.findUnique({ where: { email } });

  // Security tip: Dono cases mein 401 aur same message
  if (!user) {
    throw new AppError("Email ya Password galat hai", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Email ya Password galat hai", 401);
  }

  const token = generateToken({
    id: user.id,
    name: user.name,
    email: user.email,
  });

  await setSession(user.id, {
    userId: user.id,
    email: user.email,
    loginAt: new Date(),
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });

  return res.status(200).json({
    success: true,
    message: "Login successful!",
    data: {
      user: { id: user.id, name: user.name, email: user.email },
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
