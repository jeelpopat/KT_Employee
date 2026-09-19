import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Sparkles, Umbrella, CheckCircle2, Search, Filter,
  Clock, MapPin, Tag, Info, AlertCircle
} from 'lucide-react';
import api from '../../api/axios.js';

export const HolidayCalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [filterType, setFilterType] = useState('all'); // all, festival, public, sunday
  const [searchQuery, setSearchQuery] = useState('');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Curated fallback holidays for 2025-2027 to ensure rich display even if API is empty or slow
  const defaultHolidayList = [
    { name: 'New Year Day', date: `${currentYear}-01-01`, type: 'public', description: 'Celebration of the New Year' },
    { name: 'Makar Sankranti / Pongal', date: `${currentYear}-01-14`, type: 'festival', description: 'Harvest festival celebrated across India' },
    { name: 'Republic Day', date: `${currentYear}-01-26`, type: 'public', description: 'National holiday commemorating the Constitution of India' },
    { name: 'Maha Shivratri', date: `${currentYear}-02-26`, type: 'festival', description: 'Hindu festival celebrated in honor of Lord Shiva' },
    { name: 'Holi', date: `${currentYear}-03-14`, type: 'festival', description: 'Festival of colors, joy and spring arrival' },
    { name: 'Good Friday', date: `${currentYear}-04-03`, type: 'public', description: 'Christian holiday commemorating the crucifixion of Jesus' },
    { name: 'Eid ul-Fitr', date: `${currentYear}-03-31`, type: 'festival', description: 'Islamic festival marking the end of Ramadan' },
    { name: 'Labor Day / May Day', date: `${currentYear}-05-01`, type: 'public', description: 'International Workers Day' },
    { name: 'Bakrid / Eid al-Adha', date: `${currentYear}-06-06`, type: 'festival', description: 'Feast of the Sacrifice' },
    { name: 'Muharram', date: `${currentYear}-07-06`, type: 'festival', description: 'First month of Islamic calendar' },
    { name: 'Independence Day', date: `${currentYear}-08-15`, type: 'public', description: 'National celebration of Indian Independence' },
    { name: 'Rakshabandhan', date: `${currentYear}-08-28`, type: 'festival', description: 'Celebration of sibling bonds' },
    { name: 'Janmashtami', date: `${currentYear}-09-04`, type: 'festival', description: 'Celebration of birth of Lord Krishna' },
    { name: 'Gandhi Jayanti', date: `${currentYear}-10-02`, type: 'public', description: 'Birthday of Mahatma Gandhi' },
    { name: 'Dussehra', date: `${currentYear}-10-20`, type: 'festival', description: 'Victory of good over evil' },
    { name: 'Diwali (Deepavali)', date: `${currentYear}-11-09`, type: 'festival', description: 'Festival of lights celebrated worldwide' },
    { name: 'Bhai Dooj', date: `${currentYear}-11-11`, type: 'festival', description: 'Festival celebrating brother-sister love' },
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
        
        // Map backend objects
        const formattedApi = apiHolidays.map(item => {
          const dateStr = (item.holidayDate || item.date || '').split('T')[0];
          const rawName = item.holidayName || item.name || 'Holiday';
          
          let derivedType = 'public';
          const lowerName = rawName.toLowerCase();
          if (lowerName.includes('sunday')) {
            derivedType = 'sunday';
          } else if (lowerName.includes('saturday')) {
            derivedType = 'saturday';
          } else if (
            lowerName.includes('diwali') || lowerName.includes('holi') ||
            lowerName.includes('raksha') || lowerName.includes('eid') ||
            lowerName.includes('christmas') || lowerName.includes('navratri') ||
            lowerName.includes('dussehra') || lowerName.includes('shivratri') ||
            lowerName.includes('sankranti') || lowerName.includes('pongal')
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
        formattedApi.forEach(apiItem => {
          const exists = combined.some(c => c.date === apiItem.date && c.name.toLowerCase() === apiItem.name.toLowerCase());
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

  // Calendar helpers
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const totalDays = daysInMonth(currentYear, currentMonth);
  const startDay = firstDayOfMonth(currentYear, currentMonth);

  // Month Names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Check event for specific day
  const getEventsForDay = (day) => {
    const paddedMonth = String(currentMonth + 1).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${paddedMonth}-${paddedDay}`;
    const dateObj = new Date(currentYear, currentMonth, day);
    const dayOfWeek = dateObj.getDay();

    const events = [];

    // 1. Is Sunday?
    if (dayOfWeek === 0) {
      events.push({
        name: 'Sunday',
        type: 'sunday',
        description: 'Weekly Off / Non-working day'
      });
    }

    // 2. Is 2nd or 4th Saturday?
    if (dayOfWeek === 6) {
      const saturdayCount = Math.ceil(day / 7);
      if (saturdayCount === 2 || saturdayCount === 4) {
        events.push({
          name: `${saturdayCount === 2 ? '2nd' : '4th'} Saturday Off`,
          type: 'saturday',
          description: 'Company alternate Saturday off'
        });
      }
    }

    // 3. Any festivals or public holidays on this date?
    const matching = holidays.filter(h => h.date === dateStr);
    matching.forEach(m => {
      // Don't duplicate Sunday
      if (m.type !== 'sunday' && m.type !== 'saturday') {
        events.push(m);
      }
    });

    return events;
  };

  // Build grid cells (including empty padding for start of month)
  const calendarDays = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push({ empty: true, key: `empty-${i}` });
  }

  const todayDate = new Date();
  const isTodayCurrentMonth = todayDate.getFullYear() === currentYear && todayDate.getMonth() === currentMonth;

  for (let day = 1; day <= totalDays; day++) {
    const isToday = isTodayCurrentMonth && todayDate.getDate() === day;
    const events = getEventsForDay(day);
    calendarDays.push({
      empty: false,
      day,
      isToday,
      events,
      key: `day-${day}`
    });
  }

  // Filter events for right-hand list or upcoming
  const upcomingHolidays = holidays
    .filter(h => {
      const hDate = new Date(h.date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return hDate >= now;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);

  // Month statistics
  const currentMonthEvents = [];
  for (let d = 1; d <= totalDays; d++) {
    const evs = getEventsForDay(d);
    evs.forEach(e => {
      currentMonthEvents.push({ ...e, day: d });
    });
  }

  const totalSundaysInMonth = currentMonthEvents.filter(e => e.type === 'sunday').length;
  const totalFestivalsInMonth = currentMonthEvents.filter(e => e.type === 'festival').length;
  const totalPublicHolidaysInMonth = currentMonthEvents.filter(e => e.type === 'public').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
              <CalendarIcon size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Holiday & Festival Calendar
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                View upcoming public holidays, cultural festivals, and weekly offs with distinct color markings.
              </p>
            </div>
          </div>
        </div>

        {/* Legend Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-md text-xs font-semibold text-rose-700 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>Sundays</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-md text-xs font-semibold text-purple-700 dark:text-purple-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <span>Festivals</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-md text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Public Holidays</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-md text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span>2nd & 4th Sat</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar on Left (2 cols), Sidebar on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar Body */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors space-y-5">
          
          {/* Calendar Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <button
                onClick={goToToday}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Month Summary Stats Chips */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-md bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-center">
              <span className="block text-xl font-bold text-rose-600 dark:text-rose-400">{totalSundaysInMonth}</span>
              <span className="text-xs text-rose-700/80 dark:text-rose-400/80 font-medium">Sundays</span>
            </div>
            <div className="p-3 rounded-md bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 text-center">
              <span className="block text-xl font-bold text-purple-600 dark:text-purple-400">{totalFestivalsInMonth}</span>
              <span className="text-xs text-purple-700/80 dark:text-purple-400/80 font-medium">Festivals</span>
            </div>
            <div className="p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalPublicHolidaysInMonth}</span>
              <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Public Holidays</span>
            </div>
          </div>

          {/* Calendar Table Grid */}
          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-800/80 text-center py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              {weekDayLabels.map((lbl, idx) => (
                <div
                  key={lbl}
                  className={idx === 0 ? 'text-rose-600 dark:text-rose-400' : ''}
                >
                  {lbl}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {calendarDays.map((item) => {
                if (item.empty) {
                  return (
                    <div
                      key={item.key}
                      className="min-h-[85px] sm:min-h-[105px] p-2 bg-slate-50/40 dark:bg-slate-950/30"
                    />
                  );
                }

                const hasSunday = item.events.some(e => e.type === 'sunday');
                const festival = item.events.find(e => e.type === 'festival');
                const publicHol = item.events.find(e => e.type === 'public');
                const satOff = item.events.find(e => e.type === 'saturday');

                // Day container highlight styles
                let cellBg = 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
                if (festival) {
                  cellBg = 'bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-100/50 dark:hover:bg-purple-900/30';
                } else if (publicHol) {
                  cellBg = 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30';
                } else if (hasSunday) {
                  cellBg = 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-900/30';
                } else if (satOff) {
                  cellBg = 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-900/30';
                }

                return (
                  <div
                    key={item.key}
                    onClick={() => setSelectedDayEvents({ day: item.day, month: monthNames[currentMonth], year: currentYear, events: item.events })}
                    className={`min-h-[85px] sm:min-h-[105px] p-2 flex flex-col justify-between transition-colors cursor-pointer ${cellBg}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold rounded-full w-6 h-6 flex items-center justify-center ${
                          item.isToday
                            ? 'bg-blue-600 text-white shadow-xs'
                            : hasSunday
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.day}
                      </span>

                      {item.isToday && (
                        <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1 py-0.5 rounded">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Event Badges inside calendar cell */}
                    <div className="space-y-1 mt-1">
                      {hasSunday && !festival && !publicHol && (
                        <div className="text-[10px] truncate font-medium text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-900/40 px-1.5 py-0.5 rounded">
                          Sunday Off
                        </div>
                      )}

                      {satOff && !festival && !publicHol && (
                        <div className="text-[10px] truncate font-medium text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                          {satOff.name}
                        </div>
                      )}

                      {festival && (
                        <div
                          className="text-[10px] truncate font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 shadow-2xs"
                          title={festival.name}
                        >
                          🎉 {festival.name}
                        </div>
                      )}

                      {publicHol && (
                        <div
                          className="text-[10px] truncate font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                          title={publicHol.name}
                        >
                          🏛️ {publicHol.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Holidays & Day Detail Modal/Card */}
        <div className="space-y-6">
          
          {/* Day Detail Card if selected */}
          {selectedDayEvents && (
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-lg p-5 shadow-sm transition-all space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
                  Selected Date
                </span>
                <button
                  onClick={() => setSelectedDayEvents(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedDayEvents.day} {selectedDayEvents.month} {selectedDayEvents.year}
              </h4>

              {selectedDayEvents.events.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Standard working day. No company holidays or festivals marked.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.events.map((evt, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-md text-xs space-y-1 ${
                        evt.type === 'festival'
                          ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                          : evt.type === 'public'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : evt.type === 'sunday'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                          : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-sm">
                        {evt.type === 'festival' ? '🎉' : evt.type === 'public' ? '🏛️' : '☀️'}
                        {evt.name}
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {evt.description || 'Official holiday scheduled for all team members.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming Holidays List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" /> Upcoming Festivals & Holidays
              </h3>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono">
                {currentYear}
              </span>
            </div>

            <div className="space-y-3">
              {upcomingHolidays.map((h, i) => {
                const dateObj = new Date(h.date);
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short'
                });

                const isFestival = h.type === 'festival';

                return (
                  <div
                    key={i}
                    className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          isFestival ? 'bg-purple-500' : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {h.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <CalendarIcon size={12} /> {formattedDate}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                        isFestival
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {h.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Company Policy Notice */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <Info size={14} className="text-blue-500" /> Holiday Policy Guidelines
            </div>
            <p className="leading-relaxed">
              Public holidays & festivals apply to all Kevalon locations (Ahmedabad / Remote).
              If a holiday falls on a weekend, alternate compensation is handled as per HR guidelines.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
