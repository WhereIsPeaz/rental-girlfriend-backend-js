// routes/services.js
const express = require('express');
const {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
} = require('../controllers/services');
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
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Service UUID
 *           example: "c0f73eca-26d8-4b35-9af6-ca7f26c7b001"
 *         providerId:
 *           type: string
 *           description: UUID of provider user
 *           example: "af2f33d6-72a5-4a29-9ff8-8a1aa8e3f11f"
 *         name:
 *           type: string
 *           example: "Premium weekend companion"
 *         description:
 *           type: string
 *           example: "Full-day rental service with bespoke itinerary planning."
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           example: ["dining", "outdoor"]
 *         priceHour:
 *           type: number
 *           format: float
 *           example: 150
 *         priceDay:
 *           type: number
 *           format: float
 *           example: 1200
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["services/abc.jpg", "services/abc-2.jpg"]
 *         rating:
 *           type: number
 *           format: float
 *           example: 4.3
 *         reviewCount:
 *           type: integer
 *           example: 11
 *         bookingCount:
 *           type: integer
 *           example: 47
 *         active:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - providerId
 *         - name
 *         - priceHour
 *         - priceDay
 *         - active
 *     ServiceCreateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Premium weekend companion"
 *         description:
 *           type: string
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *         priceHour:
 *           type: number
 *         priceDay:
 *           type: number
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         rating:
 *           type: number
 *         reviewCount:
 *           type: number
 *         bookingCount:
 *           type: number
 *         active:
 *           type: boolean
 *         providerId:
 *           type: string
 *           description: Only admins can override providerId
 *       required:
 *         - name
 *         - priceHour
 *         - priceDay
 * tags:
 *   - name: Services
 *     description: CRUD endpoints for provider services
 */

/**
 * @swagger
 * /services:
 *   get:
 *     summary: List services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page (max 100, default 20)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Text search on name and description
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Paginated services
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
 *                     $ref: '#/components/schemas/Service'
 *   post:
 *     summary: Create a new service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceCreateInput'
 *     responses:
 *       201:
 *         description: Service created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 */
router
  .route('/')
  .get(listServices)
  .post(protect, createService);

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     summary: Get service by id
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       404:
 *         description: Service not found
 *   put:
 *     summary: Update service
 *     tags: [Services]
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
 *             $ref: '#/components/schemas/ServiceCreateInput'
 *     responses:
 *       200:
 *         description: Updated service
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *   delete:
 *     summary: Delete service
 *     tags: [Services]
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
 *         description: Service deleted confirmation
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
  .get(getService)
  .put(protect, updateService)
  .delete(protect, deleteService);

module.exports = router;
