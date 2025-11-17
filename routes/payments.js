const express = require('express');
const {
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
} = require('../controllers/payments');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         bookingId:
 *           type: string
 *         customerId:
 *           type: string
 *         providerId:
 *           type: string
 *         amount:
 *           type: number
 *           format: float
 *         paymentMethod:
 *           type: string
 *           enum: [credit_card, promptpay, bank_transfer]
 *         status:
 *           type: string
 *           enum: [pending, completed, failed, refunded, partially_refunded]
 *         transactionId:
 *           type: string
 *         refundAmount:
 *           type: number
 *           format: float
 *         refundReason:
 *           type: string
 *         completedAt:
 *           type: string
 *           format: date-time
 *         refundedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - bookingId
 *         - customerId
 *         - providerId
 *         - amount
 *         - paymentMethod
 *         - status
 *     PaymentCreateInput:
 *       type: object
 *       properties:
 *         bookingId:
 *           type: string
 *         customerId:
 *           type: string
 *           description: Optional - defaults to booking's customerId
 *         providerId:
 *           type: string
 *           description: Optional - defaults to booking's providerId
 *         amount:
 *           type: number
 *         paymentMethod:
 *           type: string
 *           enum: [credit_card, promptpay, bank_transfer]
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *         transactionId:
 *           type: string
 *       required:
 *         - bookingId
 *         - amount
 *         - paymentMethod
 * tags:
 *   - name: Payments
 *     description: Payment records for bookings
 */

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: List payments for authenticated user
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded, partially_refunded]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *   post:
 *     summary: Create a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentCreateInput'
 *     responses:
 *       201:
 *         description: Payment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 */
router
  .route('/')
  .get(protect, listPayments)
  .post(protect, createPayment);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get payment by id
 *     tags: [Payments]
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
 *         description: Payment payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
 *   put:
 *     summary: Update payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               transactionId:
 *                 type: string
 *               refundAmount:
 *                 type: number
 *               refundReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated payment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *   delete:
 *     summary: Delete payment (admin only)
 *     tags: [Payments]
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
 *         description: Payment deleted confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router
  .route('/:id')
  .get(protect, getPayment)
  .put(protect, updatePayment)
  .delete(protect, deletePayment);

module.exports = router;

