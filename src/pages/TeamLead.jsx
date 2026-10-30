import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Crown } from "lucide-react";
import { isFinanceOrExcludedUser, isUnknownEmployeeOrUser } from "../utils/roleFilters";
import { showToast } from "../components/common/Toast";

const BASE_URL = "https://kt-backend-ttzj.onrender.com/api";

const isInvalidName = (name) => {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return true;
  const invalidTokens = [
    'unnamed',
    'no name',
    'unknown',
    'unknown employee',
    'unknown user',
    'n/a',
    'na',
    'null',
    'undefined',
    'none',
    '—',
    '-'
  ];
  if (invalidTokens.includes(trimmed)) return true;
  if (trimmed.includes('unnamed') || trimmed.includes('unknown') || trimmed.includes('no name')) return true;
  return false;
};

const isValidName = (name) => !isInvalidName(name);

const getEmployeeReferenceId = (item) => {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  if (!item || typeof item !== 'object') return null;

  const directId = [item._id, item.id, item.employeeCode, item.uniqueID]
    .find((value) => typeof value === 'string' || typeof value === 'number');
  if (directId !== undefined) return String(directId);

  for (const key of ['employeeId', 'employeeID', 'userId', 'userID', 'employee', 'user', 'userObj']) {
    const linkedId = getEmployeeReferenceId(item[key]);
    if (linkedId) return linkedId;
  }
  return typeof item.email === 'string' ? item.email : null;
};

const getEmployeeIdentifiers = (employee) => {
  if (!employee || typeof employee !== 'object') return [];

  const identifiers = [];
  const visited = new Set();
  const identifierKeys = [
    '_id', 'id', 'userId', 'userID', 'employeeId', 'employeeID',
    'employeeCode', 'uniqueID', 'email',
  ];
  const linkedRecordKeys = [
    'user', 'employee', 'userObj', 'profile', 'employeeId',
    'employeeID', 'userId', 'userID', 'assignedEmployee', 'member',
  ];
  const collect = (record, depth = 0) => {
    if (!record || typeof record !== 'object' || visited.has(record) || depth > 3) return;
    visited.add(record);
    identifierKeys.forEach((key) => identifiers.push(record[key]));
    linkedRecordKeys.forEach((key) => collect(record[key], depth + 1));
  };
  collect(employee);

  return identifiers
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).toLowerCase().trim())
    .filter(Boolean);
};

// Helper to match an employee across any identifier: _id, userId, userID, employeeID, employeeCode, uniqueID, email
const findEmployeeByIdOrUser = (empOrId, empList = []) => {
  if (!empOrId) return null;
  const targetIds = typeof empOrId === 'object'
    ? getEmployeeIdentifiers(empOrId)
    : [String(empOrId).toLowerCase().trim()];
  if (!targetIds.length) return null;

  return empList.find((e) => {
    if (!e) return false;
    const employeeIds = getEmployeeIdentifiers(e);
    return targetIds.some((targetId) => employeeIds.includes(targetId));
  });
};

// Generate canonical uniqueness key for an employee (email, employeeCode, or id)
const getCanonicalEmployeeKey = (empOrId, empList = []) => {
  if (!empOrId) return null;
  const getEmployeeCode = (employee) => {
    const code = [
      employee.employeeID,
      employee.employeeCode,
      employee.uniqueID,
    ].find((value) => typeof value === 'string' || typeof value === 'number');
    return code === undefined ? '' : String(code).trim().toLowerCase();
  };

  const matched = findEmployeeByIdOrUser(empOrId, empList);
  if (matched) {
    const email = (matched.email || matched.user?.email || '').toLowerCase().trim();
    if (email && email.includes('@')) return `email:${email}`;
    const empCode = getEmployeeCode(matched);
    if (empCode) return `code:${empCode}`;
    const id = matched._id || matched.id;
    if (id) return `id:${String(id).toLowerCase().trim()}`;
    const name = (matched.name || matched.fullName || '').toLowerCase().trim();
    if (name) return `name:${name}`;
  }

  if (typeof empOrId === 'object') {
    const email = (empOrId.email || empOrId.user?.email || '').toLowerCase().trim();
    if (email && email.includes('@')) return `email:${email}`;
    const empCode = getEmployeeCode(empOrId);
    if (empCode) return `code:${empCode}`;
    const id = empOrId._id || empOrId.id;
    if (id) return `id:${String(id).toLowerCase().trim()}`;
    const name = (empOrId.name || empOrId.fullName || '').toLowerCase().trim();
    if (name) return `name:${name}`;
  }

  return `raw:${String(empOrId).toLowerCase().trim()}`;
};

// Deduplicate any employee list (raw IDs or objects) to guarantee each individual person is counted and listed at most once
const getDistinctAssignedEmployees = (rawList = [], empList = []) => {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const seenKeys = new Set();
  const distinctEmployees = [];

  rawList.forEach((item) => {
    if (!item) return;
    const key = getCanonicalEmployeeKey(item, empList);
    if (!key || seenKeys.has(key)) return;

    const matchedEmp = findEmployeeByIdOrUser(item, empList);
    if (matchedEmp) {
      const name = getEmployeeName(matchedEmp);
      const email = matchedEmp.email || matchedEmp.user?.email || '';
      if (isValidName(name) || (email && email.includes('@') && !isInvalidName(email.split('@')[0]))) {
        seenKeys.add(key);
        distinctEmployees.push(matchedEmp);
      }
    } else if (typeof item === 'object') {
      const name = getEmployeeName(item);
      const email = item.email || item.user?.email || '';
      if (isValidName(name) || (email && email.includes('@') && !isInvalidName(email.split('@')[0]))) {
        seenKeys.add(key);
        distinctEmployees.push(item);
      }
    }
    // Note: If item is an unresolvable ID string or has no valid name/email,
    // do NOT push a dummy blank object! It is dropped so "Unnamed" NEVER appears!
  });

  return distinctEmployees;
};

const getEmployeeName = (employee) => {
  if (!employee) return '';
  if (typeof employee === 'string') {
    const trimmed = employee.trim();
    return isValidName(trimmed) ? trimmed : '';
  }
  if (typeof employee !== 'object') return '';

  const records = [
    employee,
    employee.employee,
    employee.user,
    employee.userObj,
    employee.profile,
    employee.employeeDetails,
    employee.employeeData,
    employee.userDetails,
    employee.personalInfo,
    employee.assignedEmployee,
    employee.member,
    employee.employeeId,
    employee.employeeID,
    employee.userId,
    employee.userID,
  ].filter((record) => record && typeof record === 'object');

  for (const record of records) {
    const firstName = record.firstName;
    const lastName = record.lastName;
    const name = (
      ((firstName || record.first_name)
        ? `${firstName || record.first_name} ${lastName || record.last_name || ''}`.trim()
        : '') ||
      record.employeeName ||
      record.employee_name ||
      record.empName ||
      record.emp_name ||
      record.name ||
      record.fullName ||
      record.full_name ||
      record.displayName ||
      record.userName ||
      record.username
    );
    if (typeof name === 'string' && isValidName(name)) return name.trim();
  }

  return '';
};

