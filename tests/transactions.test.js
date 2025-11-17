const test = require('node:test');
const assert = require('node:assert/strict');
const {buildTransactionController} = require('../controllers/transactions');

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

test('listTransactions filters non-admin by user and returns balance', async () => {
  const req = {user: {type: 'customer', id: 'cust-1', balance: 250}};
  let filter;
  const TransactionModel = {
    find: (f) => {
      filter = f;
      return {sort: async () => [{_id: 'tx-1', customerId: 'cust-1'}]};
    },
  };
  const UserModel = {
    findById: async () => ({_id: 'cust-1', balance: 250}),
  };
  const {listTransactions} = buildTransactionController({TransactionModel, UserModel});
  const res = createRes();

  await listTransactions(req, res);

  assert.equal(filter.customerId, 'cust-1');
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.balance, 250);
});

test('getTransaction enforces ownership', async () => {
  const TransactionModel = {
    findById: async () => ({_id: 'tx-1', customerId: 'cust-1'}),
  };
  const UserModel = {
    findById: async () => ({_id: 'cust-1', balance: 100}),
  };
  const {getTransaction} = buildTransactionController({TransactionModel, UserModel});
  const req = {params: {id: 'tx-1'}, user: {type: 'customer', id: 'other'}};
  const res = createRes();

  await getTransaction(req, res);
  assert.equal(res.statusCode, 403);
});

test('createTransaction validates amount, updates balance and sets customerId', async () => {
  const payloads = [];
  const TransactionModel = {
    create: async (payload) => {
      payloads.push(payload);
      return payload;
    },
  };
  const userRecord = {
    _id: 'cust',
    balance: 50,
    save: async function () {
      this.saved = true;
    },
  };
  const UserModel = {
    findById: async () => userRecord,
  };
  const {createTransaction} = buildTransactionController({TransactionModel, UserModel});

  const resBad = createRes();
  await createTransaction({user: {type: 'customer', id: 'cust'}, body: {amount: 0}}, resBad);
  assert.equal(resBad.statusCode, 400);

  const resCredit = createRes();
  await createTransaction({user: {type: 'customer', id: 'cust'}, body: {amount: 100}}, resCredit);
  assert.equal(payloads[0].customerId, 'cust');
  assert.equal(payloads[0].action, 'credit');
  assert.equal(payloads[0].balanceAfter, 150);
  assert.equal(userRecord.balance, 150);
  assert.equal(resCredit.body.balance, 150);
  assert.equal(resCredit.statusCode, 201);
});

test('paymentTransaction subtracts from customer and adds to provider', async () => {
  const payloads = [];
  const TransactionModel = {
    create: async (payload) => {
      payloads.push(payload);
      return payload;
    },
  };
  const userRecord = {
    _id: 'cust',
    balance: 120,
    save: async function () {},
  };
  const providerRecord = {
    _id: 'prov',
    balance: 50,
    save: async function () {},
  };
  const UserModel = {
    findById: async (id) => (id === 'cust' ? userRecord : providerRecord),
  };
  const {paymentTransaction} = buildTransactionController({TransactionModel, UserModel});

  const resPayment = createRes();
  await paymentTransaction({
    user: {type: 'customer', id: 'cust'},
    body: {amount: 20, providerId: 'prov'},
  }, resPayment);
  assert.equal(payloads[0].action, 'debit');
  assert.equal(payloads[0].balanceAfter, 100);
  assert.equal(payloads[0].providerId, 'prov');
  assert.equal(userRecord.balance, 100);
  assert.equal(providerRecord.balance, 70);
  assert.equal(resPayment.body.customerBalance, 100);
  assert.equal(resPayment.body.providerBalance, 70);
  assert.equal(resPayment.statusCode, 201);

  const resInsufficient = createRes();
  await paymentTransaction({
    user: {type: 'customer', id: 'cust'},
    body: {amount: 150, providerId: 'prov'},
  }, resInsufficient);
  assert.equal(resInsufficient.statusCode, 400);
});
