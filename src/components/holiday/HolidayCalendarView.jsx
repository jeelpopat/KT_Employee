import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles, Calendar as CalendarIcon, Info } from 'lucide-react';
import api from '../../api/axios.js';

export const HolidayCalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Curated official holidays for 2025-2027
  const defaultHolidayList = [
    { name: 'New Year Day', date: `${currentYear}-01-01`, type: 'public', description: 'Celebration of the New Year' },
    { name: 'Makar Sankranti', date: `${currentYear}-01-14`, type: 'festival', description: 'Harvest festival celebrated across India' },
    { name: 'Republic Day', date: `${currentYear}-01-26`, type: 'public', description: 'National holiday commemorating the Constitution of India' },
    { name: 'Maha Shivratri', date: `${currentYear}-02-15`, type: 'festival', description: 'Hindu festival celebrated in honor of Lord Shiva' },
    { name: 'Holi', date: `${currentYear}-03-04`, type: 'festival', description: 'Festival of colors, joy and spring arrival' },
    { name: 'Eid ul-Fitr', date: `${currentYear}-03-20`, type: 'festival', description: 'Islamic festival marking the end of Ramadan' },
    { name: 'Good Friday', date: `${currentYear}-04-03`, type: 'public', description: 'Christian holiday commemorating the crucifixion of Jesus' },
    { name: 'Labor Day', date: `${currentYear}-05-01`, type: 'public', description: 'International Workers Day' },
    { name: 'Bakrid / Eid al-Adha', date: `${currentYear}-05-27`, type: 'festival', description: 'Feast of the Sacrifice' },
    { name: 'Muharram', date: `${currentYear}-06-26`, type: 'festival', description: 'First month of Islamic calendar' },
    { name: 'Independence Day', date: `${currentYear}-08-15`, type: 'public', description: 'National celebration of Indian Independence' },
    { name: 'Rakshabandhan', date: `${currentYear}-08-28`, type: 'festival', description: 'Celebration of sibling bonds' },
    { name: 'visarjan', date: `${currentYear}-09-25`, type: 'festival', description: 'Ganesh Visarjan / Anant Chaturdashi' },
    { name: 'Gandhi Jayanti', date: `${currentYear}-10-02`, type: 'public', description: 'Birthday of Mahatma Gandhi' },
    { name: 'Dussehra', date: `${currentYear}-10-20`, type: 'festival', description: 'Victory of good over evil' },
    { name: 'Diwali', date: `${currentYear}-11-08`, type: 'festival', description: 'Festival of lights celebrated worldwide' },
    { name: 'Bhai Dooj', date: `${currentYear}-11-10`, type: 'festival', description: 'Festival celebrating brother-sister love' },
    { name: 'Guru Nanak Jayanti', date: `${currentYear}-11-24`, type: 'festival', description: 'Birth anniversary of Guru Nanak Dev Ji' },
    { name: 'Christmas Day', date: `${currentYear}-12-25`, type: 'festival', description: 'Celebration of the birth of Jesus Christ' }
  ];

  // Fetch holidays from backend API and combine with defaults
  useEffect(() => {
    const fetchHolidays = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/api/holiday/all?year=${currentYear}`);
        const apiHolidays = res.data?.holidays || res.data?.data || [];

        const formattedApi = apiHolidays.map((item) => {
          const dateStr = (item.holidayDate || item.date || '').split('T')[0];
          const rawName = item.holidayName || item.name || 'Holiday';

          let derivedType = 'public';
          const lowerName = rawName.toLowerCase();
          if (lowerName.includes('sunday')) {
            derivedType = 'sunday';
          } else if (lowerName.includes('saturday')) {
            derivedType = 'saturday';
          } else if (
            lowerName.includes('diwali') ||
            lowerName.includes('holi') ||
            lowerName.includes('raksha') ||
            lowerName.includes('eid') ||
            lowerName.includes('christmas') ||
            lowerName.includes('navratri') ||
            lowerName.includes('dussehra') ||
            lowerName.includes('visarjan') ||
            lowerName.includes('ganesh') ||
            lowerName.includes('sankranti')
          ) {
            derivedType = 'festival';
          } else {
            derivedType = 'public';
          }

          return {
            id: item._id || `${dateStr}-${rawName}`,
            name: rawName,
            date: dateStr,
            type: derivedType,
            description: item.description || (derivedType === 'festival' ? 'Festival Celebration' : 'Public Holiday'),
            isBackend: true
          };
        });

        // Merge: avoid duplicating same date and name
        const combined = [...defaultHolidayList];
        formattedApi.forEach((apiItem) => {
          const exists = combined.some(
            (c) => c.date === apiItem.date && c.name.toLowerCase() === apiItem.name.toLowerCase()
          );
          if (!exists) {
            combined.push(apiItem);
          }
        });

        setHolidays(combined);
      } catch (err) {
        console.warn('Using default holiday database due to network/api response:', err);
        setHolidays(defaultHolidayList);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHolidays();
  }, [currentYear]);

  // Calendar Helpers (MON to SUN)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Math for 42 grid cells (6 rows x 7 cols) starting on Monday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
  // Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6
  const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = rawFirstDay === 0 ? 6 : rawFirstDay - 1;

  const today = new Date();
  const isCurrentMonthActive = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  // Build 42 grid cells
  const gridCells = [];

  // 1. Previous month overflow days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i;
    gridCells.push({
      day: dayNumber,
      isOverflow: true,
      overflowType: 'prev',
      key: `prev-${dayNumber}`
    });
  }

  // 2. Current month days
  let holidaysInCurrentMonthCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(currentYear, currentMonth, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
    const isSunday = dayOfWeek === 0;

    const saturdayIndex = dayOfWeek === 6 ? Math.ceil(day / 7) : 0;
    const is2ndOr4thSaturday = dayOfWeek === 6 && (saturdayIndex === 2 || saturdayIndex === 4);
    const isToday = isCurrentMonthActive && today.getDate() === day;

    const paddedM = String(currentMonth + 1).padStart(2, '0');
    const paddedD = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${paddedM}-${paddedD}`;

    const matchingHolidays = holidays.filter(
      (h) => h.date === dateStr && h.type !== 'sunday' && h.type !== 'saturday'
    );

    const hasHoliday = matchingHolidays.length > 0;
    const festival = matchingHolidays.find((h) => h.type === 'festival');
    const publicHol = matchingHolidays.find((h) => h.type === 'public');

    // Count this day towards total holidays if it's Sunday, 2nd/4th Sat, or has a festival/holiday
    if (isSunday || is2ndOr4thSaturday || hasHoliday) {
      holidaysInCurrentMonthCount++;
    }

    gridCells.push({
      day,
      dateStr,
      isOverflow: false,
      isToday,
      isSunday,
      is2ndOr4thSaturday,
      saturdayIndex,
      festival,
      publicHol,
      holidays: matchingHolidays,
      key: `day-${day}`
    });
  }

  // 3. Next month overflow days (fill up to exact 42 cells = 6 rows)
  const remainingCells = 42 - gridCells.length;
  for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
    gridCells.push({
      day: nextDay,
      isOverflow: true,
      overflowType: 'next',
      key: `next-${nextDay}`
    });
  }

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      {/* Main Single Calendar Card Matching KT-admin Design */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-colors">
        
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              HOLIDAYS & EVENTS
            </span>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>

          {/* Navigation Chevron Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              title="Previous Month"
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <button
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              title="Next Month"
            >
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Weekday Header Row (Mon to Sun: M T W T F S S) */}
        <div className="grid grid-cols-7 border-t border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayChar, idx) => (
            <div
              key={idx}
              className="py-2 text-center text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 select-none tracking-wide"
            >
              {dayChar}
            </div>
          ))}
        </div>

        {/* 7x6 Grid (42 Cells) */}
        <div className="grid grid-cols-7">
          {gridCells.map((cell, idx) => {
            const colIndex = idx % 7;
            const isLastCol = colIndex === 6;

            // Dividers
            const borderClasses = `${!isLastCol ? 'border-r' : ''} border-b border-slate-100 dark:border-slate-800/80`;
            const cellHeight = 'min-h-[58px] sm:min-h-[68px]';

            // Case 1: Overflow Day (Prev / Next Month)
            if (cell.isOverflow) {
              return (
                <div
                  key={cell.key}
                  className={`${cellHeight} p-1.5 sm:p-2 flex flex-col justify-between select-none ${borderClasses} bg-slate-50/40 dark:bg-slate-950/20`}
                >
                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {cell.day}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight">
                    Other
                  </div>
                </div>
              );
            }

            // Case 2: Today (Current Day)
            if (cell.isToday) {
              return (
                <div
                  key={cell.key}
                  onClick={() => setSelectedDayInfo(cell)}
                  className={`${cellHeight} p-1 sm:p-1.5 flex flex-col justify-between cursor-pointer select-none ${borderClasses} bg-white dark:bg-slate-900 relative`}
                >
                  {/* Crisp Orange Box Border as shown in screenshot */}
                  <div className="w-full h-full border-2 border-orange-500 rounded-md p-1 sm:p-1.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs">
                        {cell.day}
                      </span>
                      <span className="bg-orange-100/90 dark:bg-orange-950/60 text-orange-600 dark:text-orange-300 text-[9px] font-semibold px-1.5 py-0.2 rounded border border-orange-200/60 dark:border-orange-800/60 leading-normal">
                        Today
                      </span>
                    </div>

                    {/* Holiday/Festival text or blank */}
                    <div className="text-[10px] sm:text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5 leading-tight">
                      {cell.festival?.name || cell.publicHol?.name || (cell.isSunday ? 'Sunday' : '')}
                    </div>
                  </div>
                </div>
              );
            }

            // Case 3: Sunday or 2nd/4th Saturday (Gray Background)
            if (cell.isSunday || cell.is2ndOr4thSaturday) {
              const labelText = cell.isSunday
                ? 'Sunday'
                : cell.saturdayIndex === 2
                ? '2nd Saturday'
                : '4th Saturday';

              return (
                <div
                  key={cell.key}
                  onClick={() => setSelectedDayInfo(cell)}
                  className={`${cellHeight} p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer select-none ${borderClasses} bg-[#f0f4f9] dark:bg-slate-800/50 hover:bg-[#e8eef6] dark:hover:bg-slate-800 transition-colors`}
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {cell.day}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate leading-tight">
                    {cell.festival?.name || cell.publicHol?.name || labelText}
                  </div>
                </div>
              );
            }

            // Case 4: Festival on working day (Indigo border as requested)
            if (cell.festival) {
              return (
                <div
                  key={cell.key}
                  onClick={() => setSelectedDayInfo(cell)}
                  className={`${cellHeight} p-1 sm:p-1.5 flex flex-col justify-between cursor-pointer select-none ${borderClasses} bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/30 transition-colors relative`}
                >
                  <div className="w-full h-full border-2 border-indigo-500 rounded-md p-1 sm:p-1.5 flex flex-col justify-between">
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {cell.day}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 truncate leading-tight">
                      {cell.festival.name}
                    </div>
                  </div>
                </div>
              );
            }

            // Case 5: Public Holiday on working day
            if (cell.publicHol) {
              return (
                <div
                  key={cell.key}
                  onClick={() => setSelectedDayInfo(cell)}
                  className={`${cellHeight} p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer select-none ${borderClasses} bg-[#f0f4f9] dark:bg-slate-800/40 hover:bg-[#e8eef6] dark:hover:bg-slate-800 transition-colors`}
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {cell.day}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-indigo-600 dark:text-indigo-400 font-medium truncate leading-tight">
                    {cell.publicHol.name}
                  </div>
                </div>
              );
            }

            // Case 6: Regular Working Day (e.g. 1st Sat, 3rd Sat, Weekdays)
            return (
              <div
                key={cell.key}
                onClick={() => setSelectedDayInfo(cell)}
                className={`${cellHeight} p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer select-none ${borderClasses} bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors`}
              >
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {cell.day}
                </div>
                <div></div>
              </div>
            );
          })}
        </div>

        {/* Card Footer Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          {/* Left: Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Holiday (Blue) */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#2563eb] inline-block shadow-2xs" />
              <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                Holiday
              </span>
            </div>

            {/* Sat (2nd/4th) */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#dbeafe] dark:bg-slate-700 inline-block border border-slate-200 dark:border-slate-600" />
              <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                Sat (2nd/4th)
              </span>
            </div>

            {/* Sunday */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#94a3b8] dark:bg-slate-600 inline-block" />
              <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                Sunday
              </span>
            </div>

            {/* Today */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#f97316] inline-block shadow-2xs" />
              <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                Today
              </span>
            </div>
          </div>

          {/* Right: Total Holidays Count */}
          <div className="text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200">
            {holidaysInCurrentMonthCount} holidays
          </div>
        </div>

      </div>

      {/* Selected Day Details Modal */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-6 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {selectedDayInfo.day} {monthNames[currentMonth]} {currentYear}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayInfo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {selectedDayInfo.isToday && (
                <div className="flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 p-2.5 rounded-xl border border-orange-200 dark:border-orange-900">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Today's Date</span>
                </div>
              )}

              {selectedDayInfo.isSunday && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Sunday Weekly Off</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Regular non-working company weekend.</p>
                </div>
              )}

              {selectedDayInfo.is2ndOr4thSaturday && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedDayInfo.saturdayIndex === 2 ? '2nd Saturday Off' : '4th Saturday Off'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Company alternate Saturday scheduled holiday.</p>
                </div>
              )}

              {selectedDayInfo.holidays?.map((h, i) => (
                <div key={i} className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 text-xs space-y-1 border border-indigo-100 dark:border-indigo-900">
                  <p className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span>{h.name}</span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    {h.description || 'Official company holiday / festival celebration.'}
                  </p>
                </div>
              ))}

              {!selectedDayInfo.isSunday && !selectedDayInfo.is2ndOr4thSaturday && (!selectedDayInfo.holidays || selectedDayInfo.holidays.length === 0) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400">
                  Regular working day. No company holidays or off-days scheduled.
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedDayInfo(null)}
                className="w-full py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
