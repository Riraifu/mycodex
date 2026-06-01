const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isDoneForDate,
  isGreenColor,
  isLeftmostGreen,
} = require('../color');

test('recognizes the TME green square color', () => {
  assert.equal(isGreenColor('rgb(96, 190, 48)'), true);
  assert.equal(isGreenColor('rgba(96, 190, 48, 1)'), true);
});

test('rejects orange and transparent colors', () => {
  assert.equal(isGreenColor('rgb(237, 168, 54)'), false);
  assert.equal(isGreenColor('rgba(0, 0, 0, 0)'), false);
});

test('checks only the leftmost square', () => {
  assert.equal(isLeftmostGreen(['rgb(96, 190, 48)', 'rgb(237, 168, 54)']), true);
  assert.equal(isLeftmostGreen(['rgb(237, 168, 54)', 'rgb(96, 190, 48)']), false);
});

test('detects whether today has already completed', () => {
  assert.equal(isDoneForDate({ doneDate: '2026-05-29' }, '2026-05-29'), true);
  assert.equal(isDoneForDate({ doneDate: '2026-05-28' }, '2026-05-29'), false);
  assert.equal(isDoneForDate({}, '2026-05-29'), false);
});
