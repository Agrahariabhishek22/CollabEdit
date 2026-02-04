import express from "express";
import { contactUs } from "../controllers/contactUs.js";

const router = express.Router();

router.post("/contactUs",contactUs);

export default router;


