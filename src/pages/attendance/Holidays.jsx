import React, { useEffect, useRef, useState } from 'react';
import { useConfirm } from '../../components/common/ConfirmDialog';

const API_BASE = 'https://kt-backend-1.onrender.com/api/holiday';

const normalizeHoliday = (holiday) => {
  let dateStr = holiday.holidayDate || holiday.date || '';
  if (dateStr.length >= 10) {
    dateStr = dateStr.slice(0, 10);
  }
  return {
    id: holiday._id || holiday.id,
    date: dateStr,
    title: holiday.holidayName || holiday.title || holiday.name || '',
  };
};

export default function Holidays() {
  const { confirm, confirmationDialog } = useConfirm();
  const [holidays, setHolidays] = useState([]);
  const [date, setDate] = useState('');
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
      const response = await fetch(`${API_BASE}/all`);
      const data = await response.json();

      let holidaysData = [];
      if (Array.isArray(data)) holidaysData = data;
      else if (Array.isArray(data.holidays)) holidaysData = data.holidays;
      else if (Array.isArray(data.data)) holidaysData = data.data;

      setHolidays(holidaysData.map(normalizeHoliday));
    } catch (fetchError) {
      console.error('Holiday fetch failed', fetchError);
      setError('Unable to load holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const resetForm = (shouldClose = true) => {
    setEditingId(null);
    setDate('');
    setTitle('');
    setError('');
    if (shouldClose) setShowModal(false);
  };

  const openAddHolidayModal = (selectedDate = '') => {
    resetForm(false);
    if (selectedDate) setDate(selectedDate); 
    setShowModal(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };
 
  const handleSubmit = async (e) => { 
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!date || !trimmedTitle) return alert('Please fill in both date and title!');

    setIsSubmitting(true);
    setError('');

    const payload = {
      holidayName: trimmedTitle,
      holidayDate: date,
    };

    try {
      const url = editingId ? `${API_BASE}/update/${editingId}` : `${API_BASE}/create`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'Unable to save holiday');
      }

      const savedHoliday = normalizeHoliday(
        responseData.data || responseData.holiday || responseData || {
          _id: editingId,
          holidayDate: date,
          holidayName: trimmedTitle,
        }
      );

      setHolidays((prevHolidays) => {
        if (editingId) {
          return prevHolidays.map((holiday) =>
            holiday.id === editingId ? savedHoliday : holiday
          );
        }
        return [...prevHolidays, savedHoliday];
      });

      resetForm();
    } catch (submitError) {
      console.error('Holiday save failed', submitError);
      setError('Unable to save holiday. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (holiday) => {
    setEditingId(holiday.id);
    setDate(holiday.date);
    setTitle(holiday.title);
    setShowModal(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete holiday?',
      message: 'Are you sure you want to delete this holiday?',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setError('');

    try {
      const response = await fetch(`${API_BASE}/delete/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Unable to delete holiday');
      }

      setHolidays((prevHolidays) => prevHolidays.filter((holiday) => holiday.id !== id));
      if (editingId === id) resetForm();
    } catch (deleteError) {
      console.error('Holiday delete failed', deleteError);
      setError('Unable to delete holiday. Please try again.');
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

  const getHolidayPhoto = (title) => {
    const value = (title || '').toLowerCase();
    if (value.includes('diwali') || value.includes('deepawali')) {
      return {
        src: 'https://images.unsplash.com/photo-1603404556733-bfa95df083f4?auto=format&fit=crop&w=120&q=80',
        alt: 'Diwali celebration',
      };
    }
    if (value.includes('christmas')) {
      return {
        src: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=120&q=80',
        alt: 'Christmas celebration',
      };
    }
    if (value.includes('new year')) {
      return {
        src: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=120&q=80',
        alt: 'New Year celebration',
      };
    }
    if (value.includes('eid')) {
      return {
        src: 'https://images.unsplash.com/photo-1557787160-3d528682c273?auto=format&fit=crop&w=120&q=80',
        alt: 'Eid celebration',
      };
    }
    if (value.includes('holi')) {
      return {
        src: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=120&q=80',
        alt: 'Holi celebration',
      };
    }
    if (value.includes('ganesh') || value.includes('ganpati')) {
      return {
        src: 'https://images.unsplash.com/photo-1553456558-aff63285bddc?auto=format&fit=crop&w=120&q=80',
        alt: 'Ganesh celebration',
      };
    }
    if (value.includes('navratri') || value.includes('dashami')) {
      return {
        src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=120&q=80',
        alt: 'Navratri celebration',
      };
    }
    if (value.includes('dussehra') || value.includes('ram navami')) {
      return {
        src: 'https://images.unsplash.com/photo-1524525057524-7d7d8f8a6a5f?auto=format&fit=crop&w=120&q=80',
        alt: 'Dussehra celebration',
      };
    }
    if (value.includes('pongal') || value.includes('makar')) {
      return {
        src: 'https://images.unsplash.com/photo-1516105626288-1bd5eea2d682?auto=format&fit=crop&w=120&q=80',
        alt: 'Pongal celebration',
      };
    }
    if (value.includes('valentine')) {
      return {
        src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
        alt: 'Valentine celebration',
      };
    }
    if (value.includes('birthday')) {
      return {
        src: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=120&q=80',
        alt: 'Birthday celebration',
      };
    }
    if (value.includes('anniversary')) {
      return {
        src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
        alt: 'Anniversary celebration',
      };
    }
    return {
      src: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=120&q=80',
      alt: 'Festival celebration',
    };
  };

  const isSecondOrFourthSaturday = (d) => {
    if (d.getDay() !== 6) return false;
    const dateNum = d.getDate();
    return (dateNum >= 8 && dateNum <= 14) || (dateNum >= 22 && dateNum <= 28);
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
        isSecondOrFourthSaturday: isSecondOrFourthSaturday(d),
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
        isSecondOrFourthSaturday: isSecondOrFourthSaturday(d),
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
        isSecondOrFourthSaturday: isSecondOrFourthSaturday(d),
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
      <div className="bg-white border border-slate-300 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">
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
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-md text-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(year, month + 1))}
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-md text-sm transition-colors"
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
            if (day.isCurrentMonth && (day.isSunday || day.isSecondOrFourthSaturday)) {
              dayBgClass = 'bg-slate-100';
            } else if (!day.isCurrentMonth) {
              dayBgClass = 'bg-slate-50';
            }

            let borderClass = 'border-transparent';
            if (day.isToday) {
              borderClass = 'border-orange-500 border-2';
            } else if (day.hasHoliday && day.isCurrentMonth && !day.isSunday && !day.isSecondOrFourthSaturday) {
              borderClass = 'border-blue-500 border-2';
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (day.isCurrentMonth) {
                    openAddHolidayModal(day.dateStr);
                  }
                }}
                className={`min-h-[55px] sm:min-h-[65px] md:min-h-[75px] border ${dayBgClass} ${borderClass} p-1 sm:p-1.5 text-left cursor-pointer hover:bg-slate-100 transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center text-[10px] sm:text-xs font-semibold ${day.isToday ? 'bg-orange-500 text-white rounded-full' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>
                    {day.day}
                  </span>
                  {day.isToday && (
                    <span className="hidden sm:inline-block bg-orange-100 px-1.5 py-0.5 text-[8px] font-semibold text-orange-700 border border-orange-200 rounded">
                      Today
                    </span>
                  )}
                </div>

                <div className="mt-0.5">
                  {day.isCurrentMonth && day.hasHoliday && day.holidayTitle && (
                    <p className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-slate-700 leading-tight truncate">
                      {day.holidayTitle}
                    </p>
                  )}
                  {!day.isCurrentMonth && (
                    <p className="text-[7px] sm:text-[8px] font-semibold text-slate-400">Other</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-white border-t border-slate-300 sm:items-center text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-blue-500 rounded-sm"></div>
            <span className="text-[10px] sm:text-xs font-medium text-slate-600">Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-slate-300 rounded-sm"></div>
            <span className="text-[10px] sm:text-xs font-medium text-slate-600">Sat (2nd/4th)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-slate-400 rounded-sm"></div>
            <span className="text-[10px] sm:text-xs font-medium text-slate-600">Sunday</span>
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

  const HolidayModal = () => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-3 sm:px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-slate-900/75" onClick={resetForm}></div>
          </div>

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

          <div className="inline-block align-bottom bg-white text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full max-w-md border border-slate-300 rounded-lg sm:rounded-xl">
            <div className="bg-white px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  {editingId ? 'Edit Holiday' : 'Add New Holiday'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-3 sm:mb-4 border border-red-300 bg-red-50 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">Select Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 p-2 sm:p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg bg-white text-slate-900 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">Holiday Title</label>
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
                    className="w-full border border-slate-300 p-2 sm:p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg bg-white text-slate-900 transition-all"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sm:pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 sm:py-3 px-4 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 px-4 text-sm rounded-lg disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
                  >
                    {isSubmitting ? 'Saving...' : editingId ? 'Update Holiday' : 'Add Holiday'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {confirmationDialog}
      <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>📅</span> Holiday Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">Manage holiday schedules and office closure dates</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setView('calendar')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg transition-all ${
              view === 'calendar'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="hidden xs:inline">Calendar View</span>
            <span className="xs:hidden">Calendar</span>
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg transition-all ${
              view === 'list'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="hidden xs:inline">List View</span>
            <span className="xs:hidden">List</span>
          </button>
          <button
            onClick={() => {
              openAddHolidayModal();
            }}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border border-slate-300 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all"
          >
            <span className="hidden xs:inline">Add Holiday</span>
            <span className="xs:hidden">+ Add</span>
          </button>
        </div>
      </div>

      <div>
        <div className="w-full">
          {loading ? (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
            </div>
          ) : view === 'calendar' ? (
            renderCalendar()
          ) : (
            <div className="bg-white border border-slate-300 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">
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
                        const [hYear, hMonth, hDay] = holiday.date.split('-').map(Number);
                        const holidayDate = new Date(hYear, hMonth - 1, hDay);
                        const isWeekend = holidayDate.getDay() === 0 || isSecondOrFourthSaturday(holidayDate);
                        return (
                          <tr key={holiday.id} className={`${isWeekend ? 'bg-slate-100' : 'hover:bg-slate-50'} transition-colors`}>
                            <td className="px-3 sm:px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap text-[11px] sm:text-sm">
                              {holiday.date
                                ? holidayDate.toLocaleDateString('en-US', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '-'}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5">
                              <span className="inline-flex items-center gap-2">
                                <img
                                  src={getHolidayPhoto(holiday.title).src}
                                  alt={getHolidayPhoto(holiday.title).alt}
                                  className="h-5 w-5 sm:h-6 sm:w-6 object-cover border border-slate-300 rounded"
                                />
                                <span className="text-slate-700 font-medium text-[11px] sm:text-sm truncate max-w-[100px] sm:max-w-[200px]">
                                  {holiday.title}
                                </span>
                                {isWeekend && (
                                  <span className="hidden xs:inline-block text-[9px] sm:text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 border border-slate-300 rounded">
                                    Weekend
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right">
                              <div className="flex justify-end gap-1.5 sm:gap-2">
                                <button
                                  onClick={() => handleEdit(holiday)}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-[11px] sm:text-sm transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(holiday.id)}
                                  className="text-red-500 hover:text-red-700 font-medium text-[11px] sm:text-sm transition-colors"
                                >
                                  Delete
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

      <HolidayModal />
    </div>
  );
}