import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    salesPrice: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    weight:{type:String,requried:true},
    quantity: { type: Number, required: true },
    image: { type: String, required: true },
    lowStockThreshold: { type: Number, default: 5 }, // Default threshold
    discount: { type: Number, default: 0 }, // Discount percentage (e.g., 10 for 10% off)
    offerPrice: { type: Number }, // Final price after discount
}, { timestamps: true });



export const Product = mongoose.model("Product", productSchema);
