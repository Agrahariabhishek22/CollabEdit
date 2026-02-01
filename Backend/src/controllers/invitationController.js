import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { prisma } from "../config/database.js";
import { getIO } from "../config/socketio.js";
import { emitToUser } from "../socket/events.js";

export const sendInvitations = asyncHandler(async (req, res) => {
  const { resourceId, invites } = req.body; 
  const senderId = req.user.id;

  // Verification: Is sender the admin?
  const resource = await prisma.fileMeta.findUnique({ 
    where: { id: resourceId },
    include: { collaboratorDetail: true } 
  });

  if (resource.collaboratorDetail.adminId !== senderId) {
    throw new AppError("Unauthorized", 403);
  }

  for (const invite of invites) {
    const receiver = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!receiver) continue;

    // Create Notification with Metadata
    const notif = await prisma.notification.create({
      data: {
        receiverId: receiver.id,
        senderId: senderId,
        type: "INVITE",
        // Metadata as JSON string for security and easy parsing
        message: JSON.stringify({
          text: `${req.user.name} invited you to ${resource.name}`,
          resourceId,
          mode: invite.mode
        })
      }
    });

    // Real-time alert to User Room
    emitToUser(getIO(), receiver.id, "NEW_INVITATION", {
      notifId: notif.id,
      message: `${req.user.name} wants you to collaborate!`
    });
  }

  res.status(200).json({ success: true, message: "Invites sent!" });
});
export const respondToInvitation = asyncHandler(async (req, res) => {
  const { notifId, action } = req.body; // action: 'ACCEPT' or 'REJECT'
  const userId = req.user.id;

  // 1. Notification fetch karo metadata nikalne ke liye
  const notification = await prisma.notification.findUnique({
    where: { id: notifId }
  });

  // Security Check: Kya notification exist karti hai aur isi user ki hai?
  if (!notification || notification.receiverId !== userId) {
    throw new AppError("Invalid or unauthorized invitation", 401);
  }

  // Pehle hi check kar lo agar status already PENDING nahi hai
  if (notification.status !== "PENDING") {
    throw new AppError("Invitation already processed", 400);
  }

  if (action === "ACCEPT") {
    const metadata = JSON.parse(notification.message);
    const { resourceId, mode } = metadata;

    // Humein projectId chahiye user ke accessibleProjectIds array ke liye
    const resource = await prisma.fileMeta.findUnique({
      where: { id: resourceId },
      select: { projectId: true }
    });

    if (!resource) throw new AppError("Resource no longer exists", 404);

    const updateField = mode === "EDITOR" ? "editors" : "viewers";

    // 2. Atomic Transaction: Sab kuch ek sath update hoga
    await prisma.$transaction([
      // A. Resource ke collaborator list mein user ko add karo
      prisma.collaboratorDetail.update({
        where: { fileMetaId: resourceId },
        data: { [updateField]: { push: userId } }
      }),

      // B. User ke profile mein accessibleProjectIds array update karo
      prisma.user.update({
        where: { id: userId },
        data: { 
          accessibleProjectIds: { 
            // set logic check kar lena, agar already exists toh skip ya push
            push: resource.projectId 
          } 
        }
      }),

      // C. Notification status update karo
      prisma.notification.update({
        where: { id: notifId },
        data: { status: "ACCEPTED" }
      })
    ]);

    // Optional: Admin ko bhi socket se batana ki "User has accepted"
    emitToUser(getIO(), notification.senderId, "INVITATION_ACCEPTED", { userName: req.user.name });

  } else {
    // REJECT logic: Notification delete ya REJECTED status
    await prisma.notification.update({
      where: { id: notifId },
      data: { status: "REJECTED" } // Delete ki jagah status change is better for history
    });
  }

  res.status(200).json({ 
    success: true, 
    message: `Invitation ${action === 'ACCEPT' ? 'accepted' : 'rejected'} successfully` 
  });
});