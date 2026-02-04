import express from 'express';
import { signupCustomer, loginCustomer,logout, updateProfile,addAddress, updateAddress } from '../controllers/customer.js';
import { authenticateCustomer } from '../middlewares/authenticate.js';
import { custResetPassword, custResetPasswordToken } from '../controllers/resetPassword.js';
  import upload from '../middlewares/upload.js';

const router = express.Router();

router.post('/signup', signupCustomer);
router.post('/login', loginCustomer);
router.put('/update/profile',authenticateCustomer,upload.single("avatar"),updateProfile);
router.post("/address", authenticateCustomer, addAddress);
router.put("/address/:addressId", authenticateCustomer, updateAddress);
router.post('/reset-password-token',custResetPasswordToken);
router.post('/reset-password',custResetPassword);
router.post('/logout',authenticateCustomer,logout);
// OAuth Routes
router.get("/oauth/:provider", (req, res, next) => {
    const provider = req.params.provider;
    if (provider === "google") {
      passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    } else {
      return res.status(400).json({ message: "Invalid OAuth provider" });
    }
  });
  
  router.get(
    "/oauth/:provider/callback",
    (req, res, next) => {
        const provider = req.params.provider;
        if (provider === "google") {
            passport.authenticate("google", { failureRedirect: "/" })(req, res, next);
        } else {
            return res.status(400).json({ message: "Invalid OAuth provider" });
        }
    },
    (req, res) => {
        console.log("Session Data:", req.session); // Log session data
        res.redirect("/dashboard"); // Redirect after successful login
    }
);
export default router;
