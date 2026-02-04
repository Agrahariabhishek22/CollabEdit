import Capsule from "../models/capsule.js";
import crypto from "crypto";
import { deliveryQueue } from "../queue/deliveryQueue.js";
import {
  encryptCapsule,
  encryptFile,
  encryptText,
} from "../utils/encryption.js";
import User from "../models/user.js";
import fs from "fs"

export const createWebhookCapsule = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    const emails=req.body.emails;
    if (!user || !user.publicKey) {
      return res
        .status(404)
        .json({ message: "User encryption keys not found" });
    }
    const { title, textMessage } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const content = [];

    // text
    if (textMessage) {
      const encryptedText = encryptText(textMessage, user.publicKey);
      content.push({
        type: "text",
        ...encryptedText,
      });
    }

    // files
    for (const file of req.files) {
      const encryptedFile = await encryptFile(file.path, user.publicKey);

      content.push({
        type: "file",
        encryptedFilePath: encryptedFile.encryptedFilePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        iv: encryptedFile.iv,
        authTag: encryptedFile.authTag,
        lockedKey: encryptedFile.lockedKey,
      });

      fs.unlinkSync(file.path); // delete temp
    }
    const webhookId = crypto.randomBytes(16).toString("hex");

    const capsule = await Capsule.create({
      ownerId: userId,
      title,
      triggerType: "CUSTOM",
      content,
      emails,
      webhookId,
      deliveryStatus: "PENDING",
      reminder1Sent: true,
      reminder7Sent: true,
    });
    const webhookUrl = `${process.env.WEBHOOK_URL}/${webhookId}`;

    return res.status(201).json({
      message: "Custom trigger created successfully",
      webhookUrl,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const unlockWebhookCapsule = async (req, res) => {
  try {
    console.log("inside unlockwebhook");

    const { webhookId } = req.params;
    console.log(webhookId);

    const capsule = await Capsule.findOne({
      webhookId: webhookId.trim(),
      deliveryStatus: "PENDING",
      triggerType: "CUSTOM",
    });

    if (!capsule) {
      return res.status(404).json({
        message: "No capsules found",
      });
    }

    await Capsule.findOneAndUpdate(
      { _id: capsule._id },
      { $set: { deliveryStatus: "PROCESSING" } },
      { new: true }
    );

    await deliveryQueue.add(
      `webhook-delivery-${capsule._id}`,
      {
        capsuleId: capsule._id,
        emails:capsule.emails
      },
      { delay: 10000 }
    );

    return res.status(200).json({
      message: "When Capsule triggers you will recieve the mail shortly",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json(error.message);
  }
};
