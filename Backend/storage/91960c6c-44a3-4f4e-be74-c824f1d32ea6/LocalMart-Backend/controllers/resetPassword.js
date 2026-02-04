import Cust from "../models/customer.js";
import {Owner} from "../models/owner.js";
import mailSender from "../utils/mailSender.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const custResetPasswordToken = async (req, res) => {
  try {
    console.log("In reset pass token controller");
    
    const email = req.body.email;
    const user = await Cust.findOne({ email: email });

    if (!user) {
      return res.json({ 
        success: false,
        message: `This Email: ${email} is not Registered With Us. Enter a Valid Email.`,
      });
    }

    const token = crypto.randomBytes(20).toString("hex");

    const updatedDetails = await Cust.findOneAndUpdate(
      { email: email },
      {
        token: token,
        resetPasswordExpires: Date.now() + 5 * 60 * 1000,
      },
      { new: true }
    );

    console.log("DETAILS", updatedDetails);

    const url = `http://localhost:5173/update-password/${token}`;
    // console.log(url);

    await mailSender(
      email,
      "Password Reset",
      `Your link for email verification is ${url}. Please click this URL to reset your password.`
    );

    res.json({
      success: true,
      message:
        "Email Sent Successfully, Please Check Your Email to Continue Further.",
    });
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      message: "Some Error in Sending the Reset Message.",
    });
  }
};

export const custResetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, token } = req.body;

    if (confirmPassword !== password) {
      return res.json({
        success: false,
        message: "Password and Confirm Password Do Not Match.",
      });
    }

    const userDetails = await Cust.findOne({ token: token });

    if (!userDetails) {
      return res.json({
        success: false,
        message: "Token is Invalid.",
      });
    }

    if (!(userDetails.resetPasswordExpires > Date.now())) {
      return res.status(403).json({
        success: false,
        message: "Token is Expired, Please Regenerate Your Token.",
      });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    await Cust.findOneAndUpdate(
      { token: token },
      { password: encryptedPassword },
      { new: true }
    );

    res.json({
      success: true,
      message: "Password Reset Successful.",
    });
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      message: "Some Error in Updating the Password.",
    });
  }
};



export const ownResetPasswordToken = async (req, res) => {
  try {
    console.log("In reset pass token controller");
    
    const email = req.body.email;
    const user = await Owner.findOne({ email: email });

    if (!user) {
      return res.json({
        success: false,
        message: `This Email: ${email} is not Registered With Us. Enter a Valid Email.`,
      });
    }

    const token = crypto.randomBytes(20).toString("hex");

    const updatedDetails = await Owner.findOneAndUpdate(
      { email: email },
      {
        token: token,
        resetPasswordExpires: Date.now() + 5 * 60 * 1000,
      },
      { new: true }
    );

    console.log("DETAILS", updatedDetails);

    const url = `http://localhost:5173/update-password/${token}`;
    console.log(url);

    await mailSender(
      email,
      "Password Reset",
      `Your link for email verification is ${url}. Please click this URL to reset your password.`
    );

    res.json({
      success: true,
      message:
        "Email Sent Successfully, Please Check Your Email to Continue Further.",
    });
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      message: "Some Error in Sending the Reset Message.",
    });
  }
};



export const ownResetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, token } = req.body;

    if (confirmPassword !== password) {
      return res.json({
        success: false,
        message: "Password and Confirm Password Do Not Match.",
      });
    }

    const userDetails = await Owner.findOne({ token: token });

    if (!userDetails) {
      return res.json({
        success: false,
        message: "Token is Invalid.",
      });
    }

    if (!(userDetails.resetPasswordExpires > Date.now())) {
      return res.status(403).json({
        success: false,
        message: "Token is Expired, Please Regenerate Your Token.",
      });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    await Own.findOneAndUpdate(
      { token: token },
      { password: encryptedPassword },
      { new: true }
    );

    res.json({
      success: true,
      message: "Password Reset Successful.",
    });
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      message: "Some Error in Updating the Password.",
    });
  }
};
