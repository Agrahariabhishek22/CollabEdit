// JWT Authentication Middleware
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { isTokenBlacklisted, getSession } from "../config/redis.js";
import { AppError, asyncHandler } from "./errorHandler.js";

export const protect = asyncHandler(async (req, res, next) => {
  // Get token from cookie or header
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new AppError("Not authenticated. Please login first", 401);
  }

  // Check if token is blacklisted (logged out)
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    throw new AppError("Token has been revoked. Please login again", 401);
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;

    // Check session in Redis
    const session = await getSession(decoded.id);
    if (!session) {
      throw new AppError("Session expired. Please login again", 401);
    }

    req.session = session;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new AppError("Token expired. Please login again", 401);
    }
    throw new AppError("Invalid token", 401);
  }
});

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    throw new AppError("Admin access required", 403);
  }
};

export const isOwner = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.id === req.params.userId) {
    next();
  } else {
    throw new AppError("You don't have permission to access this resource", 403);
  }
});
