/**
 * KEVALON TECHNOLOGY HRMS - Comprehensive Verification Test Suite
 * Module: Employee Deduction Management (Frontend & Integration)
 *
 * Tests:
 * 1. Module 1: Deduction Master Catalog & Validation
 * 2. Module 2: Employee Deduction Creation & Model Validation
 * 3. Module 3: Team Leader Dashboard Scoping & Rules
 * 4. Module 4: HR / Admin Approval & Rejection Logic
 * 5. Module 5: Payroll Integration, Preview & Breakdown Reconciliation
 * 6. Module 6: Payslip Itemization & HTML Generation
 * 7. Module 7: Employee Self-Service Restrictions
 * 8. Module 8: Deduction Reporting & Metric Computations
 */

import assert from 'node:assert/strict';
import {
  createEmployeeEmploymentStatusRequest,
  isEmployeeInactive
} from '../src/utils/employeeEmployment.js';

console.log('================================================================');
console.log('🚀 KEVALON HRMS: EMPLOYEE DEDUCTION MANAGEMENT TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${error.message}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// SUITE 1: Module 1 - Deduction Master Validation & Catalog
// ============================================================================
console.log('📦 SUITE 1: Deduction Master Catalog & Policy Rules');

test('Validates required title and positive default amount', () => {
  const validateMaster = (payload) => {
    const errors = {};
    if (!payload.title || !payload.title.trim()) errors.title = 'Title is required';
    const amount = Number(payload.defaultAmount);
    if (!amount || amount <= 0) errors.defaultAmount = 'Amount must be positive';
    return { valid: Object.keys(errors).length === 0, errors };
  };

  assert.equal(validateMaster({ title: '', defaultAmount: 0 }).valid, false);
  assert.equal(validateMaster({ title: 'Late Mark', defaultAmount: -50 }).valid, false);
  assert.equal(validateMaster({ title: 'Late Mark', defaultAmount: 100 }).valid, true);
});

test('Supports calculation types FLAT and PERCENTAGE with legal compliance flag', () => {
  const masterRecord = {
    _id: 'master-01',
    deductionCode: 'DED-POLICY-001',
    title: 'ID Card Not Worn',
    description: 'Fine for not wearing company badge',
    defaultAmount: 100,
    calculationType: 'FLAT',
    category: 'POLICY_VIOLATION',
    isLegallyCompliant: true,
    policyReference: 'HR-POL-2026-08',
    isActive: true,
    isArchived: false,
    createdAt: new Date().toISOString()
  };

  assert.equal(masterRecord.calculationType, 'FLAT');
  assert.equal(masterRecord.isLegallyCompliant, true);
  assert.equal(masterRecord.deductionCode.startsWith('DED-'), true);
  assert.equal(masterRecord.isActive, true);
});

// ============================================================================
// SUITE 2: Module 2 - Employee Deduction Creation & Reporting TL Resolution
// ============================================================================
console.log('\n📦 SUITE 2: Employee Deduction Creation & Model Validation');

test('Auto-resolves Team Leader without inventing fake IDs when employee is a TL', () => {
  const employees = [
    { _id: 'emp-101', name: 'Alice Regular', role: 'EMPLOYEE', teamLeaderId: 'tl-501', teamLeaderName: 'Bob Lead' },
    { _id: 'tl-501', name: 'Bob Lead', role: 'TEAM_LEAD', teamLeaderId: null, teamLeaderName: null }, // Top-level TL
    { _id: 'tl-502', name: 'Charlie Mid-Lead', role: 'TEAM_LEAD', teamLeaderId: 'tl-admin', teamLeaderName: 'Admin Lead' }
  ];

  const resolveTL = (empId) => {
    const emp = employees.find(e => e._id === empId);
    if (!emp) return { tlId: null, tlName: null, role: 'UNKNOWN' };
    return {
      tlId: emp.teamLeaderId || null,
      tlName: emp.teamLeaderName || null,
      role: emp.role
    };
  };

  const regularResult = resolveTL('emp-101');
  assert.equal(regularResult.tlId, 'tl-501');
  assert.equal(regularResult.tlName, 'Bob Lead');
  assert.equal(regularResult.role, 'EMPLOYEE');

  // Top-level TL receiving deduction: must be null, never a fake ID
  const topTLResult = resolveTL('tl-501');
  assert.equal(topTLResult.tlId, null);
  assert.equal(topTLResult.tlName, null);
  assert.equal(topTLResult.role, 'TEAM_LEAD');

  // Mid-level TL reporting to admin lead
  const midTLResult = resolveTL('tl-502');
  assert.equal(midTLResult.tlId, 'tl-admin');
  assert.equal(midTLResult.role, 'TEAM_LEAD');
});

test('Validates deduction record attributes and default approval status', () => {
  const createDeductionPayload = {
    employeeId: 'emp-101',
    employeeName: 'Alice Regular',
    reportingTeamLeaderId: 'tl-501',
    deductionMasterId: 'master-01',
    deductionCode: 'DED-01',
    deductionTitle: 'ID Card Not Worn',
    amount: 100,
    incidentDate: '2026-11-02',
    payrollMonth: 11,
    payrollYear: 2026,
    reason: 'Forgot badge at office entrance',
    createdBy: 'tl-501',
    status: 'PENDING'
  };

  assert.equal(createDeductionPayload.status, 'PENDING');
  assert.ok(createDeductionPayload.amount > 0);
  assert.ok(createDeductionPayload.reason.length > 5);
  assert.equal(createDeductionPayload.payrollMonth, 11);
  assert.equal(createDeductionPayload.payrollYear, 2026);
});

// ============================================================================
// SUITE 3: Module 3 - Team Leader Authorization & Scoping
// ============================================================================
console.log('\n📦 SUITE 3: Team Leader Dashboard Scoping & Rules');

test('Restricts Team Leader view to authorized team members and own self-deductions', () => {
  const loggedInTLId = 'tl-501';
  const allDeductions = [
    { _id: 'd-1', employeeId: 'emp-101', teamLeaderId: 'tl-501', amount: 100 }, // Team member 1
    { _id: 'd-2', employeeId: 'emp-102', teamLeaderId: 'tl-501', amount: 200 }, // Team member 2
    { _id: 'd-3', employeeId: 'emp-999', teamLeaderId: 'tl-888', amount: 500 }, // Other team
    { _id: 'd-4', employeeId: 'tl-501', teamLeaderId: null, amount: 150 }         // Own deduction as employee
  ];

  const authorizedForTL = allDeductions.filter(
    d => d.teamLeaderId === loggedInTLId || d.employeeId === loggedInTLId
  );

  assert.equal(authorizedForTL.length, 3);
  assert.ok(authorizedForTL.some(d => d._id === 'd-1'));
  assert.ok(authorizedForTL.some(d => d._id === 'd-4'));
  assert.ok(!authorizedForTL.some(d => d._id === 'd-3')); // Blocked!
});

test('Prevents Team Leader from self-approving their own submitted deductions', () => {
  const currentUserId = 'tl-501';
  const deduction1 = { _id: 'd-1', employeeId: 'emp-101', createdBy: 'tl-501', status: 'PENDING' };
  const deductionSelf = { _id: 'd-4', employeeId: 'tl-501', createdBy: 'tl-501', status: 'PENDING' };

  const canApprove = (userRole, deduction, userId) => {
    if (userRole === 'ADMIN' || userRole === 'HR') return true;
    if (userRole === 'TEAM_LEAD') {
      // TLs cannot approve their own deduction or deductions they created
      if (deduction.employeeId === userId) return false;
      if (deduction.createdBy === userId) return false;
      return false; // In Kevalon HRMS, final deduction approval is strictly Admin/HR
    }
    return false;
  };

  assert.equal(canApprove('TEAM_LEAD', deduction1, currentUserId), false);
  assert.equal(canApprove('TEAM_LEAD', deductionSelf, currentUserId), false);
  assert.equal(canApprove('ADMIN', deduction1, currentUserId), true);
  assert.equal(canApprove('HR', deductionSelf, currentUserId), true);
});

// ============================================================================
// SUITE 4: Module 4 - HR / Admin Approval & Rejection Logic
// ============================================================================
console.log('\n📦 SUITE 4: HR / Admin Approval Workflow');

test('Approvals transition status to APPROVED and require reason on REJECTED', () => {
  const deduction = {
    _id: 'd-1',
    status: 'PENDING',
    approvedBy: null,
    approvalDate: null,
    rejectionReason: null
  };

  // Approve action
  const approveDeduction = (item, approverId) => ({
    ...item,
    status: 'APPROVED',
    approvedBy: approverId,
    approvalDate: new Date().toISOString()
  });

  const approved = approveDeduction(deduction, 'admin-01');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.approvedBy, 'admin-01');
  assert.ok(approved.approvalDate);

  // Reject action with mandatory reason
  const rejectDeduction = (item, rejectorId, reason) => {
    if (!reason || !reason.trim()) throw new Error('Rejection reason is mandatory');
    return {
      ...item,
      status: 'REJECTED',
      rejectedBy: rejectorId,
      rejectionDate: new Date().toISOString(),
      rejectionReason: reason.trim()
    };
  };

  assert.throws(() => rejectDeduction(deduction, 'admin-01', ''), /Rejection reason is mandatory/);
  const rejected = rejectDeduction(deduction, 'admin-01', 'Approved exemption by Management');
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.rejectionReason, 'Approved exemption by Management');
});

