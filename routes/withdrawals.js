const express = require('express');
const {
  listWithdrawals,
  getWithdrawal,
  createWithdrawal,
  updateWithdrawal,
  deleteWithdrawal,
} = require('../controllers/withdrawals');
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
 *     Withdrawal:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         amount:
 *           type: number
 *           format: float
 *           minimum: 100
 *         bankName:
 *           type: string
 *         accountNumber:
 *           type: string
 *         accountName:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *         requestedAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         failureReason:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - userId
 *         - amount
 *         - bankName
 *         - accountNumber
 *         - accountName
 *         - status
 *     WithdrawalCreateInput:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: Optional - admin only, defaults to current user
 *         amount:
 *           type: number
 *           minimum: 100
 *         bankName:
 *           type: string
 *         accountNumber:
 *           type: string
 *         accountName:
 *           type: string
 *       required:
 *         - amount
 *         - bankName
 *         - accountNumber
 *         - accountName
 * tags:
 *   - name: Withdrawals
 *     description: User withdrawal requests
 */

/**
 * @swagger
 * /withdrawals:
 *   get:
 *     summary: List withdrawals for authenticated user
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by userId (admin only)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
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
 *         description: Paginated list of withdrawals
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
 *                     $ref: '#/components/schemas/Withdrawal'
 *   post:
 *     summary: Create a withdrawal request
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WithdrawalCreateInput'
 *     responses:
 *       201:
 *         description: Withdrawal created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Withdrawal'
 */
router
  .route('/')
  .get(protect, listWithdrawals)
  .post(protect, createWithdrawal);

/**
 * @swagger
 * /withdrawals/{id}:
 *   get:
 *     summary: Get withdrawal by id
 *     tags: [Withdrawals]
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
 *         description: Withdrawal payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Withdrawal'
 *       404:
 *         description: Withdrawal not found
 *   put:
 *     summary: Update withdrawal (admin for status change)
 *     tags: [Withdrawals]
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
 *                 enum: [pending, completed, failed]
 *                 description: Admin only
 *               failureReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated withdrawal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Withdrawal'
 *   delete:
 *     summary: Delete withdrawal (admin only)
 *     tags: [Withdrawals]
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
 *         description: Withdrawal deleted confirmation
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
  .get(protect, getWithdrawal)
  .put(protect, updateWithdrawal)
  .delete(protect, deleteWithdrawal);

module.exports = router;

