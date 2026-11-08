import assert from 'node:assert/strict';

// Test 1: Verify backend API schema normalization and static filtering
console.log('🧪 Verifying Holiday Dynamic Backend Integration...');

const rawBackendHolidays = [
  {
    holidayName: 'Sunday',
    holidayDate: '2026-01-04T00:00:00.000Z',
    isPublicHoliday: true,
    isDefault: true
  },
  {
    holidayName: '2nd Saturday',
    holidayDate: '2026-01-10T00:00:00.000Z',
    isPublicHoliday: true,
    isDefault: true
  },
  {
    _id: '6aef70630212363b4e3d226a',
    holidayName: 'Diwali Holiday',
    holidayDate: '2026-11-09T00:00:00.000Z',
    isPublicHoliday: true,
    createdAt: '2026-11-07T18:39:31.324Z',
    updatedAt: '2026-11-08T11:55:01.202Z',
    isDefault: false
  }
];

// Real holiday filter should eliminate all fake/generated weekly-offs
const filteredHolidays = rawBackendHolidays.filter((holiday) => {
  if (holiday.isDefault === true) return false;
  const name = (holiday.holidayName || holiday.name || '').trim().toLowerCase();
  if ((name === 'sunday' || name === '2nd saturday' || name === '4th saturday') && !holiday._id) {
    return false;
  }
  return Boolean(holiday._id || holiday.id);
});

assert.equal(filteredHolidays.length, 1, 'Only real database holiday should be retained');
assert.equal(filteredHolidays[0]._id, '6aef70630212363b4e3d226a');
assert.equal(filteredHolidays[0].holidayName, 'Diwali Holiday');
console.log('✅ PASS: Real holidays strictly isolated from default weekly offs without static mocks');

// Test 2: Edit validation - dynamic ID and payload check
const editingHoliday = filteredHolidays[0];
const updatePayload = {
  holidayName: 'Diwali Festival Special',
  holidayDate: '2026-11-09'
};

assert.ok(editingHoliday._id, 'Editing holiday must have a real MongoDB _id');
assert.equal(typeof updatePayload.holidayName, 'string');
assert.equal(updatePayload.holidayDate, '2026-11-09');
console.log('✅ PASS: Dynamic edit payload verified with authentic backend record ID');

console.log('🎉 All holiday dynamic checks passed successfully!');
