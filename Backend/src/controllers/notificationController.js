import { prisma } from "../config/database.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Get all notifications for the logged-in user
 * GET /api/notifications
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
// console.log(userId);

  const allNotifications = await prisma.notification.findMany({
    where: {
      receiverId: userId,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
// console.log(allNotifications);

  // --- SEGRAGATION LOGIC ---
  
  // 1. Pending Notifications (Jo abhi user ne check nahi kiye ya respond nahi kiya)
  const pending = allNotifications.filter(n => n.status === "PENDING");

  // 2. Rest of Notifications (Jo read ho chuke hain ya action liya ja chuka hai)
  const archived = allNotifications.filter(n => n.status !== "PENDING");

  res.status(200).json({
    success: true,
    // Count sirf pending ka bhej rahe hain taaki sidebar/header badge update ho sake
    unreadCount: pending.length, 
    data: {
      pending, // Array of pending notifications
      archived  // Array of Read/Accepted/Declined notifications
    },
  });
});

/**
 * Mark a specific notification as READ/ACCEPTED/DECLINED
 * PATCH /api/notifications/:id/status
 */
export const updateNotificationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // PENDING, READ, ACCEPTED, DECLINED
  const userId = req.user.id;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  // Edge case: If invite was revoked by sender, don't allow accept/decline
  if (notification.isRevoked && (status === "ACCEPTED" || status === "DECLINED")) {
    return res.status(400).json({
      success: false,
      message: "This invitation has been revoked and can no longer be responded to.",
    });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { status },
  });

  res.status(200).json({
    success: true,
    message: `Notification marked as ${status}`,
    data: updated,
  });
});

/**
 * Delete all notifications (Clear Inbox)
 * DELETE /api/notifications/clear
 */
export const clearAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await prisma.notification.deleteMany({
    where: { receiverId: userId },
  });

  res.status(200).json({
    success: true,
    message: "Notifications cleared successfully",
  });
});