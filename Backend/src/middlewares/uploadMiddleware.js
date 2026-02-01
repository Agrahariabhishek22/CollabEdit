import multer from 'multer';

// Memory storage is better here because we manually handle the fs write 
// to recreate the folder structure sent from webkitdirectory.
const storage = multer.memoryStorage();

export const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});