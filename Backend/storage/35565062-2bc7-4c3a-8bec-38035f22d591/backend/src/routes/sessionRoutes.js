import express from "express"
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { generateSession } from "../controllers/sessionController.js";
import {  validateDecryptionSession } from "../middlewares/sessionMiddleware.js";
const router=express.Router();


router.post("/check",authMiddleware,validateDecryptionSession);
router.post("/generate",authMiddleware,generateSession);

export default router; 