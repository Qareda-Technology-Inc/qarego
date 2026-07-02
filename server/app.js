import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io'; 
import cors from 'cors';
import connectDB from './config/connect.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import authMiddleware from './middleware/authentication.js';
import requireAdmin from './middleware/requireAdmin.js';

// Routers
import authRouter from './routes/auth.js';
import rideRouter from './routes/ride.js';
import driverRouter from './routes/driver.js';
import customerRouter from './routes/customer.js';
import adminRouter from './routes/admin.js';
import merchantRouter from './routes/merchant.js';
import foodRouter from './routes/food.js';
import commerceRouter from './routes/commerce.js';
import webhooksRouter from './routes/webhooks.js';
import mediaRouter from './routes/media.js';
import notificationsRouter from './routes/notifications.js';
import { initCloudinary, isCloudinaryConfigured } from './utils/cloudinary.js';
import { getFirebaseConfigSource, isFirebaseConfigured } from './utils/firebaseAdmin.js';
import { clearDemoFoodSeed } from './seedFood.js';
import { ensureDefaultStoreTypes } from './utils/commerceStoreTypes.js';
import { startFoodCourierBroadcastScheduler } from './utils/foodCourierBroadcastScheduler.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist (for driver documents, etc.)
const uploadsDir = path.join(__dirname, 'uploads');
const driversUploadsDir = path.join(__dirname, 'uploads', 'drivers');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(driversUploadsDir)) fs.mkdirSync(driversUploadsDir, { recursive: true });
const publicSoundsDir = path.join(__dirname, 'public', 'sounds');
if (!fs.existsSync(publicSoundsDir)) fs.mkdirSync(publicSoundsDir, { recursive: true });

// Import socket handler
import handleSocketConnection from './controllers/sockets.js';

dotenv.config();

if (isCloudinaryConfigured()) {
  initCloudinary();
  console.log('[media] Cloudinary enabled');
} else {
  console.log('[media] Cloudinary not configured — using local /uploads');
}

if (isFirebaseConfigured()) {
  const firebaseSource = getFirebaseConfigSource();
  const sourceLabel =
    firebaseSource === "json_path"
      ? "JSON var -> file path"
      : firebaseSource === "json"
      ? "JSON var"
      : firebaseSource === "path"
      ? "PATH var"
      : "unknown";
  console.log(`[push] Firebase Cloud Messaging enabled (${sourceLabel})`);
} else {
  const firebaseSource = getFirebaseConfigSource();
  if (firebaseSource === "invalid_json") {
    console.log(
      "[push] Firebase config invalid — FIREBASE_SERVICE_ACCOUNT_JSON is neither valid JSON nor a readable file path"
    );
  } else if (firebaseSource === "missing_path_file") {
    console.log(
      "[push] Firebase config invalid — FIREBASE_SERVICE_ACCOUNT_PATH does not point to an existing file"
    );
  } else {
    console.log(
      "[push] Firebase not configured — set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in server/.env"
    );
  }
}

EventEmitter.defaultMaxListeners = 20;

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  process.env.ADMIN_ORIGIN,
  process.env.MERCHANT_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Mobile apps / curl / server-to-server (no Origin header)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // Dev: merchant opened via LAN IP (e.g. http://192.168.x.x:3001)
    if (
      process.env.NODE_ENV !== "production" &&
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-restaurant-id"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);

// Handle malformed/aborted HTTP connections defensively.
server.on("clientError", (err, socket) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[http] clientError:", err?.message || err);
  }
  if (socket && typeof socket.end === "function" && socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }
  if (socket && typeof socket.destroy === "function" && !socket.destroyed) {
    socket.destroy();
  }
});

const io = new socketIo(server, { cors: { origin: "*" } });

// Store io instance on app for route access
app.set('io', io);

// Attach the WebSocket instance to the request object
app.use((req, res, next) => {
  req.io = io;
  // Node can emit request-stream errors on abrupt disconnects.
  // Attach listeners so they do not bubble as unhandled exceptions.
  req.on("error", (err) => {
    console.warn("[http] request stream error:", err?.message || err);
  });
  res.on("error", (err) => {
    console.warn("[http] response stream error:", err?.message || err);
  });
  return next();
});

// Initialize the WebSocket handling logic
handleSocketConnection(io);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sounds', express.static(path.join(__dirname, 'public', 'sounds')));

/** Public ping for phone/browser — GET http://YOUR_MAC_IP:2026/health */
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "qarego-api" });
});

// Routes
app.use("/auth", authRouter);
app.use("/ride", authMiddleware, rideRouter);
app.use("/drivers", driverRouter);
app.use("/customers", authMiddleware, requireAdmin, customerRouter);
app.use("/admin", authMiddleware, requireAdmin, adminRouter);
app.use("/merchant", authMiddleware, merchantRouter);
app.use("/food", authMiddleware, foodRouter);
app.use("/commerce", authMiddleware, commerceRouter);
app.use("/webhooks", webhooksRouter);
app.use("/media", mediaRouter);
app.use("/notifications", notificationsRouter);

// Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

import Settings from './models/Settings.js';

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    const existing = await Settings.findOne({ key: 'global' });
    if (!existing) {
      await Settings.create({ key: 'global', commissionRate: 0.15, debtLimit: -100 });
      console.log('Global settings created (commission 15%, debt limit -100)');
    }
    await clearDemoFoodSeed();
    await ensureDefaultStoreTypes();
    const port = process.env.PORT || 3000;
    server.listen(port, "0.0.0.0", () => {
      startFoodCourierBroadcastScheduler(io);
      console.log(`HTTP server listening on 0.0.0.0:${port} (all devices on your LAN)`);
      console.log(`  Local:  http://127.0.0.1:${port}/health`);
      const lanIps = [];
      for (const iface of Object.values(os.networkInterfaces())) {
        for (const addr of iface || []) {
          if (addr.family === "IPv4" && !addr.internal) {
            lanIps.push(addr.address);
            console.log(`  LAN:    http://${addr.address}:${port}/health`);
          }
        }
      }
      if (lanIps.length === 0) {
        console.log("  (No LAN IPv4 found — check Wi‑Fi / VPN)");
      }
    });
  } catch (error) {
    console.log(error);
  }
};

start();
