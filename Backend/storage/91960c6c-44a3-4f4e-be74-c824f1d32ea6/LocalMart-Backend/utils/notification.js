import { Notification } from "../models/notifications.js";

export const createOrderNotification = async (shopId, orderId) => {
  await Notification.create({
    shopId,
    type: "order",
    message: `New order received: Order ID ${orderId}`,
  });
};
export const createLowStockAlert = async (shopId, productId, productName) => {
    await Notification.create({
      shopId,
      type: "lowStock",
      productId,
      message: `Low stock alert for ${productName}`,
    });
  };

  export const getUnreadNotifications = async (shopId) => {
    return await Notification.find({ shopId, read: false }).sort({ createdAt: -1 });
  };
  