const extractPeople = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  for (const key of ['employees', 'users', 'data', 'results']) {
    const records = extractPeople(payload[key]);
    if (records.length) return records;
  }
  return [];
};

// Modal Component for Assignments
const AssignmentModal = ({
  isOpen,
  onClose,
  lead,
  employees = [],
  teamLeads = [],
  assignedEmployees = {},
  onSave,
  departmentName,
}) => {
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'available' | 'current' | 'other'

  useEffect(() => {
    if (lead && isOpen) {
      const distinct = getDistinctAssignedEmployees(lead.assignedEmployees || [], employees);
      setSelectedEmployees(distinct.map(getEmployeeReferenceId).filter(Boolean));
      setSearchQuery("");
      setFilterType("all");
    }
  }, [lead, isOpen, employees]);

  // Helper to check if a person matches the current Team Lead
  const isCurrentLead = (person) => {
    if (!person || !lead) return false;

    const leadIds = [
      lead._id,
      lead.id,
      lead.teamLeadId,
      lead.userId,
      lead.employeeId,
      lead.teamLead?._id,
      lead.teamLead?.userId,
      lead.teamLead?.employeeId,
      lead.user?._id,
    ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

    const personIds = [
      person._id,
      person.id,
      person.userId,
      person.userID,
      person.employeeId,
      person.employeeID,
    ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

    const leadEmails = [
      lead.email,
      lead.teamLead?.email,
      lead.user?.email,
    ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

    const personEmails = [
      person.email,
      person.user?.email,
    ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

    const leadNames = [
      lead.name,
      lead.fullName,
      lead.firstName ? `${lead.firstName} ${lead.lastName || ''}`.trim() : null,
      lead.teamLead?.name,
      lead.teamLead?.firstName ? `${lead.teamLead.firstName} ${lead.teamLead.lastName || ''}`.trim() : null,
      lead.user?.name,
    ].filter(Boolean).map((x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim());

    const personNames = [
      person.name,
      person.fullName,
      person.firstName ? `${person.firstName} ${person.lastName || ''}`.trim() : null,
      person.user?.name,
    ].filter(Boolean).map((x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim());

    const idMatch = personIds.some((id) => leadIds.includes(id));
    const emailMatch = personEmails.length > 0 && leadEmails.length > 0 && personEmails.some((e) => leadEmails.includes(e));
    const nameMatch = personNames.length > 0 && leadNames.length > 0 && personNames.some((n) => leadNames.includes(n));

    return idMatch || emailMatch || nameMatch;
  };

  // Helper to check which Team Lead an employee is currently assigned to
  const getAssignedLeadInfo = (person) => {
    if (!person) return null;
    const empKey = getCanonicalEmployeeKey(person, employees);
    if (!empKey) return null;

    const currentLeadAssociatedIds = [
      lead?._id,
      lead?.id,
      lead?.teamLeadId,
      lead?.userId,
      lead?.employeeId,
      lead?.rawTeamDocId,
      lead?.teamLead?._id,
      lead?.teamLead?.userId,
      lead?.teamLead?.employeeId,
    ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

    for (const tl of (teamLeads || [])) {
      const tlIds = [
        tl._id,
        tl.id,
        tl.teamLeadId,
        tl.userId,
        tl.employeeId,
        tl.rawTeamDocId,
        tl.teamLead?._id,
        tl.teamLead?.userId,
        tl.teamLead?.employeeId,
      ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

      const isThisLead = isCurrentLead(tl) || tlIds.some((id) => currentLeadAssociatedIds.includes(id));

      const assignedList = [
        ...(assignedEmployees[tl._id] || []),
        ...(tl.assignedEmployees || []),
        ...tlIds.flatMap((id) => assignedEmployees[id] || [])
      ];

      const isAssigned = assignedList.some((id) => getCanonicalEmployeeKey(id, employees) === empKey);
      if (isAssigned) {
        return {
          lead: tl,
          isCurrentLead: isThisLead,
          leadName: tl.name || tl.fullName || tl.teamLead?.name || tl.firstName || "Team Lead"
        };
      }
    }
    return null;
  };

  // Available Employees: Purely employees (NOT team lead, NOT admin, NOT finance, NOT current lead) - Deduplicated
  const availableEmployees = getDistinctAssignedEmployees(
    (employees || []).filter((emp) => {
      if (isCurrentLead(emp)) return false;
      if (isFinanceOrExcludedUser(emp)) return false;
      const role = (emp.role || emp.designation || '').toLowerCase().trim();
      const isTeamLead = role.includes('lead') || emp.isTeamLead === true;
      const isAdmin = role.includes('admin');
      return !isTeamLead && !isAdmin;
    }),
    employees
  );

  const isEmployeeChecked = (emp) => {
    const empKey = getCanonicalEmployeeKey(emp, employees);
    return selectedEmployees.some((id) => getCanonicalEmployeeKey(id, employees) === empKey);
  };

  const handleEmployeeToggle = (employeeId) => {
    const empKey = getCanonicalEmployeeKey(employeeId, employees);
    const matched = findEmployeeByIdOrUser(employeeId, employees);
    const canonicalId = matched ? String(matched._id) : String(employeeId);

    const isCurrentlyChecked = selectedEmployees.some((id) => getCanonicalEmployeeKey(id, employees) === empKey);

    if (isCurrentlyChecked) {
      // Unchecking is always allowed
      setSelectedEmployees((prev) => prev.filter((id) => getCanonicalEmployeeKey(id, employees) !== empKey));
      return;
    }

    // Checking: enforce "every employee max have 1 TL"
    const leadInfo = getAssignedLeadInfo(matched || employeeId);
    if (leadInfo && !leadInfo.isCurrentLead) {
      const empName = getDisplayName(matched || employeeId);
      const otherLeadName = leadInfo.leadName;
      const currentLeadName = lead?.name || lead?.fullName || "this Team Lead";

      const confirmTransfer = window.confirm(
        `"${empName}" is currently assigned to Team Lead "${otherLeadName}".\n\n` +
        `Rule: Every employee can have a maximum of 1 Team Lead (not more than 1 TL).\n\n` +
        `Do you want to reassign "${empName}" to "${currentLeadName}"?\n` +
        `(They will be moved to this Team Lead and removed from "${otherLeadName}")`
      );

      if (!confirmTransfer) {
        return;
      }
    }

    setSelectedEmployees((prev) => [...prev, canonicalId]);
  };

  const handleSave = async () => {
    const distinct = getDistinctAssignedEmployees(selectedEmployees, employees);
    const distinctIds = distinct.map((emp) => String(emp._id));

    if (distinctIds.length === 0) {
      showToast("Please select at least one employee.", "error");
      return;
    }

    setSaving(true);
    await onSave({
      employeeIds: distinctIds,
      leadId: lead._id
    });
    setSaving(false);
    onClose();
  };

  const getEmployeeAssignmentStatus = (emp) => {
    const isChecked = isEmployeeChecked(emp);
    if (isChecked) {
      return { status: 'current', label: 'Current Team' };
    }
    const leadInfo = getAssignedLeadInfo(emp);
    if (leadInfo && !leadInfo.isCurrentLead) {
      return { status: 'other', label: `TL: ${leadInfo.leadName}`, leadInfo };
    }
    return { status: 'available', label: 'Available' };
  };
  const getDisplayName = (person) => {
    if (!person) return "";
    const name = getEmployeeName(person);
    if (isValidName(name)) return name;
    if (person.email && person.email.includes('@')) {
      const prefix = person.email.split('@')[0];
      if (isValidName(prefix)) return prefix;
    }
    return "";
  };

  const validAvailableEmployees = useMemo(() => {
    return (availableEmployees || []).filter((emp) => {
      if (!emp) return false;
      const name = getDisplayName(emp);
      return Boolean(name && isValidName(name));
    });
  }, [availableEmployees]);

  const selectAll = () => {
    // Only select employees who are Available or already on Current Team
    const safeEmployees = validAvailableEmployees.filter((emp) => {
      const { status } = getEmployeeAssignmentStatus(emp);
      return status === 'available' || status === 'current';
    });
    setSelectedEmployees(safeEmployees.map((emp) => String(emp._id)));
  };

  const deselectAll = () => {
    setSelectedEmployees([]);
  };

  if (!isOpen) return null;

  // Filter & Search Logic
  const filteredEmployees = validAvailableEmployees.filter((emp) => {
    const name = getDisplayName(emp).toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const code = (emp.employeeID || emp.employeeCode || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();

    if (q && !name.includes(q) && !email.includes(q) && !code.includes(q)) {
      return false;
    }

    const { status } = getEmployeeAssignmentStatus(emp);
    if (filterType === 'available') {
      return status === 'available';
    }
    if (filterType === 'current') {
      return status === 'current';
    }
    if (filterType === 'other') {
      return status === 'other';
    }
    return true;
  });

  const unassignedCount = validAvailableEmployees.filter((e) => getEmployeeAssignmentStatus(e).status === 'available').length;
  const currentTeamCount = validAvailableEmployees.filter((e) => getEmployeeAssignmentStatus(e).status === 'current').length;
  const otherTLCount = validAvailableEmployees.filter((e) => getEmployeeAssignmentStatus(e).status === 'other').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      ></div>

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4.5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-xs">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Assign Team Members</h2>
                  <p className="text-blue-100 text-xs mt-0.5">
                    Team Lead: <span className="font-semibold text-white">{getUserName(lead) || lead?.name || lead?.fullName || "Team Lead"}</span>
                    {departmentName && departmentName !== "Unknown Department" && (
                      <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-md font-medium">Dept: {departmentName}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-xl p-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Policy Banner */}
          <div className="bg-indigo-50/90 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
              <span className="text-sm">🛡️</span>
              <span><strong>1 TL Limit:</strong> Each employee max have 1 Team Lead.</span>
            </div>
            <span className="text-2xs bg-indigo-200/80 text-indigo-900 font-bold px-2 py-0.5 rounded-full">
              Selected: {selectedEmployees.length}
            </span>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, or employee code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs & Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-2xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({validAvailableEmployees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('available')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    filterType === 'available' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Unassigned ({unassignedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('current')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    filterType === 'current' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  This Team ({currentTeamCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('other')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    filterType === 'other' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Other TL ({otherTLCount})
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-2xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Select all unassigned employees and current team members"
                >
                  Select Available
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-2xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Scrollable Employee List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[300px]">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm font-semibold">No employees match this filter</p>
                  <p className="text-xs text-slate-400 mt-0.5">Try clearing your search query or switching filters.</p>
                </div>
              ) : (
                filteredEmployees.map((employee) => {
                  const statusInfo = getEmployeeAssignmentStatus(employee);
                  const isChecked = statusInfo.status === 'current';
                  const isOtherLead = statusInfo.status === 'other';

                  return (
                    <label
                      key={employee._id}
                      className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-purple-50/60 border-purple-200/90 shadow-xs'
                          : isOtherLead
                            ? 'bg-slate-50/50 hover:bg-amber-50/40 border-slate-200/80 hover:border-amber-200'
                            : 'bg-white hover:bg-slate-50 border-slate-200/70 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleEmployeeToggle(employee._id)}
                        className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                      />

                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 border border-slate-200/60">
                        {(getDisplayName(employee) || 'E').charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                            {getDisplayName(employee)}
                          </p>
                          {employee.employeeID && (
                            <span className="text-2xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60 shrink-0">
                              {employee.employeeID}
                            </span>
                          )}
                        </div>
                        {employee.email && (
                          <p className="text-2xs text-slate-500 truncate">
                            {employee.email}
                          </p>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="shrink-0 flex items-center">
                        {statusInfo.status === 'current' ? (
                          <span className="text-2xs font-bold bg-purple-100 text-purple-800 border border-purple-200/80 px-2 py-0.5 rounded-full">
                            Current Team
                          </span>
                        ) : statusInfo.status === 'other' ? (
                          <span
                            className="text-2xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full"
                            title={`Assigned to ${statusInfo.leadInfo?.leadName}. Click to reassign.`}
                          >
                            {statusInfo.label}
                          </span>
                        ) : (
                          <span className="text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Available
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-500">
              {selectedEmployees.length} employee{selectedEmployees.length === 1 ? '' : 's'} assigned to {lead?.name || 'this TL'}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
                className={`px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer ${
                  saving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {saving ? "Saving..." : `Save Assignments (${selectedEmployees.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main TeamLead Component
export const TeamLead = () => {
  const [teamLeads, setTeamLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [assignedEmployees, setAssignedEmployees] = useState({});

  // Helper Functions
  const getUserRole = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.role?.toLowerCase().trim() || '';
    } catch {
      return '';
    }
  };

  const getLeadId = (lead) => {
    if (!lead) return null;
    return (
      lead.teamLead?.userId ||
      lead.teamLead?.employeeId ||
      lead.userId ||
      lead.employeeId ||
      lead.user?._id ||
      lead._id
    );
  };

  const normalizeEmployeeId = getEmployeeReferenceId;

  const getEmployeeDisplayName = (employee) => {
    if (!employee) return "";
    const name = getEmployeeName(employee);
    if (isValidName(name)) return name;
    if (employee.email && employee.email.includes('@')) {
      const prefix = employee.email.split('@')[0];
      if (isValidName(prefix)) return prefix;
    }
    return "";
  };

  // Get department name from lead data
const getDepartment = (lead, employees = []) => {
  if (!lead) return "-";

  const departmentValues = [
    lead.teamLead?.department,
    lead.department,
    lead.departmentName,
    lead.teamLead?.user?.department,
    lead.user?.department,
  ];

  for (const value of departmentValues) {
    if (value && typeof value === 'object') {
      const name = value.departmentName || value.name;
      if (name) return name;
    }
    if (typeof value === 'string' && !value.match(/^[0-9a-fA-F]{24}$/)) {
      return value;
    }
  }

  const leadIds = [
    lead.teamLead?.userId,
    lead.teamLead?.employeeId,
    lead.teamLead?._id,
    lead.userId,
    lead.employeeId,
    lead.user?._id,
    lead._id,
  ].filter(Boolean).map(String);

  const matchingEmployee = employees.find((employee) => {
    const employeeIds = [
      employee?._id,
      employee?.id,
      employee?.userId,
      employee?.userID,
      employee?.employeeId,
    ].filter(Boolean).map(String);
    return employeeIds.some((id) => leadIds.includes(id));
  });

  const employeeDepartment = matchingEmployee?.department || matchingEmployee?.departmentName;
  if (employeeDepartment && typeof employeeDepartment === 'object') {
    return employeeDepartment.departmentName || employeeDepartment.name || "-";
  }
  if (typeof employeeDepartment === 'string' && !employeeDepartment.match(/^[0-9a-fA-F]{24}$/)) {
    return employeeDepartment;
  }
  
  return "-";
};

const getDesignation = (lead) => {
  if (!lead) return "-";
  
  // Check all possible paths for designation
  // Check teamLead.designation (could be populated object or string)
  if (lead.teamLead?.designation) {
    if (typeof lead.teamLead.designation === 'object') {
      return lead.teamLead.designation.designationName || 
             lead.teamLead.designation.name || 
             lead.teamLead.designation.title || 
             "-";
    }
    if (typeof lead.teamLead.designation === 'string') {
      // If it looks like a MongoDB ID, it's not the name
      if (!lead.teamLead.designation.match(/^[0-9a-fA-F]{24}$/)) {
        return lead.teamLead.designation;
      }
    }
  }
  
  // Check teamLead.designationName
  if (lead.teamLead?.designationName) {
    return lead.teamLead.designationName;
  }
  
  // Check lead.designation (could be object or string)
  if (lead.designation) {
    if (typeof lead.designation === 'object') {
      return lead.designation.designationName || 
             lead.designation.name || 
             lead.designation.title || 
             "-";
    }
    if (typeof lead.designation === 'string') {
      if (!lead.designation.match(/^[0-9a-fA-F]{24}$/)) {
        return lead.designation;
      }
    }
  }
  
  // Check lead.designationName
  if (lead.designationName) {
    return lead.designationName;
  }
  
  // Check if designation is in teamLead.user
  if (lead.teamLead?.user?.designation) {
    if (typeof lead.teamLead.user.designation === 'object') {
      return lead.teamLead.user.designation.designationName || 
             lead.teamLead.user.designation.name || 
             "-";
    }
    if (typeof lead.teamLead.user.designation === 'string') {
      if (!lead.teamLead.user.designation.match(/^[0-9a-fA-F]{24}$/)) {
        return lead.teamLead.user.designation;
      }
    }
  }
  
  // Check if designation is in user object
  if (lead.user?.designation) {
    if (typeof lead.user.designation === 'object') {
      return lead.user.designation.designationName || 
             lead.user.designation.name || 
             "-";
    }
    if (typeof lead.user.designation === 'string') {
      if (!lead.user.designation.match(/^[0-9a-fA-F]{24}$/)) {
        return lead.user.designation;
      }
    }
  }
  
  return "-";
};

  const getUserName = (lead) => {
    if (!lead) return "";
    
    // Check teamLead first (from backend structure)
    if (lead.teamLead?.name && isValidName(lead.teamLead.name)) return lead.teamLead.name.trim();
    if (lead.teamLead?.fullName && isValidName(lead.teamLead.fullName)) return lead.teamLead.fullName.trim();
    
    // Check other possible fields
    if (lead.name && isValidName(lead.name)) return lead.name.trim();
    if (lead.fullName && isValidName(lead.fullName)) return lead.fullName.trim();
    if (lead.displayName && isValidName(lead.displayName)) return lead.displayName.trim();
    if (lead.userName && isValidName(lead.userName)) return lead.userName.trim();
    if (lead.username && isValidName(lead.username)) return lead.username.trim();
    
    if (lead.firstName || lead.lastName) {
      const full = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
      if (isValidName(full)) return full;
    }
    if (lead.user) {
      const uName = getUserName(lead.user);
      if (isValidName(uName)) return uName;
    }
    if (lead.email && lead.email.includes('@')) {
      const emailPrefix = lead.email.split('@')[0];
      if (isValidName(emailPrefix)) return emailPrefix;
    }
    return "";
  };

  const getUserEmail = (lead) => {
    if (lead.teamLead?.email && lead.teamLead.email.includes('@')) return lead.teamLead.email;
    if (lead.email && lead.email.includes('@')) return lead.email;
    if (lead.user?.email && lead.user.email.includes('@')) return lead.user.email;
    return "";
  };

  const getAssignedEmployeeIds = (lead) => {
    const candidateLists = [
      lead.employees,
      lead.assignedEmployees,
      lead.assignedMembers,
      lead.members,
      lead.teamEmployees,
      lead.employeeIds,
      lead.team?.employees,
      lead.team?.members,
      lead.user?.employees,
      lead.teamLead?.employees,
      lead.teamLead?.members,
    ];

    const mergedIds = candidateLists.flatMap((value) => {
      if (!value) return [];
      if (!Array.isArray(value)) return [];
      return value.map((item) => {
        if (item && typeof item === 'object' && getEmployeeName(item)) return item;
        return normalizeEmployeeId(item);
      }).filter(Boolean);
    });

    const seen = new Set();
    return mergedIds.filter((item) => {
      const key = normalizeEmployeeId(item) || getEmployeeName(item);
      if (!key || seen.has(String(key).toLowerCase())) return false;
      seen.add(String(key).toLowerCase());
      return true;
    });
  };

  // Helper to check if two lead records represent the same individual
  const isSameLead = (leadA, leadB) => {
    if (!leadA || !leadB) return false;

    const idsA = [
      leadA._id,
      leadA.id,
      leadA.teamLeadId,
      leadA.userId,
      leadA.employeeId,
      leadA.rawTeamDocId,
      leadA.teamLead?._id,
      leadA.teamLead?.userId,
      leadA.teamLead?.employeeId,
      leadA.user?._id,
      typeof leadA.teamLead === 'string' ? leadA.teamLead : null
    ].filter(Boolean).map(x => String(x).toLowerCase().trim());

    const idsB = [
      leadB._id,
      leadB.id,
      leadB.teamLeadId,
      leadB.userId,
      leadB.employeeId,
      leadB.rawTeamDocId,
      leadB.teamLead?._id,
      leadB.teamLead?.userId,
      leadB.teamLead?.employeeId,
      leadB.user?._id,
      typeof leadB.teamLead === 'string' ? leadB.teamLead : null
    ].filter(Boolean).map(x => String(x).toLowerCase().trim());

    if (idsA.some(id => idsB.includes(id))) return true;

    const emailA = (getUserEmail(leadA) || '').toLowerCase().trim();
    const emailB = (getUserEmail(leadB) || '').toLowerCase().trim();
    if (emailA && emailB && emailA !== 'n/a' && emailA.includes('@') && emailA === emailB) {
      return true;
    }

    const nameA = (getUserName(leadA) || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const nameB = (getUserName(leadB) || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (nameA && nameB && isValidName(nameA) && isValidName(nameB) && nameA === nameB) {
      return true;
    }

    return false;
  };

  // Fetch Functions
  const fetchTeamLeads = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      if (!isSilent) setError(null);

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        if (!isSilent) setError("Authentication required. Please login.");
        if (!isSilent) setLoading(false);
        return;
      }
  
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 1. Fetch team leads using api/user/all (with api/users/all as fallback)
      let allUsers = [];
      try {
        const userRes = await axios.get(`${BASE_URL}/user/all`, { headers });
        allUsers = userRes?.data?.users || userRes?.data?.data || (Array.isArray(userRes?.data) ? userRes.data : []);
      } catch (err1) {
        try {
          const usersRes = await axios.get(`${BASE_URL}/users/all`, { headers });
          allUsers = usersRes?.data?.users || usersRes?.data?.data || (Array.isArray(usersRes?.data) ? usersRes.data : []);
        } catch (err2) {
          try {
            const publicUsersRes = await axios.get(`${BASE_URL}/users/all`);
            allUsers = publicUsersRes?.data?.users || publicUsersRes?.data?.data || (Array.isArray(publicUsersRes?.data) ? publicUsersRes.data : []);
          } catch (err3) {
            console.warn("Could not fetch user/all or users/all:", err3);
          }
        }
      }

      const isTeamLeadUser = (u) => {
        if (!u) return false;
        if (isFinanceOrExcludedUser(u)) return false;
        const role = String(u.role || '').toLowerCase().trim();
        const desig = String(u.designation?.designationName || u.designation?.name || u.designation || '').toLowerCase().trim();
        return (
          u.isTeamLead === true ||
          u.isTeamLeader === true ||
          role === 'team lead' ||
          role === 'team_leader' ||
          role === 'team leader' ||
          role === 'tl' ||
          role.includes('team lead') ||
          role.includes('lead') ||
          desig.includes('team lead') ||
          desig.includes('team leader')
        );
      };

      const userTeamLeads = (Array.isArray(allUsers) ? allUsers : []).filter(isTeamLeadUser);

      // Format team leads from api/user/all (strictly filtering out unnamed or unknown users)
      const formattedUserTLs = userTeamLeads
        .filter((u) => {
          if (!u || isFinanceOrExcludedUser(u) || isUnknownEmployeeOrUser(u)) return false;
          const name = u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
          return Boolean(name && isValidName(name));
        })
        .map((u) => {
          const name = (u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()).trim();
          const designation = typeof u.designation === 'object'
            ? (u.designation?.designationName || u.designation?.name || u.designation?.title || '')
            : (u.designation || '');
          return {
            _id: u._id,
            teamLeadId: u._id,
            name,
            fullName: name,
            email: u.email,
            mobile: u.mobile || u.phone || u.phoneNumber,
            phone: u.phone || u.phoneNumber || u.mobile,
            department: u.department,
            designation,
            role: u.role || 'team lead',
            isActive: u.isActive !== false,
            profileImage: u.profileImage,
            teamLead: {
              _id: u._id,
              userId: u._id,
              name,
              fullName: name,
              email: u.email,
              role: u.role || 'team lead',
              department: u.department,
              designation,
              profileImage: u.profileImage
            },
            assignedEmployees: []
          };
        });

      // Optional: fetch teamLead/team to attach any existing assignments or raw team docs
      let teamLeadsData = [];
      try {
        const teamLeadResponse = await axios.get(
          `${BASE_URL}/teamLead/team`,
          { headers }
        );
        if (teamLeadResponse?.data?.data) {
          teamLeadsData = teamLeadResponse.data.data;
        } else if (Array.isArray(teamLeadResponse?.data)) {
          teamLeadsData = teamLeadResponse.data;
        } else {
          teamLeadsData = teamLeadResponse?.data || [];
        }
      } catch (tlErr) {
        console.warn("teamLead/team fetch note (using api/user/all roster):", tlErr?.message);
      }

      if (!Array.isArray(teamLeadsData)) {
        teamLeadsData = [];
      }

      // Fetch employees from live backend
      const fetchedEmployees = await fetchEmployees(headers);

      // Extract all employees from database marked as team lead (e.g. Yash Vaghasiya)
      const employeeTeamLeads = (fetchedEmployees || []).filter((emp) => {
        if (!emp) return false;
        if (isFinanceOrExcludedUser(emp) || isUnknownEmployeeOrUser(emp)) return false;
        const role = String(emp.role || emp.designation || '').toLowerCase().trim();
        return emp.isTeamLead === true || role === 'team lead' || role === 'team_leader' || role === 'tl' || role.includes('lead');
      });

      // Format employee TLs to match teamLead structure
      const formattedEmployeeTLs = employeeTeamLeads
        .filter((emp) => {
          if (!emp || isFinanceOrExcludedUser(emp) || isUnknownEmployeeOrUser(emp)) return false;
          const name = emp.name || emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
          return Boolean(name && isValidName(name));
        })
        .map((emp) => {
          const name = (emp.name || emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()).trim();
          return {
            _id: emp._id,
            teamLeadId: emp._id,
            name,
            fullName: name,
            email: emp.email,
            mobile: emp.mobile || emp.phone,
            phone: emp.phone || emp.mobile,
            department: emp.department,
            designation: emp.designation,
            role: 'team lead',
            teamLead: {
              _id: emp._id,
              userId: emp._id,
              name,
              fullName: name,
              email: emp.email,
              role: 'team lead',
              department: emp.department,
              designation: emp.designation
            },
            assignedEmployees: []
          };
        });

      // 1. Start merged leads with the formatted team leads from api/user/all
      const mergedLeads = [...formattedUserTLs];

      // 2. Merge in any employeeTeamLeads (e.g. Yash Vaghasiya)
      (formattedEmployeeTLs || []).forEach((empLead) => {
        if (!empLead) return;
        if (isFinanceOrExcludedUser(empLead) || isUnknownEmployeeOrUser(empLead)) return;

        const leadName = getUserName(empLead);
        const leadEmail = getUserEmail(empLead);
        if (!leadName || isInvalidName(leadName)) return;
        if (!leadEmail || leadEmail === "N/A" || !leadEmail.includes("@")) return;

        const existingIdx = mergedLeads.findIndex(m => isSameLead(m, empLead));
        if (existingIdx >= 0) {
          const existing = mergedLeads[existingIdx];
          if (!existing.department && empLead.department) existing.department = empLead.department;
          if (!existing.designation && empLead.designation) existing.designation = empLead.designation;
          if (!existing.mobile && empLead.mobile) existing.mobile = empLead.mobile;
          if (!existing.phone && empLead.phone) existing.phone = empLead.phone;
        } else {
          mergedLeads.push(empLead);
        }
      });

      // 3. Process teamLeadsData from teamLead/team to attach any existing assignments / rawTeamDocId
      (teamLeadsData || []).forEach((apiLead) => {
        if (!apiLead) return;
        if (isFinanceOrExcludedUser(apiLead) || (apiLead.teamLead && isFinanceOrExcludedUser(apiLead.teamLead))) return;
        if (isUnknownEmployeeOrUser(apiLead) || (apiLead.teamLead && isUnknownEmployeeOrUser(apiLead.teamLead))) return;

        const leadName = getUserName(apiLead);
        const leadEmail = getUserEmail(apiLead);
        if (!leadName || isInvalidName(leadName)) return;
        if (!leadEmail || leadEmail === "N/A" || !leadEmail.includes("@")) return;

        const leadId = 
          apiLead?.teamLead?.userId || 
          apiLead?.teamLead?.employeeId || 
          apiLead?.teamLead?._id ||
          apiLead?.userId || 
          apiLead?.employeeId || 
          apiLead?.user?._id || 
          apiLead?._id;

        const normalizedLead = {
          ...apiLead,
          _id: leadId || apiLead._id,
          teamLeadId: leadId || apiLead._id,
          name: leadName,
          fullName: leadName,
          email: leadEmail,
          role: apiLead?.teamLead?.role || apiLead?.role || 'team lead',
          rawTeamDocId: apiLead._id
        };

        const existingIdx = mergedLeads.findIndex(m => isSameLead(m, normalizedLead));
        if (existingIdx >= 0) {
          const existing = mergedLeads[existingIdx];
          const empsA = getAssignedEmployeeIds(existing);
          const empsB = getAssignedEmployeeIds(normalizedLead);
          const distinctCombined = getDistinctAssignedEmployees([...empsA, ...empsB], fetchedEmployees);
          existing.assignedEmployees = distinctCombined.map((employee) => normalizeEmployeeId(employee) || employee);
          if (!existing.rawTeamDocId) existing.rawTeamDocId = apiLead._id;
        } else {
          mergedLeads.push(normalizedLead);
        }
      });

      // 4. Pure live API assignments only - DO NOT LOAD OR MERGE FROM LOCAL STORAGE
      const employeeAssignments = {};
      const globallyAssignedEmpKeys = new Set();

      mergedLeads.forEach((lead) => {
        const leadId = String(lead._id);
        const apiEmployees = getAssignedEmployeeIds(lead);

        // Collect all IDs associated with this lead
        const allAssociatedIds = [
          lead._id,
          lead.id,
          lead.teamLeadId,
          lead.userId,
          lead.employeeId,
          lead.rawTeamDocId,
          lead.teamLead?._id,
          lead.teamLead?.userId,
          lead.teamLead?.employeeId,
          typeof lead.teamLead === 'string' ? lead.teamLead : null
        ].filter(Boolean).map(String);

        // Check if any employee directly references this lead in live API response
        const directlyAssignedEmployees = (fetchedEmployees || [])
          .filter(emp => emp && allAssociatedIds.some(id => String(emp.teamLeadId) === id || String(emp.teamLead) === id))
          .map(emp => String(emp._id));

        // PURE LIVE API DATA ONLY
        const mergedLiveEmployees = [...apiEmployees, ...directlyAssignedEmployees];
        const distinctAssigned = getDistinctAssignedEmployees(mergedLiveEmployees, fetchedEmployees);

        // Strictly filter out any employee without a valid resolved name (NO "Unnamed" or unknown)
        const validNamedEmployees = distinctAssigned.filter((emp) => {
          if (!emp) return false;
          const name = getEmployeeName(emp);
          const email = emp.email || emp.user?.email || '';
          if (!isValidName(name) && (!email || !email.includes('@'))) return false;
          if (name && isInvalidName(name)) return false;
          return true;
        });

        // Strictly enforce 1 TL per employee across the whole system
        const singleTlEmployees = validNamedEmployees.filter((emp) => {
          const empKey = getCanonicalEmployeeKey(emp, fetchedEmployees);
          if (!empKey) return false;
          if (globallyAssignedEmpKeys.has(empKey)) {
            // Already claimed by a Team Lead; enforce max 1 TL rule
            return false;
          }
          globallyAssignedEmpKeys.add(empKey);
          return true;
        });

        const distinctIds = singleTlEmployees
          .map((employee) => normalizeEmployeeId(employee) || employee)
          .filter(Boolean);
        lead.assignedEmployees = distinctIds;

        // Store under lead._id and all associated IDs so lookups always find clean deduplicated IDs
        allAssociatedIds.forEach(id => {
          employeeAssignments[id] = distinctIds;
        });
        employeeAssignments[leadId] = distinctIds;
      });

      // Strict filter on leads: NEVER display any team lead that has an invalid or unnamed name!
      const cleanedLeads = mergedLeads.filter((lead) => {
        if (!lead) return false;
        const name = getUserName(lead);
        return Boolean(name && isValidName(name));
      });

      setTeamLeads(cleanedLeads);
      setAssignedEmployees(employeeAssignments);

    } catch (error) {
      console.error("Error fetching team leads:", error);
      handleError(error);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchEmployees = async (headers) => {
    try {
      const allEmployees = [];
      try {
        const res = await axios.get(`${BASE_URL}/employee/list`, { headers });
        allEmployees.push(...extractPeople(res?.data));
      } catch (e) {
        console.warn("Could not fetch /employee/list; trying user directory:", e?.message);
      }

      for (const endpoint of ['/users/all', '/user/all']) {
        try {
          const usersRes = await axios.get(`${BASE_URL}${endpoint}`, { headers });
          allEmployees.push(...extractPeople(usersRes?.data));
          break;
        } catch (e) {
          console.warn(`Could not fetch ${endpoint}:`, e?.message);
        }
      }

      if (!allEmployees.length) {
        throw new Error('Employee and user directory endpoints returned no employee records.');
      }

      const validEmployees = allEmployees.filter((emp) => {
        if (!emp || isFinanceOrExcludedUser(emp) || isUnknownEmployeeOrUser(emp)) return false;
        const name = getEmployeeName(emp);
        if (!name || isInvalidName(name)) return false;
        return true;
      });
      const distinctEmployeesList = getDistinctAssignedEmployees(validEmployees, validEmployees);
      setEmployees(distinctEmployeesList);
      return distinctEmployeesList;
    } catch (error) {
      console.log("Could not fetch employees:", error);
      setEmployees([]);
      return [];
    }
  };

  const handleError = (error) => {
    if (error.response?.status === 401) {
      setError("Authentication failed. Please login again.");
    } else if (error.response?.status === 403) {
      setError("You don't have permission to view team leads.");
    } else if (error.response?.status === 404) {
      setError("Team leads data not found.");
    } else {
      setError("Failed to load team leads. Please try again.");
    }
  };

  // Modal Handlers
  const handleOpenModal = (lead) => {
    const rawAssigned = assignedEmployees[lead._id] || lead.assignedEmployees || [];
    const distinctAssigned = getDistinctAssignedEmployees(rawAssigned, employees);
    const validAssigned = distinctAssigned.filter((emp) => {
      const name = getEmployeeName(emp);
      return Boolean(name && isValidName(name));
    });
    const leadWithAssignments = {
      ...lead,
      assignedEmployees: validAssigned.map(getEmployeeReferenceId).filter(Boolean)
    };
    setSelectedLead(leadWithAssignments);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedLead(null);
  };

  const handleSaveAssignments = async (data) => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        showToast("Authentication required. Please login again.", "error");
        return;
      }
  
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
  
      const distinct = getDistinctAssignedEmployees(data.employeeIds || [], employees);
      const cleanEmployeeIds = distinct.map(e => String(e._id));
      const targetLeadId = String(data.leadId);

      // Collect canonical keys of employees assigned to this lead
      const assignedCanonicalKeys = new Set(
        distinct.map(e => getCanonicalEmployeeKey(e, employees)).filter(Boolean)
      );

      // Collect all associated IDs for the target lead
      const targetLeadObj = selectedLead || teamLeads.find(tl => String(tl._id) === targetLeadId);
      const targetAssociatedIds = targetLeadObj ? [
        targetLeadObj._id,
        targetLeadObj.id,
        targetLeadObj.teamLeadId,
        targetLeadObj.userId,
        targetLeadObj.employeeId,
        targetLeadObj.rawTeamDocId,
        targetLeadObj.teamLead?._id,
        targetLeadObj.teamLead?.userId,
        targetLeadObj.teamLead?.employeeId,
      ].filter(Boolean).map(String) : [targetLeadId];

      // Identify affected other leads whose employees were transferred to target lead
      const affectedOtherLeads = [];

      // 1. Update teamLeads state: assign cleanEmployeeIds to target, remove transferred from others
      const nextTeamLeads = teamLeads.map((tl) => {
        const isTarget = isSameLead(tl, targetLeadObj) || targetAssociatedIds.includes(String(tl._id));

        if (isTarget) {
          return {
            ...tl,
            assignedEmployees: cleanEmployeeIds
          };
        }

        // For all other leads: strictly remove any employee now assigned to targetLead
        const currentAssigned = tl.assignedEmployees || [];
        const remainingAssigned = currentAssigned.filter((empRef) => {
          const empKey = getCanonicalEmployeeKey(empRef, employees);
          return !assignedCanonicalKeys.has(empKey);
        });

        if (remainingAssigned.length !== currentAssigned.length) {
          const distinctRemaining = getDistinctAssignedEmployees(remainingAssigned, employees);
          affectedOtherLeads.push({
            lead: tl,
            remainingEmpIds: distinctRemaining.map((e) => String(e._id))
          });
        }

        const distinctRemaining = getDistinctAssignedEmployees(remainingAssigned, employees);
        return {
          ...tl,
          assignedEmployees: distinctRemaining.map((e) => String(e._id))
        };
      });

      // 2. Update assignedEmployees mapping
      const nextAssignedEmployees = { ...assignedEmployees };

      // Update non-target keys by removing reassigned employees
      Object.keys(nextAssignedEmployees).forEach((key) => {
        if (!targetAssociatedIds.includes(String(key))) {
          const list = nextAssignedEmployees[key] || [];
          nextAssignedEmployees[key] = list.filter((empRef) => {
            const empKey = getCanonicalEmployeeKey(empRef, employees);
            return !assignedCanonicalKeys.has(empKey);
          });
        }
      });

      // Set target associated keys to cleanEmployeeIds
      targetAssociatedIds.forEach((id) => {
        nextAssignedEmployees[id] = cleanEmployeeIds;
      });
      nextAssignedEmployees[targetLeadId] = cleanEmployeeIds;

      // Update React state immediately
      setTeamLeads(nextTeamLeads);
      setAssignedEmployees(nextAssignedEmployees);

      // 4. Save to backend for target lead
      const payload = {
        teamLead: data.leadId,
        employees: cleanEmployeeIds
      };

      try {
        await axios.post(
          `${BASE_URL}/teamLead/create-team`,
          payload,
          { headers }
        );
      } catch (backendErr) {
        console.warn('Backend team assign endpoint note:', backendErr?.response?.data || backendErr.message);
      }

      // 5. Save updated assignments to backend for any other leads that lost employees
      for (const affected of affectedOtherLeads) {
        try {
          const otherLeadId = affected.lead?.teamLeadId || affected.lead?._id;
          if (otherLeadId) {
            await axios.post(
              `${BASE_URL}/teamLead/create-team`,
              {
                teamLead: otherLeadId,
                employees: affected.remainingEmpIds
              },
              { headers }
            );
          }
        } catch (otherErr) {
          console.warn('Backend update note for reassigned lead:', otherErr?.message);
        }
      }

      // 6. Asynchronously sync user document teamLead fields if possible
      cleanEmployeeIds.forEach(async (empId) => {
        try {
          const matched = findEmployeeByIdOrUser(empId, employees);
          const uId = matched?.userId || matched?.userID || matched?.user?._id || empId;
          if (uId && String(uId).match(/^[0-9a-fA-F]{24}$/)) {
            await axios.put(
              `${BASE_URL}/users/approve`,
              {
                id: uId,
                userId: uId,
                _id: uId,
                teamLead: targetLeadId,
                teamLeadId: targetLeadId,
                assignedTL: targetLeadId,
                teamLeader: targetLeadId,
                teamLeadName: targetLeadName,
                teamLeadEmail: targetLeadEmail
              },
              { headers }
            ).catch(() => {});
          }
        } catch {}
      });

      // Reload live data from backend to guarantee UI displays fresh API truth
      await fetchTeamLeads(true);

      window.dispatchEvent(new Event('kt_team_assignment_updated'));

      showToast("Assignments saved successfully! Each employee is assigned to at most 1 Team Lead.", "success");
    } catch (error) {
      console.error('Error saving assignments:', error);
      showToast(error?.response?.data?.message || 'Failed to save assignments. Please try again.', "error");
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('teamLeadAssignedEmployees');
    } catch {}
    fetchTeamLeads(false);

    // Silent background auto-refresh every 12 seconds for real-time team assignments & updates
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!modalOpen) {
        fetchTeamLeads(true);
      }
    }, 12000);

    const handleFocus = () => {
      if (!modalOpen) fetchTeamLeads(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !modalOpen) {
        fetchTeamLeads(true);
      }
    };

    const handleTeamAssignmentUpdated = () => {
      if (!modalOpen) fetchTeamLeads(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('kt_team_assignment_updated', handleTeamAssignmentUpdated);
    window.addEventListener('storage', handleTeamAssignmentUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('kt_team_assignment_updated', handleTeamAssignmentUpdated);
      window.removeEventListener('storage', handleTeamAssignmentUpdated);
    };
  }, [modalOpen]);

  const userRole = getUserRole();
  const isAdmin = userRole === 'admin';

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] py-16 sm:py-20">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }
 
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button 
                onClick={() => fetchTeamLeads()} 
                className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center shrink-0">
            <Crown size={18} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Team Leads Directory</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">Manage team leads and member assignments with live database sync</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchTeamLeads()}
          disabled={loading}
          className="h-10 px-4 bg-white rounded-lg shadow-xs border border-slate-200/80 hover:bg-slate-50 transition-colors text-slate-700 flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{loading ? 'Syncing...' : 'Refresh Data'}</span>
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full bg-[#004b73]" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">TOTAL TEAM LEADS</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{teamLeads.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full bg-[#004b73]" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">TOTAL EMPLOYEES</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">
            {employees.filter((employee) => employee.role?.toLowerCase().trim() === "employee").length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full bg-[#004b73]" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">TOTAL MEMBERS</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">
            {teamLeads.length + employees.filter((employee) => employee.role?.toLowerCase().trim() === "employee").length}
          </p>
        </div>
      </div>

      {teamLeads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs p-12 text-center border border-slate-200/80">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">No Team Leads Found</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            {isAdmin ? 'No team leads have been created yet.' : 'You are not assigned as a Team Lead.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {teamLeads.map((lead, index) => {
            const leadName = getUserName(lead);
            if (!leadName || isInvalidName(leadName)) return null;

            const rawAssigned = assignedEmployees[lead._id] || lead.assignedEmployees || [];
            const assignedList = getDistinctAssignedEmployees(rawAssigned, employees);
            const validAssignedList = assignedList.filter((emp) => {
              const disp = getEmployeeDisplayName(emp);
              return Boolean(disp && isValidName(disp));
            });
            const totalAssignments = validAssignedList.length;
            const leadEmail = getUserEmail(lead);
            const departmentName = getDepartment(lead, employees);

            return (
              <div
                key={lead._id || index}
                className="group bg-white rounded-xl shadow-xs hover:shadow-md transition-all duration-300 border border-slate-200/80 hover:border-slate-300 overflow-hidden"
              >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {leadName}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{leadEmail}</p>
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
                          Team Lead
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-gray-600">
                          <span className="font-medium">Department:</span> {departmentName}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-600">
                          <span className="font-medium">Designation:</span> {getDesignation(lead)}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="text-center border-r border-gray-200">
                        <p className="text-xs text-gray-500 font-medium">Employees</p>
                        <p className="text-lg font-bold text-purple-600">{totalAssignments}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 font-medium">Total</p>
                        <p className="text-lg font-bold text-blue-600">{totalAssignments}</p>
                      </div>
                    </div>

                    {/* Action Button */}
                    {isAdmin && (
                      <button
                        onClick={() => handleOpenModal(lead)}
                        style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-xl text-white shadow-xs hover:opacity-95 transition-all duration-200 cursor-pointer"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Assign Team Members
                        {totalAssignments > 0 && (
                          <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                            {totalAssignments}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Member Tags */}
                    {totalAssignments > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 font-medium mb-2">Team Members</p>
                        <div className="flex flex-wrap gap-1.5">
                          {validAssignedList.slice(0, 6).map((emp) => {
                            const dispName = getEmployeeDisplayName(emp);
                            if (!dispName || isInvalidName(dispName)) return null;
                            return (
                              <span key={emp._id || emp.email || emp.name} className="inline-flex items-center px-2.5 py-1 bg-purple-100 text-purple-800 text-xs rounded-full border border-purple-200">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1.5"></span>
                                {dispName}
                              </span>
                            );
                          })}
                          {totalAssignments > 6 && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">
                              +{totalAssignments - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Modal */}
      <AssignmentModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        lead={selectedLead}
        employees={employees}
        teamLeads={teamLeads}
        assignedEmployees={assignedEmployees}
        departmentName={selectedLead ? getDepartment(selectedLead, employees) : "Unknown Department"}
        onSave={handleSaveAssignments}
      />
    </div>
  );
};

export default TeamLead;