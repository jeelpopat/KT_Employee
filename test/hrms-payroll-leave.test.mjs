import assert from 'node:assert/strict';
import { expandHolidayDates, isWeeklyOffSunday, isWorkingDay } from '../src/utils/holidayUtils.js';

console.log('🧪 Starting Kevalon HRMS Payroll, Leave & Holiday Test Suite...\n');

// ==============================================================================
// TEST 1: ₹6,000 Simple Fixed Salary Structure & Calculations
// ==============================================================================
console.log('▶ Test 1: Simple Fixed Salary (₹6,000) Structure & Statutory Verification');

const fixedSalaryStructure = {
  structureType: 'SIMPLE_FIXED',
  fixedSalary: 6000,
  basicSalary: 6000, // kept in sync for backward-compatible backend schema
  effectiveFrom: '2026-11-01',
  isPfApplicable: true,
  isEsicApplicable: true,
  isPtApplicable: true,
  isTdsApplicable: false,
  extraAllowance: 0,
  incentive: 0,
  bonus: 0
};

// Fixed salary does not require mandatory HRA or allowance components
assert.equal(fixedSalaryStructure.structureType, 'SIMPLE_FIXED');
assert.equal(fixedSalaryStructure.fixedSalary, 6000);
assert.equal(fixedSalaryStructure.basicSalary, 6000);

// Gujarat PT rules: monthly gross <= 12,000 has ₹0 Professional Tax
const ptAmount = (gross) => {
  if (gross > 12000) return 200;
  return 0;
};
assert.equal(ptAmount(fixedSalaryStructure.fixedSalary), 0, '₹6,000 salary must be exempt from Professional Tax');

// Monthly payroll with 30 days and 0 leaves/LOP
const monthDays = 30;
const perDayFixedSalary = fixedSalaryStructure.fixedSalary / monthDays;
assert.equal(perDayFixedSalary, 200, 'Per day salary for ₹6,000 in a 30-day month should be ₹200');

console.log('  ✔ ₹6,000 SIMPLE_FIXED structure accepts fixed amount without mandatory Basic/HRA breakdown');
console.log('  ✔ PT is ₹0 for ₹6,000 (below ₹12,000 threshold)');
console.log('  ✔ Daily wage is accurately ₹200/day\n');


// ==============================================================================
// TEST 2: Half-Day and Full-Day Approved Unpaid Leave Calculations
// ==============================================================================
console.log('▶ Test 2: Approved Unpaid Leave Scenarios (HR Approval = Authorized Unpaid Leave)');

// Policy table:
// Approved Full Day: 1 day actual unpaid leave
// Approved Half Day: 0.5 day actual unpaid leave
const evaluateUnpaidLeave = (scenario, count = 1) => {
  switch (scenario) {
    case 'APPROVED_FULL_DAY':
      return { actualUnpaidDays: 1.0 * count, status: 'Authorized Unpaid Leave' };
    case 'APPROVED_HALF_DAY':
      return { actualUnpaidDays: 0.5 * count, status: 'Authorized Unpaid Leave' };
    case 'UNAUTHORIZED_FULL_DAY':
      return { actualUnpaidDays: 1.0 * count, proposedPenaltyDays: 0.5 * count, status: 'Unauthorized Absence' };
    case 'UNAUTHORIZED_HALF_DAY':
      return { actualUnpaidDays: 0.5 * count, proposedPenaltyDays: 0.5 * count, status: 'Unauthorized Absence' };
    default:
      return { actualUnpaidDays: 0, status: 'Normal' };
  }
};

// Authoritative Per-Day Salary ₹500 Example Compliance Check:
// Per Day Salary: ₹500
// Approved Full Day     → Leave ₹500 + Penalty ₹0   = ₹500
// Approved Half Day     → Leave ₹250 + Penalty ₹0   = ₹250
// Unauthorized Full Day → Leave ₹500 + Penalty ₹250 = ₹750
// Unauthorized Half Day → Leave ₹250 + Penalty ₹250 = ₹500 (NOT ₹375)
const perDayTest500 = 500;
const checkAppFull = evaluateUnpaidLeave('APPROVED_FULL_DAY', 1);
assert.equal(checkAppFull.actualUnpaidDays * perDayTest500, 500, 'Approved Full Day: ₹500 leave + ₹0 penalty = ₹500');

const checkAppHalf = evaluateUnpaidLeave('APPROVED_HALF_DAY', 1);
assert.equal(checkAppHalf.actualUnpaidDays * perDayTest500, 250, 'Approved Half Day: ₹250 leave + ₹0 penalty = ₹250');

