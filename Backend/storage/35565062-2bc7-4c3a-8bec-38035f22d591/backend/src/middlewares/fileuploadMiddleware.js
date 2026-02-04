import multer from "multer";
import path from "path";
import fs from "fs";

const TEMP_DIR = "storage/temp";

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "video/mp4",
    "video/quicktime",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Unsupported file type"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB per file (extra safety)
  },
});
export default upload;  