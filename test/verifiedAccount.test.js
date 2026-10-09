const test = require('node:test');
const assert = require('node:assert/strict');
const { isVerifiedAccount } = require('../utils/verifiedAccount');

test('only the designated email is treated as verified', () => {
  assert.equal(isVerifiedAccount('vishnubangaru001@gmail.com'), true);
  assert.equal(isVerifiedAccount(' VISHNUBANGARU001@GMAIL.COM '), true);
  assert.equal(isVerifiedAccount('member@example.com'), false);
  assert.equal(isVerifiedAccount(undefined), false);
});
