// Admin trips: lists, detail, reports, live map and manual dispatch.
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../../utils/tripSettlement.js";
import { generateOTP } from "../../utils/mapUtils.js";
import { canRiderReceiveOffer, getEligibilityRejectReason } from "../../utils/riderServiceEligibility.js";

export const getAllTrips = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (type && type !== 'ALL') {
      if (type === 'RIDE') query.serviceType = 'RIDE';
      else if (type === 'DELIVERY') query.serviceType = 'DELIVERY';
    }

    const trips = await Ride.find(query)
      .populate('customer', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Ride.countDocuments(query);

    res.status(StatusCodes.OK).json({
      trips,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalTrips: count
    });
  } catch (error) {
    console.error('Get all trips error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch trips' });
  }
};

/** GET /admin/trips/:id - Get single trip with full details for dispute/detail view */
export const getTripById = async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await Ride.findById(id)
      .populate('customer', 'name phone email')
      .populate('rider', 'name phone email driverDetails');
    if (!trip) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Trip not found' });
    }
    res.status(StatusCodes.OK).json({ trip });
  } catch (error) {
    console.error('Get trip by id error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch trip' });
  }
};

/** GET /admin/reports/rides-by-day - Rides per day for last N days (default 14) */
export const getRidesReport = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const report = await Ride.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          totalFare: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$fare', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(StatusCodes.OK).json({ report, days });
  } catch (error) {
    console.error('Rides report error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch report' });
  }
};

/** GET /admin/trips/active - Active (ongoing) trips for live map */
export const getActiveTrips = async (req, res) => {
  try {
    const activeStatuses = ['SEARCHING_FOR_RIDER', 'START', 'ARRIVED', 'IN_PROGRESS'];
    const trips = await Ride.find({ status: { $in: activeStatuses } })
      .populate('customer', 'name phone')
      .populate('rider', 'name phone currentLocation')
      .select('pickup drop status rider customer createdAt')
      .lean();

    const formatted = trips.map((t) => ({
      _id: t._id,
      status: t.status,
      pickup: t.pickup,
      drop: t.drop,
      customer: t.customer,
      rider: t.rider,
      createdAt: t.createdAt,
      riderLocation: t.rider?.currentLocation?.coordinates
        ? { lat: t.rider.currentLocation.coordinates[1], lng: t.rider.currentLocation.coordinates[0] }
        : null,
    }));

    res.status(StatusCodes.OK).json({ trips: formatted });
  } catch (error) {
    console.error('Get active trips error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch active trips' });
  }
};

/** POST /admin/rides/:rideId/assign - Manual dispatch: assign a ride to a specific driver */
export const assignRideToDriver = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'driverId is required' });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Ride not found' });
    }
    if (ride.status !== 'SEARCHING_FOR_RIDER') {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Ride is not pending assignment' });
    }

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'rider') {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Driver not found' });
    }
    const driverStatus = driver.driverDetails?.status;
    if (driverStatus !== 'active') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Driver must have status Active to receive rides',
      });
    }

    const settings = await getSettings();
    if (!canRiderReceiveOffer(driver, ride, settings)) {
      const reason = getEligibilityRejectReason(driver, ride, settings);
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: reason || 'Driver cannot accept this service type with their vehicle',
      });
    }

    ride.rider = driverId;
    ride.status = 'START';
    ride.otp = ride.otp || generateOTP();
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      const rideWithCustomer = await Ride.findById(rideId).populate('customer', 'name phone averageRating totalRatings');
      io.to(`rider_${driverId}`).emit('rideOffer', rideWithCustomer);
      const rideData = await Ride.findById(rideId).populate('customer rider');
      io.to(`ride_${rideId}`).emit('rideData', rideData);
    }

    res.status(StatusCodes.OK).json({ message: 'Ride assigned', ride: await Ride.findById(rideId).populate('customer rider') });
  } catch (error) {
    console.error('Assign ride error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to assign ride' });
  }
};
