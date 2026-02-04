import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop"},
    customerId:{type:mongoose.Schema.Types.ObjectId,ref:"Customer"},
    type: { type: String, enum: ["order", "lowStock"], required: true }, // Order or Low Stock
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: false }, // Only for low stock alerts
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: "7d" }, // Auto-delete after 7 days
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
