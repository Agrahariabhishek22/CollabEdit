import { instance } from "../config/razorpay.js";
import crypto from "crypto";
// import mailSender from "../utils/mailSender.js";

// Capture the payment and initiate the Razorpay order
export const capturePayment = async (req, res) => {
  // console.log("capture payment",req.body);
  
  const {amount} = req.body;
  if(!amount){
    return res.status(200).json({ success: false, message: "total cart value is not defined" }); 
  }
  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: Math.random(Date.now()).toString(),
  };

  try {
    const paymentResponse = await instance.orders.create(options);
    console.log(paymentResponse);
    
    res.json({
      success: true,
      data: paymentResponse,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Could not initiate order." });
  }
};
 
// Verify the payment
export const verifyPayment = async (req, res) => {
  // console.log("verify payment",req.body);
  
  const razorpay_order_id = req.body?.razorpay_order_id;
  const razorpay_payment_id = req.body?.razorpay_payment_id;
  const razorpay_signature = req.body?.razorpay_signature;

  const userId = req.customerId;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
    return res.status(200).json({ success: false, message: "Payment Failed" });
  }

  let body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    return res.status(200).json({ success: true, message: "Payment Verified" });
  }

  return res.status(200).json({ success: false, message: "Payment Failed" });
};
 