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
  convertUTCMinutesToLocal,
  formatISOToLocalTime,
  normalizeAttendanceRecord,
  deriveAttendanceStatus
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

    // Purge any stale rejection overrides from localStorage so real server data is always loaded
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('kt_attendance_rejected_') || key.startsWith('kt_rejection_reason_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }, []);

  const fetchAttendance = async () => {
    setIsLoading(true);

    try {
      let endpoint = `/api/employee-panel/attendance/timeline`;

      if (activeFilterTab === 'month' && selectedMonthStr) {
        const [year, month] = selectedMonthStr.split('-');
        const startDate = `${year}-${month}-01`;
        const endD = new Date(Number(year), Number(month), 0);
        const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
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

      // Fetch timeline records and authoritative today's attendance simultaneously
      const [tlResponse, todayResponse] = await Promise.allSettled([
        api.get(endpoint, { skipCache: true }),
        api.get('/api/attendance/today', { skipCache: true })
      ]);

      let data = [];
      let summary = {};
      if (tlResponse.status === 'fulfilled') {
        data = tlResponse.value.data?.data || [];
        summary = tlResponse.value.data?.summary || {};
      }

      let todayDoc = null;
      if (todayResponse.status === 'fulfilled') {
        const tData = todayResponse.value.data?.attendance || todayResponse.value.data?.data?.attendance || todayResponse.value.data?.data || todayResponse.value.data;
        if (tData && (tData.checkInTime || tData.status || tData.approvalStatus || tData.adminStatus || tData._id)) {
          todayDoc = tData;
        }
      }

      const today = new Date();
      const todayLocalStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayStr = todayLocalStr;

      // Purge any stale rejection flags from localStorage
      localStorage.removeItem('kt_attendance_rejected_' + todayStr);
      localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
      localStorage.removeItem('kt_rejection_reason_' + todayStr);
      localStorage.removeItem('kt_rejection_reason_' + todayLocalStr);

      const todayStatusLower = String(todayDoc?.status || '').toLowerCase();
      const todayApprvLower = String(todayDoc?.approvalStatus || '').toLowerCase();
      const todayAdminLower = String(todayDoc?.adminStatus || '').toLowerCase();

      // Only reject if authoritative server record explicitly states rejection
      const isTodayRejected = Boolean(
        todayDoc?.isRejected === true ||
        todayStatusLower === 'rejected' ||
        todayStatusLower.includes('reject') ||
        todayApprvLower === 'rejected' ||
        todayApprvLower.includes('reject') ||
        todayAdminLower === 'rejected' ||
        todayAdminLower.includes('reject')
      );

      // Merge authoritative today's state into attendance records
      let todayFound = false;
      const mergedRecords = data.map((record) => {
        const isRecToday = isTodayDate(record.date) || isTodayDate(record.checkInTime);
        if (isRecToday) {
          todayFound = true;
          const statusLower = String(record.status || todayDoc?.status || '').toLowerCase();
          const apprvLower = String(record.approvalStatus || todayDoc?.approvalStatus || '').toLowerCase();
          const adminLower = String(record.adminStatus || todayDoc?.adminStatus || '').toLowerCase();

          const isRej = Boolean(
            isTodayRejected ||
            record.isRejected === true ||
            statusLower === 'rejected' ||
            statusLower.includes('reject') ||
            apprvLower === 'rejected' ||
            apprvLower.includes('reject') ||
            adminLower === 'rejected' ||
            adminLower.includes('reject')
          );

          if (isRej) {
            return {
              ...record,
              ...(todayDoc || {}),
              status: 'rejected',
              approvalStatus: 'rejected',
              isRejected: true,
              rejectionReason: todayDoc?.rejectionReason || record.rejectionReason || 'Rejected by admin',
              timelineSegments: [],
              totalWorkTime: 0,
              totalWorkTimeDisplay: '0h'
            };
          } else if (todayDoc) {
            return {
              ...record,
              ...todayDoc,
              status: todayDoc.status || record.status,
              approvalStatus: todayDoc.approvalStatus || record.approvalStatus,
              timelineSegments: record.timelineSegments || todayDoc.timelineSegments || []
            };
          }
        }
        return record;
      });

      // If today's record wasn't returned by timeline API but exists or was rejected today, ensure it appears
      if (!todayFound && (todayDoc || isTodayRejected) && (activeFilterTab === 'today' || activeFilterTab === '10days' || activeFilterTab === '7days' || activeFilterTab === 'month')) {
        mergedRecords.push({
          _id: todayDoc?._id || `today-${todayStr}`,
          date: todayDoc?.date || new Date().toISOString(),
          checkInTime: todayDoc?.checkInTime || todayDoc?.inTime || localStorage.getItem('kt_check_in_time_str'),
          checkOutTime: todayDoc?.checkOutTime || todayDoc?.outTime,
          status: isTodayRejected ? 'rejected' : (todayDoc?.status || 'present'),
          approvalStatus: isTodayRejected ? 'rejected' : todayDoc?.approvalStatus,
          isRejected: isTodayRejected,
          rejectionReason: isTodayRejected ? (todayDoc?.rejectionReason || localRejectionReason) : undefined,
          timelineSegments: isTodayRejected ? [] : (todayDoc?.timelineSegments || []),
          totalWorkTime: isTodayRejected ? 0 : (todayDoc?.totalWorkTime || 0),
          totalWorkTimeDisplay: isTodayRejected ? '0h' : (todayDoc?.totalWorkTimeDisplay || '0h'),
          totalBreakTime: isTodayRejected ? 0 : (todayDoc?.totalBreakTime || 0)
        });
      }

      const sortedRecords = [...mergedRecords].sort((a, b) => new Date(b.date || b.checkInTime) - new Date(a.date || a.checkInTime));
      // Normalize all records: if employee has not checked out until 11:59 PM, auto check out time 7:00 PM at that day
      const normalizedRecords = sortedRecords.map(normalizeAttendanceRecord);
      setAttendanceRecords(normalizedRecords);

      let totalWorkHrs = summary.totalWorkingHours || 0;
      if (normalizedRecords.length > 0) {
        const computedTotal = normalizedRecords.reduce((acc, r) => acc + (r.isRejected ? 0 : (parseFloat(r.totalWorkTime) || 0)), 0);
        if (computedTotal > totalWorkHrs) {
          totalWorkHrs = Number(computedTotal.toFixed(1));
        }
      }

      setSummaryStats({
        totalWorkingHours: totalWorkHrs,
        presentDays: summary.presentDays || normalizedRecords.filter(r => (r.status === 'present' || r.checkInTime) && !r.isRejected && r.status !== 'rejected').length,
        absentDays: (summary.absentDays || 0) + (isTodayRejected ? 1 : 0),
        halfDays: summary.halfDays || 0,
        averageWorkingHours: summary.averageWorkingHours || (normalizedRecords.length > 0 ? Number((totalWorkHrs / normalizedRecords.length).toFixed(1)) : 0)
      });

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
    const matchesStatus = selectedStatusFilter === 'all' || 
      (record.status || '').toLowerCase() === selectedStatusFilter.toLowerCase() ||
      (selectedStatusFilter === 'rejected' && (record.isRejected || (record.status || '').toLowerCase().includes('reject')));
    return matchesSearch && matchesStatus;
  });

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
          { label: 'Total Hours', value: `${summaryStats.totalWorkingHours.toFixed(1)}h`, accent: 'border-l-indigo-600' },
          { label: 'Present Days', value: summaryStats.presentDays, accent: 'border-l-emerald-500' },
          { label: 'Absent Days', value: summaryStats.absentDays, accent: 'border-l-rose-500' },
          { label: 'Half Days', value: summaryStats.halfDays, accent: 'border-l-purple-500' },
        ].map((item, idx) => {
          return (
            <div key={idx} className={`bg-white border border-slate-200/80 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}>
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">{item.label}</p>
                  <p className="px-2 text-xl font-bold text-slate-900">{item.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-4 transition-all shadow-xs">

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '10days', label: 'Last 10 Days' },
            { id: 'month', label: 'Monthly View' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${activeFilterTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
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
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="statusFilter" className="sr-only">Filter by Status</label>
            <select
              id="statusFilter"
              name="statusFilter"
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present / On Time</option>
              <option value="late">Late</option>
              <option value="half day">Half Day</option>
              <option value="absent">Absent</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <button
            onClick={() => { setActiveFilterTab('10days'); setSearchQuery(''); setSelectedStatusFilter('all'); }}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {isLoading ? (
          <div className="xl:col-span-2 flex flex-col items-center justify-center p-16 space-y-4">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
            <span className="text-sm font-medium text-slate-500">Loading attendance history...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="xl:col-span-2 flex flex-col items-center justify-center p-16 space-y-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
            <Calendar size={48} className="text-slate-300 dark:text-slate-700" />
            <span className="text-sm font-medium text-slate-500">No attendance records found for this criteria.</span>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const dateObj = getMonthDate(record.date);
            const statusLabel = (record.status || 'unknown').toLowerCase();
            const isToday = isTodayDate(record.date) || isTodayDate(record.checkInTime);

            const isRecordRejected = Boolean(
              record.isRejected === true ||
              statusLabel === 'rejected' ||
              statusLabel.includes('reject') ||
              String(record.approvalStatus || '').toLowerCase().includes('reject') ||
              String(record.adminStatus || '').toLowerCase().includes('reject') ||
              String(record.checkInStatus || '').toLowerCase().includes('reject')
            );

            const isRecordPending = Boolean(
              !isRecordRejected && (
                record.isPending === true ||
                statusLabel.includes('pending') ||
                String(record.approvalStatus || '').toLowerCase().includes('pending') ||
                String(record.adminStatus || '').toLowerCase().includes('pending') ||
                String(record.checkInStatus || '').toLowerCase().includes('pending') ||
                record.isApproved === false
              )
            );

            // Fixed 9-Hour Timeline Computation
            const nineHourTimeline = computeNineHourTimeline({
              checkInTime: record.checkInTime,
              checkOutTime: record.checkOutTime,
              timelineSegments: isRecordRejected ? [] : (record.timelineSegments || []),
              breaks: record.breaks || [],
              isOnBreak: !isRecordRejected && (record.isOnBreak || statusLabel === 'on_break'),
              isCheckedIn: !isRecordRejected && !isRecordPending && Boolean(record.checkInTime || record.status),
              isCheckedOut: !isRecordRejected && Boolean(record.checkOutTime && record.checkOutTime !== '--:--' && record.checkOutTime !== 'null'),
              isRejected: isRecordRejected
            });

            const displayRejectionReason = isRecordRejected ? (record.rejectionReason || '') : '';

            return (
              <div key={record._id} className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 flex flex-col transition-all shadow-xs hover:shadow-card">

                <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shrink-0">
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
                      {isRecordRejected && displayRejectionReason && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
                          Rejected: {displayRejectionReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {(() => {
                      const derived = deriveAttendanceStatus({
                        checkInTime: record.checkInTime,
                        checkOutTime: record.checkOutTime,
                        totalBreakMinutes: record.totalBreakTime,
                        adminStatus: record.adminStatus || record.approvalStatus,
                        approvalStatus: record.approvalStatus,
                        checkInStatus: record.checkInStatus,
                        isRejected: isRecordRejected,
                        isPending: isRecordPending,
                        rejectionReason: displayRejectionReason,
                        status: isRecordRejected ? 'rejected' : record.status,
                        isCompleted: Boolean(record.checkOutTime && record.checkOutTime !== '--:--' && record.checkOutTime !== 'null')
                      });

                      if (isRecordRejected || derived.status === 'rejected') {
                        return (
                          <span className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            Rejected
                          </span>
                        );
                      }

                      if (isRecordPending || derived.status === 'pending') {
                        return (
                          <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending Approval
                          </span>
                        );
                      }

                      if (isToday) {
                        if (record.checkOutTime && record.checkOutTime !== '--:--' && record.checkOutTime !== 'null') {
                          return (
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider">
                              Checked Out ({derived.label})
                            </span>
                          );
                        } else if (record.isOnBreak || statusLabel === 'on_break') {
                          return (
                            <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-[#F59E0B] border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse"></span>
                              On Break
                            </span>
                          );
                        } else if (record.checkInTime) {
                          return (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[#00E676] border border-[#00E676]/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse"></span>
                              Working ({derived.label})
                            </span>
                          );
                        } else {
                          return (
                            <span className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-500 border border-slate-200 dark:border-slate-700 text-[10px] font-medium uppercase tracking-wider">
                              Not Checked In
                            </span>
                          );
                        }
                      } else {
                        if (record.isAutoCheckedOut) {
                          return <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider">Checked Out (7:00 PM)</span>;
                        }
                        return (
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${derived.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                            {derived.label}
                          </span>
                        );
                      }
                    })()}
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
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{isRecordRejected ? '0m' : `${Math.round(parseFloat(String(record.totalBreakTime || 0).replace(/[^\d.-]/g, '')) || 0)}m`}</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-3">
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Work</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{isRecordRejected ? '0h' : (record.totalWorkTimeDisplay || `${Math.round(parseFloat(String(record.totalWorkTime || 0)) || 0)}h`)}</span>
                  </div>
                </div>

                {/* --- 9-Hour Fixed Shift Timeline --- */}
                <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-2">

                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
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