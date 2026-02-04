import {Owner} from '../models/owner.js';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import generateToken from '../utils/generateToken.js';
import cloudinary from '../config/cloudinary.js';

// Register Owner
export const registerOwner = async (req, res, next) => {
 
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { mobileNumber, email, password,  ...otherDetails } = req.body;
    const salt = await bcrypt.genSalt(10)
     const pass = await bcrypt.hash(password,salt);
    const shopImageLink = req?.file?.path || req?.file?.url || "";
  // Ensure a string is assigned

    if (await Owner.findOne({ $or: [{ mobileNumber }, { email }] })) {
      return res.status(400).json({ message: 'Mobile number or email already registered' });
    }

    const owner = await Owner.create({
      mobileNumber,
      password:pass,
      shopImage:shopImageLink,
      email,
      ...otherDetails,
    });

    generateToken(res, owner._id, "owner");

    //  Emit a socket event to join the room
    if (req.io) {
      req.io.to(owner._id.toString()).emit("owner_signed_up", {
        message: `Welcome, ${owner.shopName}! Your shop is now active.`,
      });
    }

    res.status(201).json({ success: true, owner });
  } catch (error) {
    console.log(error)
    next(error);
  }
};


// Login Owner
export const loginOwner = async (req, res, next) => {
  try {
    const { mobileNumber, email, password } = req.body;
   
    const owner = await Owner.findOne({ $or: [{ mobileNumber }, { email }] });
  
   
    if (!owner  ) {
      return res.status(400).json({ message: 'Invalid Email' });
    }
    const matchPassword = await bcrypt.compare(password, owner.password)
    
    if(!matchPassword){
      return res.status(400).json({ message: 'Invalid Password' });
    }
console.log("token")
    generateToken(res, owner._id, "owner");

    res.status(201).json({ success: true, name:owner.ownerName,email:owner.email,id:owner._id });
  } catch (error) {
    next(error);
  }
};

export const logoutOwner = async (req, res, next) => {
  try {
    res.cookie("token", "", { httpOnly: true, expires: new Date(0) }); // Clear token

    // 🔹 Emit an event to remove the owner from their room
    if (req.io && req.ownerId) {
      req.io.to(req.ownerId.toString()).emit("Logged-out", {
        message: "You have been logged out.",
      });
    }

    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

// Get Owner Profile (Optimized - No DB Query)
export const getOwnerProfile = async (req, res, next) => {
  try {
    const owner = await Owner.findById(req.ownerId).select('-password');
    if (!owner) return res.status(404).json({ message: 'Owner not found' });

    res.json(owner);
  } catch (error) {
    next(error);
  }
};



// Update Shop
export const updateShop = async (req, res, next) => {
  try {
    const owner = await Owner.findById(req.ownerId);
    if (!owner) return res.status(404).json({ message: "Owner not found" });

    let { shopName, shopAddress, shopCategory, itemCategories, shopLocation } = req.body;

    // Parse `itemCategories` and `shopLocation` safely
    try {
      itemCategories = JSON.parse(itemCategories || "[]");
      shopLocation = JSON.parse(shopLocation || "{}");
    } catch (error) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    // Update shop image if a new one is uploaded
    if (req.file) {
      owner.shopImage = req.file.path; // Cloudinary automatically uploads and provides a URL
    }

    // Update other fields only if provided
    owner.shopName = shopName || owner.shopName;
    owner.shopAddress = shopAddress || owner.shopAddress;
    owner.shopCategory = shopCategory || owner.shopCategory;
    owner.itemCategories = itemCategories.length ? itemCategories : owner.itemCategories;
    owner.shopLocation = Object.keys(shopLocation).length ? shopLocation : owner.shopLocation;

    await owner.save();
    res.json({ success: true, message: "Shop updated successfully", owner });
  } catch (error) {
    next(error);
  }
};


// Delete Shop and related data
export const deleteShop = async (req, res, next) => {
  try {
    const owner = await Owner.findById(req.ownerId);
    if (!owner) return res.status(404).json({ message: 'Owner not found' });

    // Delete shop-related data (modify as needed)
    await Order.deleteMany({ shopId: owner._id });
    await Product.deleteMany({ shopId: owner._id });

    // Delete the shop image from Cloudinary
    const imageId = owner.shopImage.split('/').pop().split('.')[0]; // Extract ID from Cloudinary URL
    await cloudinary.uploader.destroy(imageId);

    // Delete owner/shop from database
    await Owner.findByIdAndDelete(req.ownerId);

    res.json({ success: true, message: 'Shop and related data deleted successfully' });
  } catch (error) {
    next(error);
  }
};




