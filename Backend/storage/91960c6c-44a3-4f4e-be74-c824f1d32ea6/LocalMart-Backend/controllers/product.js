import mongoose from "mongoose";
import { Product } from "../models/product.js";
import cloudinary from "../config/cloudinary.js";
import { Owner } from "../models/owner.js";
//  Add a new item
export const addProduct = async (req, res, next) => {
    try {
        const {  name, category, salesPrice, costPrice, quantity, image, discount } = req.body;
        const shopId = req.ownerId;
        const imageLink = req?.file?.path;
        if (!shopId || !name || !category || !salesPrice || !costPrice || !quantity ) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
       
        const offerPrice = discount > 0 ? salesPrice - (salesPrice * discount / 100) : salesPrice;

        const newProduct = new Product({
            shopId,
            name,
            category,
            salesPrice,
            costPrice,
            quantity,
            image:imageLink,
            discount,
            offerPrice,
        });

        const savedProduct = await newProduct.save();

        res.status(201).json({ success: true, message: "Product added successfully", product: savedProduct });
    } catch (error) {
        next(error);
    }
};




//  Update an existing item
export const updateProduct = async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { name, category, salesPrice, costPrice, quantity, image, discount ,oldImageLink } = req.body;
        
        let imageLink = oldImageLink;
        if (req.file && oldImageLink) {
          const publicId = oldImageLink.split('/').pop().split('.')[0]; // Extract public ID from URL
          await cloudinary.uploader.destroy(publicId);
         
      }
      if(req.file){
        imageLink = req.file.path||"";
      }
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                name,
                category,
                salesPrice,
                costPrice,
                quantity,
                image:imageLink,
                discount,
                offerPrice: discount > 0 ? salesPrice - (salesPrice * discount / 100) : salesPrice,
            },
            { new: true } 
        );

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({ success: true, message: "Prduct updated successfully", product: updatedProduct });
    } catch (error) {
       next(error)
    }
};

// Delete an item
export const deleteProduct = async (req, res) => {
    try {
        const { productId } = req.params;
       
        const deletedProduct = await Product.findByIdAndDelete(productId);
       
        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
       
       next(error)
    }
};


//Get all prodcuts of shop requested by shopkeeper
export const getProducts = async (req, res) => {
    try {
      const  shopId  = req.ownerId;
      if (!shopId) {
        return res.status(400).json({ message: "Shop ID is required" });
      }

      const products = await Product.find({ shopId });
  
      if (!products.length) {
        return res.status(404).json({ message: "No products found for this shop." });
      }
  
      res.status(200).json({
        success:true,
        products
      });
    } catch (error) {
    const customError = new Error("Failed to fetch products");
    customError.statusCode = 500; 
    next(customError); 
}

  };
 



//  customer added 
 
export const getShopProduct = async (req, res) => {
  try {
      const { shopId } = req.params;
      //const { category } = req.query;
    //   console.log(shopId)

    // Find products by shopId and category
    const products = await Product.find({ shopId });

    if (!products.length) {
      return res.status(404).json({ success: false, message: "No products found for this category in the shop" });
    }

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

 // Get products whose quantity is below the alert level

export const getLowStockProducts = async (req, res) => { 
    try {
        const  shopId  = req.ownerId;
        const shopid = new mongoose.Types.ObjectId(shopId);

        console.log(shopId);

        // Use $expr to compare two fields (quantity and lowStockThreshold)
        const lowStockProducts = await Product.find({ 
            shopId: shopid, 
            $expr: { $lt: ["$quantity", "$lowStockThreshold"] } // Compare quantity < lowStockThreshold
        });

        console.log(lowStockProducts);
        res.status(200).json(lowStockProducts);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error fetching low stock products", error });
    }
};

  
  // Update product quantities
  export const updateProductQuantities = async (req, res) => {
    try {
      const { products } = req.body;
  
      if (!products || products.length === 0) {
        return res.status(400).json({ message: "No products provided for update" });
      }
  
      // Prepare bulk operations
      const bulkOperations = products.map((product) => ({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { quantity: product.newQuantity } },
        },
      }));
  
      // Perform bulk write operation
      const result = await Product.bulkWrite(bulkOperations);
  
      res.status(200).json({ message: "Product quantities updated successfully", result });
    } catch (error) {
      res.status(500).json({ message: "Error updating quantities", error });
    }
  };
  export const getCategories = async(req,res,next)=>{
    const shopId = req.ownerId;
    try {
      const categories = await Owner.findById(shopId).select("itemCategories");
      return res.status(201).json({categories})
    } catch (error) {
      next(error)
    }
  }

