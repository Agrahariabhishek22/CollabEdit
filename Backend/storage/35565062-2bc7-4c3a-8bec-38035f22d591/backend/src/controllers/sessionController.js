import User from "../models/user.js";
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs";

export const generateSession = async (req, res) => {
  try {
    console.log("inside generate session");

    const { password } = req.body;
    const userId = req.user.userId;
    // console.log(password,userId);
    
    const user = await User.findById(userId);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Password is wrong" });
    }
    // console.log("user password", password);

    const decrypt_token = jwt.sign(
      { passHash: password },
      process.env.DECRYPT_SECRET,
      { expiresIn: "1h" }
    );

    return res
      .cookie("decrypt_token", decrypt_token, {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
      })
      .json({ success: true, message: "Decryption session active for 1 hour" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create session" });
  }
};
