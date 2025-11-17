// controllers/services.js
const Service = require('../models/Service');

const OWNERSHIP_ROLES = ['provider', 'admin'];

const sanitizeService = (serviceDoc) => {
  if (!serviceDoc) return null;
  if (typeof serviceDoc.toJSON === 'function') {
    const data = serviceDoc.toJSON();
    delete data.updatedAt;
    return data;
  }
  const copy = { ...serviceDoc };
  delete copy.__v;
  delete copy.updatedAt;
  return copy;
};

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const numberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const boolOrUndefined = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

/**
 * Validate a single base64 or data URI image.
 * Returns { ok: true, dataUri, size, mimeType } or { ok: false, message }.
 *
 * Accepts:
 *  - data URI: data:image/png;base64,AAAA...
 *  - raw base64 string: AAAA... (assumed image/png unless mimeHint provided)
 *
 * Options:
 *  - maxBytes (default 5MB)
 *  - mimeHint (optional)
 */
function validateBase64Image(input, options = {}) {
  const MAX_BYTES = options.maxBytes || 5 * 1024 * 1024; // 5 MB default
  const mimeHint = options.mimeHint || null;

  if (!input || typeof input !== 'string') {
    return { ok: false, message: 'image must be a non-empty string' };
  }

  const trimmed = input.trim();

  // Reject if looks like URL — we only accept inline base64/data URIs here
  if (/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: 'image must be base64 or data URI, not a remote URL' };
  }

  const dataUriMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  let mimeType = null;
  let b64 = null;

  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    b64 = dataUriMatch[2].replace(/\s+/g, '');
  } else {
    // treat as raw base64
    b64 = trimmed.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
      return { ok: false, message: 'image must be valid base64 or a data URI' };
    }
    mimeType = mimeHint || 'image/png';
  }

  // Normalize common variant
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  const allowed = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
  if (!allowed.has(mimeType)) {
    return { ok: false, message: `unsupported image type: ${mimeType}. allowed: png, jpeg, gif, webp` };
  }

  // Estimate bytes from base64 length: bytes = (len * 3)/4 - padding
  const padding = (b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0));
  const approxBytes = Math.floor((b64.length * 3) / 4) - padding;
  if (approxBytes > MAX_BYTES) {
    return { ok: false, message: `image too large: ${approxBytes} bytes (max ${MAX_BYTES} bytes)` };
  }

  const dataUri = `data:${mimeType};base64,${b64}`;
  return { ok: true, dataUri, size: approxBytes, mimeType };
}

/**
 * Validate images input which can be array or comma-separated string.
 * Returns { ok: true, dataUris } or { ok: false, message }.
 *
 * Options:
 *  - maxImages (default 10)
 *  - maxBytesPerImage (default 5MB)
 *  - mimeHint (optional): used for raw base64 entries
 */
function validateImagesArray(input, options = {}) {
  const maxImages = options.maxImages || 10;
  const maxBytesPerImage = options.maxBytesPerImage || 5 * 1024 * 1024;
  const mimeHint = options.mimeHint || null;

  const arr = normalizeStringArray(input);
  if (arr.length === 0) return { ok: true, dataUris: [] }; // empty allowed

  if (arr.length > maxImages) {
    return { ok: false, message: `too many images: ${arr.length}. maximum allowed is ${maxImages}` };
  }

  const dataUris = [];
  for (let i = 0; i < arr.length; i++) {
    const entry = arr[i];
    const v = validateBase64Image(entry, { maxBytes: maxBytesPerImage, mimeHint });
    if (!v.ok) {
      return { ok: false, message: `image[${i}] invalid: ${v.message}` };
    }
    dataUris.push(v.dataUri);
  }

  return { ok: true, dataUris };
}

