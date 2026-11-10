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
