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

  return false;
};

/**
 * Filters an array of users/employees/records, removing Finance & Admin users.
 */
export const filterOutFinanceUsers = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => !isFinanceOrExcludedUser(item));
};
