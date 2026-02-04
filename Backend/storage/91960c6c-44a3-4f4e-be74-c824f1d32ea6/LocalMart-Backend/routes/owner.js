import express from 'express';
import {registerOwner,loginOwner,getOwnerProfile,updateShop,deleteShop,logoutOwner} from  '../controllers/owner.js';
import { body } from 'express-validator';
import { authenticateOwner } from '../middlewares/authenticate.js';
 import { getAllShops, getShopDetails } from '../controllers/shop.js'
 import upload from '../middlewares/upload.js';
import { ownResetPassword, ownResetPasswordToken } from '../controllers/resetPassword.js';
 

const router = express.Router();

router.post(
  '/register',
  upload.single("shopImage"),
  [
    body('shopName').notEmpty().withMessage('Shop name is required'),
    body('shopAddress').notEmpty().withMessage('Shop address is required'),
    body('ownerName').notEmpty().withMessage('Owner name is required'),
    body('mobileNumber').isMobilePhone().withMessage('Valid mobile number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('shopCategory').notEmpty().withMessage('Shop category is required'),
    body('shopLocation.coordinates').isArray({ min: 2, max: 2 }).withMessage('Valid coordinates are required'),
  ],
 
  registerOwner
);

router.post('/login', loginOwner);
router.post("/logout", authenticateOwner, logoutOwner); 
router.get('/profile', authenticateOwner, getOwnerProfile);

router.put("/update-shop", authenticateOwner, upload.single("shopImage"), updateShop);

router.delete('/delete-shop', authenticateOwner, deleteShop);


// i added 
router.get('/getAllShops',getAllShops);
router.get('/:shopId',getShopDetails);
router.post('/reset-password-token',ownResetPasswordToken);
router.post('/reset-password',ownResetPassword);

export default router;
