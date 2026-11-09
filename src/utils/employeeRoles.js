/**
 * Standard Employee Departments and Roles Specification:
 * - Development: Frontend, Backend, Full Stack, Web, and Mobile App Developers
 * - Design: UI/UX, Graphic, and Motion Designers
 * - Quality Assurance (QA): Manual and Automation Testers
 * - Sales & Business Development: BDE, Sales Executive, Lead Generation
 * - Marketing: Digital Marketing, SEO, Social Media, Content
 * - Human Resources (HR): Recruitment, Attendance, Employee Management
 * - Finance & Accounts: Accountant, Payroll, Billing, Payments
 * - Project Management: Project Manager, Project Coordinator
 * - IT & Infrastructure: DevOps, Server, Cloud, IT Support
 * - Customer Support & Success: Client Support, Onboarding, After-sales Support
 */

export const EMPLOYEE_DEPARTMENTS_ROLES = {
  "Development": [
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "Web Developer",
    "Mobile App Developer"
  ],
  "Design": [
    "UI/UX Designer",
    "Graphic Designer",
    "Motion Designer"
  ],
  "Quality Assurance (QA)": [
    "Manual Tester",
    "Automation Tester",
    "QA Tester"
  ],
  "Sales & Business Development": [
    "Business Development Executive (BDE)",
    "Sales Executive",
    "Lead Generation Specialist"
  ],
  "Marketing": [
    "Digital Marketing Specialist",
    "SEO Specialist",
    "Social Media Specialist",
    "Content Specialist"
  ],
  "Human Resources (HR)": [
    "Recruitment Specialist",
    "Attendance Specialist",
    "Employee Management Executive"
  ],
  "Finance & Accounts": [
    "Accountant",
    "Payroll Specialist",
    "Billing Executive",
    "Payments Executive"
  ],
  "Project Management": [
    "Project Manager",
    "Project Coordinator"
  ],
  "IT & Infrastructure": [
    "DevOps Engineer",
    "Server Administrator",
    "Cloud Engineer",
    "IT Support Specialist"
  ],
  "Customer Support & Success": [
    "Client Support Specialist",
    "Onboarding Specialist",
    "After-sales Support Specialist"
  ]
};

export const ALL_EMPLOYEE_DEPARTMENTS = Object.keys(EMPLOYEE_DEPARTMENTS_ROLES);

export const ALL_EMPLOYEE_ROLES = Object.values(EMPLOYEE_DEPARTMENTS_ROLES).flat();

// Standard blood groups and genders for HRMS onboarding & profiles
export const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const ALL_GENDERS = ['Male', 'Female', 'Other'];

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
    }
  }

  // Fallback heuristics
  if (str.includes('front') || str.includes('back') || str.includes('full stack') || str.includes('developer') || str.includes('software') || str.includes('mern') || str.includes('mobile')) {
    return 'Development';
  }
  if (str.includes('ui') || str.includes('ux') || str.includes('graphic') || str.includes('motion') || str.includes('design')) {
    return 'Design';
  }
  if (str.includes('qa') || str.includes('test') || str.includes('quality')) {
    return 'Quality Assurance (QA)';
  }
  if (str.includes('bde') || str.includes('sales') || str.includes('lead gen')) {
    return 'Sales & Business Development';
  }
  if (str.includes('marketing') || str.includes('seo') || str.includes('social') || str.includes('content')) {
    return 'Marketing';
  }
  if (str.includes('hr') || str.includes('recruit') || str.includes('attendance') || str.includes('employee management')) {
    return 'Human Resources (HR)';
  }
  if (str.includes('account') || str.includes('payroll') || str.includes('billing') || str.includes('payment') || str.includes('finance')) {
    return 'Finance & Accounts';
  }
  if (str.includes('project')) {
    return 'Project Management';
  }
  if (str.includes('devops') || str.includes('server') || str.includes('cloud') || str.includes('infrastructure') || str.includes('it support')) {
    return 'IT & Infrastructure';
  }
  if (str.includes('customer') || str.includes('client') || str.includes('onboarding') || str.includes('after-sales')) {
    return 'Customer Support & Success';
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
  if (targetLower.includes('dev') && empDept.includes('dev')) return true;
  if (targetLower.includes('sale') && empDept.includes('sale')) return true;

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
    return empDesig.includes(rLower) || rLower.includes(empDesig);
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

  if (empDesig === targetLower || empDesig.includes(targetLower) || targetLower.includes(empDesig)) return true;
  return false;
};