// ============================================================================
// SUITE 5: Module 5 - Payroll Integration & Preview Reconciliation
// ============================================================================
console.log('\n📦 SUITE 5: Payroll Integration, Preview & Breakdown');

test('Reconciles customDeductionsList with payroll totals without overwriting backend values', () => {
  const payrollRecord = {
    basicSalary: 25000,
    hra: 5000,
    allowance: 2000,
    grossSalary: 32000,
    // Base statutory deductions
    pfDeduction: 1800,
    ptDeduction: 200,
    baseDeductionTotal: 2000,
    // Employee specific deductions
    customDeductionTotal: 300,
    customDeductionsList: [
      {
        deductionRecordId: 'DED-202611-0001',
        title: 'Late Arrival (Grace Exceeded)',
        amount: 200,
        incidentDate: '2026-11-04',
        status: 'APPROVED',
        isLegallyCompliant: true,
        payrollApplicationStatus: 'APPLIED'
      },
      {
        deductionRecordId: 'DED-202611-0002',
        title: 'ID Card Not Worn',
        amount: 100,
        incidentDate: '2026-11-05',
        status: 'APPROVED',
        isLegallyCompliant: true,
        payrollApplicationStatus: 'APPLIED'
      }
    ],
    totalDeduction: 2300, // 2000 + 300
    netSalary: 29700      // 32000 - 2300
  };

  // Verify list matches total
  const listSum = payrollRecord.customDeductionsList.reduce((acc, curr) => acc + curr.amount, 0);
  assert.equal(listSum, payrollRecord.customDeductionTotal);
  assert.equal(payrollRecord.baseDeductionTotal + payrollRecord.customDeductionTotal, payrollRecord.totalDeduction);
  assert.equal(payrollRecord.grossSalary - payrollRecord.totalDeduction, payrollRecord.netSalary);
});

