# Cloudinary & Multer Setup Guide

This guide explains how to set up and use Cloudinary and Multer for image uploading in the Rayo Finance backend.

## Overview

- **Multer**: Handles file uploads from the client and stores them in memory as buffers
- **Cloudinary**: Cloud storage service for images with transformations and optimization

## Installation

Packages have been installed:
- `multer` - Middleware for handling file uploads
- `cloudinary` - Node.js SDK for Cloudinary
- `next-cloudinary` - (optional) Additional utilities
- `@types/multer` - TypeScript types

## Environment Variables

Add these to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Getting Cloudinary Credentials

1. Sign up at [cloudinary.com](https://cloudinary.com/)
2. Go to your Dashboard
3. Find your Cloud Name, API Key, and API Secret in the Account section
4. Copy these values to your `.env` file

## File Structure

### New Files Created

1. **`src/lib/cloudinary.ts`** - Cloudinary utility functions
   - `uploadToCloudinary()` - Upload files to Cloudinary
   - `deleteFromCloudinary()` - Delete files from Cloudinary
   - `getCloudinaryImageUrl()` - Get optimized image URLs

2. **`src/lib/multer.ts`** - Multer configuration
   - Memory storage configuration
   - File type validation (JPEG, PNG, GIF, WebP)
   - 5MB file size limit
   - `uploadSingleImage` middleware
   - `uploadMultipleImages` middleware

3. **Profile Image Upload Handler** - Added to `src/handlers/auth.ts`
   - `uploadProfileImage()` - Handle profile picture uploads

### Modified Files

1. **`src/routes/auth.ts`** - Added new route
   - `POST /api/auth/upload-image` - Upload profile image

## Usage

### API Endpoint

**Upload Profile Image**

```bash
POST /api/auth/upload-image
```

**Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: multipart/form-data`

**Request:**
- Form field name: `image`
- Accepted formats: JPEG, PNG, GIF, WebP
- Max file size: 5MB

**Response (Success):**
```json
{
  "statusCode": 200,
  "message": "Profile image uploaded successfully",
  "data": {
    "image": "https://res.cloudinary.com/...",
    "message": "Profile image uploaded successfully"
  }
}
```

**Response (Error):**
```json
{
  "statusCode": 400,
  "message": "No image file provided"
}
```

### Frontend Example (JavaScript/React)

```javascript
const uploadProfileImage = async (imageFile, token) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('/api/auth/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();
  return result;
};

// Usage in a React component
const handleImageUpload = async (event) => {
  const file = event.target.files[0];
  const token = localStorage.getItem('authToken');
  
  try {
    const result = await uploadProfileImage(file, token);
    console.log('Image uploaded:', result.data.image);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### Curl Example

```bash
curl -X POST http://localhost:3000/api/auth/upload-image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

## Features

### Automatic Old Image Deletion

When a user uploads a new profile image, the old image is automatically deleted from Cloudinary to save storage space.

### Image Transformations

The `getCloudinaryImageUrl()` function supports transformations:

```typescript
// Get image with specific width and height
const url = getCloudinaryImageUrl('profile-123-4567', 200, 200);
// Returns optimized image with face-aware cropping
```

### File Validation

Multer validates:
- ✅ File types: JPEG, PNG, GIF, WebP only
- ✅ File size: Maximum 5MB
- ❌ Other formats are rejected

## Security Considerations

1. **Authentication**: All upload endpoints require valid JWT token
2. **File Type Validation**: Only images are allowed
3. **File Size Limits**: 5MB per file to prevent abuse
4. **Rate Limiting**: Upload endpoints use auth rate limiter
5. **Unique Filenames**: Files include timestamp and user ID to prevent collisions

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "No image file provided" | No file in request | Ensure file is attached in `image` field |
| "Only image files are allowed" | Wrong file type | Use JPEG, PNG, GIF, or WebP |
| "File size exceeds limit" | File > 5MB | Compress image or reduce file size |
| "Failed to upload image" | Cloudinary error | Check Cloudinary credentials in `.env` |
| "Unauthorized" | Missing/invalid token | Include valid JWT in Authorization header |

## Extending the Implementation

### Upload Multiple Images

```typescript
// In routes
router.post("/images/batch", requireAuth, uploadMultipleImages, batchUploadHandler);

// Handler example
export const batchUploadHandler = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  
  if (!req.files || req.files.length === 0) {
    throw new ErrorResponse("No images provided", 400);
  }

  const urls = [];
  for (const file of req.files) {
    const result = await uploadToCloudinary(
      file.buffer,
      `batch-${userId}-${Date.now()}`,
      "rayo-finance/images"
    );
    if (result.success) {
      urls.push(result.url);
    }
  }

  return appResponse(res, 200, { images: urls });
});
```

### Add to Other Entities

To add image uploads to transactions, budgets, or savings goals:

1. Add `imageUrl` field to schema
2. Create upload handler in respective file
3. Add route with `uploadSingleImage` middleware
4. Handle deletion when records are deleted

## Monitoring

Monitor uploads using:
- Cloudinary Dashboard for storage usage
- Application logs for upload success/failures
- Sentry for error tracking

## Troubleshooting

**Images not uploading:**
- Check Cloudinary API credentials
- Verify `.env` variables are loaded
- Check browser console for CORS issues
- Ensure file is within 5MB limit

**Images not deleting:**
- Old image deletion failures are logged but don't fail the request
- Check Cloudinary dashboard to manually delete orphaned files

**Performance issues:**
- Use `getCloudinaryImageUrl()` with dimensions for responsive images
- Enable Cloudinary CDN caching

## References

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Multer Documentation](https://github.com/expressjs/multer)
- [Cloudinary Node.js SDK](https://github.com/cloudinary/cloudinary_npm)
