import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const step = process.argv[2];
const sign = (u) => jwt.sign({ id: String(u._id), phone: u.phone, role: u.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '3h' });
if (step === 'setup') {
  const merchant = await db.collection('users').findOne({ role: 'merchant', phone: '+233200000999' });
  const customer = await db.collection('users').findOne({ phone: '+233222222222' });
  const rider = await db.collection('users').findOne({ role: 'rider', phone: '+233111111111' });
  const now = new Date();
  const store = await db.collection('restaurants').insertOne({
    name: 'QA Test Laundry', description: '', category: 'Laundry', vertical: 'LAUNDRY', tags: ['Wash & Iron'], cuisine: 'Laundry',
    imageEmoji: '🧺', imageUrl: null, rating: 4.5, ratingCount: 0, deliveryFee: 0, minOrderAmount: 0, estimatedPrepMinutes: 25,
    isActive: true, address: 'QA Test Plaza, Airport Residential, Accra', latitude: 5.6037, longitude: -0.1870, owner: merchant._id,
    isAcceptingOrders: true, commissionOwed: 0, allowsPickup: false, review: { status: 'approved' }, createdAt: now, updatedAt: now,
  });
  const items = [['Shirt', 5], ['Trousers', 6], ['Duvet', 30]];
  const ids = {};
  for (const [name, price] of items) {
    const r = await db.collection('menuitems').insertOne({ restaurant: store.insertedId, name, price, isAvailable: true, category: 'Wash & Iron', imageUrl: null, modifierGroups: [], createdAt: now, updatedAt: now });
    ids[name] = String(r.insertedId);
  }
  console.log(JSON.stringify({ storeId: String(store.insertedId), items: ids, merchant: sign(merchant), customer: sign(customer), rider: sign(rider), riderId: String(rider._id) }));
} else if (step === 'assign') {
  // Give the open trip for this order to the review rider, as if they accepted the offer.
  const order = await db.collection('foodorders').findOne({ _id: new mongoose.Types.ObjectId(process.argv[3]) });
  await db.collection('rides').updateOne({ _id: order.ride }, { $set: { rider: new mongoose.Types.ObjectId(process.argv[4]), status: 'START' } });
  const ride = await db.collection('rides').findOne({ _id: order.ride });
  console.log(JSON.stringify({ rideId: String(ride._id), gasLeg: ride.gasLeg, storeVertical: ride.storeVertical, fare: ride.fare, summary: ride.foodOrderSummary, cash: ride.cashCollection, otp: ride.otp }));
} else if (step === 'cleanup') {
  const store = await db.collection('restaurants').findOne({ name: 'QA Test Laundry' });
  if (store) {
    const orders = await db.collection('foodorders').find({ restaurant: store._id }).toArray();
    const orderIds = orders.map((o) => o._id);
    const rides = await db.collection('rides').find({ foodOrder: { $in: orderIds } }).toArray();
    const rideIds = rides.map((r) => r._id);
    const tx = await db.collection('transactions').deleteMany({ ride: { $in: rideIds } });
    console.log('rides', (await db.collection('rides').deleteMany({ _id: { $in: rideIds } })).deletedCount,
      'orders', (await db.collection('foodorders').deleteMany({ _id: { $in: orderIds } })).deletedCount,
      'tx', tx.deletedCount,
      'ledger', (await db.collection('storeledgerentries').deleteMany({ restaurant: store._id })).deletedCount,
      'items', (await db.collection('menuitems').deleteMany({ restaurant: store._id })).deletedCount,
      'store', (await db.collection('restaurants').deleteOne({ _id: store._id })).deletedCount);
  }
}
await mongoose.disconnect();
