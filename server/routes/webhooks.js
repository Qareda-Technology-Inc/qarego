import express from 'express';
import { paystackWebhook } from '../controllers/payment.js';

const router = express.Router();

// Signature-checked inside the handler (needs the raw body kept by express.json in app.js).
router.post('/paystack', paystackWebhook);

export default router;