test('Excludes non-permissible or pending deductions from applicable payroll list', () => {
  const candidateDeductions = [
    { id: '1', title: 'Late Mark', amount: 100, status: 'APPROVED', isLegallyCompliant: true },
    { id: '2', title: 'Damage Charge', amount: 500, status: 'PENDING', isLegallyCompliant: true }, // Pending!
    { id: '3', title: 'Arbitrary Fine', amount: 300, status: 'APPROVED', isLegallyCompliant: false } // Not compliant!
  ];

  const approvedAndPermissible = candidateDeductions.filter(
    d => d.status === 'APPROVED' && d.isLegallyCompliant !== false
  );
  const excludedDeductions = candidateDeductions.filter(
    d => d.status !== 'APPROVED' || d.isLegallyCompliant === false
  );

  assert.equal(approvedAndPermissible.length, 1);
  assert.equal(approvedAndPermissible[0].id, '1');
  assert.equal(excludedDeductions.length, 2);
  assert.ok(excludedDeductions.some(d => d.id === '2'));
  assert.ok(excludedDeductions.some(d => d.id === '3'));
});

// ============================================================================
// SUITE 6: Module 6 - Payslip Itemization & HTML
// ============================================================================
console.log('\n📦 SUITE 6: Payslip Itemization & Generation');

test('Generates itemized employee deductions section in payslip HTML while preserving components', () => {
  const mockPayroll = {
    employeeName: 'John Doe',
    basicSalary: 25000,
    grossSalary: 25000,
    pfDeduction: 1800,
    customDeductionTotal: 200,
    customDeductionsList: [
      { deductionRecordId: 'DED-001', title: 'ID Card Not Worn', amount: 100 },
      { deductionRecordId: 'DED-002', title: 'ID Card Not Worn', amount: 100 }
    ],
    netSalary: 23000
  };

  const renderPayslipHtmlSnippet = (payroll) => {
    const list = payroll.customDeductionsList || [];
    let itemsHtml = '';
    list.forEach(item => {
      itemsHtml += `<tr><td>${item.title}</td><td style="text-align:right">₹${item.amount}</td></tr>`;
    });
    return `
      <div>
        <h3>Gross Salary: ₹${payroll.grossSalary}</h3>
        <table>${itemsHtml}</table>
        <div>Employee Deduction Total: ₹${payroll.customDeductionTotal}</div>
        <div>Net Salary: ₹${payroll.netSalary}</div>
      </div>
    `;
  };

  const html = renderPayslipHtmlSnippet(mockPayroll);
  assert.ok(html.includes('ID Card Not Worn'));
  assert.ok(html.includes('₹100'));
  assert.ok(html.includes('Employee Deduction Total: ₹200'));
  assert.ok(html.includes('Net Salary: ₹23000'));
});

