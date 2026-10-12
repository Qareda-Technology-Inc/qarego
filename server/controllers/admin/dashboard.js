// Admin dashboard: headline stats and on-duty riders.
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import { StatusCodes } from "http-status-codes";
import { formatCurrency } from "../../utils/currency.js";

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Helper for percentage change
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // 1. Total Rides (Today vs Yesterday)
    const ridesToday = await Ride.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const ridesYesterday = await Ride.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });
    const ridesChange = calculateChange(ridesToday, ridesYesterday);

    // 2. Active Drivers (Total Active vs Total Pending/Suspended)
    // Now using isOnline for a more accurate 'Active Now' count if desired, 
    // or keep 'Active Accounts'. Let's show 'Online Drivers' as the stat for better real-time utility.
    const onlineDrivers = await User.countDocuments({
      role: 'rider',
      isOnline: true
    });
    // For the change metric, we don't have history of 'online yesterday at this time', 
    // so we'll just show the total approved drivers as context or keep it simple.
    const approvedDrivers = await User.countDocuments({ 
        role: 'rider', 
        'driverDetails.status': 'active' 
    });
    
    // 3. New Sign-ups (Today vs Yesterday)
    const signupsToday = await User.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const signupsYesterday = await User.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });
    const signupsChange = calculateChange(signupsToday, signupsYesterday);

    // 4. Revenue (Today vs Yesterday)
    const getRevenue = async (start, end) => {
      const result = await Ride.aggregate([
        {
          $match: {
            status: 'COMPLETED',
            updatedAt: { $gte: start, $lt: end }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$fare" }
          }
        }
      ]);
      return result[0]?.total || 0;
    };

    const revenueToday = await getRevenue(today, tomorrow);
    const revenueYesterday = await getRevenue(yesterday, today);
    const revenueChange = calculateChange(revenueToday, revenueYesterday);

    res.status(StatusCodes.OK).json({
      stats: [
        {
          name: 'Total Rides (Today)',
          stat: ridesToday.toString(),
          change: `${ridesChange.toFixed(1)}%`,
          changeType: ridesChange >= 0 ? 'increase' : 'decrease'
        },
        {
          name: 'Online Drivers',
          stat: onlineDrivers.toString(),
          change: `${approvedDrivers} total`, // Showing total fleet size as context
          changeType: 'increase'
        },
        {
          name: 'New Sign-ups',
          stat: signupsToday.toString(),
          change: `${signupsChange.toFixed(1)}%`,
          changeType: signupsChange >= 0 ? 'increase' : 'decrease'
        },
        {
          name: 'Revenue (Today)',
          stat: formatCurrency(revenueToday),
          change: `${revenueChange.toFixed(1)}%`,
          changeType: revenueChange >= 0 ? 'increase' : 'decrease'
        }
      ]
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch stats' });
  }
};

export const getActiveDrivers = async (req, res) => {
    try {
        const drivers = await User.find({
            role: 'rider',
            isOnline: true,
            currentLocation: { $exists: true }
        }).select('name phone currentLocation driverDetails.vehicle');

        // Transform to cleaner format for frontend
        const formattedDrivers = drivers.map(d => ({
            id: d._id,
            name: d.name,
            phone: d.phone,
            location: {
                lat: d.currentLocation.coordinates[1],
                lng: d.currentLocation.coordinates[0]
            },
            vehicle: d.driverDetails?.vehicle?.make + ' ' + d.driverDetails?.vehicle?.model
        }));

        res.status(StatusCodes.OK).json({ drivers: formattedDrivers });
    } catch (error) {
        console.error('Fetch active drivers error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch active drivers' });
    }
};
