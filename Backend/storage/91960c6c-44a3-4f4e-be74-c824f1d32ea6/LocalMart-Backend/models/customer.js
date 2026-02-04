import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  postalCode: { type: String, required: true },
  isDefault: { type: Boolean, default: false }, // Mark default address
});

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please enter your email'],
      unique: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Please enter a valid email'],
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Please enter your password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    address: [addressSchema], // Array of addresses without coordinates
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
    ],
    token: {
			type: String,
		},
		resetPasswordExpires: {
			type: Date,
		},
  },
  { timestamps: true }
);

// Hash the password before saving
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
customerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('Customer', customerSchema);
