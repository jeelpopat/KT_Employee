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
    candidateName.includes('priya') ||
    candidateName.includes('kuresh') ||
    candidateEmail.includes('priya') ||
    candidateEmail.includes('kuresh')
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
    clean.includes('priya') ||
    clean.includes('kuresh') ||
    cleanEmail.includes('priya') ||
    cleanEmail.includes('kuresh')
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
