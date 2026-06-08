import express from 'express';
import { hubtelWebhook } from '../controllers/payment.js';

const router = express.Router();

router.post('/hubtel', hubtelWebhook);
router.post('/hubtel-payout', (req, res) => res.status(200).json({ received: true }));

export default router;
