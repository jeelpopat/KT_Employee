import React, { useState, useEffect } from 'react';
import {
  Clock, Calendar, Search, RotateCcw,
  CheckCircle2, AlertTriangle, PlayCircle, StopCircle, Coffee, Loader2, MapPin
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';
import {
  computeNineHourTimeline,
  isTodayDate,
  formatMinutesToTimeStr,
  convertUTCMinutesToLocal
} from '../../utils/timelineUtils.js';

export const AttendanceView = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalWorkingHours: 0,
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    averageWorkingHours: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const [activeFilterTab, setActiveFilterTab] = useState('10days');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedMonthStr, setSelectedMonthStr] = useState('');

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    setSelectedMonthStr(`${y}-${m}`);
  }, []);

  const fetchAttendance = async () => {
    setIsLoading(true);

    try {
      let endpoint = `/api/employee-panel/attendance/timeline`;

      if (activeFilterTab === 'month' && selectedMonthStr) {
        const [year, month] = selectedMonthStr.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        endpoint += `?startDate=${startDate}&endDate=${endDate}`;
      } else if (activeFilterTab === 'month') {
        endpoint += `?filter=thisMonth`;
      } else if (activeFilterTab === '10days') {
        endpoint += `?filter=last10days`;
      } else if (activeFilterTab === '7days') {
        endpoint += `?filter=last7days`;
      } else if (activeFilterTab === 'today') {
        endpoint += `?filter=today`;
      }

      const response = await api.get(endpoint);
      const data = response.data?.data || [];
      const summary = response.data?.summary || {};

      if (summary) {
        setSummaryStats({
          totalWorkingHours: summary.totalWorkingHours || 0,
          presentDays: summary.presentDays || 0,
          absentDays: summary.absentDays || 0,
          halfDays: summary.halfDays || 0,
          averageWorkingHours: summary.averageWorkingHours || 0
        });
      }

      const sortedRecords = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendanceRecords(sortedRecords);

    } catch (error) {
      console.error("Failed to fetch timeline attendance:", error);
      setAttendanceRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [activeFilterTab, selectedMonthStr]);

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesSearch = (record.date || '').includes(searchQuery);
    const matchesStatus = selectedStatusFilter === 'all' || (record.status || '').toLowerCase() === selectedStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const formatISOToLocalTime = (isoStr) => {
    if (!isoStr) return '--:--';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Convert UTC minutes from backend to local time minutes from midnight
  const convertUTCMinutesToLocal = (utcMinutes) => {
    const d = new Date();
    d.setUTCHours(Math.floor(utcMinutes / 60), utcMinutes % 60, 0, 0);
    return d.getHours() * 60 + d.getMinutes();
  };

  const formatMinutesToTimeStr = (totalMinutes) => {
    const d = new Date();
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getDayName = (dateString) => {
    if (!dateString) return 'Unknown Day';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getMonthDate = (dateString) => {
    if (!dateString) return { day: '--', month: '---' };
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { day: '--', month: '---' };
    return {
      day: date.toLocaleDateString('en-US', { day: '2-digit' }),
      month: date.toLocaleDateString('en-US', { month: 'short' })
    };
  };

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Hours', value: `${summaryStats.totalWorkingHours.toFixed(1)}h`, accent: 'border-l-blue-500' },
          { label: 'Present Days', value: summaryStats.presentDays, accent: 'border-l-green-500' },
          { label: 'Absent Days', value: summaryStats.absentDays, accent: 'border-l-red-500' },
          { label: 'Half Days', value: summaryStats.halfDays, accent: 'border-l-purple-500' },
          // { label: 'Avg per day', value: `${summaryStats.averageWorkingHours.toFixed(1)}h`, accent: 'border-l-indigo-500' }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm`}>
              <div>
                <div className="flex justify-between">
                  <p className="text-2xs  font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
                  <p className="px-2 items-end text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
                </div>
                {/* <Icon size={18} className="text-slate-400 dark:text-slate-500" /> */}
              </div>
              {/* <p className="text-xs mt-2 text-slate-400 dark:text-slate-500">{item.note}</p> */}
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors shadow-sm">

        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '10days', label: 'Last 10 Days' },
            { id: 'month', label: 'Monthly View' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id)}
              className={`px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${activeFilterTab === tab.id
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">

          {activeFilterTab === 'month' && (
            <div>
              <label htmlFor="monthPicker" className="sr-only">Select Month</label>
              <input
                id="monthPicker"
                name="monthPicker"
                type="month"
                value={selectedMonthStr}
                onChange={(e) => setSelectedMonthStr(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
              />
            </div>
          )}

          <div className="relative flex-1 sm:w-48">
            <label htmlFor="searchDate" className="sr-only">Search by Date</label>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="searchDate"
              name="searchDate"
              type="text"
              placeholder="Search date..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="statusFilter" className="sr-only">Filter by Status</label>
            <select
              id="statusFilter"
              name="statusFilter"
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present / On Time</option>
              <option value="late">Late</option>
              <option value="half day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <button
            onClick={() => { setActiveFilterTab('10days'); setSearchQuery(''); setSelectedStatusFilter('all'); }}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md transition-colors cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {isLoading ? (
          <div className="xl:col-span-2 flex flex-col items-center justify-center p-16 space-y-4">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium text-slate-500">Loading attendance history...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="xl:col-span-2 flex flex-col items-center justify-center p-16 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm">
            <Calendar size={48} className="text-slate-300 dark:text-slate-700" />
            <span className="text-sm font-medium text-slate-500">No attendance records found for this criteria.</span>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const dateObj = getMonthDate(record.date);
            const statusLabel = (record.status || 'unknown').toLowerCase();
            const isToday = isTodayDate(record.date) || isTodayDate(record.checkInTime);

            // Fixed 9-Hour Timeline Computation
            const nineHourTimeline = computeNineHourTimeline({
              checkInTime: record.checkInTime,
              checkOutTime: record.checkOutTime,
              timelineSegments: record.timelineSegments || [],
              breaks: record.breaks || [],
              isOnBreak: record.isOnBreak || statusLabel === 'on_break',
              isCheckedIn: Boolean(record.checkInTime || record.status),
              isCheckedOut: Boolean(record.checkOutTime && record.checkOutTime !== '--:--' && record.checkOutTime !== 'null')
            });

            return (
              <div key={record._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col transition-colors shadow-sm hover:shadow-md">

                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-none">{dateObj.day}</span>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase mt-1">{dateObj.month}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {getDayName(record.date)}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium font-mono">
                        <MapPin size={12} className="text-slate-400" /> Verified Geofence
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {isToday ? (
                      record.checkOutTime && record.checkOutTime !== '--:--' && record.checkOutTime !== 'null' ? (
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider">
                          Checked Out
                        </span>
                      ) : record.isOnBreak || statusLabel === 'on_break' ? (
                        <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-[#F59E0B] border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse"></span>
                          Break In
                        </span>
                      ) : record.checkInTime ? (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[#00E676] border border-[#00E676]/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse"></span>
                          Check In
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-500 border border-slate-200 dark:border-slate-700 text-[10px] font-medium uppercase tracking-wider">
                          Not Checked In
                        </span>
                      )
                    ) : (
                      <>
                        {statusLabel === 'present' && (
                          <span className="px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 text-[10px] font-bold uppercase tracking-wider">Present</span>
                        )}
                        {statusLabel === 'late' && (
                          <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold uppercase tracking-wider">Late</span>
                        )}
                        {statusLabel.includes('half day') && (
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 text-[10px] font-bold uppercase tracking-wider">Half Day</span>
                        )}
                        {statusLabel === 'absent' && (
                          <span className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 text-[10px] font-bold uppercase tracking-wider">Absent</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1 mb-1"><PlayCircle size={10} className="text-green-500" /> In</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatISOToLocalTime(record.checkInTime)}</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1 mb-1"><StopCircle size={10} className="text-red-500" /> Out</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatISOToLocalTime(record.checkOutTime)}</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1 mb-1"><Coffee size={10} className="text-amber-500" /> Break</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{record.totalBreakTime || 0}m</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-3">
                    <span className="text-[10px] font-semibold text-blue-500 uppercase mb-1">Work</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{record.totalWorkTime || 0}h</span>
                  </div>
                </div>

                {/* --- 9-Hour Fixed Shift Timeline --- */}
                <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-2">

                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                        Work
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                        Break
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                        Extra Break
                      </span>
                    </div>
                  </div>

                  {/* Fixed 9-Hour Track (Grey Base for Early Out / Remaining Time) */}
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex relative group cursor-help shadow-inner">
                    {nineHourTimeline.displaySegments.map((seg) => (
                      <div
                        key={seg.id}
                        title={seg.label}
                        style={{ left: `${seg.leftPercent}%`, width: `${seg.widthPercent}%` }}
                        className={`absolute top-0 bottom-0 h-full ${seg.colorClass} hover:brightness-110 transition-all border-r border-white/20`}
                      />
                    ))}
                  </div>

                  {/* Status Transition Markers Below Timeline (Check In, Break In, Extra Break, Break Out, Check Out, 9h End) */}
                  <div className="mt-2.5">
                    {/* Positioned Marker Ticks & Timestamps Along Timeline */}
                    <div className="relative w-full h-4">
                      {(nineHourTimeline.statusMarkers || []).map((marker) => {
                        let alignClass = '-translate-x-1/2';
                        if (marker.percent <= 3) alignClass = 'translate-x-0';
                        else if (marker.percent >= 97) alignClass = '-translate-x-full';

                        return (
                          <div
                            key={`tick-${marker.id}`}
                            style={{ left: `${marker.percent}%` }}
                            className={`absolute top-0 flex flex-col items-center ${alignClass} transition-all pointer-events-auto group cursor-help`}
                            title={`${marker.label}: ${marker.timeStr}`}
                          >
                            <div className={`w-0.5 h-1.5 rounded-full ${marker.dotClass} mb-0.5`} />
                            <span className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300 leading-none">
                              {marker.timeStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};