import Customer from "../models/customer.js";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";
import cloudinary from "../config/cloudinary.js";

// Signup Controller
export const signupCustomer = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      gender,
      mobileNumber,
      latitude,
      longitude,
      avatar,
      address,
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !gender || !mobileNumber) {
      return res
        .status(400)
        .json({
          message:
            "Name, email, gender, mobile number, and password are required.",
        });
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({
      $or: [{ email }, { mobileNumber }],
    });

    if (existingCustomer) {
      return res
        .status(400)
        .json({
          message: "Customer already exists with this email or mobile number.",
        });
    }

    // Validate and format address data
    let customerAddress = [];

    if (Array.isArray(address)) {
      customerAddress = address.map((addr) => ({
        street: addr.street || "",
        city: addr.city || "",
        state: addr.state || "",
        country: addr.country || "",
        postalCode: addr.postalCode || "",
        isDefault: addr.isDefault || false,
      }));
    } else if (typeof address === "object" && address !== null) {
      customerAddress = [
        {
          street: address.street || "",
          city: address.city || "",
          state: address.state || "",
          country: address.country || "",
          postalCode: address.postalCode || "",
          isDefault: address.isDefault || false,
        },
      ];
    }

    // Create customer
    const customer = new Customer({
      name,
      email,
      password,
      gender,
      mobileNumber,
      avatar: avatar || "",
      location: {
        type: "Point",
        coordinates: [longitude || 0, latitude || 0],
      },
      address: customerAddress, // Assign address array
    });

    // Save customer explicitly
    await customer.save();

    // Generate token
    generateToken(res, customer._id);

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        avatar: customer.avatar,
        mobileNumber: customer.mobileNumber,
        location: customer.location,
        address: customer.address,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login Controller (No changes needed)
export const loginCustomer = async (req, res) => {
  console.log("called");
  try {
    const { identifier, password, location } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({
          message: "Please provide email or mobile number and password.",
        });
    }

    const customer = await Customer.findOne({
      $or: [{ email: identifier }, { mobileNumber: identifier }],
    }).select("+password");

    if (!customer) {
      return res
        .status(401)
        .json({ message: "Please Register Yourself first" });
    }

    const isPasswordMatch = await customer.comparePassword(password);
    if (!isPasswordMatch) {
      return res
        .status(401)
        .json({ message: "Invalid email/mobile number or password." });
    }

    if (location && location.latitude && location.longitude) {
      customer.location = {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      };
      customer.markModified("location");
      await customer.save();
    }

    generateToken(res, customer._id);

    res.status(200).json({
      success: true,
      message: "Login successful!",
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        mobileNumber: customer.mobileNumber,
        avatar: customer.avatar,
        location: customer.location,
        address: customer.address,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Profile Controller
export const updateProfile = async (req, res) => {
  try {
    console.log("in update prof");
    
    const { name, gender,oldPassword,newPassword } = req.body;
    console.log("in updateProfile controller",req.body);
    
    const customerId = req.customerId;
    console.log(customerId);
    const customer = await Customer.findById(customerId).select("+password");
    if (!customer) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name && name.trim().length < 3) {
      return res
        .status(400)
        .json({ message: "Name must be at least 3 characters long" });
    }
    if (name) customer.name = name.trim();

    if (gender && !["Male", "Female"].includes(gender)) {
      return res.status(400).json({ message: "Invalid gender value" });
    }
    if (gender) customer.gender = gender;

    // if (
    //   location &&
    //   (!Array.isArray(location.coordinates) ||
    //     location.coordinates.length !== 2)
    // ) {
    //   return res.status(400).json({ message: "Invalid location format" });
    // }
    // if (location) customer.location = location;

    if (req.file) {
      customer.avatar = req.file.path;
      if (customer.avatar) {
        const imageId = customer.avatar.split("/").pop().split(".")[0]; // Extract ID from Cloudinary URL
        await cloudinary.uploader.destroy(imageId);
      }
    }

    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, customer.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Old password is incorrect" });
      }
      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ message: "New password must be at least 8 characters long" });
      }
      customer.password = await bcrypt.hash(newPassword, 10);
    } else if (newPassword && !oldPassword) {
      return res
        .status(400)
        .json({ message: "Old password is required to update password" });
    }

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      customer: {
        name: customer.name,
        gender: customer.gender,
        location: customer.location,
        avatar: customer.avatar,
        address: customer.address,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const addAddress = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { street, city, state, country, postalCode, isDefault } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    // If new address is default, unset previous default
    if (isDefault) {
      customer.address.forEach((addr) => (addr.isDefault = false));
    }

    // Push new address
    const newAddress = { street, city, state, country, postalCode, isDefault };
    customer.address.push(newAddress);
    await customer.save();

    res
      .status(201)
      .json({ message: "Address added successfully", address: newAddress });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//  Update an existing address
export const updateAddress = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { addressId } = req.params;
    console.log(addressId);
    const { street, city, state, country, postalCode, isDefault } = req.body;
    console.log(customerId);
    const customer = await Customer.findById(customerId);
    console.log(customer);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    const address = customer.address.id(addressId);
    console.log(address);
    if (!address) return res.status(404).json({ message: "Address not found" });

    // If setting this address as default, remove default from others
    if (isDefault) {
      customer.address.forEach((addr) => (addr.isDefault = false));
    }

    // Update fields
    address.street = street;
    address.city = city;
    address.state = state;
    address.country = country;
    address.postalCode = postalCode;
    address.isDefault = isDefault;

    await customer.save();
    res.status(200).json({ message: "Address updated successfully", address });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const logout = async (req, res, next) => {
  try {
    res.cookie("token", "", { httpOnly: true, expires: new Date(0) }); // Clear token

    // 🔹 Emit an event to remove the owner from their room
    if (req.io && req.customerId) {
      console.log("emitted");
      req.io.to(req.customerId.toString()).emit("Logged-Out", {
        message: "You have been logged out.",
      });
    }

    res.status(201).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};
