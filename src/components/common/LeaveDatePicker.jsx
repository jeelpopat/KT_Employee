import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const parseDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const LeaveDatePicker = ({
  value,
  minDate,
  disabledDates,
  onChange,
  disabled = false,
  placeholder = 'Select date',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => (
    parseDate(value) || parseDate(minDate) || new Date()
  ));
  const pickerRef = useRef(null);
  const holidayDateSet = new Set(disabledDates);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const firstDayOffset = (new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  ).getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate();
  const selectedDate = parseDate(value);
  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : placeholder;

  const changeMonth = (amount) => {
    setVisibleMonth((month) => new Date(
      month.getFullYear(),
      month.getMonth() + amount,
      1
    ));
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!isOpen) setVisibleMonth(parseDate(value) || parseDate(minDate) || new Date());
          setIsOpen((open) => !open);
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-left text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className={selectedDate ? '' : 'text-slate-400'}>{displayValue}</span>
        <CalendarDays size={17} className="text-slate-500" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose leave date"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span key={day} className="py-1">{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - firstDayOffset + 1;
              if (day < 1 || day > daysInMonth) {
                return <span key={`empty-${index}`} className="h-8" />;
              }

              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day
              );
              const dateKey = formatDateKey(date);
              const isHoliday = holidayDateSet.has(dateKey);
              const isBeforeMinimum = Boolean(minDate && dateKey < minDate);
              const isSelected = dateKey === value;

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={isHoliday || isBeforeMinimum}
                  title={isHoliday ? 'Company holiday' : undefined}
                  aria-label={isHoliday ? `${day}, company holiday` : dateKey}
                  onClick={() => {
                    onChange(dateKey);
                    setIsOpen(false);
                  }}
                  className={`h-8 rounded-md text-xs transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 font-semibold text-white'
                      : isHoliday
                        ? 'cursor-not-allowed bg-slate-100 text-slate-300 line-through'
                        : isBeforeMinimum
                          ? 'cursor-not-allowed text-slate-300'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Company holidays are unavailable for leave.
          </p>
        </div>
      )}
    </div>
  );
};
