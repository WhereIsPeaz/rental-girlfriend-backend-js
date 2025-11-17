const Chat = require('../models/Chat');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Service = require('../models/Service');

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

const buildChatController = ({ChatModel = Chat, BookingModel = Booking, UserModel = User, ServiceModel = Service} = {}) => {
  const canViewChat = (chat, user) => {
    if (!chat || !user) return false;
    return isAdmin(user) || chat.isParticipant(currentUserId(user));
  };

  const resolveParticipantNames = async (chat) => {
    try {
      if (!UserModel || typeof UserModel.find !== 'function' || !chat) {
        return {customerName: null, providerName: null, customerImg: null, providerImg: null};
      }
      const ids = [chat.customerId, chat.providerId].filter(Boolean);
      if (!ids.length) {
        return {customerName: null, providerName: null, customerImg: null, providerImg: null};
      }
      const query = UserModel.find({_id: {$in: ids}});
      const users =
        query && typeof query.select === 'function'
          ? await query.select('_id firstName lastName username email img')
          : await query;

      const dataMap = new Map();
      (users || []).forEach((user) => {
        // Use username as primary, fallback to "ผู้ใช้ที่ถูกลบ" if not found
        const displayName = user.username || 'ผู้ใช้ที่ถูกลบ';
        dataMap.set(String(user._id), {
          name: displayName,
          img: user.img || null
        });
      });

      const customerData = dataMap.get(String(chat.customerId)) || {name: 'ผู้ใช้ที่ถูกลบ', img: null};
      const providerData = dataMap.get(String(chat.providerId)) || {name: 'ผู้ใช้ที่ถูกลบ', img: null};

      return {
        customerName: customerData.name,
        providerName: providerData.name,
        customerImg: customerData.img,
        providerImg: providerData.img,
      };
    } catch (err) {
      console.error('resolveParticipantNames error:', err);
      return {customerName: null, providerName: null, customerImg: null, providerImg: null};
    }
  };

  const resolveBookingDetails = async (chat) => {
    try {
      if (!BookingModel || !ServiceModel || !chat || !chat.bookingId) {
        return null;
      }

      const booking = await BookingModel.findById(chat.bookingId);
      if (!booking) return null;

      const service = await ServiceModel.findById(booking.serviceId);
      
      return {
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        serviceName: booking.serviceName || (service ? service.name : null),
        status: booking.status,
        totalAmount: booking.totalAmount,
      };
    } catch (err) {
      console.error('resolveBookingDetails error:', err);
      return null;
    }
  };

  const listChats = async (req, res) => {
    try {
      const userId = currentUserId(req.user);
      const userType = req.user?.type;

      // Admin can see all chats (just IDs)
      if (isAdmin(req.user)) {
      const chats = await ChatModel.find();
        return res.json({
          success: true,
          data: chats.map((chat) => chat._id),
        });
      }

      // Regular users can only see their own chats
      const query = {};
      if (userType === 'customer') {
        query.customerId = userId;
      } else if (userType === 'provider') {
        query.providerId = userId;
      } else {
        return res.status(403).json({success: false, message: 'Forbidden'});
      }

      const chats = await ChatModel.find(query);
      
      // Return full chat details with participant names and booking details for regular users
      const chatsWithDetails = await Promise.all(
        chats.map(async (chat) => {
          const [participantNames, bookingDetails] = await Promise.all([
            resolveParticipantNames(chat),
            resolveBookingDetails(chat),
          ]);
          
          return {
            id: chat._id,
            bookingId: chat.bookingId,
            customerId: chat.customerId,
            providerId: chat.providerId,
            customerName: participantNames.customerName,
            providerName: participantNames.providerName,
            customerImg: participantNames.customerImg,
            providerImg: participantNames.providerImg,
            bookingDetails: bookingDetails || undefined,
            messages: chat.messages,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
          };
        })
      );

      res.json({
        success: true,
        data: chatsWithDetails,
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

      const [participantNames, bookingDetails] = await Promise.all([
        resolveParticipantNames(chat),
        resolveBookingDetails(chat),
      ]);

      return res.json({
        success: true,
        data: {
          id: chat._id,
          bookingId: chat.bookingId,
          customerId: chat.customerId,
          providerId: chat.providerId,
          customerName: participantNames.customerName,
          providerName: participantNames.providerName,
          customerImg: participantNames.customerImg,
          providerImg: participantNames.providerImg,
          bookingDetails: bookingDetails || undefined,
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

      const userId = currentUserId(req.user);
      
      // Check if user is participant of this booking (or admin)
      if (!isAdmin(req.user)) {
        const isParticipant = 
          String(booking.customerId) === userId || 
          String(booking.providerId) === userId;
        
        if (!isParticipant) {
          return res.status(403).json({
            success: false, 
            message: 'You are not a participant of this booking'
          });
        }
      }

      const chat = await ensureChatForBookingInternal(booking, ChatModel);
      if (!chat) {
        return res
          .status(400)
          .json({success: false, message: 'Unable to create chat for booking'});
      }

      // Get participant names and booking details
      const [participantNames, bookingDetails] = await Promise.all([
        resolveParticipantNames(chat),
        resolveBookingDetails(chat),
      ]);

      return res.status(201).json({
        success: true, 
        data: {
          id: chat._id,
          bookingId: chat.bookingId,
          customerId: chat.customerId,
          providerId: chat.providerId,
          customerName: participantNames.customerName,
          providerName: participantNames.providerName,
          customerImg: participantNames.customerImg,
          providerImg: participantNames.providerImg,
          bookingDetails: bookingDetails || undefined,
          messages: chat.messages,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        }
      });
    } catch (err) {
      if (err && err.code === 11000) {
        // Chat already exists, fetch and return it
        try {
          const bookingId = req.body?.bookingId;
          const existingChat = await ChatModel.findOne({bookingId});
          if (existingChat) {
            const [participantNames, bookingDetails] = await Promise.all([
              resolveParticipantNames(existingChat),
              resolveBookingDetails(existingChat),
            ]);
            
            return res.status(200).json({
              success: true,
              data: {
                id: existingChat._id,
                bookingId: existingChat.bookingId,
                customerId: existingChat.customerId,
                providerId: existingChat.providerId,
                customerName: participantNames.customerName,
                providerName: participantNames.providerName,
                customerImg: participantNames.customerImg,
                providerImg: participantNames.providerImg,
                bookingDetails: bookingDetails || undefined,
                messages: existingChat.messages,
                createdAt: existingChat.createdAt,
                updatedAt: existingChat.updatedAt,
              }
            });
          }
        } catch (fetchErr) {
          console.error('Error fetching existing chat:', fetchErr);
        }
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
