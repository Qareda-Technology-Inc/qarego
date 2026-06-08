
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  registerDriver,
  getAllDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
} from '../controllers/driver.js';
import authMiddleware from '../middleware/authentication.js';
import requireAdmin from '../middleware/requireAdmin.js';
import { assertImageUnderLimit, imageSizeErrorMessage } from '../utils/mediaLimits.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads', 'drivers');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype?.startsWith('image/') || file.mimetype === 'application/pdf';
    if (ok) cb(null, true);
    else cb(new Error('Only images and PDF files are allowed'));
  },
});

const driverUploads = upload.fields([
  { name: 'license', maxCount: 2 },
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'nationalId', maxCount: 1 },
  { name: 'policeClearance', maxCount: 1 },
  { name: 'registration', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 },
]);

function validateDriverImageSizes(req, res, next) {
  const files = req.files;
  if (!files || typeof files !== 'object') return next();
  try {
    for (const list of Object.values(files)) {
      for (const file of list || []) {
        assertImageUnderLimit(file.size, file.mimetype);
      }
    }
    return next();
  } catch (err) {
    if (err.code === 'IMAGE_TOO_LARGE') {
      return res.status(400).json({ message: imageSizeErrorMessage() });
    }
    return res.status(400).json({ message: err.message || 'Invalid upload' });
  }
}

/** Skip multer when admin/app sends JSON with pre-uploaded document URLs */
function optionalDriverUploads(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) return next();
  return driverUploads(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File must be under 15 MB' });
      }
      return res.status(400).json({ message: err.message || 'Invalid upload' });
    }
    return validateDriverImageSizes(req, res, next);
  });
}

const adminOnly = [authMiddleware, requireAdmin];

router.post('/register', ...adminOnly, optionalDriverUploads, registerDriver);
router.get('/', ...adminOnly, getAllDrivers);
router.get('/:id', ...adminOnly, getDriver);
router.patch('/:id', authMiddleware, optionalDriverUploads, updateDriver);
router.delete('/:id', ...adminOnly, deleteDriver);

export default router;
