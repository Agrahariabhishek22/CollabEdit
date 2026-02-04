import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import crypto from "crypto";

const generateUserKeys = (password) => {
  try {
    console.log("Generating keys for password:", password);
    // Ensure password is at least 8+ characters for aes-256
    if (password.length < 8) {
      throw new Error(
        "Password too short for key encryption. Min 8 characters."
      );
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, //2048 bit strong key
      publicKeyEncoding: {
        type: "spki", //type of key
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8", //type of key
        format: "pem", //to convert into text string
        cipher: "aes-256-cbc", //AES-256 algorithm se encrypt
        // Passphrase ko string ke bajaye Buffer mein dena zyada safe hai
        passphrase: Buffer.from(password),
      },
    });

    return { publicKey, privateKey };
  } catch (err) {
    console.error(" RSA Key Generation Failed:", err.message);
    throw err; // Isse registration catch block ko pata chal jayega
  }
};

export const register = async (req, res) => {
  try {
    // console.log("entered into registeration");

    const { name, email, password } = req.body;

    console.log(password);

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }
    // console.log("before password hashing");
    const passwordHash = await bcrypt.hash(password, 12);
    // console.log("after password hashing");
    const { publicKey, privateKey } = generateUserKeys(password);
    // console.log("after key  geneartion");
    const user = await User.create({
      name,
      email,
      password: passwordHash,
      publicKey,
      privateKey,
    });
    // console.log("before creation");
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const decrypt_token = jwt.sign(
      { passHash: password },
      process.env.DECRYPT_SECRET,
      { expiresIn: "1h" }
    );

    return res
      .cookie("token", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din
      })
      .cookie("decrypt_token", decrypt_token, {
        httpOnly: true,
        maxAge: 1 * 60 * 60 * 1000, // 1 ghanta
      })
      .status(201)
      .json({
        message: "User registered successfully",
        userId: user._id,
        user,
        success: true,
      });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User does not exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Login credentials are wrong" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const decrypt_token = jwt.sign(
      { passHash: password },
      process.env.DECRYPT_SECRET,
      { expiresIn: "1h" }
    );

    return res
      .cookie("token", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din
      })
      .cookie("decrypt_token", decrypt_token, {
        httpOnly: true,
        maxAge: 1 * 60 * 60 * 1000, // 1 ghanta
      })
      .json({
        success: true,
        message: "Login successful & Decryption session active",
        user: { name: user.name, email: user.email },
      });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const logout = async (req, res) => {
  try {
    return res
      .cookie("token", "", {
        httpOnly: true,
        expires: new Date(0),
      })

      .json({
        message: "user logged out successfully",
      });
  } catch (error) {
    console.log("Logout error:", error.message);
    return res.status(500).json({ message: "Something went wrong in Logout!" });
  }
};
