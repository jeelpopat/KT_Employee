/**
 * Standard Employee Departments and Roles Specification:
 * • Sales: Business Development Executive (BDE), Account Executive
 * • Developer: Software, Frontend, Backend, Full Stack, Mobile, QA, AI/ML, Data Analyst
 * • Design: UI/UX, Graphic
 */

export const EMPLOYEE_DEPARTMENTS_ROLES = {
  Sales: [
    "Business Development Executive (BDE)",
    "Account Executive"
  ],
  Developer: [
    "Software",
    "Frontend",
    "Backend",
    "Full Stack",
    "Mobile",
    "QA",
    "AI/ML",
    "Data Analyst"
  ],
  Design: [
    "UI/UX",
    "Graphic"
  ]
};

export const ALL_EMPLOYEE_DEPARTMENTS = Object.keys(EMPLOYEE_DEPARTMENTS_ROLES);

export const ALL_EMPLOYEE_ROLES = Object.values(EMPLOYEE_DEPARTMENTS_ROLES).flat();

/**
 * Given a role or designation name, finds the corresponding department
 */
export const getDepartmentForRole = (roleOrDesignation = '') => {
  const str = String(roleOrDesignation || '').toLowerCase().trim();
  if (!str) return '';

  for (const [dept, roles] of Object.entries(EMPLOYEE_DEPARTMENTS_ROLES)) {
    for (const r of roles) {
      const rLower = r.toLowerCase();
      if (str === rLower || str.includes(rLower) || rLower.includes(str)) {
        return dept;
      }
      if (rLower.includes('bde') && str.includes('bde')) return 'Sales';
      if (rLower.includes('qa') && (str.includes('qa') || str.includes('testing') || str.includes('tester'))) return 'Developer';
      if (rLower.includes('ui/ux') && (str.includes('ui') || str.includes('ux'))) return 'Design';
    }
  }
  return '';
};

/**
 * Check if an employee matches a target department
 */
export const matchesEmployeeDepartment = (emp, targetDepartment) => {
  if (!targetDepartment || targetDepartment === 'all') return true;
  const targetLower = targetDepartment.toLowerCase();

  const empDept = String(
    emp?.department?.departmentName ||
    emp?.departmentName ||
    emp?.department ||
    ''
  ).toLowerCase().trim();

  if (empDept === targetLower || empDept.includes(targetLower)) return true;

  const empDesig = String(
    emp?.designation?.name ||
    emp?.designation?.designationName ||
    emp?.designation ||
    emp?.position ||
    ''
  ).toLowerCase().trim();

  const rolesForDept = EMPLOYEE_DEPARTMENTS_ROLES[targetDepartment] || [];
  return rolesForDept.some(r => {
    const rLower = r.toLowerCase();
    if (empDesig.includes(rLower)) return true;
    if (rLower.includes('bde') && empDesig.includes('bde')) return true;
    if (rLower.includes('qa') && (empDesig.includes('qa') || empDesig.includes('test'))) return true;
    if (rLower.includes('ui/ux') && (empDesig.includes('ui') || empDesig.includes('ux'))) return true;
    return false;
  });
};

/**
 * Check if an employee matches a target employee role / designation
 */
export const matchesEmployeeRole = (emp, targetRole) => {
  if (!targetRole || targetRole === 'all') return true;
  const targetLower = targetRole.toLowerCase().trim();

  const empDesig = String(
    emp?.designation?.name ||
    emp?.designation?.designationName ||
    emp?.designation ||
    emp?.position ||
    ''
  ).toLowerCase().trim();

  if (empDesig === targetLower || empDesig.includes(targetLower)) return true;
  if (targetLower.includes('bde') && empDesig.includes('bde')) return true;
  if (targetLower.includes('account executive') && empDesig.includes('account executive')) return true;
  if (targetLower.includes('software') && empDesig.includes('software')) return true;
  if (targetLower.includes('frontend') && empDesig.includes('frontend')) return true;
  if (targetLower.includes('backend') && empDesig.includes('backend')) return true;
  if (targetLower.includes('full stack') && (empDesig.includes('full stack') || empDesig.includes('fullstack'))) return true;
  if (targetLower.includes('mobile') && (empDesig.includes('mobile') || empDesig.includes('android') || empDesig.includes('ios') || empDesig.includes('flutter'))) return true;
  if (targetLower.includes('qa') && (empDesig.includes('qa') || empDesig.includes('tester') || empDesig.includes('testing') || empDesig.includes('quality'))) return true;
  if (targetLower.includes('ai/ml') && (empDesig.includes('ai') || empDesig.includes('ml') || empDesig.includes('machine learning'))) return true;
  if (targetLower.includes('data analyst') && (empDesig.includes('data analyst') || empDesig.includes('analyst'))) return true;
  if (targetLower.includes('ui/ux') && (empDesig.includes('ui') || empDesig.includes('ux'))) return true;
  if (targetLower.includes('graphic') && empDesig.includes('graphic')) return true;

  return false;
};
