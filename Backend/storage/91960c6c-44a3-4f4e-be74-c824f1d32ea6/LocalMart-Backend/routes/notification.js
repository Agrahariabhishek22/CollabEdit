import express from "express";
import {
  getUnreadNotifications,
  markAllAsRead,
  getUnreadNotificationsForCustomer,
  markAllAsReadForCustomer
} from "../controllers/notification.js";
import { authenticateOwner } from "../middlewares/authenticate.js"; 
import { authenticateCustomer } from "../middlewares/authenticate.js";
const router = express.Router();

router.get("/customer", authenticateCustomer, getUnreadNotificationsForCustomer);

router.get("/shopkeeper", authenticateOwner, getUnreadNotifications);

router.put("/mark-all-read", authenticateOwner, markAllAsRead);




router.put("/customer/mark-all-read", authenticateCustomer, markAllAsReadForCustomer);

export default router;
