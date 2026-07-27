import express from 'express';
import { hubtelWebhook, hubtelPayoutWebhook } from '../controllers/payment.js';
import verifyHubtelWebhook from '../middleware/hubtelWebhookAuth.js';

const router = express.Router();

router.post('/hubtel', verifyHubtelWebhook, hubtelWebhook);
router.post('/hubtel-payout', verifyHubtelWebhook, hubtelPayoutWebhook);

export default router;
