// Authentication Routes
import express from "express";
import {
  signup,
  login,
  logout,
  getCurrentUser,
  verifyToken,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { loginLimiter, signupLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post("/signup", signupLimiter, signup);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get token
 * @access  Public
 */
router.post("/login", loginLimiter, login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and blacklist token
 * @access  Private
 */
router.post("/logout", protect, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get("/me", protect, getCurrentUser);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify if token is valid
 * @access  Private
 */
router.get("/verify", protect, verifyToken);

export default router;
