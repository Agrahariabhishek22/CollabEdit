import axios from "axios";
import dotenv from "dotenv";
import User from "../models/user.js";
import { encryptFile, encryptText } from "../utils/encryption.js";
import Capsule from "../models/capsule.js";
import fs from "fs"
dotenv.config();

export const createGithubCapsule = async (req, res) => {
  try {
    console.log("inside github cap creation api");

    const userId = req.user.userId;
    const user = await User.findById(userId);
    const { title, textMessage, emails, githubPrs } = req.body;

    if (!user || !user.publicKey) {
      return res
        .status(404)
        .json({ message: "User encryption keys not found" });
    } 

    if (!githubPrs) {
      return res
        .status(400)
        .json({ message: "Target PR count (githubPrs) is required" });
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
      triggerType: "GITHUB_PR",
      content,
      githubPrs: Number(githubPrs),
      emails,
      deliveryStatus: "PENDING",
      reminder1Sent: true,
      reminder7Sent: true,
    });

    return res.status(201).json({
      message: "GitHub PR capsule created & encrypted successfully!",
      capsule,
    });
  } catch (error) {
    console.log("Error in GitHub Capsule Creation:", error);
    return res.status(500).json({ message: error.message });
  }
};
export const callbackGitub = async (req, res) => {
  try {
    console.log("inside callbackgithub");

    const requestToken = req.query.code;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).send("User not authenticated");
    }

    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: requestToken,
      },
      { headers: { accept: "application/json" } }
    );

    const accessToken = response.data.access_token;
    console.log("accessToken:", accessToken);

    if (!accessToken) {
      return res.status(400).send("Failed to get access token from GitHub");
    }

    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${accessToken}` },
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        githubToken: accessToken,
        githubUsername: userResponse.data.login,
        githubId: userResponse.data.id,
        isGithubConnected: true,
      },
      { new: true }
    );

    // Redirect to frontend
    res.redirect("http://localhost:5173/dashboard?success=true");
  } catch (error) {
    console.log(
      "Error inside github callback:",
      error.response?.data || error.message
    );
    res.status(500).send("Internal Server Error");
  }
};

export const gitChecker = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.githubToken || !user.githubUsername) {
      return res.status(400).json({
        success: false,
        isGithubConnected: false,
        message: "GitHub account connected nahi hai ya user nahi mila!",
      });
    }
    return res.status(200).json({
      success: true,
      isGithubConnected: true,
    });
  } catch (error) {
    console.error(
      "Error in gitChecker:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "GitHub data fetch error",
    });
  }
};

export const disconnectGithub = async (req, res) => {
  try {
    const userId = req.user.userId;

    await User.findByIdAndUpdate(userId, {
      $set: {
        githubToken: null,
        githubUsername: null,
        githubId: null,
        isGithubConnected: false,
      },
    });

    res.status(200).json({
      success: true,
      message: "GitHub successfully disconnected. Achievements are still safe!",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
