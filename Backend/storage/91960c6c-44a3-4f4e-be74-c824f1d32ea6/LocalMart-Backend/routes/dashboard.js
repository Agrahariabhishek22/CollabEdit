import express from "express";
import {stats,toggleShopStatus} from "../controllers/dashboard.js";
import { authenticateOwner } from "../middlewares/authenticate.js";

const router = express.Router();


router.get("/stats", authenticateOwner,stats);
router.post("/toggle-shop-status",authenticateOwner,toggleShopStatus)

export default router;
