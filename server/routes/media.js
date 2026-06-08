import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authentication.js";
import { getMediaConfig, uploadImage } from "../controllers/media.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype?.startsWith("image/") || file.mimetype === "application/pdf";
    if (ok) cb(null, true);
    else cb(new Error("Only images and PDF files are allowed"));
  },
});

const router = express.Router();

function handleMulterUpload(req, res, next) {
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) {
      const picked = req.files?.file?.[0] || req.files?.image?.[0];
      if (picked) req.file = picked;
      return next();
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File must be under 15 MB" });
    }
    return res.status(400).json({ message: err.message || "Invalid upload" });
  });
}

router.get("/config", authMiddleware, getMediaConfig);
router.post("/upload", authMiddleware, handleMulterUpload, uploadImage);

export default router;