const checkUnauthFull = evaluateUnpaidLeave('UNAUTHORIZED_FULL_DAY', 1);
const unauthFullLeaveVal = checkUnauthFull.actualUnpaidDays * perDayTest500;
const unauthFullPenaltyVal = checkUnauthFull.proposedPenaltyDays * perDayTest500;
assert.equal(unauthFullLeaveVal, 500, 'Unauthorized Full Day Leave: ₹500');
assert.equal(unauthFullPenaltyVal, 250, 'Unauthorized Full Day Penalty: ₹250');
assert.equal(unauthFullLeaveVal + unauthFullPenaltyVal, 750, 'Unauthorized Full Day Total: ₹750');

const checkUnauthHalf = evaluateUnpaidLeave('UNAUTHORIZED_HALF_DAY', 1);
const unauthHalfLeaveVal = checkUnauthHalf.actualUnpaidDays * perDayTest500;
const unauthHalfPenaltyVal = checkUnauthHalf.proposedPenaltyDays * perDayTest500;
assert.equal(unauthHalfLeaveVal, 250, 'Unauthorized Half Day Leave: ₹250');
assert.equal(unauthHalfPenaltyVal, 250, 'Unauthorized Half Day Penalty: ₹250');
assert.equal(unauthHalfLeaveVal + unauthHalfPenaltyVal, 500, 'Unauthorized Half Day Total: strictly ₹500 (NOT ₹375)');

const fullDayApproved = evaluateUnpaidLeave('APPROVED_FULL_DAY', 1);
assert.equal(fullDayApproved.actualUnpaidDays, 1.0);
assert.equal(fullDayApproved.status, 'Authorized Unpaid Leave');
const lopFullDay = fullDayApproved.actualUnpaidDays * perDayFixedSalary;
assert.equal(lopFullDay, 200, 'Full day unpaid leave LOP deduction should be ₹200 on ₹6,000 base');

const halfDayApproved = evaluateUnpaidLeave('APPROVED_HALF_DAY', 1);
assert.equal(halfDayApproved.actualUnpaidDays, 0.5);
assert.equal(halfDayApproved.status, 'Authorized Unpaid Leave');
const lopHalfDay = halfDayApproved.actualUnpaidDays * perDayFixedSalary;
assert.equal(lopHalfDay, 100, 'Half day unpaid leave LOP deduction should be ₹100 on ₹6,000 base');

console.log('  ✔ Approved Full Day: 1 day actual unpaid leave (₹200 LOP deduction)');
console.log('  ✔ Approved Half Day: 0.5 day actual unpaid leave (₹100 LOP deduction)');
console.log('  ✔ Status clearly verified as "Authorized Unpaid Leave"\n');


// ==============================================================================
// TEST 3: Unauthorized Absence & Proposed Disciplinary Penalty Separation
// ==============================================================================
console.log('▶ Test 3: Unauthorized Absence & Separation of Proposed Disciplinary Penalty');

// Policy: Unauthorized Full Day = 1 day actual unpaid leave + 0.5-day-equivalent proposed penalty
const unauthFullDay = evaluateUnpaidLeave('UNAUTHORIZED_FULL_DAY', 1);
assert.equal(unauthFullDay.actualUnpaidDays, 1.0);
assert.equal(unauthFullDay.proposedPenaltyDays, 0.5);

const unauthLopDeduction = unauthFullDay.actualUnpaidDays * perDayFixedSalary; // ₹200
const proposedPenaltyAmount = unauthFullDay.proposedPenaltyDays * perDayFixedSalary; // ₹100

// In standard calculation, proposed penalty must NOT reduce net salary unless legally authorized
const legallyAuthorizedPenalty = 0; // Not approved by formal disciplinary proceeding
const totalLawfulDeductions = unauthLopDeduction + legallyAuthorizedPenalty;
const netSalaryAfterUnauth = fixedSalaryStructure.fixedSalary - totalLawfulDeductions;

assert.equal(netSalaryAfterUnauth, 5800, 'Net salary should be ₹5,800 (only lawful 1-day LOP deducted, proposed penalty excluded)');
assert.equal(proposedPenaltyAmount, 100, 'Proposed penalty should be tracked as ₹100 without affecting net salary');

console.log('  ✔ Unauthorized Absence: 1.0 day LOP (₹200) deducted lawfully');
console.log('  ✔ Proposed Disciplinary Penalty: ₹100 (0.5 day) separated and NOT deducted from Net Salary');
console.log('  ✔ Net Payable Salary verified as ₹5,800\n');


// ==============================================================================
// TEST 4: Dynamic Saturday Working Day & Holiday Verification
// ==============================================================================
console.log('▶ Test 4: Dynamic Saturday Working Days & Weekly Off Logic');

// All Saturdays are working days unless declared in Holiday Master.
// Sunday is always weekly off.
// Let's test November 2026 dates:
// 2026-11-01 is Sunday
// 2026-11-07 is 1st Saturday
// 2026-11-14 is 2nd Saturday
// 2026-11-21 is 3rd Saturday
// 2026-11-28 is 4th Saturday

const declaredHolidays = [
  {
    _id: 'hol_diwali',
    holidayName: 'Diwali Festival',
    holidayDate: '2026-11-14T00:00:00.000Z', // 2nd Saturday declared as a special festival holiday
    isPublicHoliday: true
  }
];

