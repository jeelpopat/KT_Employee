export const extractArrayFromResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.employees)) return payload.employees;
  if (Array.isArray(payload.teamLeads)) return payload.teamLeads;
  if (Array.isArray(payload.teamLead)) return payload.teamLead;
  if (Array.isArray(payload.result)) return payload.result;

  return [];
};

const getSafeText = (value, fallback = '') => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.fullName === 'string') return value.fullName;
    if (typeof value.displayName === 'string') return value.displayName;
    if (typeof value.departmentName === 'string') return value.departmentName;
    if (typeof value.title === 'string') return value.title;
    if (typeof value.email === 'string') return value.email;
    if (typeof value._id === 'string' || typeof value._id === 'number') return String(value._id);
    return fallback;
  }
  return fallback;
};

const getDisplayName = (item) => {
  if (!item || typeof item !== 'object') return '';

  const candidates = [
    item.name,
    item.fullName,
    item.displayName,
    item.username,
    item.employeeName,
    item.userName,
    item.title,
  ];

  const directName = candidates.find((value) => Boolean(value));
  if (directName) return getSafeText(directName);

  const firstName = item.firstName || item.firstname;
  const lastName = item.lastName || item.lastname;
  if (firstName || lastName) {
    return `${getSafeText(firstName)} ${getSafeText(lastName)}`.trim();
  }

  return '';
};

const getDepartment = (item) => {
  if (!item || typeof item !== 'object') return 'N/A';

  const departmentValue = (
    item.department?.departmentName ||
    item.departmentName ||
    item.department ||
    item.teamLead?.department?.departmentName ||
    item.user?.department?.departmentName ||
    'N/A'
  );

  return getSafeText(departmentValue, 'N/A');
};

export const normalizeEmployeeRecord = (item, role = 'employee') => {
  const source = item?.teamLead || item?.user || item?.employee || item || {};

  const name = getDisplayName(source) || getDisplayName(item) || 'Unknown Employee';
  const email = source?.email || item?.email || 'No email';
  const department = getDepartment(source) || getDepartment(item) || 'N/A';
  const employeeId =
    source?.employeeID ||
    source?.employeeId ||
    item?.employeeID ||
    item?.employeeId ||
    item?.id ||
    'N/A';
  const position = source?.position || item?.position || 'Employee';
  const phone = source?.phone || item?.phone || 'N/A';
  const joinDate = source?.joinDate || item?.joinDate || 'N/A';

  return {
    _id: item?._id || item?.id || source?._id || source?.id || employeeId,
    name,
    employeeId,
    email,
    department,
    position,
    phone,
    joinDate,
    role,
    source: role,
  };
};

export const getOverallGrade = (kpiScore) => {
  if (kpiScore >= 85) return 'A';
  if (kpiScore >= 75) return 'B';
  if (kpiScore >= 65) return 'C';
  if (kpiScore >= 55) return 'D';
  return 'F';
};

export const buildPerformanceSummary = (data = {}) => {
  const attendance = Number(data.attendance ?? 0);
  const taskCompletion = Number(data.taskCompletion ?? 0);
  const projectContribution = Number(data.projectContribution ?? 0);
  const lateComing = Number(data.lateComing ?? 0);
  const leave = Number(data.leave ?? 0);
  const managerRating = Number(data.managerRating ?? 0);
  const kpiScore = Number(data.kpiScore ?? 0);

  return {
    attendance,
    taskCompletion,
    projectContribution,
    lateComing,
    leave,
    managerRating,
    kpiScore,
    overallGrade: getOverallGrade(kpiScore),
  };
};