exports.listServices = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const q = (req.query.q || '').trim();

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }
    if (req.query.providerId) {
      filter.providerId = req.query.providerId;
    }
    if (req.query.category) {
      filter.categories = req.query.category;
    }
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true' || req.query.active === true;
    }

    const [total, services] = await Promise.all([
      Service.countDocuments(filter),
      Service.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
    ]);

    return res.json({
      success: true,
      meta: { page, limit, total },
      data: services.map((svc) => sanitizeService(svc)),
    });
  } catch (err) {
    console.error('listServices error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: 'Service not found' });
    }
    return res.json({ success: true, data: sanitizeService(service) });
  } catch (err) {
    console.error('getService error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createService = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Not authenticated' });
    }
    if (!OWNERSHIP_ROLES.includes(req.user.type)) {
      return res
        .status(403)
        .json({ success: false, message: 'Only providers or admins can create services' });
    }

    const providerId =
      req.user.type === 'admin' && req.body.providerId
        ? req.body.providerId
        : req.user.id || req.user._id;

    // Validate images if provided
    let validatedImages = [];
    if (typeof req.body.images !== 'undefined') {
      const v = validateImagesArray(req.body.images, { maxImages: 10, maxBytesPerImage: 5 * 1024 * 1024 });
      if (!v.ok) {
        return res.status(400).json({ success: false, message: `Invalid images: ${v.message}` });
      }
      validatedImages = v.dataUris;
    }

    const servicePayload = {
      providerId,
      name: req.body.name,
      description: req.body.description,
      categories: normalizeStringArray(req.body.categories),
      priceHour: numberOrUndefined(req.body.priceHour),
      priceDay: numberOrUndefined(req.body.priceDay),
      images: validatedImages.length ? validatedImages : normalizeStringArray(req.body.images),
      rating: numberOrUndefined(req.body.rating),
      reviewCount: numberOrUndefined(req.body.reviewCount),
      bookingCount: numberOrUndefined(req.body.bookingCount),
      active:
        boolOrUndefined(req.body.active) !== undefined
          ? boolOrUndefined(req.body.active)
          : undefined,
    };

    const service = await Service.create(servicePayload);

    return res
      .status(201)
      .json({ success: true, data: sanitizeService(service) });
  } catch (err) {
    console.error('createService error:', err);
    if (err && err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: 'Validation failed', errors: messages });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateService = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Not authenticated' });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: 'Service not found' });
    }

    if (req.user.type !== 'admin' && service.providerId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Forbidden' });
    }

    const updatableFields = [
      'name',
      'description',
      'priceHour',
      'priceDay',
      'rating',
      'reviewCount',
      'bookingCount',
      'active',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'priceHour' || field === 'priceDay' || field === 'rating' || field === 'reviewCount' || field === 'bookingCount') {
          const numericValue = numberOrUndefined(req.body[field]);
          if (numericValue !== undefined) {
            service[field] = numericValue;
          }
          return;
        }
        if (field === 'active') {
          const boolValue = boolOrUndefined(req.body[field]);
          if (boolValue !== undefined) {
            service[field] = boolValue;
          }
          return;
        }
        service[field] = req.body[field];
      }
    });

    if (req.body.categories !== undefined) {
      service.categories = normalizeStringArray(req.body.categories);
    }

    // If images provided, validate and store array of data URIs
    if (req.body.images !== undefined) {
      const v = validateImagesArray(req.body.images, { maxImages: 10, maxBytesPerImage: 5 * 1024 * 1024 });
      if (!v.ok) {
        return res.status(400).json({ success: false, message: `Invalid images: ${v.message}` });
      }
      service.images = v.dataUris;
    }

    await service.save();

    return res.json({ success: true, data: sanitizeService(service) });
  } catch (err) {
    console.error('updateService error:', err);
    if (err && err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: 'Validation failed', errors: messages });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteService = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Not authenticated' });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: 'Service not found' });
    }

    if (req.user.type !== 'admin' && service.providerId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Forbidden' });
    }

    await service.deleteOne();
    return res.json({ success: true, message: 'Service deleted' });
  } catch (err) {
    console.error('deleteService error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
