import multer from "multer";
import { logger } from "./logger.ts";

// Configure multer to store files in memory (buffer) instead of disk
// since we'll be uploading directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`File rejected: Invalid MIME type ${file.mimetype}`);
    cb(new Error("Only image files are allowed (JPEG, PNG, GIF, WebP)"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

export const parseFormBody = upload.none();
export const uploadSingleImage = upload.single("image");
export const uploadMultipleImages = upload.array("images", 10); // Max 10 images

export default upload;
