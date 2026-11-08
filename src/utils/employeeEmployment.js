export const isEmployeeInactive = (employee) => {
  const records = [employee, employee?.employeeRecord].filter(Boolean);
  return records.some((record) =>
    record.isActive === false ||
    [record.employeeStatus, record.employmentStatus, record.status]
      .some((status) => String(status || '').trim().toLowerCase() === 'inactive')
  );
};

export const createEmployeeEmploymentStatusRequest = (apiBase, employeeId, isActive, token) => {
  if (!employeeId) {
    throw new Error('Employee ID is missing.');
  }

  return {
    url: `${apiBase}/employee/edit/${encodeURIComponent(employeeId)}`,
    options: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        isActive,
        employeeStatus: isActive ? 'Active' : 'Inactive',
        status: isActive ? 'active' : 'inactive'
      })
    }
  };
};
