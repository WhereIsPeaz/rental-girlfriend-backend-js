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

test('listTransactions filters non-admin by user', async () => {
  const req = {user: {type: 'customer', id: 'cust-1'}};
  let filter;
  const TransactionModel = {
    find: (f) => {
      filter = f;
      return {sort: async () => [{_id: 'tx-1', customerId: 'cust-1'}]};
    },
  };
  const {listTransactions} = buildTransactionController(TransactionModel);
  const res = createRes();

  await listTransactions(req, res);

  assert.equal(filter.customerId, 'cust-1');
  assert.equal(res.body.data.length, 1);
});

test('getTransaction enforces ownership', async () => {
  const TransactionModel = {
    findById: async () => ({_id: 'tx-1', customerId: 'cust-1'}),
  };
  const {getTransaction} = buildTransactionController(TransactionModel);
  const req = {params: {id: 'tx-1'}, user: {type: 'customer', id: 'other'}};
  const res = createRes();

  await getTransaction(req, res);
  assert.equal(res.statusCode, 403);
});

test('createTransaction validates amount and sets customerId', async () => {
  const payloads = [];
  const TransactionModel = {
    create: async (payload) => {
      payloads.push(payload);
      return payload;
    },
  };
  const {createTransaction} = buildTransactionController(TransactionModel);

  const resBad = createRes();
  await createTransaction({user: {type: 'customer', id: 'cust'}, body: {amount: 0}}, resBad);
  assert.equal(resBad.statusCode, 400);

  const resGood = createRes();
  await createTransaction({user: {type: 'customer', id: 'cust'}, body: {amount: 100}}, resGood);
  assert.equal(payloads[0].customerId, 'cust');
  assert.equal(resGood.statusCode, 201);
});
