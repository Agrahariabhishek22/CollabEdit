import Capsule from "../models/capsule.js";
import User from "../models/user.js";
import fs from "fs";
import { encryptFile, encryptText } from "../utils/encryption.js";
import { addToDeliveryQueue } from "../utils/addToDeliveryQueue.js";

export const datetimeCapsuleCreation = async (req, res) => {
  try {
    console.log("inside the date based cap");
    const userId = req.user.userId;
    const user = await User.findById(userId);
    console.log(new Date()); //give time in UTC
    // console.log(new Date().toISOString());  //stringify utc time
    // console.log(new Date().toString());  //give time as per server format now sever in IST
    const emails = req.body.emails;
    if (!user || !user.publicKey) {
      return res
        .status(404)
        .json({ message: "User encryption keys not found" });
    }
    const { title, textMessage, deliveryTime } = req.body;
    if ((!title, !deliveryTime)) {
      return res.status(400).json({
        message: "Kindly give title and deliveryTime",
      });
    }
    console.log("req body", textMessage, deliveryTime);
    console.log(req.body.emails);

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

    const deliveryDateObj = new Date(deliveryTime);
    const deliveryTimeMS = deliveryDateObj.getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const reminder7Date = new Date(deliveryTimeMS - sevenDaysInMs);
    const reminder1Date = new Date(deliveryTimeMS - oneDayInMs);

    const now = new Date();

    const twoMinsInMs=2*60*1000;
    const isUrgent=(deliveryDateObj.getTime()-now.getTime())<=twoMinsInMs;

    const reminder7Sent = now >= reminder7Date;
    const reminder1Sent = now >= reminder1Date;

    const newCapsule=await Capsule.create({
      ownerId: userId,
      title,
      content,
      deliveryTime,
      emails: emails,
      triggerType: "DATE_TIME",
      deliveryStatus:isUrgent?"PROCESSING":"PENDING",
      reminder7Sent,
      reminder1Sent,
    });

    if(isUrgent){
      console.log('Urgent date_time capsule detected adding to the queue immediately');
      await addToDeliveryQueue(newCapsule)
    }

    return res.status(200).json({
      message: isUrgent 
    ? "Capsule scheduled for immediate processing" 
    : "Capsule created and scheduled",
    });
  } catch (error) {
    console.log("Error", error.message);
    return res.status(500).json(error.message);
  }
};
