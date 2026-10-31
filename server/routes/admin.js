import { getMoneyMovements } from "../controllers/admin/money.js";
import {
  getAdminMe,
  changeMyAdminPassword,
  listTeam,
  createTeamMember,
  updateTeamMember,
  resetTeamMemberPassword,
  getAdminActivity,
} from '../controllers/admin/team.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getDashboardStats,
  getAdminOverview,
  getActiveDrivers,
  getAllTrips,
  getTripById,
  resolveUnpaidTrip,
  getReport,
  getActiveTrips,
  assignRideToDriver,
  getFinanceStats,
  getSettingsAdmin,
  updateSettingsAdmin,
  uploadKitchenAlertSound,
  uploadRiderAlertSound,
  getPushTemplatesAdmin,
  updatePushTemplatesAdmin,
  previewPushTemplateAdmin,
  getPushBroadcastAdmin,
  sendPushBroadcastAdmin,
  getTransactionsAdmin,
  getFoodPaymentsAdmin,
  creditDriverBalance,
  getRiderDebtsAdmin,
  getStoreDebtsAdmin,
  recordStoreCommissionPayment,
  getStoreLedgerAdmin,
  retryFoodPaymentPayoutAdmin,
  getRiderBalancesAdmin,
  payOutRiderAdmin,
} from '../controllers/admin.js';
import {
  getDispatchOverview,
  getDispatchAnalytics,
  getDispatchDrivers,
  getDriverDispatchProfile,
  adminUpdateDriverServicePreferences,
  adminUpdateDriverReliability,
} from '../controllers/adminDispatch.js';
import {
  adminCreateVendor,
  adminListVendors,
  adminUpdateVendor,
  adminDeleteVendor,
  adminResetVendorPassword,
  adminListVendorCategories,
  adminCreateVendorCategory,
  adminListRestaurants,
  adminGetRestaurant,
  adminCreateRestaurant,
  adminUpdateRestaurant,
  adminDeleteRestaurant,
  adminCreateMenuItem,
  adminUpdateMenuItem,
  adminDeleteMenuItem,
} from '../controllers/restaurant.js';
import {
  adminListStoreTypes,
  adminCreateStoreType,
  adminUpdateStoreType,
  adminDeleteStoreType,
} from '../controllers/commerceStoreType.js';
import { adminListStoreReviews, adminReviewStore } from '../controllers/storeReview.js';
import {
  adminListVendorApplications,
  adminUpdateVendorApplication,
  adminInviteFromApplication,
} from '../controllers/vendorApplication.js';
import { adminListChatReports, adminUpdateChatReport } from '../controllers/chatReport.js';
import { registerAdminServiceZoneRoutes } from './serviceZone.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });

const kitchenSoundUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, soundsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp3';
      cb(null, `new-order${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed'));
  },
});

const adminRouter = express.Router();

adminRouter.get('/stats', getDashboardStats);
adminRouter.get('/overview', getAdminOverview);
adminRouter.get('/dispatch/overview', getDispatchOverview);
adminRouter.get('/dispatch/analytics', getDispatchAnalytics);
adminRouter.get('/dispatch/drivers', getDispatchDrivers);
adminRouter.get('/dispatch/drivers/:id', getDriverDispatchProfile);
adminRouter.patch('/dispatch/drivers/:id/service-preferences', adminUpdateDriverServicePreferences);
adminRouter.patch('/dispatch/drivers/:id/reliability', adminUpdateDriverReliability);
adminRouter.get('/drivers/active', getActiveDrivers);
adminRouter.get('/trips', getAllTrips);
adminRouter.get('/trips/active', getActiveTrips);
adminRouter.get('/trips/:id', getTripById);
adminRouter.post('/trips/:id/payment', resolveUnpaidTrip);
adminRouter.get('/reports', getReport);
adminRouter.post('/rides/:rideId/assign', assignRideToDriver);
adminRouter.get('/finance', getFinanceStats);
adminRouter.get('/money', getMoneyMovements);
adminRouter.get('/store-reviews', adminListStoreReviews);
adminRouter.post('/restaurants/:id/review', adminReviewStore);
adminRouter.get('/settings', getSettingsAdmin);
adminRouter.patch('/settings', updateSettingsAdmin);
adminRouter.get('/push-templates', getPushTemplatesAdmin);
adminRouter.patch('/push-templates', updatePushTemplatesAdmin);
adminRouter.post('/push-templates/preview', previewPushTemplateAdmin);
adminRouter.get('/push-broadcast', getPushBroadcastAdmin);
adminRouter.post('/push-broadcast', sendPushBroadcastAdmin);
adminRouter.post(
  '/settings/kitchen-alert-sound',
  kitchenSoundUpload.single('sound'),
  uploadKitchenAlertSound
);
adminRouter.post(
  '/settings/rider-alert-sound',
  kitchenSoundUpload.single('sound'),
  uploadRiderAlertSound
);
adminRouter.get('/transactions', getTransactionsAdmin);
adminRouter.get('/food-payments', getFoodPaymentsAdmin);
adminRouter.post('/food-payments/:id/retry-payout', retryFoodPaymentPayoutAdmin);
adminRouter.post('/drivers/:id/credit', creditDriverBalance);
adminRouter.get('/rider-debts', getRiderDebtsAdmin);
adminRouter.get('/store-debts', getStoreDebtsAdmin);
adminRouter.post('/stores/:id/commission-payment', recordStoreCommissionPayment);
adminRouter.get('/stores/:id/ledger', getStoreLedgerAdmin);
adminRouter.get('/rider-balances', getRiderBalancesAdmin);
// Team (super admin only, see utils/adminAccess.js) and the signed-in admin's own account.
adminRouter.get('/me', getAdminMe);
adminRouter.post('/me/password', changeMyAdminPassword);
adminRouter.get('/team', listTeam);
adminRouter.post('/team', createTeamMember);
adminRouter.patch('/team/:id', updateTeamMember);
adminRouter.post('/team/:id/reset-password', resetTeamMemberPassword);
adminRouter.get('/activity', getAdminActivity);
adminRouter.post('/drivers/:id/payout', payOutRiderAdmin);

// Multivendor restaurant management
adminRouter.get('/store-types', adminListStoreTypes);
adminRouter.post('/store-types', adminCreateStoreType);
adminRouter.patch('/store-types/:id', adminUpdateStoreType);
adminRouter.delete('/store-types/:id', adminDeleteStoreType);

adminRouter.get('/vendors', adminListVendors);
adminRouter.post('/vendors', adminCreateVendor);
adminRouter.patch('/vendors/:vendorId', adminUpdateVendor);
adminRouter.post('/vendors/:vendorId/reset-password', adminResetVendorPassword);
adminRouter.get('/vendor-applications', adminListVendorApplications);
adminRouter.patch('/vendor-applications/:id', adminUpdateVendorApplication);
adminRouter.post('/vendor-applications/:id/invite', adminInviteFromApplication);
adminRouter.get('/chat-reports', adminListChatReports);
adminRouter.patch('/chat-reports/:id', adminUpdateChatReport);
adminRouter.delete('/vendors/:vendorId', adminDeleteVendor);
adminRouter.get('/vendors/:vendorId/categories', adminListVendorCategories);
adminRouter.post('/vendors/:vendorId/categories', adminCreateVendorCategory);
adminRouter.get('/restaurants', adminListRestaurants);
adminRouter.post('/restaurants', adminCreateRestaurant);
adminRouter.get('/restaurants/:id', adminGetRestaurant);
adminRouter.patch('/restaurants/:id', adminUpdateRestaurant);
adminRouter.delete('/restaurants/:id', adminDeleteRestaurant);
adminRouter.post('/restaurants/:id/menu', adminCreateMenuItem);
adminRouter.patch('/restaurants/:id/menu/:itemId', adminUpdateMenuItem);
adminRouter.delete('/restaurants/:id/menu/:itemId', adminDeleteMenuItem);

registerAdminServiceZoneRoutes(adminRouter);

export default adminRouter;
