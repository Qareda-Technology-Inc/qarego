// Admin trips: lists, detail, live map and manual dispatch.
import User from "../../models/User.js";
import Ride, { RIDE_CODE_FIELDS } from "../../models/Ride.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../../utils/tripSettlement.js";
import { generateOTP } from "../../utils/mapUtils.js";
import { canRiderReceiveOffer, getEligibilityRejectReason } from "../../utils/riderServiceEligibility.js";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import {
  OPEN_RIDE_PAYMENT,
  isUnpaidMomoTrip,
  markRidePaidInCash,
  writeOffUnpaidRide,
} from "../../utils/ridePayments.js";

export const getAllTrips = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, payment } = req.query;
    const query = {};
    // Completed MoMo trips the customer hasn't paid for.
    if (payment === 'UNPAID') {
      Object.assign(query, {
        status: 'COMPLETED',
        paymentMethod: 'MOBILE_MONEY',
        serviceType: { $in: ['RIDE', 'DELIVERY'] },
        paymentStatus: { $in: OPEN_RIDE_PAYMENT },
      });
    }
    if (status && status !== 'ALL' && payment !== 'UNPAID') {
      query.status = status;
    }
    if (type && type !== 'ALL') {
      if (type === 'RIDE') query.serviceType = 'RIDE';
      else if (type === 'DELIVERY') query.serviceType = 'DELIVERY';
    }

    // Search by customer or rider name/phone, an address, or the end of the trip id.
    const q = String(req.query.q || '').trim();
    if (q) {
      const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      // 024… and +23324… are the same number.
      const digits = q.replace(/\D/g, '').replace(/^(233|0)/, '');
      const people = await User.find({
        role: { $in: ['customer', 'rider'] },
        $or: [{ name: pattern }, ...(digits.length >= 4 ? [{ phone: new RegExp(digits) }] : [])],
      })
        .select('_id')
        .limit(200)
        .lean();
      const ids = people.map((p) => p._id);
      query.$or = [
        { customer: { $in: ids } },
        { rider: { $in: ids } },
        { 'pickup.address': pattern },
        { 'drop.address': pattern },
        ...(/^[a-f0-9]{4,24}$/i.test(q)
          ? [{ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${q}$`, options: 'i' } } }]
          : []),
      ];
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

    const ride = await Ride.findById(rideId).select(RIDE_CODE_FIELDS);
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

/**
 * POST /admin/trips/:id/payment { action: "paid_cash" | "write_off" } — settle a MoMo trip the
 * customer never paid. paid_cash: the customer paid the rider in cash (a normal cash trip).
 * write_off: QareGO pays the rider as if the MoMo payment had come in, and drops the debt.
 */
export const resolveUnpaidTrip = async (req, res) => {
  const { action } = req.body || {};
  if (!['paid_cash', 'write_off'].includes(action)) {
    throw new BadRequestError('action must be paid_cash or write_off');
  }
  const ride = await Ride.findById(req.params.id);
  if (!ride) throw new NotFoundError('Trip not found');
  if (!isUnpaidMomoTrip(ride)) throw new BadRequestError('This trip is not waiting for a mobile money payment');

  if (action === 'paid_cash') {
    const { outcome } = await markRidePaidInCash(ride, { by: 'ADMIN', io: req.io });
    return res.status(StatusCodes.OK).json({
      trip: ride,
      message: outcome === 'already_paid' ? 'The customer had already paid by mobile money.' : 'Marked as paid in cash.',
    });
  }
  await writeOffUnpaidRide(ride, { io: req.io });
  res.status(StatusCodes.OK).json({ trip: ride, message: 'Written off. The rider has been paid by QareGO.' });
};
