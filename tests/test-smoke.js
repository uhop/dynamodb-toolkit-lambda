import test from 'tape-six';

import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';

// Minimal adapter stand-in: enough for the factory shape checks plus one
// driven GET / (which calls adapter.getList).
const makeMockAdapter = () => ({
  keyFields: [{name: 'name', type: 'string'}],
  async getList(opts) {
    return {data: [], offset: opts.offset, limit: opts.limit, total: 0};
  }
});

// Minimal API Gateway v2 event — just what the adapter's dispatcher reads.
const makeV2Event = (method, path) => ({
  version: '2.0',
  rawPath: path,
  rawQueryString: '',
  headers: {},
  isBase64Encoded: false,
  requestContext: {http: {method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test'}}
});

test('smoke: package loads + factory returns a Lambda handler', t => {
  const adapter = makeMockAdapter();
  const handler = createLambdaAdapter(adapter);
  t.equal(typeof handler, 'function', 'handler is a function');
  t.equal(handler.length, 2, 'handler takes (event, context)');
});

test('smoke: options object is optional', t => {
  const adapter = makeMockAdapter();
  t.doesNotThrow(() => createLambdaAdapter(adapter), 'accepts no options');
});

test('smoke: handler returns a Lambda result envelope', async t => {
  const adapter = makeMockAdapter();
  const handler = createLambdaAdapter(adapter);
  const res = await handler(makeV2Event('GET', '/'), {});
  t.equal(typeof res, 'object', 'returns an object');
  t.equal(res.statusCode, 200, 'root GET responds 200 from mock getList');
  t.equal(typeof res.body, 'string', 'body is a string');
});
