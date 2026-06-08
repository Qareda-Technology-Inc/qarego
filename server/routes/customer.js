
import express from 'express';
import { getAllCustomers, getCustomer, updateCustomer, deleteCustomer, createCustomer } from '../controllers/customer.js';

const router = express.Router();

router.post('/', createCustomer);
router.get('/', getAllCustomers);
router.get('/:id', getCustomer);
router.patch('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
