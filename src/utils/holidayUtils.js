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

  const dateSet = new Set();
  holidays.forEach((holiday) => {
    const start = normalizeDate(
      holiday.startDate || holiday.fromDate || holiday.holidayDate || holiday.date
    );
    const end = normalizeDate(holiday.endDate || holiday.toDate || start);
    if (!start || !end || start > end) return;

    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const last = Date.UTC(endYear, endMonth - 1, endDay);

    while (current.getTime() <= last) {
      dateSet.add(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  });

  return Array.from(dateSet).sort();
};

export const isWeeklyOffSunday = (value) => {
  const norm = normalizeDate(value);
  if (!norm) return false;
  const d = new Date(`${norm}T00:00:00`);
  return d.getDay() === 0;
};

export const isWorkingDay = (dateValue, holidayDates = []) => {
  const norm = normalizeDate(dateValue);
  if (!norm) return false;
  const d = new Date(`${norm}T00:00:00`);
  if (d.getDay() === 0) return false; // Sunday is weekly off
  // All Saturdays are regular working days unless explicitly in holiday list
  const holidayList = Array.isArray(holidayDates) ? holidayDates : [];
  const normalizedHolidayStrings = holidayList.map((h) =>
    typeof h === 'string'
      ? normalizeDate(h)
      : normalizeDate(h?.startDate || h?.fromDate || h?.holidayDate || h?.date)
  );
  const holidaysSet = new Set(normalizedHolidayStrings.filter(Boolean));
  return !holidaysSet.has(norm);
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
