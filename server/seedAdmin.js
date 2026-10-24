// Create the first super admin, once, on a new database:
//   SEED_ADMIN_PASSWORD='a long password' node seedAdmin.js
// Optional: SEED_ADMIN_USERNAME (default qaretech). The password is never stored in this file.
// If the account already exists, nothing changes unless you also pass --reset-password.
// Add every other admin or staff member from the admin portal (Team).
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const username = (process.env.SEED_ADMIN_USERNAME || 'qaretech').trim();
const password = process.env.SEED_ADMIN_PASSWORD || '';
const resetPassword = process.argv.includes('--reset-password');

const seedAdmin = async () => {
  if (password.length < 12) {
    console.error('Set SEED_ADMIN_PASSWORD to a password of at least 12 characters.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existing = await User.findOne({ username });
    if (existing) {
      if (!resetPassword) {
        console.log(`Admin "${username}" already exists. Nothing changed (use --reset-password to set a new password).`);
      } else {
        existing.password = password;
        existing.mustChangePassword = false;
        if (existing.role === 'admin' && !existing.adminRole) existing.adminRole = 'super';
        await existing.save();
        console.log(`Password for "${username}" reset.`);
      }
    } else {
      await User.create({ username, password, role: 'admin', adminRole: 'super', name: 'Super Admin' });
      console.log(`Super admin "${username}" created.`);
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();
