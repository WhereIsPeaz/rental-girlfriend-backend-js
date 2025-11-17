const test = require('node:test');
const assert = require('node:assert/strict');
const {buildChatController} = require('../controllers/chat');

const createRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const userModelStub = (users = []) => ({
  find: () => ({
    select: () => users,
  }),
});

test('listChats returns only ids', async () => {
  const ChatModel = {
    find: async () => [{_id: 'chat-1'}, {_id: 'chat-2'}],
  };
  const {listChats} = buildChatController({ChatModel, UserModel: userModelStub()});
  const res = createRes();

  await listChats({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, ['chat-1', 'chat-2']);
});

test('getChat forbids non participants', async () => {
  const ChatModel = {
    findById: async () => ({
      isParticipant: () => false,
      messages: [],
    }),
  };
  const {getChat} = buildChatController({ChatModel, UserModel: userModelStub()});
  const req = {params: {id: 'chat'}, user: {id: 'user', type: 'customer'}};
  const res = createRes();

  await getChat(req, res);

  assert.equal(res.statusCode, 403);
});

test('getChat allows admin access', async () => {
  const chat = {
    _id: 'chat',
    bookingId: 'booking',
    customerId: 'cust',
    providerId: 'prov',
    messages: [{content: 'hello'}],
    isParticipant: () => false,
  };
  const ChatModel = {
    findById: async () => chat,
  };
  const userStub = userModelStub([
    {_id: 'cust', firstName: 'Alice', lastName: 'Wong'},
    {_id: 'prov', username: 'provider01'},
  ]);
  const {getChat} = buildChatController({ChatModel, UserModel: userStub});
  const req = {params: {id: 'chat'}, user: {id: 'admin', type: 'admin'}};
  const res = createRes();

  await getChat(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.messages, chat.messages);
  assert.equal(res.body.data.customerName, 'Alice Wong');
  assert.equal(res.body.data.providerName, 'provider01');
});

test('postMessage stores trimmed content for participant', async () => {
  const messages = [];
  const chat = {
    _id: 'chat',
    messages,
    isParticipant: () => true,
    save: async () => {},
  };
  const ChatModel = {
    findById: async () => chat,
  };
  const {postMessage} = buildChatController({ChatModel, UserModel: userModelStub()});
  const req = {
    params: {id: 'chat'},
    user: {id: 'cust', type: 'customer'},
    body: {message: '  Hi there  '},
  };
  const res = createRes();

  await postMessage(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, 'Hi there');
  assert.equal(messages[0].senderId, 'cust');
});

test('postMessage forbids admin senders', async () => {
  const ChatModel = {
    findById: async () => ({
      isParticipant: () => true,
    }),
  };
  const {postMessage} = buildChatController({ChatModel, UserModel: userModelStub()});
  const req = {params: {id: 'chat'}, user: {id: 'admin', type: 'admin'}, body: {message: 'hi'}};
  const res = createRes();

  await postMessage(req, res);

  assert.equal(res.statusCode, 403);
});

test('createChat requires valid booking', async () => {
  const ChatModel = {
    findOne: async () => null,
    create: async (payload) => payload,
  };
  const BookingModel = {
    findById: async () => ({
      _id: 'booking-1',
      customerId: 'cust',
      providerId: 'prov',
    }),
  };
  const {createChat} = buildChatController({ChatModel, BookingModel, UserModel: userModelStub()});
  const req = {body: {bookingId: 'booking-1'}};
  const res = createRes();

  await createChat(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.bookingId, 'booking-1');
});

test('updateChat validates payload', async () => {
  const chat = {
    _id: 'chat',
    save: async () => {},
  };
  const ChatModel = {
    findById: async () => chat,
  };
  const {updateChat} = buildChatController({ChatModel, UserModel: userModelStub()});

  const resInvalid = createRes();
  await updateChat({params: {id: 'chat'}, body: {}}, resInvalid);
  assert.equal(resInvalid.statusCode, 400);

  const resValid = createRes();
  await updateChat({params: {id: 'chat'}, body: {customerId: 'new-cust'}}, resValid);
  assert.equal(resValid.statusCode, 200);
  assert.equal(chat.customerId, 'new-cust');
});

test('deleteChat removes chat', async () => {
  let deleted = false;
  const ChatModel = {
    findById: async () => ({
      deleteOne: async () => {
        deleted = true;
      },
    }),
  };
  const {deleteChat} = buildChatController({ChatModel, UserModel: userModelStub()});
  const res = createRes();

  await deleteChat({params: {id: 'chat'}}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

test('ensureChatForBookingInternal creates chat if missing', async () => {
  const booking = {_id: 'booking', customerId: 'cust', providerId: 'prov'};
  const ChatModel = {
    findOne: async () => null,
    create: async (payload) => payload,
  };
  const {ensureChatForBookingInternal} = buildChatController({ChatModel, UserModel: userModelStub()});

  const chat = await ensureChatForBookingInternal(booking);

  assert.equal(chat.bookingId, 'booking');
  assert.equal(chat.customerId, 'cust');
});
