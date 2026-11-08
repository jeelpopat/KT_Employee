import React, { useEffect, useRef, useState } from 'react';
import { LoadingScreen, TableSkeleton } from '../../components/common/Loader.jsx';
import { Loader2, Calendar, Trash2, XCircle, Edit3 } from 'lucide-react';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { invalidateCache } from '../../api/axios.js';
import { expandHolidayDates } from '../../utils/holidayUtils.js';
import { BASE_URL } from '../../api/config';

const API_BASE = `${BASE_URL}/api/holiday`;

const toStandardDateString = (input) => {
  if (!input) return '';
  const str = String(input).trim();
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str.slice(0, 10);
};

const parseHolidayDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2].slice(0, 2), 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const normalizeHoliday = (holiday) => {
  const rawDate = holiday.holidayDate || holiday.date || '';
  const date = toStandardDateString(rawDate);
  const title = holiday.holidayName || holiday.title || holiday.name || 'Holiday';
  return {
    id: holiday._id || holiday.id,
    date,
    title,
    isDefault: holiday.isDefault === true,
  };
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export default function Holidays() {
  const { confirm, confirmationDialog } = useConfirm();
  const [holidays, setHolidays] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState('calendar');
  const [showModal, setShowModal] = useState(false);
  const titleInputRef = useRef(null);

  const fetchHolidays = async () => {
    setLoading(true);
    setError('');

    try {
      let holidaysData = [];

      // 1. Fetch real MongoDB holidays from /current-month (authoritative database collection)
      try {
        const cmRes = await fetch(`${API_BASE}/current-month?_t=${Date.now()}`, {
          headers: getAuthHeaders()
        });
        if (cmRes.ok) {
          const cmData = await cmRes.json();
          const list = Array.isArray(cmData) ? cmData : cmData.holidays || cmData.data || [];
          holidaysData.push(...list);
        }
      } catch (e) {
        console.warn('current-month fetch failed:', e);
      }

      // 2. Also check /all for any custom non-default items
      try {
        const allRes = await fetch(`${API_BASE}/all?_t=${Date.now()}`, {
          headers: getAuthHeaders()
        });
        if (allRes.ok) {
          const allData = await allRes.json();
          const allList = Array.isArray(allData) ? allData : allData.holidays || allData.data || [];
          for (const item of allList) {
            if (item && !item.isDefault && (item._id || item.id)) {
              if (!holidaysData.some(h => (h._id || h.id) === (item._id || item.id))) {
                holidaysData.push(item);
              }
            }
          }
        }
      } catch (e) {
        console.warn('all fetch failed:', e);
      }

      // STRICT DYNAMIC FILTER: Keep only real holidays created and stored in the database
      // Exclude auto-generated weekly offs (isDefault === true)
      const realHolidays = holidaysData.filter((holiday) => {
        if (!holiday) return false;
        if (holiday.isDefault === true) return false;
        const name = (holiday.holidayName || holiday.name || holiday.title || '').trim();
        return Boolean(name && (holiday.holidayDate || holiday.date || holiday.startDate));
      });

      const expandedHolidays = [];
      for (const item of realHolidays) {
        const title = (item.holidayName || item.title || item.name || 'Holiday').trim();
        const startRaw = item.startDate || item.fromDate || item.holidayDate || item.date;
        const endRaw = item.endDate || item.toDate || startRaw;

        const startStr = toStandardDateString(startRaw);
        const endStr = toStandardDateString(endRaw);

        if (startStr && endStr && startStr < endStr) {
          const rangeDates = expandHolidayDates([{ startDate: startStr, endDate: endStr }]);
          for (const rDate of rangeDates) {
            expandedHolidays.push({
              id: item._id || item.id || `${rDate}-${title}`,
              dbId: item._id || item.id,
              date: rDate,
              title,
              isDefault: false,
            });
          }
        } else if (startStr) {
          expandedHolidays.push({
            id: item._id || item.id || `${startStr}-${title}`,
            dbId: item._id || item.id,
            date: startStr,
            title,
            isDefault: false,
          });
        }
      }

      setHolidays(expandedHolidays);
    } catch (fetchError) {
      console.error('Holiday fetch failed', fetchError);
      setError('Unable to load holidays from server. Please try again.');
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const resetForm = (shouldClose = true) => {
    setEditingId(null);
    setStartDate('');
    setEndDate('');
    setTitle('');
    setError('');
    if (shouldClose) setShowModal(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        resetForm();
      }
    };
    if (showModal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const openAddHolidayModal = (selectedDate = '') => {
    resetForm(false);
    if (selectedDate) {
      const selectedDateValue = toStandardDateString(selectedDate);
      setStartDate(selectedDateValue);
      setEndDate(selectedDateValue);
    }
    setShowModal(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);
  };
 
  const handleSubmit = async (e) => { 
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!startDate || !trimmedTitle) {
      setError('Please fill in the date and holiday title.');
      return;
    }

    if (editingId) {
      // DYNAMIC UPDATE: send PUT directly to backend
      setIsSubmitting(true);
      setError('');
      try {
        const payload = {
          holidayName: trimmedTitle,
          holidayDate: startDate,
        };
        const response = await fetch(`${API_BASE}/update/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        const responseData = await response.json();
        if (!response.ok || responseData.success === false) {
          throw new Error(responseData.message || 'Unable to update holiday on server.');
        }

        invalidateCache(/holiday/);
        await fetchHolidays();
        resetForm();
      } catch (submitError) {
        console.error('Holiday update failed', submitError);
        setError(submitError.message || 'Unable to update holiday. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ADD NEW HOLIDAY: single date or date range
    if (!endDate) {
      setError('Please specify an end date.');
      return;
    }
    if (startDate > endDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    const rangeDates = expandHolidayDates([{ startDate, endDate }]);
    const conflictingHoliday = holidays.find((holiday) =>
      rangeDates.includes(holiday.date) &&
      holiday.id !== editingId &&
      holiday.title.toLowerCase() !== trimmedTitle.toLowerCase()
    );
    if (conflictingHoliday) {
      setError(`${conflictingHoliday.date} already has the holiday "${conflictingHoliday.title}".`);
      return;
    }

    const datesToSave = rangeDates.filter((rangeDate) => !holidays.some((holiday) =>
      holiday.date === rangeDate &&
      holiday.title.toLowerCase() === trimmedTitle.toLowerCase()
    ));

    setIsSubmitting(true);
    setError('');
    let savedCount = 0;

    try {
      for (const rangeDate of datesToSave) {
        const payload = {
          holidayName: trimmedTitle,
          holidayDate: rangeDate,
        };

        // Check if a holiday already exists in backend on this date
        const existingOnDate = holidays.find(h => h.date === rangeDate);
        const existingDbId = existingOnDate?.dbId || existingOnDate?.id;

        let response;
        if (existingDbId) {
          // UPDATE existing record to avoid MongoDB E11000 duplicate key error
          response = await fetch(`${API_BASE}/update/${existingDbId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });
        } else {
          response = await fetch(`${API_BASE}/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });
        }

        const responseData = await response.json();
        if (!response.ok || responseData.success === false) {
          const errMsg = responseData.message || '';
          if (errMsg.includes('E11000') || errMsg.includes('duplicate key')) {
            throw new Error(`A holiday record already exists for ${rangeDate}. Please edit or delete the existing record.`);
          }
          throw new Error(errMsg || `Unable to save holiday for ${rangeDate}.`);
        }
        savedCount += 1;
      }
      invalidateCache(/holiday/);
      await fetchHolidays();
      resetForm();
    } catch (submitError) {
      console.error('Holiday save failed', submitError);
      if (savedCount > 0) {
        await fetchHolidays();
        setError(`Saved ${savedCount} holiday date(s), but some failed: ${submitError.message}`);
      } else {
        const rawMsg = submitError.message || '';
        if (rawMsg.includes('E11000') || rawMsg.includes('duplicate key')) {
          setError('A holiday already exists for this date in the system. Please edit the existing holiday.');
        } else {
          setError(rawMsg || 'Unable to save holiday. Please try again.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (holiday) => {
    setEditingId(holiday.dbId || holiday.id);
    const stdDate = toStandardDateString(holiday.date);
    setStartDate(stdDate);
    setEndDate(stdDate);
    setTitle(holiday.title);
    setError('');
    setShowModal(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);
  };

  const handleDelete = async (id) => {
    const holidayToDelete = holidays.find((holiday) => holiday.id === id || holiday.dbId === id);
    if (!holidayToDelete) return;

    const targetDbId = holidayToDelete.dbId || holidayToDelete.id;

    const confirmed = await confirm({
      title: 'Delete holiday?',
      message: `Are you sure you want to delete "${holidayToDelete.title}" on ${holidayToDelete.date}? This holiday will be permanently removed from the system.`,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setError('');

    try {
      const response = await fetch(`${API_BASE}/delete/${targetDbId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Unable to delete holiday');
      }

      invalidateCache(/holiday/);
      await fetchHolidays();
      if (editingId === id) resetForm();
    } catch (deleteError) {
      console.error('Holiday delete failed', deleteError);
      setError(deleteError.message || 'Unable to delete holiday. Please try again.');
    }
  };

  const sortedHolidays = [...holidays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const formatDateKey = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const isHoliday = (dateStr) => {
    return holidays.some((h) => h.date === dateStr);
  };

  const getHolidayTitle = (dateStr) => {
    const holiday = holidays.find((h) => h.date === dateStr);
    return holiday ? holiday.title : '';
  };

  const isSunday = (d) => {
    return d.getDay() === 0;
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const todayStr = formatDateKey(new Date());

    const days = [];
    const totalSlots = 42;

    const prevMonthDate = new Date(year, month, 0);
    const prevMonthDays = prevMonthDate.getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const dateStr = formatDateKey(d);
      days.push({
        day: prevMonthDays - i,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        hasHoliday: isHoliday(dateStr),
        holidayTitle: getHolidayTitle(dateStr),
        isSunday: isSunday(d),
        isSaturday: d.getDay() === 6,
        dateObj: d,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = formatDateKey(d);
      days.push({
        day,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        hasHoliday: isHoliday(dateStr),
        holidayTitle: getHolidayTitle(dateStr),
        isSunday: isSunday(d),
        isSaturday: d.getDay() === 6,
        dateObj: d,
      });
    }

    const remainingDays = totalSlots - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = formatDateKey(d);
      days.push({
        day: i,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        hasHoliday: isHoliday(dateStr),
        holidayTitle: getHolidayTitle(dateStr),
        isSunday: isSunday(d),
        isSaturday: d.getDay() === 6,
        dateObj: d,
      });
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const holidayCount = holidays.filter((holiday) => {
      const [hYear, hMonth] = holiday.date.split('-').map(Number);
      return hYear === year && hMonth === month + 1;
    }).length;

    return (
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 px-3 sm:px-4 py-3 bg-white border-b border-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Holiday Calendar</p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {monthNames[month]} <span className="font-normal text-slate-500">{year}</span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentMonth(new Date(year, month - 1))}
              aria-label="Previous month"
              title="Previous month"
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(year, month + 1))}
              aria-label="Next month"
              title="Next month"
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 bg-white border-b border-slate-300">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="py-1.5 sm:py-2 text-center text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 border-r border-slate-200 last:border-r-0">
              <span className="hidden xs:inline">{day}</span>
              <span className="xs:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 p-1 bg-white">
          {days.map((day, index) => {
            let dayBgClass = 'bg-white';
            if (day.hasHoliday && day.isCurrentMonth) {
              dayBgClass = 'bg-blue-50/40';
            } else if (!day.isCurrentMonth) {
              dayBgClass = 'bg-slate-50';
            }

            let borderClass = 'border-slate-100';
            if (day.isToday) {
              borderClass = 'border-orange-500 border-2 shadow-xs';
            } else if (day.hasHoliday && day.isCurrentMonth) {
              borderClass = 'border-blue-500 border-2 shadow-xs';
            }

            return (
              <div
                key={index}
                role="button"
                tabIndex={day.isCurrentMonth ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    day.isCurrentMonth &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    openAddHolidayModal(day.dateStr);
                  }
                }}
                onClick={() => {
                  if (day.isCurrentMonth) {
                    const holiday = holidays.find(item => item.date === day.dateStr);
                    if (holiday) handleEdit(holiday);
                    else openAddHolidayModal(day.dateStr);
                  }
                }}
                className={`relative min-h-[64px] sm:min-h-[74px] md:min-h-[82px] border ${dayBgClass} ${borderClass} p-1 sm:p-1.5 text-left cursor-pointer hover:bg-slate-100 transition-colors flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center text-[10px] sm:text-xs font-bold ${day.isToday ? 'bg-orange-500 text-white rounded-full shadow-2xs' : day.hasHoliday ? 'bg-blue-600 text-white rounded-full shadow-2xs' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>
                      {day.day}
                    </span>
                    {day.isToday && (
                      <span className="bg-orange-100 px-1.5 py-0.5 text-[8px] font-bold text-orange-700 border border-orange-200 rounded">
                        Today
                      </span>
                    )}
                    {day.hasHoliday && !day.isToday && (
                      <span className="bg-blue-100 text-blue-800 text-[8px] font-bold px-1.5 py-0.5 rounded border border-blue-200 leading-none">
                        Holiday
                      </span>
                    )}
                  </div>

                  {/* Holiday Title (Only show if present in backend DB) */}
                  {day.hasHoliday && day.holidayTitle && (
                    <div className="mt-1">
                      <div
                        className="p-1 sm:p-1.5 rounded-md bg-blue-50/95 border border-blue-200/90 shadow-2xs"
                        title={day.holidayTitle}
                      >
                        <p className="text-[10px] sm:text-[11px] font-bold text-blue-900 leading-tight truncate">
                          {day.holidayTitle}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {day.hasHoliday && day.isCurrentMonth && (
                  <button
                    type="button"
                    aria-label={`Delete ${day.holidayTitle} holiday on ${day.dateStr}`}
                    title={`Delete "${day.holidayTitle}"`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const holiday = holidays.find(item => item.date === day.dateStr);
                      if (holiday) handleDelete(holiday.dbId || holiday.id);
                    }}
                    className="self-end inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/90 border border-rose-200 text-rose-600 hover:bg-rose-50 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 cursor-pointer mt-1"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-white border-t border-slate-300 sm:items-center text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-blue-500 rounded-sm"></div>
            <span className="text-[10px] sm:text-xs font-medium text-slate-600">Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-orange-500 rounded-sm"></div>
            <span className="text-[10px] sm:text-xs font-medium text-slate-600">Today</span>
          </div>
          <div className="ml-auto text-[10px] sm:text-xs font-semibold text-slate-700">
            {holidayCount} holiday{holidayCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {confirmationDialog}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Holiday Calendar
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Manage official holiday schedules and company closure dates
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setView('calendar')}
              className={`h-8 px-3 text-xs sm:text-sm font-medium rounded-md transition-all ${
                view === 'calendar'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setView('list')}
              className={`h-8 px-3 text-xs sm:text-sm font-medium rounded-md transition-all ${
                view === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List View
            </button>
          </div>
          <button
            onClick={() => {
              openAddHolidayModal();
            }}
            className="h-10 px-4 text-xs sm:text-sm font-medium btn-brand-primary text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
          >
            <span>+ Add Holiday</span>
          </button>
        </div>
      </div>

      <div>
        <div className="w-full">
          {loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : view === 'calendar' ? (
            renderCalendar()
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-b border-slate-300">
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  Holiday List ({holidays.length})
                </h2>
              </div>

              {sortedHolidays.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-4xl sm:text-5xl mb-2">🎉</div>
                  <p className="text-slate-400 text-xs sm:text-sm font-medium">No holidays added yet. Add a new holiday!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-[10px] sm:text-xs font-bold uppercase text-slate-600 border-b border-slate-300">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 text-left">Date</th>
                        <th className="px-3 sm:px-4 py-2 text-left">Holiday Name</th>
                        <th className="px-3 sm:px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedHolidays.map((holiday) => {
                        const holidayDate = parseHolidayDate(holiday.date);
                        return (
                          <tr key={holiday.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 sm:px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap text-[11px] sm:text-sm">
                              {holidayDate
                                ? holidayDate.toLocaleDateString('en-US', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : holiday.date || '-'}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5">
                              <span className="inline-flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 font-bold text-xs shrink-0 shadow-2xs">
                                  {holiday.title ? holiday.title.charAt(0).toUpperCase() : 'H'}
                                </div>
                                <span className="text-slate-800 font-semibold text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[260px]">
                                  {holiday.title}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right">
                              <div className="flex justify-end gap-1.5 sm:gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(holiday)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit holiday"
                                >
                                  <Edit3 size={13} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(holiday.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete holiday"
                                >
                                  <Trash2 size={13} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Holiday Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          {/* Backdrop: placed BEHIND modal dialog */}
          <div
            className="fixed inset-0"
            onClick={resetForm}
          />

          {/* Modal Dialog Container: centered, fixed max height, no overflowing */}
          <div
            className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,560px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed & Pinned */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {editingId ? 'Edit Holiday' : 'Add New Holiday'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingId ? 'Update dynamic holiday record in database' : 'Schedule a new official company closure date'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Close holiday dialog"
                title="Close modal"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs modal-scrollbar">
                {error && (
                  <div className="border border-rose-200 bg-rose-50 px-3.5 py-2.5 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                    <span className="shrink-0 text-rose-500 font-bold">!</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        {editingId ? 'Select Date' : 'Start Date'} <span className="text-rose-500">*</span>
                      </label>
                      {startDate && (
                        <span className="text-2xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {parseHolidayDate(startDate)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          const nextStartDate = e.target.value;
                          setStartDate(nextStartDate);
                          if (!endDate || endDate < nextStartDate) setEndDate(nextStartDate);
                        }}
                        className="w-full border border-slate-300 pl-3.5 pr-3 py-2.5 text-xs sm:text-sm rounded-xl bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer shadow-2xs"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        End Date <span className="text-rose-500">*</span>
                      </label>
                    </div>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      disabled={Boolean(editingId)}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer shadow-2xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                      required
                    />
                  </div>
                  <p className="sm:col-span-2 text-2xs text-slate-400">
                    {editingId
                      ? 'Updating the date and name of this holiday.'
                      : 'The holiday title will be applied to every date from start to end, inclusive.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Holiday Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    placeholder="e.g. Diwali, Christmas..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && title.trim()) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    className="w-full border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-white text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* Pinned Action Buttons Footer */}
              <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 btn-brand-primary text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 transition"
                  style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  )}
                  <span>{isSubmitting ? 'Saving...' : editingId ? 'Update Holiday' : 'Save Holiday'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}