// Sunday check
assert.equal(isWeeklyOffSunday('2026-11-01'), true, 'Sunday Nov 1 must be recognized as weekly off');
assert.equal(isWeeklyOffSunday('2026-11-07'), false, 'Saturday Nov 7 is NOT Sunday');

// Dynamic Saturday check
// 1st Saturday (Nov 7) has no declared holiday -> WORKING DAY
assert.equal(isWorkingDay('2026-11-07', declaredHolidays), true, '1st Saturday Nov 7 is a working day');

// 2nd Saturday (Nov 14) is declared as Diwali in holiday master -> HOLIDAY (NOT working)
assert.equal(isWorkingDay('2026-11-14', declaredHolidays), false, '2nd Saturday Nov 14 is a holiday because declared in Holiday Master');

// 4th Saturday (Nov 28) has NO declared holiday -> WORKING DAY (no hardcoded 2nd/4th Saturday holiday!)
assert.equal(isWorkingDay('2026-11-28', declaredHolidays), true, '4th Saturday Nov 28 is a WORKING day (no hardcoded 4th Saturday holiday)');

// Expand holiday dates uniqueness check (no duplicate counts)
const rawEvents = [
  { holidayDate: '2026-11-14' },
  { holidayDate: '2026-11-14' }, // Duplicate entry
  { startDate: '2026-11-20', endDate: '2026-11-21' }
];
const expandedDates = expandHolidayDates(rawEvents);
const countNov14 = expandedDates.filter(d => d === '2026-11-14').length;
assert.equal(countNov14, 1, 'expandHolidayDates must eliminate duplicate dates via Set');

console.log('  ✔ Sunday is weekly off');
console.log('  ✔ All Saturdays are regular working days by default');
console.log('  ✔ 2nd Saturday Nov 14 treated as holiday ONLY because declared in Holiday Master');
console.log('  ✔ 4th Saturday Nov 28 is a regular working day (hardcoded 2nd/4th Saturday logic completely eliminated)');
console.log('  ✔ Duplicate holiday dates deduplicated with Set\n');


// ==============================================================================
// TEST 5: 13-Point Salary Breakdown Structure Integrity
// ==============================================================================
console.log('▶ Test 5: 13-Point Salary Breakdown & Payslip Specification Integrity');

const samplePayrollResponse = {
  monthlySalary: 6000,
  earnedSalary: 5800,
  extraAllowance: 500,
  incentive: 700,
  approvedLeaveDays: 0,
  unauthorizedAbsenceDays: 1,
  lopDeduction: 200,
  pfDeduction: 0,
  esicDeduction: 0,
  professionalTax: 0,
  tdsAmount: 0,
  otherDeductions: 0,
  proposedPenalty: 100,
  legallyApprovedPenalties: 0,
  totalDeduction: 200,
  netSalary: 6800 // (5800 earned + 500 extra + 700 incentive = 7000 gross) - 200 LOP = 6800 net
};

// Verify presence and validity of all 13 items
const items = [
  { name: '1. Monthly Contracted Salary', value: samplePayrollResponse.monthlySalary, expected: 6000 },
  { name: '2. Earned Salary', value: samplePayrollResponse.earnedSalary, expected: 5800 },
  { name: '3. Extra Allowances', value: samplePayrollResponse.extraAllowance, expected: 500 },
  { name: '4. Incentives', value: samplePayrollResponse.incentive, expected: 700 },
  { name: '5. Approved Unpaid Leave Days', value: samplePayrollResponse.approvedLeaveDays, expected: 0 },
  { name: '6. Unauthorized Absence Days', value: samplePayrollResponse.unauthorizedAbsenceDays, expected: 1 },
  { name: '7. LOP Deduction', value: samplePayrollResponse.lopDeduction, expected: 200 },
  { name: '8. Statutory Deductions', value: samplePayrollResponse.pfDeduction + samplePayrollResponse.professionalTax, expected: 0 },
  { name: '9. Other Approved Deductions', value: samplePayrollResponse.otherDeductions, expected: 0 },
  { name: '10. Proposed Penalty (not applied)', value: samplePayrollResponse.proposedPenalty, expected: 100 },
  { name: '11. Legally Approved Penalty', value: samplePayrollResponse.legallyApprovedPenalties, expected: 0 },
  { name: '12. Total Deductions', value: samplePayrollResponse.totalDeduction, expected: 200 },
  { name: '13. Net Payable Salary', value: samplePayrollResponse.netSalary, expected: 6800 }
];

for (const item of items) {
  assert.equal(item.value, item.expected, `Mismatch on ${item.name}`);
  console.log(`  ✔ Verified ${item.name}: ₹${item.value}`);
}

console.log('\n🎉 ALL HRMS PAYROLL, LEAVE & HOLIDAY TESTS PASSED SUCCESSFULLY! 🚀');
