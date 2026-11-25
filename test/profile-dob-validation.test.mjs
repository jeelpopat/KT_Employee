import assert from 'node:assert/strict';
import { getDateOfBirthValidationError } from '../src/utils/dateOfBirthValidation.js';

const today = new Date(2026, 10, 25);

assert.equal(
  getDateOfBirthValidationError('222222-09-23', today),
  'Enter a valid date of birth with a 4-digit year.',
  'Years with more than four digits must be rejected'
);
assert.equal(
  getDateOfBirthValidationError('2026-02-30', today),
  'Enter a valid date of birth with a 4-digit year.',
  'Nonexistent calendar dates must be rejected'
);
assert.equal(
  getDateOfBirthValidationError('2026-11-26', today),
  'Date of birth cannot be in the future.',
  'Future dates must be rejected'
);
assert.equal(getDateOfBirthValidationError('2000-02-29', today), '');
assert.equal(getDateOfBirthValidationError('', today), '');

console.log('PASS: Date of birth rejects invalid years, dates, and future dates');
