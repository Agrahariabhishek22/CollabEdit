import express from "express";
import { addProduct, updateProduct, deleteProduct, getProducts,getCategories,getLowStockProducts,getShopProduct,updateProductQuantities } from "../controllers/product.js";
import { authenticateOwner } from "../middlewares/authenticate.js";
import upload from "../middlewares/upload.js";
const router = express.Router();


router.post("/add",authenticateOwner,upload.single("image"), addProduct); // Add item
router.put("/update/:productId", authenticateOwner,upload.single("image"), updateProduct); // Update item
router.delete("/delete/:productId",authenticateOwner,  deleteProduct); // Delete item
router.get("/", authenticateOwner,getProducts);
router.get("/low-stock", authenticateOwner,getLowStockProducts);
router.get("/categories",authenticateOwner,getCategories)
router.put("/update-quantities", authenticateOwner,updateProductQuantities);// Update product quantities
// customer end point added 
router.get("/:shopId", getShopProduct);
export default router;
