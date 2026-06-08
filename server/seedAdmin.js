
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const adminUsername = 'qaretech';
    const adminPassword = 'qaretech2026';

    const existingAdmin = await User.findOne({ username: adminUsername });

    if (existingAdmin) {
      console.log('Admin user already exists. Updating password...');
      existingAdmin.password = adminPassword;
      await existingAdmin.save();
      console.log('Admin password updated.');
    } else {
      console.log('Creating new admin user...');
      const admin = new User({
        username: adminUsername,
        password: adminPassword,
        role: 'admin',
        name: 'Super Admin',
        // Phone is sparse, so we can omit it or set it if needed, but schema allows null
      });
      await admin.save();
      console.log('Admin user created successfully.');
    }

    mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
