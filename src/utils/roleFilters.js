/**
 * Utility for filtering out Finance and other non-HRMS roles from the HRMS Admin panel.
 * Excludes: Admin, Accountant, CA (Chartered Accountant), Manager (Finance/Accounts/General),
 * and any user belonging to the Finance/Accounts department.
 */

export const isFinanceOrExcludedUser = (user) => {
  if (!user) return false;

  // Extract nested user object if wrapped (e.g. employee.userID, attendance.userId, etc.)
  const target =
    typeof user === 'object' &&
      (user.userID || user.userId || user.user || user.employeeId || user.assignedEmployee) &&
      typeof (user.userID || user.userId || user.user || user.employeeId || user.assignedEmployee) === 'object'
      ? {
        ...user,
        ...(user.userID || user.userId || user.user || user.employeeId || user.assignedEmployee),
      }
      : user;

  const role = String(
    target.role ||
    target.userRole ||
    target.roleType ||
    user.role ||
    user.userRole ||
    user.roleType ||
    ''
  )
    .toLowerCase()
    .trim();

  const department = String(
    target.department ||
    target.dept ||
    user.department ||
    user.dept ||
    ''
  )
    .toLowerCase()
    .trim();

  const designation = String(
    target.designation ||
    target.jobTitle ||
    target.position ||
    user.designation ||
    user.jobTitle ||
    user.position ||
    ''
  )
    .toLowerCase()
    .trim();

  // 1. Admin check
  if (role === 'admin' || designation === 'admin') return true;

  // 2. Exact Excluded Roles
  const excludedRoles = [
    'admin',
    'accountant',
    'accounts',
    'ca',
    'chartered accountant',
    'manager',
    'finance manager',
    'accounts manager',
    'account manager',
    'finance',
    'cfo',
    'auditor'
  ];

  if (excludedRoles.includes(role)) return true;

  // 3. Excluded Departments
  const excludedDepts = ['finance', 'accounts', 'accounting', 'audit'];
  if (excludedDepts.includes(department)) return true;

  // 4. Role keywords
  if (
    role.includes('accountant') ||
    role.includes('finance') ||
    role === 'ca' ||
    role.startsWith('ca ') ||
    role.endsWith(' ca') ||
    role.includes('chartered accountant') ||
    (role.includes('manager') && !role.includes('hr manager') && !role.includes('project manager'))
  ) {
    return true;
  }

  // 5. Designation keywords
  if (
    designation.includes('accountant') ||
    designation.includes('finance') ||
    designation === 'ca' ||
    designation.startsWith('ca ') ||
    designation.endsWith(' ca') ||
    designation.includes('chartered accountant') ||
    (designation.includes('manager') && !designation.includes('hr manager') && !designation.includes('project manager'))
  ) {
    return true;
  }

  // 6. Exclude test & demo accounts (Priya and Kuresh)
  const candidateEmail = String(
    target.email ||
    target.employeeEmail ||
    target.userEmail ||
    user.email ||
    user.employeeEmail ||
    ''
  ).toLowerCase().trim();

  const candidateName = String(
    target.name ||
    target.employeeName ||
    target.fullName ||
    user.name ||
    user.employeeName ||
    user.fullName ||
    ''
  ).toLowerCase().trim();

  if (
    candidateName.includes('employee') ||
    candidateEmail.includes('employee')
  ) {
    return true;
  }

  return false;
};

/**
 * Filters an array of users/employees/records, removing Finance & Admin users.
 */
export const filterOutFinanceUsers = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => !isFinanceOrExcludedUser(item));
};

export const getEmploymentStatus = (...records) => {
  const sources = records.filter((record) => record && typeof record === 'object');

  for (const source of sources) {
    for (const field of ['employeeStatus', 'employmentStatus', 'status']) {
      const value = source[field];
      if (value != null && String(value).trim()) return String(value).trim();
    }
    if (typeof source.isActive === 'boolean') {
      return source.isActive ? 'Active' : 'Inactive';
    }
  }

  return 'Active';
};

