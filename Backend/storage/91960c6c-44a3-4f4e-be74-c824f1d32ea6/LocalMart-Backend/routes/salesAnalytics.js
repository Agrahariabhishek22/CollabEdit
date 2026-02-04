import express from "express";
import { getSalesAnalytics } from "../controllers/salesAnalytics.js";
import { authenticateOwner } from "../middlewares/authenticate.js";

const router = express.Router();

router.get("/:shopId",  getSalesAnalytics);

export default router;
