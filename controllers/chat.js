const Chat = require('../models/Chat');
const Booking = require('../models/Booking');
const User = require('../models/User');

const currentUserId = (user = {}) =>
  user?.id || user?._id ? String(user.id || user._id) : '';
const isAdmin = (user) => user?.type === 'admin';

const ensureChatForBookingInternal = async (booking, ChatModel) => {
  if (!booking) return null;
  const payload = {
    bookingId: booking._id,
    customerId: booking.customerId,
    providerId: booking.providerId,
  };
  if (!payload.bookingId || !payload.customerId || !payload.providerId) {
    return null;
  }

  const existing = await ChatModel.findOne({bookingId: payload.bookingId});
  if (existing) return existing;
  return ChatModel.create(payload);
};

const buildChatController = ({ChatModel = Chat, BookingModel = Booking, UserModel = User} = {}) => {
  const canViewChat = (chat, user) => {
    if (!chat || !user) return false;
    return isAdmin(user) || chat.isParticipant(currentUserId(user));
  };

  const resolveParticipantNames = async (chat) => {
    try {
      if (!UserModel || typeof UserModel.find !== 'function' || !chat) {
        return {customerName: null, providerName: null};
      }
      const ids = [chat.customerId, chat.providerId].filter(Boolean);
      if (!ids.length) {
        return {customerName: null, providerName: null};
      }
      const query = UserModel.find({_id: {$in: ids}});
      const users =
        query && typeof query.select === 'function'
          ? await query.select('_id firstName lastName username email')
          : await query;

      const nameMap = new Map();
      (users || []).forEach((user) => {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        const fallback = user.username || user.email || user._id;
        nameMap.set(String(user._id), fullName || fallback || null);
      });

      return {
        customerName: nameMap.get(String(chat.customerId)) || null,
        providerName: nameMap.get(String(chat.providerId)) || null,
      };
    } catch (err) {
      console.error('resolveParticipantNames error:', err);
      return {customerName: null, providerName: null};
    }
  };

  const listChats = async (req, res) => {
    try {
      const chats = await ChatModel.find();
      res.json({
        success: true,
        data: chats.map((chat) => chat._id),
      });
    } catch (err) {
      console.error('listChats error:', err);
      res.status(500).json({success: false, message: 'Unable to list chats'});
    }
  };

  const getChat = async (req, res) => {
    try {
      const chat = await ChatModel.findById(req.params.id);
      if (!chat) {
        return res.status(404).json({success: false, message: 'Chat not found'});
      }

      if (!canViewChat(chat, req.user)) {
        return res.status(403).json({success: false, message: 'Forbidden'});
      }

      const {customerName, providerName} = await resolveParticipantNames(chat);

      return res.json({
        success: true,
        data: {
          id: chat._id,
          bookingId: chat.bookingId,
          customerId: chat.customerId,
          providerId: chat.providerId,
          customerName,
          providerName,
          messages: chat.messages,
        },
      });
    } catch (err) {
      console.error('getChat error:', err);
      return res.status(500).json({success: false, message: 'Unable to fetch chat'});
    }
  };

  const createChat = async (req, res) => {
    try {
      const bookingId = req.body?.bookingId;
      if (!bookingId) {
        return res
          .status(400)
          .json({success: false, message: 'bookingId is required'});
      }

      const booking = await BookingModel.findById(bookingId);
      if (!booking) {
        return res.status(404).json({success: false, message: 'Booking not found'});
      }

      const chat = await ensureChatForBookingInternal(booking, ChatModel);
      if (!chat) {
        return res
          .status(400)
          .json({success: false, message: 'Unable to create chat for booking'});
      }

      return res.status(201).json({success: true, data: chat});
    } catch (err) {
      if (err && err.code === 11000) {
        return res
          .status(400)
          .json({success: false, message: 'Chat already exists for this booking'});
      }
      console.error('createChat error:', err);
      return res.status(500).json({success: false, message: 'Unable to create chat'});
    }
  };

  const updateChat = async (req, res) => {
    try {
      const chat = await ChatModel.findById(req.params.id);
      if (!chat) {
        return res.status(404).json({success: false, message: 'Chat not found'});
      }

      const allowedFields = ['customerId', 'providerId'];
      let touched = false;
      allowedFields.forEach((field) => {
        if (req.body[field]) {
          chat[field] = req.body[field];
          touched = true;
        }
      });

      if (!touched) {
        return res
          .status(400)
          .json({success: false, message: 'No valid fields to update'});
      }

      await chat.save();

      return res.json({success: true, data: chat});
    } catch (err) {
      console.error('updateChat error:', err);
      return res.status(500).json({success: false, message: 'Unable to update chat'});
    }
  };

  const deleteChat = async (req, res) => {
    try {
      const chat = await ChatModel.findById(req.params.id);
      if (!chat) {
        return res.status(404).json({success: false, message: 'Chat not found'});
      }
      await chat.deleteOne();
      return res.json({success: true, data: {}});
    } catch (err) {
      console.error('deleteChat error:', err);
      return res.status(500).json({success: false, message: 'Unable to delete chat'});
    }
  };

  const postMessage = async (req, res) => {
    try {
      const chat = await ChatModel.findById(req.params.id);
      if (!chat) {
        return res.status(404).json({success: false, message: 'Chat not found'});
      }

      const senderType = req.user?.type;
      if (senderType !== 'customer' && senderType !== 'provider') {
        return res.status(403).json({success: false, message: 'Forbidden'});
      }

      const userId = currentUserId(req.user);
      if (!chat.isParticipant(userId)) {
        return res.status(403).json({success: false, message: 'Forbidden'});
      }

      const message = (req.body?.message || '').trim();
      if (!message) {
        return res.status(400).json({success: false, message: 'Message is required'});
      }

      chat.messages.push({
        senderId: userId,
        senderType,
        content: message,
      });
      await chat.save();

      const createdMessage = chat.messages[chat.messages.length - 1];
      return res.status(201).json({success: true, data: createdMessage});
    } catch (err) {
      console.error('postMessage error:', err);
      return res.status(500).json({success: false, message: 'Unable to send message'});
    }
  };

  return {
    listChats,
    getChat,
    createChat,
    updateChat,
    deleteChat,
    postMessage,
    ensureChatForBookingInternal: (booking) =>
      ensureChatForBookingInternal(booking, ChatModel),
  };
};

const controller = buildChatController();

const ensureChatForBooking = async (booking) =>
  ensureChatForBookingInternal(booking, Chat);

module.exports = {
  ...controller,
  buildChatController,
  ensureChatForBooking,
};
