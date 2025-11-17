// routes/bookings.js
const express = require("express");
const {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
} = require("../controllers/bookings");
const { protect } = require("../middleware/auth");

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
 *     Booking:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         customerId:
 *           type: string
 *         providerId:
 *           type: string
 *         serviceId:
 *           type: string
 *         serviceName:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *           example: "2025-03-10"
 *         startTime:
 *           type: string
 *           example: "13:00"
 *         endTime:
 *           type: string
 *           example: "16:00"
 *         totalHours:
 *           type: number
 *           format: float
 *         totalAmount:
 *           type: number
 *           format: float
 *         depositAmount:
 *           type: number
 *           format: float
 *         status:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, refunded, partially_refunded]
 *         specialRequests:
 *           type: string
 *         cancelledBy:
 *           type: string
 *           enum: [customer, provider]
 *         refundAmount:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - customerId
 *         - providerId
 *         - serviceId
 *         - serviceName
 *         - date
 *         - startTime
 *         - endTime
 *         - totalHours
 *         - totalAmount
 *         - depositAmount
 *         - status
 *         - paymentStatus
 *     BookingCreateInput:
 *       type: object
 *       properties:
 *         serviceId:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         startTime:
 *           type: string
 *         endTime:
 *           type: string
 *         totalHours:
 *           type: number
 *         totalAmount:
 *           type: number
 *         depositAmount:
 *           type: number
 *         specialRequests:
 *           type: string
 *         customerId:
 *           type: string
 *           description: Only admins can override customerId
 *         status:
 *           $ref: '#/components/schemas/Booking/properties/status'
 *         paymentStatus:
 *           $ref: '#/components/schemas/Booking/properties/paymentStatus'
 *       required:
 *         - serviceId
 *         - date
 *         - startTime
 *         - endTime
 *         - totalHours
 *         - totalAmount
 *         - depositAmount
 * tags:
 *   - name: Bookings
 *     description: Manage customer bookings
 */

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: List bookings for the authenticated user
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: serviceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, refunded, partially_refunded]
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *         description: Include provider/customer details and review status (reduces API calls)
 *     responses:
 *       200:
 *         description: Paginated list of bookings
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
 *                     $ref: '#/components/schemas/Booking'
 *   post:
 *     summary: Create a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookingCreateInput'
 *     responses:
 *       201:
 *         description: Booking created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 */
router.route("/").get(protect, listBookings).post(protect, createBooking);

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get booking by id
 *     tags: [Bookings]
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
 *         description: Booking payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       404:
 *         description: Booking not found
 *   put:
 *     summary: Update booking details
 *     tags: [Bookings]
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
 *               date:
 *                 type: string
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *               totalHours:
 *                 type: number
 *               totalAmount:
 *                 type: number
 *               depositAmount:
 *                 type: number
 *               status:
 *                 type: string
 *               paymentStatus:
 *                 type: string
 *               specialRequests:
 *                 type: string
 *               refundAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Updated booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *   delete:
 *     summary: Delete booking (admin only)
 *     tags: [Bookings]
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
 *         description: Booking deleted confirmation
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
  .route("/:id")
  .get(protect, getBooking)
  .put(protect, updateBooking)
  .delete(protect, deleteBooking);

module.exports = router;
