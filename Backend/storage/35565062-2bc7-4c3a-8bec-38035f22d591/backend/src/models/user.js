import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    publicKey:{
      type:String,
      required:true
    },
    privateKey:{
      type:String,
      required:true
    },
    githubToken:{
      type:String
    },
    githubUsername:{
      type:String
    },
    githubId:{
      type:String
    },
    isGithubConnected:{
      type:Boolean,
      default:false
    }
  },
  {
    timestamps: true,
  }
);

const User=new mongoose.model("User",userSchema);

export default User;
