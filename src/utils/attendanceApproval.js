const PENDING_STATUS_FIELDS = [
  'status',
  'approvalStatus',
  'adminStatus',
  'checkInStatus',
  'checkInApprovalStatus',
  'adminDecision'
];

export const isAttendanceRequestPending = (record, hasCheckInActivity) => {
  if (!record || !hasCheckInActivity) return false;

  const hasPendingStatus = PENDING_STATUS_FIELDS.some((field) =>
    String(record[field] || '').toLowerCase().trim().includes('pending')
  );

  return hasPendingStatus || record.isApproved === false;
};