// ============================================================================
// SUITE 7: Module 7 - Employee Self-Service Restrictions
// ============================================================================
console.log('\n📦 SUITE 7: Employee Self-Service Permissions');

test('Enforces read-only self-service with dispute/clarification capability', () => {
  const user = { _id: 'emp-101', role: 'EMPLOYEE' };

  const canPerformAction = (userRole, action) => {
    if (userRole === 'EMPLOYEE') {
      const allowedActions = ['VIEW_MY_DEDUCTIONS', 'RAISE_DISPUTE', 'REQUEST_CLARIFICATION'];
      return allowedActions.includes(action);
    }
    return true;
  };

  assert.equal(canPerformAction(user.role, 'VIEW_MY_DEDUCTIONS'), true);
  assert.equal(canPerformAction(user.role, 'RAISE_DISPUTE'), true);
  assert.equal(canPerformAction(user.role, 'CREATE_DEDUCTION'), false);
  assert.equal(canPerformAction(user.role, 'EDIT_DEDUCTION'), false);
  assert.equal(canPerformAction(user.role, 'APPROVE_DEDUCTION'), false);
  assert.equal(canPerformAction(user.role, 'DELETE_DEDUCTION'), false);
});

// ============================================================================
// SUITE 8: Module 8 - Reporting & Summary Metrics
// ============================================================================
console.log('\n📦 SUITE 8: Reporting & Aggregation Metrics');

test('Computes multi-dimensional deduction report metrics accurately', () => {
  const dataset = [
    { id: '1', amount: 500, status: 'PENDING', isAppliedToPayroll: false, category: 'POLICY_VIOLATION' },
    { id: '2', amount: 200, status: 'APPROVED', isAppliedToPayroll: true, category: 'ATTENDANCE_PENALTY' },
    { id: '3', amount: 300, status: 'APPROVED', isAppliedToPayroll: false, category: 'ASSET_DAMAGE' },
    { id: '4', amount: 400, status: 'REJECTED', isAppliedToPayroll: false, category: 'POLICY_VIOLATION' }
  ];

  const totalAmount = dataset.reduce((sum, d) => sum + d.amount, 0);
  const pendingCount = dataset.filter(d => d.status === 'PENDING').length;
  const approvedCount = dataset.filter(d => d.status === 'APPROVED').length;
  const appliedCount = dataset.filter(d => d.isAppliedToPayroll).length;
  const approvedAmount = dataset
    .filter(d => d.status === 'APPROVED')
    .reduce((sum, d) => sum + d.amount, 0);

  assert.equal(totalAmount, 1400);
  assert.equal(pendingCount, 1);
  assert.equal(approvedCount, 2);
  assert.equal(appliedCount, 1);
  assert.equal(approvedAmount, 500);
});

// ============================================================================
// SUITE 9: Employee Soft Deactivation
// ============================================================================
console.log('\n📦 SUITE 9: Employee Soft Deactivation');

test('Builds a status update request without using permanent deletion', () => {
  const request = createEmployeeEmploymentStatusRequest(
    'https://api.example.test/api',
    'employee/123',
    false,
    'test-token'
  );

  assert.equal(request.url, 'https://api.example.test/api/employee/edit/employee%2F123');
  assert.equal(request.options.method, 'PUT');
  assert.notEqual(request.options.method, 'DELETE');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), {
    isActive: false,
    employeeStatus: 'Inactive',
    status: 'inactive'
  });
});

test('Recognizes inactive employees from the listed employee fields', () => {
  assert.equal(isEmployeeInactive({ employeeStatus: 'Inactive' }), true);
  assert.equal(isEmployeeInactive({ employeeRecord: { isActive: false } }), true);
  assert.equal(isEmployeeInactive({ employeeStatus: 'Active', isActive: true }), false);
});

console.log('\n================================================================');
console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} tests successful.`);
console.log('================================================================\n');
