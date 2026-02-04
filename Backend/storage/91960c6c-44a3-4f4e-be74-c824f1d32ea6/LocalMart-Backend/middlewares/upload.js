import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "shops",
    allowed_formats: ["jpg", "jpeg", "png","webp"],
  },
});

const upload = multer({  
  storage,
  limits: { fileSize: 1 * 1024 * 500 }, //size limit 500 KB
  fileFilter: (req, file, cb) => {
    console.log("infilter");
    
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
});

export default upload;
