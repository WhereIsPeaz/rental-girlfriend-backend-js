const express = require('express');
const {
  listTransactions,
  getTransaction,
  createTransaction,
  paymentTransaction,
} = require('../controllers/transactions');
const {protect} = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Customer wallet top-ups
 *
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         customerId:
 *           type: string
 *         amount:
 *           type: number
 *         currency:
 *           type: string
 *         method:
 *           type: string
 *         action:
 *           type: string
 *           enum: [credit, debit]
 *           description: credit = เพิ่มเงิน, debit = หักเงิน
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *         note:
 *           type: string
 *         balanceAfter:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

router.use(protect);

/**
 * @swagger
 * /transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: List transactions (admin sees all, others only own)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filter by customerId (admin only)
 *     responses:
 *       200:
 *         description: Array of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 balance:
 *                   type: number
 *                   nullable: true
 *                 balance:
 *                   type: number
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Transactions]
 *     summary: Create a top-up transaction
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Admin only; defaults to current user
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               method:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [credit, debit]
 *                 description: ไม่ระบุ = credit (เติมเงิน)
 *               status:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *                 balance:
 *                   type: number
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */
router.route('/').get(listTransactions).post(createTransaction);

/**
 * @swagger
 * /transactions/payment:
 *   post:
 *     tags: [Transactions]
 *     summary: Pay a provider (debit customer, credit provider)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Admin only; defaults to current user
 *               customerId:
 *                 type: number
 *                 description: Admin only; defaults to current customer
 *               providerId:
 *                 type: string
 *               amount:
 *                 type: number
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *                 customerBalance:
 *                   type: number
 *                 providerBalance:
 *                   type: number
 *       400:
 *         description: Invalid payload or insufficient funds
 *       401:
 *         description: Unauthorized
 */
router.post('/payment', paymentTransaction);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *                 balance:
 *                   type: number
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Transaction not found
 */
router.route('/:id').get(getTransaction);

module.exports = router;
