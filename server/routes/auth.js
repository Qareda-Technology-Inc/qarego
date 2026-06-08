import express from 'express';
import { refreshToken, auth, updateUser, requestOtp, verifyOtp, adminLogin } from '../controllers/auth.js';
import { merchantLogin } from '../controllers/merchant.js';
import authMiddleware from '../middleware/authentication.js';

const router = express.Router();

router.post('/refresh-token', refreshToken);
router.post('/signin', auth);
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/admin/login', adminLogin);
router.post('/merchant/login', merchantLogin);
router.patch('/update-user', authMiddleware, updateUser);

export default router;
