// Import the required modules
import express from "express";
const router = express.Router()
import { capturePayment, verifyPayment } from "../controllers/payment.js";
import { authenticateCustomer } from "../middlewares/authenticate.js"
router.post("/capturePayment",authenticateCustomer, capturePayment)
router.post("/verifyPayment",authenticateCustomer, verifyPayment)
// router.post("/sendPaymentSuccessEmail", auth, isStudent, sendPaymentSuccessEmail);

export default router;
