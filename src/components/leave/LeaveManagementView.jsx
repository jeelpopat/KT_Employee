import React, { useState, useEffect } from 'react';
import { 
  Plus, CheckCircle2, Clock, XCircle, 
  Paperclip, Search, Info, Calendar, FileText, Loader2
} from 'lucide-react';
import api from '../../api/axios.js'; 

export const LeaveManagementView = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({ 
    totalLeaves: 12, usedLeaves: 0, remainingLeaves: 12, pendingRequests: 0 
  });
  const [holidaysList, setHolidaysList] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  
  // Form States mapped strictly to API schema
  const [leaveType, setLeaveType] = useState('paid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dynamically set minimum allowed date (2 days from today)
  const minAllowedDateStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch Live Leave & Holiday Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Leave Overview 
      const overviewRes = await api.get('/api/employee-panel/leaves/overview');
      if (overviewRes.data?.success) {
        if (overviewRes.data.summary) setLeaveBalance(overviewRes.data.summary);
        if (overviewRes.data.history) setLeaveRequests(overviewRes.data.history);
      }

      // 2. Fetch Holidays List to calculate working days
      const year = new Date().getFullYear();
      const holidayRes = await api.get(`/api/holiday/all?year=${year}`);
      if (holidayRes.data?.success && holidayRes.data?.holidays) {
        // Extract formatted date strings (YYYY-MM-DD) for easy comparison
        const dates = holidayRes.data.holidays.map(h => h.holidayDate.split('T')[0]);
        setHolidaysList(dates);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Force endDate to equal startDate if Half Day is selected
  useEffect(() => {
    if (isHalfDay && startDate) {
      setEndDate(startDate);
    }
  }, [isHalfDay, startDate]);

  // Safely calculate actual working days excluding Sundays and Holidays
  const getCalculatedDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 0;

    let count = 0;
    let curr = new Date(start);
    
    while (curr <= end) {
      // Format current date to YYYY-MM-DD safely handling timezones
      const dateStr = new Date(curr.getTime() - curr.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const isSunday = curr.getDay() === 0;

      // Only count if it's NOT a Sunday AND NOT in the backend holiday list
      if (!isSunday && !holidaysList.includes(dateStr)) {
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (isHalfDay && count > 0) return 0.5;
    return count;
  };

  const calculatedDays = getCalculatedDays();

  const filteredLeaves = leaveRequests.filter(l => {
    const matchesSearch = (l.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (l.leaveType || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (startDate < minAllowedDateStr) {
      setFormError(`Policy Notice: Leave requests must be submitted at least 2 days in advance.`);
      return;
    }

    if (calculatedDays === 0) {
      setFormError(`Invalid Range: The selected dates fall entirely on recognized holidays or Sundays.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Sending exact payload to the API. 
      // Ensure your backend accepts the "totalDays" field!
      const payload = {
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        isHalfDay: isHalfDay,
        totalDays: Number(calculatedDays), // Explicitly passing the calculated days to DB
        reason: reason,
        attachment: attachmentName || ""
      };

      const response = await api.post('/api/employee-panel/leaves/apply', payload);

      if (response.data) {
        setSuccessMsg('Leave request submitted successfully.');
        setTimeout(() => {
          setIsModalOpen(false);
          setReason('');
          setStartDate('');
          setEndDate('');
          setAttachmentName('');
          setIsHalfDay(false);
          setSuccessMsg('');
          fetchData(); // Refresh history and balance
        }, 2000);
      }

    } catch (error) {
      console.error("Error applying for leave:", error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to submit leave application. Please try again.';
      setFormError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dateString.split('T')[0];
  };

  return (
    <div className="space-y-6">

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-md shrink-0">
            <Info size={24} />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">Leave Policy Guidelines</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              You are entitled to <strong className="text-slate-900 dark:text-slate-200 font-semibold">12 Paid Leaves</strong> per year. All other leaves (Casual/Sick) are processed as unpaid. Applications require 2 days notice.{' '}
              <button 
                onClick={() => setIsPolicyModalOpen(true)}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1 ml-1 cursor-pointer"
              >
                Read Full Policies
              </button>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Paid Quota', value: `${leaveBalance.totalLeaves || 12} Days`, note: 'Annual Paid Leaves', icon: Calendar, accent: 'border-l-blue-500', iconColor: 'text-blue-500' },
          { label: 'Leaves Used', value: `${leaveBalance.usedLeaves || 0} Days`, note: 'Total utilized', icon: Clock, accent: 'border-l-amber-500', iconColor: 'text-amber-500' },
          { label: 'Paid Balance', value: `${leaveBalance.remainingLeaves || 12} Days`, note: 'Remaining PL', icon: CheckCircle2, accent: 'border-l-green-500', iconColor: 'text-green-500' },
          { label: 'Pending', value: `${leaveBalance.pendingRequests || 0} Req.`, note: 'Awaiting Review', icon: Clock, accent: 'border-l-slate-400', iconColor: 'text-slate-500' }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{item.value}</p>
                </div>
                <Icon size={18} className={item.iconColor} />
              </div>
              <p className="text-xs mt-2 text-slate-400 dark:text-slate-500">{item.note}</p>
            </div>
          );
        })}
        
        <button 
          onClick={() => {
            setStartDate(minAllowedDateStr);
            setEndDate(minAllowedDateStr);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white border-l-4 border-blue-800 rounded-md p-4 transition-colors flex flex-col items-center justify-center gap-3 text-center cursor-pointer min-h-[110px] lg:col-span-1 col-span-2 shadow-sm"
        >
          <Plus size={28} />
          <span className="font-semibold text-sm tracking-wide">Apply For Leave</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden transition-colors shadow-sm">
        
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Leave History</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track your leave application status</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search reason..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-3">
               <Loader2 size={24} className="animate-spin text-blue-500" />
               <span className="text-sm text-slate-500 font-medium">Loading history...</span>
             </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Leave Category</th>
                  <th className="px-5 py-4">Duration & Dates</th>
                  <th className="px-5 py-4 w-1/3">Reason</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">No leave requests found.</td>
                  </tr>
                ) : (
                  filteredLeaves.map((l, index) => {
                    const statusStr = String(l.status || 'pending').toLowerCase();
                    const isPaid = l.leaveType?.toLowerCase() === 'paid';
                    return (
                      <tr key={l._id || index} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 uppercase block">{l.leaveType}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 inline-block px-2 py-0.5 rounded-sm border ${isPaid ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                            {isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {formatDate(l.startDate)} to {formatDate(l.endDate)}
                          </span>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 block">
                            {l.totalDays} {l.totalDays === 1 || l.totalDays === 0.5 ? 'Day' : 'Days'} {l.isHalfDay ? '(Half Day)' : ''}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={l.reason}>
                          {l.reason}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            {statusStr === 'approved' && (
                              <span className="px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
                                <CheckCircle2 size={14} /> Approved
                              </span>
                            )}
                            {statusStr === 'pending' && (
                              <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
                                <Clock size={14} /> Pending
                              </span>
                            )}
                            {statusStr === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
                                <XCircle size={14} /> Rejected
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 dark:bg-black/60 transition-opacity flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText size={20} className="text-slate-500" />
                  Leave Policies
                </h3>
              </div>
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="p-2 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/50 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-500 rounded-md">
                    <Calendar size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Paid Leave (PL)</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Paid leaves are meant for planned vacations, personal time, or extended rest.
                </p>
                <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3">Policy Rules:</h5>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 marker:text-purple-500">
                  <li>Employees earn <strong className="text-slate-800 dark:text-slate-200">12 days</strong> of paid leave per year (1 per month).</li>
                  <li>Paid leaves can be carried forward up to a maximum of 30 days.</li>
                  <li>Prior approval is required at least 2 days in advance.</li>
                </ul>
              </div>

              <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/50 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                    <Info size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unpaid Leaves (Casual / Sick)</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Casual and Sick leaves are granted for unanticipated personal matters or emergencies, but are processed as unpaid.
                </p>
                <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3">Policy Rules:</h5>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 marker:text-slate-500">
                  <li>Any leaves taken beyond the 12 Paid Leaves are considered Unpaid.</li>
                  <li>Medical documents are required for sick leaves exceeding 2 consecutive days.</li>
                </ul>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-slate-300 text-white dark:text-slate-900 font-medium rounded-md transition-colors cursor-pointer"
              >
                Close Policies
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 dark:bg-black/60 transition-opacity flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            
            <div className="px-6 py-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Apply For Leave</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Must be applied at least 2 days in advance</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
              
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md text-red-700 dark:text-red-400 font-medium text-sm">
                  {formError}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-md text-green-700 dark:text-green-400 font-medium text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> {successMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Leave Category</label>
                  <select 
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="Paid Leave">Paid Leave (PL)</option>
                    <option value="Casual Leave">Casual Leave (Unpaid)</option>
                    <option value="Sick Leave">Sick Leave (Unpaid)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Duration</label>
                  <div className="flex items-center gap-4 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duration" 
                        checked={!isHalfDay}
                        onChange={() => setIsHalfDay(false)}
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Full Day</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duration" 
                        checked={isHalfDay}
                        onChange={() => setIsHalfDay(true)}
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Half Day</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Start Date</label>
                  <input 
                    type="date" 
                    min={minAllowedDateStr}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">End Date</label>
                  <input 
                    type="date" 
                    min={startDate}
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={isHalfDay}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>
              
              {/* Dynamic Working Days Banner */}
              {startDate && endDate && (
                <div className={`p-2.5 rounded-md border text-sm font-semibold flex items-center justify-between ${calculatedDays === 0 ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50'}`}>
                  <span>Working Days Requested:</span>
                  <span className="font-mono text-base">{calculatedDays} {calculatedDays === 1 || calculatedDays === 0.5 ? 'Day' : 'Days'}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Reason</label>
                <textarea 
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Provide brief explanation for leave..."
                  className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-y"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Document (Optional)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Provide a link to your medical doc..."
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || calculatedDays === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Submit Application
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};