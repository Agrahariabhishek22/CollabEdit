import express from "express"
import { protect } from "../middlewares/auth.js";
import { clearAllNotifications, getUserNotifications, updateNotificationStatus } from "../controllers/notificationController.js";

const router=express.Router()


router.get("/", protect, getUserNotifications);
router.patch("/:id/status", protect, updateNotificationStatus);
router.delete("/clear", protect, clearAllNotifications);


export default router;