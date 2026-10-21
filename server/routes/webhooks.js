import express from 'express';
import { hubtelWebhook, hubtelPayoutWebhook, paystackWebhook } from '../controllers/payment.js';
import verifyHubtelWebhook from '../middleware/hubtelWebhookAuth.js';

const router = express.Router();

router.post('/hubtel', verifyHubtelWebhook, hubtelWebhook);
router.post('/hubtel-payout', verifyHubtelWebhook, hubtelPayoutWebhook);
// Signature-checked inside the handler (needs the raw body kept by express.json in app.js).
router.post('/paystack', paystackWebhook);

export default router;
