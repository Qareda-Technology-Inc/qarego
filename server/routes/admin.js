import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getDashboardStats,
  getActiveDrivers,
  getAllTrips,
  getTripById,
  getRidesReport,
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
  creditDriverBalance,
  runWeeklyPayouts,
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
adminRouter.get('/reports/rides-by-day', getRidesReport);
adminRouter.post('/rides/:rideId/assign', assignRideToDriver);
adminRouter.get('/finance', getFinanceStats);
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
adminRouter.post('/drivers/:id/credit', creditDriverBalance);
adminRouter.post('/payouts/run', runWeeklyPayouts);

// Multivendor restaurant management
adminRouter.get('/store-types', adminListStoreTypes);
adminRouter.post('/store-types', adminCreateStoreType);
adminRouter.patch('/store-types/:id', adminUpdateStoreType);
adminRouter.delete('/store-types/:id', adminDeleteStoreType);

adminRouter.get('/vendors', adminListVendors);
adminRouter.post('/vendors', adminCreateVendor);
adminRouter.patch('/vendors/:vendorId', adminUpdateVendor);
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

export default adminRouter;
