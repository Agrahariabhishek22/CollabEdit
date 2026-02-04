import { Notification } from "../models/notifications.js";
import mongoose from "mongoose";
// Get all unread notifications for a specific shop
export const getUnreadNotifications = async (req, res) => {
  try {
    const  shopId  = req.ownerId;
  
    // Fetch unread notifications for the given shop
    const notifications = await Notification.find({ shopId, read: false }).sort({ createdAt: -1 });

    res.status(201).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications", error });
  }
};

// Mark all notifications as read for a specific shop
export const markAllAsRead = async (req, res) => {
  try {
    const  shopId  = req.ownerId;
   
    // Update all unread notifications to read
    await Notification.updateMany({ shopId, read: false }, { $set: { read: true } });

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error updating notifications", error });
  }
};


export const getUnreadNotificationsForCustomer = async (req, res) => {
  try {
    console.log("object")
    const customerId = req.customerId;
    

    // Fetch unread notifications for the given shop
    const notifications = await Notification.find({ customerId, read: false }).sort({ createdAt: -1 });
    console.log(notifications)
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications", error });
  }
};

// Mark all notifications as read for a specific shop
export const markAllAsReadForCustomer = async (req, res) => {
  try {
    const customerId = req.customerId;
    // console.log("cusomter read ",customerId)

    // Update all unread notifications to read
   
    await Notification.updateMany({ customerId, read: false }, { $set: { read: true } });

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error updating notifications", error });
  }
};
