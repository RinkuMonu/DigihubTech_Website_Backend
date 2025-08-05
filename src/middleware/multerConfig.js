import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// ✅ Configure Cloudinary with your credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // e.g., 'mycloud'
    api_key: process.env.CLOUDINARY_API_KEY,        // e.g., '1234567890'
    api_secret: process.env.CLOUDINARY_API_SECRET,  // e.g., 'abcdefg12345'
});

// ✅ Set up Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'uploads', // Folder name in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'], // Allowed image types
        // transformation: [{ width: 800, height: 800, crop: 'limit' }] // Optional image resize
    },
});

// ✅ File filter to allow only image files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// ✅ Create the multer upload middleware
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    }
});

// ✅ Optional: Multer error handler middleware
const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
    } else if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    next();
};

export default upload;
