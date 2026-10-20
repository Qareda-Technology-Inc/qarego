
import express from 'express';
import { getAllCustomers, getCustomer, updateCustomer, deleteCustomer,
  getCustomerHistory, createCustomer } from '../controllers/customer.js';

const router = express.Router();

router.post('/', createCustomer);
router.get('/', getAllCustomers);
router.get('/:id/history', getCustomerHistory);
router.get('/:id', getCustomer);
router.patch('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
