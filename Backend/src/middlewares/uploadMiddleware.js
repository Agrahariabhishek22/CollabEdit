import multer from 'multer';
import path from 'path';

// Disk storage is safer for large project uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage/temp'); // Ek temp directory bana lo
    },
    filename: (req, file, cb) => {
        // Unique name taaki collision na ho
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9));
    }
});

export const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit (Source code ke liye kaafi hai)
});