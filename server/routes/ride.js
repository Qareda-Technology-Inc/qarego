import express from 'express';
import { createRide, getFareRates, getRideById, getCourierLocation, updateRideStatus, acceptRide, getMyRides, getPendingRideOffers, rateRide, updateRiderStatus, getMyTransactions, getRiderAlertSound, getRiderServicePreferences, updateRiderServicePreferences, getRiderReliability, getRiderDispatchAnalytics, declineRideOffer } from '../controllers/ride.js';
import { initiateTopUp } from '../controllers/payment.js';

const router = express.Router();

router.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

router.get('/fare-rates', getFareRates);
router.post('/create', createRide);
router.get('/rides', getMyRides);
router.get('/reliability', getRiderReliability);
router.get('/dispatch-analytics', getRiderDispatchAnalytics);
router.get('/offers/pending', getPendingRideOffers);
router.post('/offers/:rideId/decline', declineRideOffer);
router.get('/rider-alert-sound', getRiderAlertSound);
router.get('/transactions', getMyTransactions);
router.post('/top-up', initiateTopUp);
router.patch('/rider-status', updateRiderStatus);
router.get('/service-preferences', getRiderServicePreferences);
router.patch('/service-preferences', updateRiderServicePreferences);
router.patch('/accept/:rideId', acceptRide);
router.patch('/update/:rideId', updateRideStatus);
router.post('/:rideId/rate', rateRide);
router.get('/:rideId/courier-location', getCourierLocation);
router.get('/:rideId', getRideById);

export default router;
