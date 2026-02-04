import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid"; // Install with `npm i uuid`

const orderSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    products: [
      {
        productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product",required:true},
        name: { type: String, required: true }, 
        category: { type: String, required: true }, 
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      }
    ],

    totalAmount: { type: Number, required: true },
    profit: { type: Number }, 
    status: { type: String, enum: ["Pending", "Accepted", "Cancelled", "Delivered"], default: "Pending" },

    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending" },
    paymentMethod: { type: String, enum: ["cash","online","COD","UPI"], required: true },

    invoiceId: { type: String, unique: true, default: uuidv4 }, 
    deliveryAddress: { type: String, required: true }, 
    estimatedDeliveryDate: { type: Date }, 
    estimatedDeliveryTime: { type: String }

  },
  { timestamps: true }
);


export const Order = mongoose.model("Order", orderSchema);
