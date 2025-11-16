// routes/users.js
const express = require('express');
const router = express.Router();

const usersCtrl = require('../controllers/users');
const { protect, authorize } = require('../middleware/auth');

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     UserPublic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "4f8c9a3b-3260-4e60-b632-b2ad4328a99c"
 *         email:
 *           type: string
 *           example: "user@example.com"
 *         username:
 *           type: string
 *           example: "user1"
 *         firstName:
 *           type: string
 *           example: "John"
 *         lastName:
 *           type: string
 *           example: "Doe"
 *         birthdate:
 *           type: string
 *           example: "2000-01-01"
 *         gender:
 *           type: string
 *           example: "ชาย"
 *         interestedGender:
 *           type: string
 *           example: "หญิง"
 *         type:
 *           type: string
 *           example: "customer"
 *         img:
 *           type: string
 *           example: "/uploads/profiles/4f8c9a3b-avatar.jpg"
 *         joined:
 *           type: string
 *           example: "2025"
 *         verified:
 *           type: boolean
 *           example: false
 *
 *     UserCreateRequest:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - password
 *         - firstName
 *         - lastName
 *         - birthdate
 *         - gender
 *         - interestedGender
 *       properties:
 *         email:
 *           type: string
 *           example: "user@example.com"
 *         username:
 *           type: string
 *           example: "user1"
 *         password:
 *           type: string
 *           example: "Password123!"
 *         firstName:
 *           type: string
 *           example: "John"
 *         lastName:
 *           type: string
 *           example: "Doe"
 *         birthdate:
 *           type: string
 *           example: "2000-01-01"
 *         gender:
 *           type: string
 *           enum: ["ชาย","หญิง"]
 *         interestedGender:
 *           type: string
 *           enum: ["ชาย","หญิง"]
 *         idCard:
 *           type: string
 *         phone:
 *           type: string
 *         type:
 *           type: string
 *           enum: ["customer","provider","admin"]
 *         img:
 *           type: string
 *           example: "/uploads/profiles/..."
 *
 *     UserUpdateRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         birthdate:
 *           type: string
 *           example: "2000-01-01"
 *         gender:
 *           type: string
 *           enum: ["ชาย","หญิง"]
 *         interestedGender:
 *           type: string
 *           enum: ["ชาย","หญิง"]
 *         idCard:
 *           type: string
 *         phone:
 *           type: string
 *         type:
 *           type: string
 *           enum: ["customer","provider","admin"]
 *         img:
 *           type: string
 *         joined:
 *           type: string
 *         verified:
 *           type: boolean
 *         generalTimeSetting:
 *           type: object
 *
 *     ProfileImageRequest:
 *       type: object
 *       required:
 *         - imgPath
 *       properties:
 *         imgPath:
 *           type: string
 *           description: "Path only (server stores path), e.g. /uploads/profiles/uuid.jpg"
 *           example: "/uploads/profiles/4f8c9a3b-avatar.jpg"
 *
 *     GeneralTimeSetting:
 *       type: object
 *       description: "Arbitrary object for user general time settings"
 *       example:
 *         timezone: "Asia/Bangkok"
 *         available:
 *           - day: "mon"
 *             from: "09:00"
 *             to: "17:00"
 *
 *     UsersListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         meta:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 123
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserPublic'
 *
 * /users:
 *   get:
 *     summary: List users (public)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           description: Search query for email/username/firstName/lastName
 *     responses:
 *       '200':
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersListResponse'
 *       '500':
 *         description: Server error
 *
 *   post:
 *     summary: Create a new user (admin only)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       '201':
 *         description: Created user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       '400':
 *         description: Validation or duplicate key
 *       '403':
 *         description: Forbidden (not admin)
 *
 * /users/{id}:
 *   get:
 *     summary: Get single user by id (public)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "4f8c9a3b-3260-4e60-b632-b2ad4328a99c"
 *     responses:
 *       '200':
 *         description: User object (sanitized)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       '404':
 *         description: Not found
 *
 *   put:
 *     summary: Update user (self or admin)
 *     tags:
 *       - Users
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
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       '200':
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: User not found
 *
 *   delete:
 *     summary: Delete user (self or admin)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: User not found
 *
 * /users/{id}/profile-image:
 *   post:
 *     summary: Save profile image path (S3 path or uploads path) for user (self or admin)
 *     tags:
 *       - Users
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
 *             $ref: '#/components/schemas/ProfileImageRequest'
 *     responses:
 *       '200':
 *         description: Updated user with img path
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       '400':
 *         description: Bad request (missing or invalid URL/path)
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: User not found
 *
 * /users/{id}/general-time-setting:
 *   put:
 *     summary: Update user's generalTimeSetting (self or admin)
 *     tags:
 *       - Users
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
 *             $ref: '#/components/schemas/GeneralTimeSetting'
 *     responses:
 *       '200':
 *         description: Updated generalTimeSetting
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: User not found
 */


// Public routes
router.get('/', usersCtrl.listUsers);       // PUBLIC
router.get('/:id', usersCtrl.getUser);      // PUBLIC

// Admin-only create
router.post('/', protect, authorize('admin'), usersCtrl.createUser);

// Self or admin update
router.put('/:id', protect, usersCtrl.updateUser);

// Self or admin delete
router.delete('/:id', protect, usersCtrl.deleteUser);

// Self or admin profile image update
router.post('/:id/profile-image', protect, usersCtrl.uploadProfileImage);

// Self or admin general time setting update
router.put('/:id/general-time-setting', protect, usersCtrl.updateGeneralTimeSetting);

module.exports = router;
