import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const OwnerSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true },
    shopAddress: { type: String, required: true },
    ownerName: { type: String, required: true },
    email:{type:String,required:true},
    mobileNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    shopCategory: { type: String, required: true },
    itemCategories: { type: [String], default: [] },
    shopImage: { type: String,  },
    shopLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    closingTime:{type:String},
    openingTime:{type:String},
    shopStatus:{type:String,enum:["OPEN","CLOSE"],default:"CLOSE"},
    token: {
			type: String,
		},
		resetPasswordExpires: {
			type: Date,
		},
  },
  { timestamps: true }
);


export const Owner =  mongoose.model('Owner', OwnerSchema);

//Owner.createIndexes({ shopLocation: "2dsphere" });