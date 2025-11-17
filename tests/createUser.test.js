// tests/createUser.test.js
/**
 * Tests for controllers/users.createUser
 * Adds explicit per-test PASS/FAIL logging via runTest helper.
 */

jest.mock('../models/User', () => ({
  create: jest.fn(),
}));
const User = require('../models/User');

// require controller after mocking
const usersController = require('../controllers/users');
const { createUser } = usersController;

// helper to build a mock res with chainable status().json()
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Reproduce sanitizeUser behavior (same transformation as in your controller)
function expectedSanitize(userDoc) {
  if (!userDoc) return null;
  const u = (typeof userDoc.toJSON === 'function') ? userDoc.toJSON() : { ...userDoc };
  if (u.password) delete u.password;
  if (u.otp) delete u.otp;
  if (u.otpExpires) delete u.otpExpires;
  if (u.__v) delete u.__v;
  return u;
}

// Helper that wraps a test function and logs PASS/FAIL then rethrows on failure
async function runTest(name, fn) {
  try {
    await fn();
    // pretty, consistent pass message
    // you can change formatting here if you like (timestamps, colors, etc).
    console.log(`[TEST PASS] ${name}`);
  } catch (err) {
    // print a short fail line, then rethrow so Jest still treats the test as failed
    console.log(`[TEST FAIL] ${name}: ${err && err.message ? err.message : err}`);
    throw err;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  // suppress createUser console.error noise during tests
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // restore original console.error
  console.error.mockRestore();
});

describe('controllers/users.createUser', () => {
  test('403 when req.user missing', async () => {
    await runTest('403 when req.user missing', async () => {
      const req = { user: undefined, body: {} };
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden' });
    });
  });

  test('403 when req.user is not admin', async () => {
    await runTest('403 when req.user is not admin', async () => {
      const req = { user: { type: 'customer' }, body: {} };
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden' });
    });
  });

  test('400 when required fields missing -> "missing field"', async () => {
    await runTest('400 when required fields missing -> "missing field"', async () => {
      const req = {
        user: { type: 'admin' },
        body: {
          email: 'a@b.com',
          // username missing
          password: 'pwd'
        },
      };
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'missing field' });
    });
  });

  test('201 and sanitized data when create succeeds (doc has toJSON)', async () => {
    await runTest('201 and sanitized data when create succeeds (doc has toJSON)', async () => {
      const body = {
        email: 'ok@b.com',
        username: 'okuser',
        password: 'secret',
        firstName: 'F',
        lastName: 'L',
        birthdate: '1990-01-01',
        idCard: '1112223334445',
        phone: '0812345678',
        gender: 'male',
        interestedGender: 'female',
        type: 'customer',
        img: 'path/to.png',
      };
      const req = { user: { type: 'admin' }, body };
      const res = makeRes();

      const createdUser = {
        _id: 'u123',
        email: body.email,
        username: body.username,
        password: body.password,
        otp: '1234',
        otpExpires: Date.now(),
        __v: 0,
        toJSON() {
          return {
            _id: this._id,
            email: this.email,
            username: this.username,
            password: this.password,
            otp: this.otp,
            otpExpires: this.otpExpires,
            __v: this.__v
          };
        }
      };

      User.create.mockResolvedValue(createdUser);

      await createUser(req, res);

      expect(User.create).toHaveBeenCalledWith({
        email: body.email,
        username: body.username,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
        birthdate: body.birthdate,
        idCard: body.idCard,
        phone: body.phone,
        gender: body.gender,
        interestedGender: body.interestedGender,
        type: body.type,
        img: body.img,
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: expectedSanitize(createdUser) });
    });
  });

  test('201 and sanitized data when create succeeds (plain object)', async () => {
    await runTest('201 and sanitized data when create succeeds (plain object)', async () => {
      const body = {
        email: 'plain@b.com',
        username: 'plainuser',
        password: 'secret',
        firstName: 'F',
        lastName: 'L',
        birthdate: '1990-01-01',
        idCard: '1112223334445',
        phone: '0812345678',
        gender: 'male',
        interestedGender: 'female',
        type: 'provider',
        img: 'avatar.jpg',
      };
      const req = { user: { type: 'admin' }, body };
      const res = makeRes();

      const createdUser = {
        _id: 'u_plain',
        email: body.email,
        username: body.username,
        password: body.password,
        __v: 1
      };

      User.create.mockResolvedValue(createdUser);

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: expectedSanitize(createdUser) });
    });
  });

  test('duplicate key error (11000) with keyValue returns specific message', async () => {
    await runTest('duplicate key error (11000) with keyValue returns specific message', async () => {
      const body = {
        email: 'dup@b.com', username: 'dupuser', password: 'p',
        firstName: 'F', lastName: 'L', birthdate: '1990-01-01',
        idCard: 'id', phone: 'p', gender: 'male', interestedGender: 'female', type: 'customer', img: 'i'
      };
      const req = { user: { type: 'admin' }, body };
      const res = makeRes();

      const err = new Error('dup');
      err.code = 11000;
      err.keyValue = { email: 'dup@b.com' };

      User.create.mockRejectedValue(err);

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'email already exists' });
    });
  });

  test('duplicate key error (11000) without keyValue -> generic field message', async () => {
    await runTest('duplicate key error (11000) without keyValue -> generic field message', async () => {
      const body = {
        email: 'dup2@b.com', username: 'dupuser2', password: 'p',
        firstName: 'F', lastName: 'L', birthdate: '1990-01-01',
        idCard: 'id', phone: 'p', gender: 'male', interestedGender: 'female', type: 'provider', img: 'i'
      };
      const req = { user: { type: 'admin' }, body };
      const res = makeRes();

      const err = new Error('dup');
      err.code = 11000;

      User.create.mockRejectedValue(err);

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'field already exists' });
    });
  });

  test('ValidationError returns 400 with errors array', async () => {
    await runTest('ValidationError returns 400 with errors array', async () => {
      const body = {
        email: 'bad@b.com', username: 'bad', password: 'p',
        firstName: 'F', lastName: 'L', birthdate: '1990-01-01',
        idCard: 'id', phone: 'p', gender: 'male', interestedGender: 'female', type: 'customer', img: 'i'
      };
      const req = { user: { type: 'admin' }, body };
      const res = makeRes();

      const err = new Error('validation');
      err.name = 'ValidationError';
      err.errors = {
        email: { message: 'Email invalid' },
        username: { message: 'Username too short' }
      };

      User.create.mockRejectedValue(err);

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Email invalid', 'Username too short']
      });
    });
  });

  test('unknown server error returns 500', async () => {
    await runTest('unknown server error returns 500', async () => {
      const body = {
        email: 'err@b.com', username: 'err', password: 'p',
        firstName: 'F', lastName: 'L', birthdate: '1990-01-01',
        idCard: 'id', phone: 'p', gender: 'male', interestedGender: 'female', type: 'provider', img: 'i'
      };
      const req = { user: { type: 'admin' }, body };
      const res = makeRes();

      User.create.mockRejectedValue(new Error('boom'));

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Server error' });
    });
  });
});
