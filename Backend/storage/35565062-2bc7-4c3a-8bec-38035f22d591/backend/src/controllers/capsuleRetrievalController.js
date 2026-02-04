import Capsule from "../models/capsule.js";
import User from "../models/user.js";
import { decryptFileStream, decryptText } from "../utils/encryption.js";

export const downloadCapsuleFile = async (req, res) => {
  const { capsuleId, contentIndex } = req.params;
  const password = req.decryptionPassword;

  const capsule = await Capsule.findById(capsuleId);
  const user = await User.findById(req.user.userId);

  const fileItem = capsule.content[contentIndex];

  const decryptedStream = decryptFileStream(
    fileItem.encryptedFilePath,
    fileItem.iv,
    fileItem.authTag,
    fileItem.lockedKey,
    user.privateKey,
    password
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileItem.originalName}"`
  );
  res.setHeader("Content-Type", fileItem.mimeType);

  decryptedStream.pipe(res);
};

export const getDeliveredCapsules = async (req, res) => {
  try {
    console.log("inside get capsules");

    const password = req.decryptionPassword;
    if (!password) {
      return res
        .status(400)
        .json({ message: "Password is required to decrypt capsules" });
    }
    const user = await User.findById(req.user.userId);

    const capsules = await Capsule.find({
      ownerId: user._id,
      deliveryStatus: "DELIVERED",
    });
    if (capsules.length === 0) {
      return res
        .status(200)
        .json({ success:true,message: "No delivered capsules yet", capsules: [] });
    }

    const decryptedCapsules = capsules.map((cap) => {
      try {
        const decryptedContent = cap.content
          .map((item, index) => {
            if (item.type === "text") {
              const text = decryptText(
                item.encryptedData,
                item.iv,
                item.authTag,
                item.lockedKey,
                user.privateKey,
                password
              );

              return {
                type: "text",
                text,
              };
            }

            if (item.type === "file") {
              return {
                type: "file",
                fileName: item.originalName,
                mimeType: item.mimeType,
                size: item.size,
                downloadUrl: `/capsules/${cap._id}/files/${index}`,
              };
            }

            return null;
          })
          .filter(Boolean);

        const webhookUrl = `${process.env.WEBHOOK_URL}/${cap?.webhookId}`;

        // Optional Chaining logic
        return {
          id: cap._id,
          title: cap.title,
          triggerType: cap.triggerType, // DATE_TIME, LOCATION, or WEBHOOK
          deliveryTime: cap.deliveryTime || null,
          decryptedContent: decryptedContent || [],
          location:
            cap.triggerType === "LOCATION"
              ? {
                  city: cap?.location?.city,
                  country: cap?.location?.country,
                }
              : undefined,

          webhookData:
            cap.triggerType === "CUSTOM"
              ? {
                  webhookUrl: webhookUrl,
                }
              : undefined,
          Github:
            cap.triggerType === "GITHUB_PR"
              ? {
                  githubPrs: cap?.githubPrs,
                }
              : undefined,

          createdAt: cap.createdAt,
        };
      } catch (err) {
        console.error(`Decryption failed for ${cap._id}:`, err.message);
        return { id: cap._id, title: cap.title, error: "Locked/Invalid Key" };
      }
    });

    return res.status(200).json({
      success: true,
      total: decryptedCapsules.length,
      capsules: decryptedCapsules,
    });
  } catch (error) {
    console.error("GetCapsules Error:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch and decrypt capsules" });
  }
};

export const getUndeliveredCapsules = async (req, res) => {
  try {
    console.log("inside getUndeliveredCapsules");
    const userId = req.user.userId;

    const capsules = await Capsule.find({
      ownerId: userId,
      deliveryStatus: {$in: ["PENDING", "PROCESSING"]},
    });

    if (capsules.length === 0) {
      return res
        .status(200)
        .json({ message: "No undelivered capsules yet", capsules: [] });
    }

    const formattedCapsules = capsules.map((cap) => ({
      id: cap._id,
      title: cap.title,
      deliveryTime: cap?.deliveryTime || null,
      triggerType: cap.triggerType,
      location:
        cap.triggerType === "LOCATION"
          ? {
              city: cap?.location?.city,
              country: cap?.location?.country,
            }
          : undefined,

      webhookData:
        cap.triggerType === "CUSTOM"
          ? {
              webhookUrl: `${process.env.WEBHOOK_URL}/${cap?.webhookId}`,
            }
          : undefined,
      Github:
        cap.triggerType === "GITHUB_PR"
          ? {
              githubPrs: cap?.githubPrs,
            }
          : undefined,

      createdAt: cap.createdAt,
    }));

    return res.status(200).json({
      message: "All undelivered capsules",
      formattedCapsules,
    });
  } catch (error) {
    console.log("Error", error.message);
  }
};