export const resolveRoleName = (record, roleNamesById = new Map()) => {
  const roleFields = [
    'roleName',
    'role_name',
    'role',
    'userRole',
    'user_role',
    'employeeRole',
    'employee_role',
    'roleType',
    'role_type',
    'roleId',
    'role_id',
    'roleID',
  ];
  const nestedFields = [
    'user',
    'userId',
    'userID',
    'employee',
    'employeeId',
    'employeeID',
    'profile',
  ];
  const records = [];
  const pending = [record];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || records.includes(current)) continue;
    records.push(current);
    nestedFields.forEach((field) => {
      if (current[field] && typeof current[field] === 'object') {
        pending.push(current[field]);
      }
    });
  }

  const candidates = records.flatMap((source) => roleFields
    .map((field) => source[field])
    .filter((value) => value != null && value !== ''));

  const names = candidates.map((candidate) => {
    const value = candidate && typeof candidate === 'object'
      ? candidate.roleName ||
        candidate.name ||
        candidate.title ||
        candidate.key ||
        candidate.label ||
        candidate.displayName ||
        candidate.role_name ||
        candidate.roleId ||
        candidate.userRole ||
        candidate.user_role ||
        candidate.employeeRole ||
        candidate.employee_role ||
        candidate.roleType ||
        candidate.role_type ||
        candidate.roleID ||
        candidate.role_id ||
        candidate._id ||
        candidate.id ||
        ''
      : candidate;
    const text = String(value || '').trim();
    return roleNamesById.get(text.toLowerCase()) ||
      (/^[0-9a-f]{24}$/i.test(text) ? '' : text);
  }).filter(Boolean);

  return names.find((name) => name.trim().toLowerCase() !== 'employee') || names[0] || '';
};

export const isTeamLeadRole = (...records) => {
  const leadRoleNames = new Set(['teamlead', 'teamleader', 'tl']);

  const getText = (value) => {
    if (value && typeof value === 'object') {
      return value.roleName || value.name || value.title || value.key || value.label || value.designationName || '';
    }
    return value == null ? '' : String(value);
  };

  const matchesLeadRole = (value) => {
    const normalized = getText(value).toLowerCase().replace(/[^a-z]/g, '');
    return leadRoleNames.has(normalized);
  };

  const isLeadRecord = (record) => {
    if (!record || typeof record !== 'object') return false;
    if (record.isTeamLead === true || record.isTeamLeader === true) return true;

    return [
      record.role,
      record.userRole,
      record.roleName,
      record.designation,
      record.designationName,
      record.employeeRole,
      record.position,
    ].some(matchesLeadRole);
  };

  return records.some((record) => {
    if (typeof record === 'string') return matchesLeadRole(record);
    if (!record || typeof record !== 'object') return false;
    return [
      record,
      record.user,
      record.userId,
      record.userID,
      record.employee,
      record.employeeId,
      record.employeeID,
    ].some(isLeadRecord);
  });
};

/**
 * Checks if a user, employee, or record has an unknown / dummy employee name.
 */
export const isUnknownEmployeeOrUser = (entity) => {
  if (!entity) return true;

  let rawName = '';
  let rawEmail = '';
  if (typeof entity === 'string') {
    rawName = entity;
  } else if (typeof entity === 'object') {
    rawName =
      entity.employeeName ||
      entity.name ||
      entity.fullName ||
      entity.displayName ||
      entity.username ||
      entity.userName ||
      entity.employee?.name ||
      entity.employee?.fullName ||
      entity.employee?.displayName ||
      entity.user?.name ||
      entity.user?.fullName ||
      entity.user?.displayName ||
      entity.userId?.name ||
      entity.userId?.fullName ||
      entity.employeeID?.name ||
      entity.employeeID?.fullName ||
      entity.employeeId?.name ||
      entity.employeeId?.fullName ||
      entity.userObj?.name ||
      entity.assignedEmployee?.name ||
      (entity.firstName ? `${entity.firstName} ${entity.lastName || ''}`.trim() : '') ||
      '';

    rawEmail =
      entity.email ||
      entity.employeeEmail ||
      entity.userEmail ||
      entity.employee?.email ||
      entity.user?.email ||
      entity.userId?.email ||
      entity.employeeID?.email ||
      entity.employeeId?.email ||
      '';
  }

  const clean = String(rawName).trim().toLowerCase();
  const cleanEmail = String(rawEmail).trim().toLowerCase();
  if (!clean && !cleanEmail) return true;

  // Exclude test & demo users (Priya and Kuresh)
  if (
    clean.includes('employee') ||
    // clean.includes('kuresh') ||
    cleanEmail.includes('employee')
    // cleanEmail.includes('kuresh')
  ) {
    return true;
  }

  const invalidNames = [
    'unknown employee',
    'unknown user',
    'unknown',
    'unnamed',
    'unnamed employee',
    'unnamed user',
    'no name',
    'n/a',
    'undefined',
    'null',
    'none',
    '—',
    '-'
  ];

  if (invalidNames.includes(clean)) return true;
  if (clean.includes('unknown employee') || clean.includes('unknown user')) return true;
  if (clean.startsWith('unknown ') || clean.startsWith('unnamed ')) return true;

  return false;
};

/**
 * Filters an array of records to remove any with unknown / unnamed employees.
 */
export const filterOutUnknownUsers = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => !isUnknownEmployeeOrUser(item));
};
