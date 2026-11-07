const normalizeDate = (value) => {
  if (!value) return '';
  const date = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const expandHolidayDates = (holidays) => {
  if (!Array.isArray(holidays)) return [];

  return holidays.flatMap((holiday) => {
    const start = normalizeDate(
      holiday.startDate || holiday.fromDate || holiday.holidayDate || holiday.date
    );
    const end = normalizeDate(holiday.endDate || holiday.toDate || start);
    if (!start || !end || start > end) return [];

    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const last = Date.UTC(endYear, endMonth - 1, endDay);
    const dates = [];

    while (current.getTime() <= last) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  });
};

export const calculateLeaveDays = (startValue, endValue, holidays = [], isHalfDay = false) => {
  const start = normalizeDate(startValue);
  const end = normalizeDate(endValue || startValue);
  if (!start || !end || start > end) return 0;

  const holidayDates = new Set(holidays);
  if (isHalfDay) return holidayDates.has(start) ? 0 : 0.5;

  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const last = Date.UTC(endYear, endMonth - 1, endDay);
  let totalDays = 0;

  while (current.getTime() <= last) {
    const date = current.toISOString().slice(0, 10);
    if (current.getUTCDay() !== 0 && !holidayDates.has(date)) totalDays += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return totalDays;
};
