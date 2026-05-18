import { v2 as cloudinary } from "cloudinary";
import { logger } from "./logger.ts";
import ENV from "../../db/env.ts";

cloudinary.config({
  cloud_name: ENV.CLOUDINARY.CLOUD_NAME,
  api_key: ENV.CLOUDINARY.API_KEY,
  api_secret: ENV.CLOUDINARY.API_SECRET,
});

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
} 

/**
 * Upload a file buffer to Cloudinary
 */
export const uploadToCloudinary = async (
  buffer: Buffer,
  filename: string,
  folder: string = "rayo-finance"
): Promise<UploadResult> => {
  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "auto",
        public_id: filename,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          logger.error(`Cloudinary upload failed: ${error.message}`);
          resolve({
            success: false,
            error: error.message,
          });
        } else {
          logger.info(`File uploaded to Cloudinary: ${result?.public_id}`);
          resolve({
            success: true,
            url: result?.secure_url,
            publicId: result?.public_id,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === "ok") {
      logger.info(`File deleted from Cloudinary: ${publicId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to delete from Cloudinary: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

/**
 * Get Cloudinary image URL with transformations
 */
export const getCloudinaryImageUrl = (publicId: string, width?: number, height?: number): string => {
  let url = cloudinary.url(publicId, {
    secure: true,
  });

  if (width && height) {
    url = cloudinary.url(publicId, {
      secure: true,
      crop: "fill",
      width,
      height,
      gravity: "face",
    });
  }

  return url;
};

export default cloudinary;
