import test from 'tape-six';

import * as thunk from 'dynamodb-toolkit-lambda';
import * as core from 'dynamodb-toolkit/lambda';
import * as thunkLocal from 'dynamodb-toolkit-lambda/local.js';
import * as coreLocal from 'dynamodb-toolkit/lambda/local.js';
import * as thunkBody from 'dynamodb-toolkit-lambda/read-lambda-body.js';
import * as coreBody from 'dynamodb-toolkit/http/lambda/read-lambda-body.js';

test('thunk: re-exports the dynamodb-toolkit/lambda surface verbatim', t => {
  t.deepEqual(Object.keys(thunk).sort(), Object.keys(core).sort(), 'same export surface');
  for (const key of Object.keys(core)) {
    t.equal(thunk[key], core[key], `same identity: ${key}`);
  }
});

test('thunk: local.js path re-exports the core local bridges', t => {
  t.deepEqual(Object.keys(thunkLocal).sort(), Object.keys(coreLocal).sort(), 'same export surface');
  t.equal(thunkLocal.createNodeListener, coreLocal.createNodeListener, 'same identity: createNodeListener');
  t.equal(thunkLocal.createFetchBridge, coreLocal.createFetchBridge, 'same identity: createFetchBridge');
});

test('thunk: read-lambda-body.js path re-exports the core module', t => {
  t.deepEqual(Object.keys(thunkBody).sort(), Object.keys(coreBody).sort(), 'same export surface');
  t.equal(thunkBody.readJsonBody, coreBody.readJsonBody, 'same identity: readJsonBody');
});
