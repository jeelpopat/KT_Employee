import assert from 'node:assert/strict';
import {
  EMPLOYEE_POLICIES,
  EMPLOYEE_POLICY_CATEGORIES,
  HR_POLICIES,
  HR_POLICY_CATEGORIES,
  TEAM_LEAD_POLICIES,
  TEAM_LEAD_POLICY_CATEGORIES
} from '../src/data/hrPolicies.js';

assert.equal(HR_POLICY_CATEGORIES.length, 13);
assert.deepEqual(
  HR_POLICY_CATEGORIES.map(({ policies }) => policies.length),
  [12, 13, 16, 14, 17, 11, 19, 10, 10, 9, 11, 15, 8]
);
assert.equal(HR_POLICIES.length, 165);
assert.deepEqual(
  HR_POLICIES.map(({ number }) => number),
  Array.from({ length: 165 }, (_, index) => index + 1)
);
assert.ok(HR_POLICIES.every(({ name, description, categoryId }) => (
  name.trim().length > 0 &&
  description.trim().length > 0 &&
  /^[A-M]$/.test(categoryId)
)));
assert.ok(HR_POLICIES.every(({ description, details, explanation }) => (
  typeof explanation === 'string' &&
  explanation.trim().length > 40 &&
  details.includes(explanation) &&
  details.trim().length > description.length
)));
assert.equal(
  new Set(HR_POLICIES.map(({ explanation }) => explanation)).size,
  HR_POLICIES.length
);

assert.deepEqual(
  EMPLOYEE_POLICY_CATEGORIES.map(({ id }) => id),
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'M']
);
assert.deepEqual(
  EMPLOYEE_POLICIES.map(({ number }) => number),
  [
    ...Array.from({ length: 142 }, (_, index) => index + 1),
    ...Array.from({ length: 8 }, (_, index) => index + 158)
  ]
);
assert.ok(EMPLOYEE_POLICIES.every(({ categoryId }) => categoryId !== 'L'));

assert.deepEqual(
  TEAM_LEAD_POLICY_CATEGORIES.map(({ id }) => id),
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
);
assert.deepEqual(
  TEAM_LEAD_POLICIES.map(({ number }) => number),
  Array.from({ length: 157 }, (_, index) => index + 1)
);
assert.ok(TEAM_LEAD_POLICIES.every(({ categoryId }) => categoryId !== 'M'));

console.log('HR policy catalog checks passed.');
