import mongoose from "mongoose";

const contentItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "file"],
      required: true,
    },

    // text
    encryptedData: {
      type: String,
    },

    //  file 
    encryptedFilePath: {
      type: String,
    },
    originalName: {
      type: String,
    },
    mimeType: {
      type: String,
    },
    size: {
      type: Number,
    },
    // meta data
    iv: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      required: true,
    },
    lockedKey: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const capsuleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      require: true,
    },

    content:{
      type:[contentItemSchema]
    },

    triggerType: {
      type: String,
      enum: ["DATE_TIME", "LOCATION", "CUSTOM","GITHUB_PR"],
      required: true,
      index: true,
    },
    githubPrs:{
      type:Number
    },
                                           
    deliveryTime: {
      type: Date,
      index: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      city: { type: String },
      country: { type: String },
      address: { type: String },
    },
    webhookId: {
      type: String,
      index: true,
    },

    deliveryStatus: {
      type: String,
      enum: ["PENDING", "DELIVERED", "FAILED", "PROCESSING"],
      default: "PENDING",
      index: true,
    },
    emails:{
      type:[String]
    },

    reminder7Sent: { type: Boolean, default: false },
    reminder1Sent: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

/* Geospatial index (only used for LOCATION triggers) */
capsuleSchema.index({ location: "2dsphere" },{ sparse: true });

const Capsule = mongoose.model("Capsule", capsuleSchema);

export default Capsule;
