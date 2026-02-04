import Capsule from "../models/capsule.js";
import { deliveryQueue } from "../queue/deliveryQueue.js";
import { encryptFile, encryptText } from "../utils/encryption.js";
import User from "../models/user.js";
import getCoordinates from "../services/geocodingFromDataset.js";
import fs from "fs"
import mongoose from "mongoose";

export const createLocationCapsule = async (req, res) => {
  try {
    console.log("inside location cap creation api");

    const userId = req.user.userId;
    const user = await User.findById(userId);
    const emails=req.body.emails;

    if (!user || !user.publicKey) {
      return res
        .status(404)
        .json({ message: "User encryption keys not found" });
    }
    const { title, city, country, textMessage } = req.body;
    // console.log(address,city,state,country);

    if (!title || !city || !country) {
      return res
        .status(400)
        .json({ message: "Title, City and Country are required" });
    }

    let latitude, longitude;

    try {
      const coords = await getCoordinates(city,country);
      latitude = coords.lat;
      longitude = coords.lng;
    } catch (error) {
      console.log("Error in geodecoding:", error.message);
      return res.status(404).json({
        success:false,
        message: error.message,
      });
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

    // console.log("this is encrypted content",encryptedData);

    const capsule = await Capsule.create({
      ownerId: userId,
      title,
      triggerType: "LOCATION",
      content,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
        city,
        country,
      },
      emails,
      deliveryStatus: "PENDING",
      reminder1Sent: true,
      reminder7Sent: true,
    });

    return res.status(201).json({
      message: "Location capsule created & encrypted!",
      capsule,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({ message: error.message });
  }
};

export const unlockLocationCapsule = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.userId;
    console.log("Input Data:", { 
  lat: latitude, 
  long: longitude, 
  user: userId 
});

    const capsules = await Capsule.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude,latitude] },
          distanceField: "dist.calculated",
          maxDistance: 20000, // 10km range
          query: { ownerId: new mongoose.Types.ObjectId(userId), deliveryStatus: "PENDING" },
          spherical: true
        }
      }
    ]);

    console.log("Capsules found:", capsules)

    let nextInterval = 300000; 

    if (capsules.length === 0) {
      return res.status(200).json({ 
        message: "No capsules nearby.", 
        nextInterval 
      });
    }

    // Identify capsules to trigger
    const TRIGGER_RADIUS = 15000; 
    const toTrigger = capsules.filter(c => c.dist.calculated <= TRIGGER_RADIUS);
    const toWait = capsules.filter(c => c.dist.calculated > TRIGGER_RADIUS);

    if (toTrigger.length > 0) {
      const capsuleIds = toTrigger.map(c => c._id);
      
      await Capsule.updateMany(
        { _id: { $in: capsuleIds } },
        { $set: { deliveryStatus: "PROCESSING" } }
      );

      const jobPromises = toTrigger.map(capsule => {
        return deliveryQueue.add(`location-delivery-${capsule._id}`, {
          capsuleId: capsule._id,
          emails: capsule.emails
        });
      });
      await Promise.all(jobPromises);
    }

    if (toWait.length > 0) {
      const nearestDist = toWait[0].dist.calculated; // Sorted by distance

      if (nearestDist < 1000) {
        nextInterval = 30000; // 30 seconds
      } else if (nearestDist < 3000) {
        nextInterval = 60000; // 1 minute
      } else {
        nextInterval = 120000; // 2 minutes
      }
    }

    return res.status(200).json({
      message: toTrigger.length > 0 ? "Capsules triggered!" : "Scanning...",
      nextInterval
    });

  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({ message: error.message });
  }
};
