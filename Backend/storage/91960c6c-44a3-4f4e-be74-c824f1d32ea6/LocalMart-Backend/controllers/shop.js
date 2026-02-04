import { Owner } from '../models/owner.js';
import {Product} from "../models/product.js"

export const getAllShops = async (req, res) => {
  try { 

   // const { latitude, longitude } = req.query; 

    // if (!latitude || !longitude) {
    //   return res.status(400).json({ success: false, message: "User location required" });
    // }

    // const userLocation = {
    //   type: "Point",
    //   coordinates: [parseFloat(latitude),parseFloat(longitude) ], // official [longitude, latitude] but this doesn't work , so using [latitude,longitude]
    // };
    // console.log(userLocation)
    const shops = await Owner.find({});
    const products = await Product.find({});
    //console.log(shops)
    res.status(200).json({ 
      success: true,
     products,
      data: shops,
    });

  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



export const getShopDetails = async (req, res) => {
    try {
      const { shopId } = req.params;
      // console.log(shopId)
      
      // Find the shop by ID
      const shop = await Owner.findById(shopId);
     
      
      if (!shop) {
        return res.status(404).json({ success: false, message: "Shop not found" });
      }
      
      res.status(200).json({ success: true, data: shop});
    } catch (error) {
      res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
  };
