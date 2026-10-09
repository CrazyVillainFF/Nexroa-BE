const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Ensure local uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup Cloudinary if credentials provided
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for image types only
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed.'), false);
  }
};

const validateImageContent = (req, res, next) => {
  if (!req.file) return next();
  let valid = false;
  try {
    const signature = Buffer.alloc(12);
    const descriptor = fs.openSync(req.file.path, 'r');
    try { fs.readSync(descriptor, signature, 0, signature.length, 0); }
    finally { fs.closeSync(descriptor); }
    const bytes = [...signature];
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isGif = signature.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/);
    const isWebp = signature.subarray(0, 4).toString('ascii') === 'RIFF' && signature.subarray(8, 12).toString('ascii') === 'WEBP';
    valid = isJpeg || isPng || isGif || isWebp;
  } catch { valid = false; }

  if (!valid) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, message: 'The uploaded file is not a valid JPEG, PNG, WEBP, or GIF image.' });
  }
  return next();
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

/**
 * Upload helper that processes the uploaded file:
 * Uploads to Cloudinary if configured; otherwise returns the static local URL.
 */
const processUploadedFile = async (file, req, folder = 'nexora') => {
  if (!file) return null;

  // If Cloudinary is configured
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `nexora/${folder}`,
        resource_type: 'image'
      });
      // Remove temporary local file after Cloudinary upload
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return result.secure_url;
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err);
      // Fallback to local file URL if Cloudinary fails
    }
  }

  // Local storage URL (served statically via Express /uploads route)
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${file.filename}`;
};

module.exports = { upload, processUploadedFile, validateImageContent };
