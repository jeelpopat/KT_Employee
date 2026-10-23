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
  const targetLower = targetDepartment.toLowerCase().trim();

  // Safely extract department text from string or object
  const rawDept =
    typeof emp?.department === 'object'
      ? (emp.department?.name || emp.department?.departmentName || emp.department?.title || '')
      : (emp?.departmentName || emp?.department || '');
  const empDept = String(rawDept || '').toLowerCase().trim();

  if (empDept && (empDept === targetLower || empDept.includes(targetLower) || targetLower.includes(empDept))) {
    return true;
  }

  // Safely extract designation text from string or object
  const rawDesig =
    typeof emp?.designation === 'object'
      ? (emp.designation?.name || emp.designation?.designationName || emp.designation?.title || '')
      : (emp?.designation || emp?.position || emp?.role || '');
  const empDesig = String(rawDesig || '').toLowerCase().trim();

  // Specific semantic checks for standard departments
  if (targetLower === 'sales') {
    if (
      empDept.includes('sale') ||
      empDept.includes('bd') ||
      empDept.includes('marketing') ||
      empDesig.includes('sale') ||
      empDesig.includes('bde') ||
      empDesig.includes('business development') ||
      empDesig.includes('account executive')
    ) {
      return true;
    }
  }

  if (targetLower === 'developer') {
    if (
      empDept.includes('dev') ||
      empDept.includes('tech') ||
      empDept.includes('software') ||
      empDept.includes('engineer') ||
      empDesig.includes('developer') ||
      empDesig.includes('software') ||
      empDesig.includes('engineer') ||
      empDesig.includes('frontend') ||
      empDesig.includes('backend') ||
      empDesig.includes('full stack') ||
      empDesig.includes('fullstack') ||
      empDesig.includes('qa') ||
      empDesig.includes('tester') ||
      empDesig.includes('testing') ||
      empDesig.includes('ai') ||
      empDesig.includes('ml') ||
      empDesig.includes('data')
    ) {
      return true;
    }
  }

  if (targetLower === 'design') {
    if (
      empDept.includes('design') ||
      empDesig.includes('design') ||
      empDesig.includes('ui') ||
      empDesig.includes('ux') ||
      empDesig.includes('graphic')
    ) {
      return true;
    }
  }

  const rolesForDept = EMPLOYEE_DEPARTMENTS_ROLES[targetDepartment] || [];
  return rolesForDept.some((r) => {
    const rLower = r.toLowerCase();
    if (empDesig && (empDesig.includes(rLower) || rLower.includes(empDesig))) return true;
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

  const rawDesig =
    typeof emp?.designation === 'object'
      ? (emp.designation?.name || emp.designation?.designationName || emp.designation?.title || '')
      : (emp?.designation || emp?.position || emp?.role || '');
  const empDesig = String(rawDesig || '').toLowerCase().trim();

  if (!empDesig) return false;

  // Direct bi-directional match
  if (empDesig === targetLower || empDesig.includes(targetLower) || targetLower.includes(empDesig)) {
    return true;
  }

  // BDE / Business Development Executive
  if (
    (targetLower.includes('bde') || targetLower.includes('business development executive')) &&
    (empDesig.includes('bde') || empDesig.includes('business development') || empDesig.includes('sales executive') || empDesig.includes('sales'))
  ) {
    return true;
  }

  // Account Executive
  if (targetLower.includes('account executive') && empDesig.includes('account executive')) return true;

  // Software & Developer roles
  if (targetLower.includes('software') && empDesig.includes('software')) return true;
  if (targetLower.includes('frontend') && (empDesig.includes('frontend') || empDesig.includes('front-end') || empDesig.includes('react') || empDesig.includes('ui'))) return true;
  if (targetLower.includes('backend') && (empDesig.includes('backend') || empDesig.includes('back-end') || empDesig.includes('node') || empDesig.includes('api'))) return true;
  if (targetLower.includes('full stack') && (empDesig.includes('full stack') || empDesig.includes('fullstack'))) return true;
  if (targetLower.includes('mobile') && (empDesig.includes('mobile') || empDesig.includes('android') || empDesig.includes('ios') || empDesig.includes('flutter'))) return true;
  if (targetLower.includes('qa') && (empDesig.includes('qa') || empDesig.includes('tester') || empDesig.includes('testing') || empDesig.includes('quality'))) return true;
  if (targetLower.includes('ai/ml') && (empDesig.includes('ai') || empDesig.includes('ml') || empDesig.includes('machine learning'))) return true;
  if (targetLower.includes('data analyst') && (empDesig.includes('data analyst') || empDesig.includes('analyst'))) return true;

  // Team Lead
  if (
    targetLower.includes('team lead') ||
    targetLower.includes('teamlead') ||
    targetLower === 'tl'
  ) {
    if (
      emp?.isTeamLead ||
      emp?.isTeamLeader ||
      empDesig.includes('team lead') ||
      empDesig.includes('teamlead') ||
      empDesig.includes('tl') ||
      String(emp?.role || '').toLowerCase().includes('lead')
    ) {
      return true;
    }
  }

  // Sales
  if (targetLower.includes('sales')) {
    if (
      empDesig.includes('sale') ||
      empDesig.includes('bde') ||
      empDesig.includes('business development') ||
      String(emp?.department || '').toLowerCase().includes('sale')
    ) {
      return true;
    }
  }

  // Design roles
  if (targetLower.includes('ui/ux') && (empDesig.includes('ui') || empDesig.includes('ux') || empDesig.includes('designer'))) return true;
  if (targetLower.includes('graphic') && (empDesig.includes('graphic') || empDesig.includes('designer'))) return true;

  return false;
};
