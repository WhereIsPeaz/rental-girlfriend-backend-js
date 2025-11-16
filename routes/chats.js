const express = require('express');
const {
  listChats,
  getChat,
  createChat,
  updateChat,
  deleteChat,
  postMessage,
} = require('../controllers/chat');
const {protect, authorize} = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: Booking chat management
 *
 * components:
 *   schemas:
 *     ChatMessage:
 *       type: object
 *       properties:
 *         senderId:
 *           type: string
 *         senderType:
 *           type: string
 *           enum: [customer, provider]
 *         content:
 *           type: string
 *         sentAt:
 *           type: string
 *           format: date-time
 *     Chat:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         bookingId:
 *           type: string
 *         customerId:
 *           type: string
 *         providerId:
 *           type: string
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 */

router.use(protect);

/**
 * @swagger
 * /chats:
 *   get:
 *     tags: [Chats]
 *     summary: List chat IDs (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of chat IDs
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
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   post:
 *     tags: [Chats]
 *     summary: Create chat for an existing booking (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Booking not found
 */
router
  .route('/')
  .get(authorize('admin'), listChats)
  .post(authorize('admin'), createChat);

/**
 * @swagger
 * /chats/{id}:
 *   get:
 *     tags: [Chats]
 *     summary: Get chat detail and messages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Chat'
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Chat not found
 *   put:
 *     tags: [Chats]
 *     summary: Update chat participants (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
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
 *               customerId:
 *                 type: string
 *               providerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat updated
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Chat not found
 *   delete:
 *     tags: [Chats]
 *     summary: Delete chat (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat deleted
 *       404:
 *         description: Chat not found
 */
router
  .route('/:id')
  .get(getChat)
  .put(authorize('admin'), updateChat)
  .delete(authorize('admin'), deleteChat);

/**
 * @swagger
 * /chats/{id}/messages:
 *   post:
 *     tags: [Chats]
 *     summary: Send message to a chat room
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
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
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message created
 *       400:
 *         description: Invalid message
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Chat not found
 */
router.route('/:id/messages').post(postMessage);

module.exports = router;
