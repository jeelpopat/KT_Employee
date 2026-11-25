export const normalizeHalfDayType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  return normalized === "first-half" || normalized === "second-half"
    ? normalized
    : "";
};

export const getHalfDayType = (leave) => {
  const explicitType = normalizeHalfDayType(leave?.halfDayType);
  if (explicitType) return explicitType;

  const leaveType = String(leave?.leaveType || leave?.type || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (leaveType === "half_day_1") return "first-half";
  if (leaveType === "half_day_2") return "second-half";
  return "";
};

export const isHalfDayLeave = (leave) => {
  const leaveType = String(leave?.leaveType || leave?.type || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  return leave?.isHalfDay === true ||
    ["half_day", "half_day_1", "half_day_2"].includes(leaveType) ||
    Number(leave?.totalDays) === 0.5 ||
    Boolean(getHalfDayType(leave));
};

export const getTeamLeadLeaveStatus = (leave) => {
  const teamLeadStatus = String(leave?.teamLeadStatus || "").trim().toLowerCase();
  if (teamLeadStatus === "approved") return "approved";
  if (teamLeadStatus === "rejected") return "rejected";

  if (String(leave?.teamLeadRemark || "").toLowerCase().includes("approved")) {
    return "approved";
  }

  const status = String(leave?.status || "").toLowerCase().trim();
  if (status === "pending_hr" || status === "pending_admin") return "approved";
  if (status.includes("approve")) return "approved";
  if (status.includes("reject")) return "rejected";

  return "pending";
};

export const getLeaveDurationPayload = (isHalfDay, halfDayType, totalDays) => {
  const normalizedHalfDayType = normalizeHalfDayType(halfDayType) || "first-half";
  const halfDay = Boolean(isHalfDay);

  return {
    leaveType: halfDay
      ? normalizedHalfDayType === "second-half" ? "half_day_2" : "half_day_1"
      : "full_day",
    isHalfDay: halfDay,
    halfDayType: halfDay ? normalizedHalfDayType : null,
    totalDays: halfDay ? 0.5 : Number(totalDays),
  };
};

export const hasActiveLeaveDateOverlap = (leaves, startDate, endDate = startDate) => {
  const requestedStart = String(startDate || "").slice(0, 10);
  const requestedEnd = String(endDate || startDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedStart) || !/^\d{4}-\d{2}-\d{2}$/.test(requestedEnd)) {
    return false;
  }

  return Array.isArray(leaves) && leaves.some((leave) => {
    const status = String(leave?.status || leave?.approvalStatus || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    if (status !== "approved" && status !== "pending" && !status.startsWith("pending ")) return false;

    const existingStart = String(leave?.startDate || leave?.fromDate || "").slice(0, 10);
    const existingEnd = String(leave?.endDate || leave?.toDate || existingStart).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(existingStart) || !/^\d{4}-\d{2}-\d{2}$/.test(existingEnd)) {
      return false;
    }

    return existingStart <= requestedEnd && existingEnd >= requestedStart;
  });
};
