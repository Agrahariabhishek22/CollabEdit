import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    messages: [
        {
            sender: { type: String, enum: ["Customer", "ShopOwner"], required: true },
            text: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

export const Chat = mongoose.model("Chat", chatSchema);
