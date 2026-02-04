import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { Owner } from "../models/owner.js";
import { Notification } from "../models/notifications.js"; // Import Notification model
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import { updateSalesAnalytics } from "./salesAnalytics.js"; // Adjust the path accordingly


export const placeOrder = async (req, res, next) => {
  try {
    const { customerId,shopId, products, paymentMethod, deliveryAddress } = req.body;
   const io = req.io;
    const productDetails = await Product.find({
      _id: { $in: products.map((item) => item.productId) },
    });

    if (productDetails.length !== products.length) {
      return res.status(400).json({ success: false, message: "Invalid product IDs" });
    }

    let totalAmount = 0;
    let totalProfit = 0;
    const finalProducts = [];
    const notifications = [];

    
    for (const item of products) {
      const product = productDetails.find((p) => p._id.toString() === item.productId);

      if (!product || product.quantity < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${product?.name || "some products"}` 
        });
      }

      const itemTotal = product.offerPrice * item.quantity;
      const itemProfit = (product.offerPrice - product.costPrice) * item.quantity;

      totalAmount += itemTotal;
      totalProfit += itemProfit;

      finalProducts.push({
        productId: product._id,
        name: product.name,
        category: product.category,
        quantity: item.quantity,
        price: product.offerPrice,
      });

      // Check if stock goes below threshold after purchase
      const remainingStock = product.quantity - item.quantity;
      if (remainingStock < 10) {
        notifications.push({
          shopId,
          type: "lowStock",
          productId: product._id,
          message: `Low stock alert: ${product.name} has only ${remainingStock} left.`,
        });
      }
    }

    // Create the order
    const order = await Order.create({
      shopId,
      customerId,
      products: finalProducts,
      totalAmount,
      profit: totalProfit,
      invoiceId: uuidv4(),
      paymentMethod,
      deliveryAddress,
    });

    // Deduct stock (Atomic update)
    const bulkOperations = products.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { quantity: -item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOperations);

    // Store order notification
    notifications.push({
      shopId,
      type: "order",
      message: `New order received! Order ID: ${order._id}`,
    });

    // Save all notifications to DB
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    console.log("order id ",order.invoiceId)
    // Emit real-time order notification
    io.to(shopId.toString()).emit("newOrder", {
      message: `New order placed! Order ID: ${order.invoiceId}`,
      order,
    });

    // Emit low-stock alerts in real-time
    notifications
      .filter((notif) => notif.type === "lowStock")
      .forEach((alert) => {
        io.to(shopId.toString()).emit("lowStockAlert", { message: alert.message,productId:alert.productId });
      });

    res.status(201).json({ success: true, message: "Order placed successfully", order });
  } catch (error) {
    next(error);
  }
};




//  Get Orders for a Customer
export const getCustomerOrders = async (req, res, next) => {
  try {
    const cust = req.customerId;
    const customerId =new mongoose.Types.ObjectId(cust)
//     console.log(customerId)
    const orders = await Order.find({ customerId }).populate("shopId", "shopName");
    // console.log(orders)

    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

//  **Get Orders for a Shop Owner**
export const getShopOrders = async (req, res, next) => {
  try {
    const Id = req.ownerId;
    const ownerId = new mongoose.Types.ObjectId(Id);
    const orders = await Order.find({ shopId: ownerId });
    res.status(201).json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};





export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
   const io = req.io;
    const { status } = req.body;
   
    if (!["Pending", "Accepted", "Cancelled", "Delivered"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true })
    .populate({
      path:"shopId",
      select:"shopName"
    });
console.log("update status ",order)
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (status === "Accepted") {
      await updateSalesAnalytics(order.shopId, order.products, order.totalAmount, order.paymentMethod);
    } 
    
   
    const customerId = order.customerId;
io.to(customerId.toString()).emit("OrderStatusUpdated",{
message:`Order at ${order.shopId.shopName} has been ${status}`
})

await Notification.insertOne({
  customerId:Order.customerId,
  type:"order",
  message:`Order at ${order.shopId.shopName} has been ${status}`,
})
    res.status(201).json({ success: true, message: "Order status updated", order });
  } catch (error) {
    next(error);
  }
};



//  **Update Payment Status (Owner)**
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    if (!["Pending", "Paid", "Failed"].includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: "Invalid payment status" });
    }

    const order = await Order.findByIdAndUpdate(orderId, { paymentStatus }, { new: true });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, message: "Payment status updated", order });
  } catch (error) {
    next(error);
  }
};
