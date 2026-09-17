// import React, { useEffect, useState, useCallback } from 'react';
// import { 
//   Clock, Pause, Play, LogOut, Calendar, Gift, 
//   Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, MapPin, Loader2, AlertCircle, Map
// } from 'lucide-react';
// import { useApp } from '../../context/AppContext.jsx';
// import api from '../../api/axios.js';

// // --- Geofencing Configuration ---
// const TARGET_LAT = 23.057808;
// const TARGET_LNG = 72.538926;
// const GEOFENCE_RADIUS_KM = 0.5; // Acceptable radius: 500 meters

// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//   const R = 6371; 
//   const dLat = (lat2 - lat1) * (Math.PI / 180);
//   const dLon = (lon2 - lon1) * (Math.PI / 180);
//   const a = 
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
//     Math.sin(dLon / 2) * Math.sin(dLon / 2); 
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
//   return R * c; 
// };

// export const DashboardView = () => {
//   const { user } = useApp();

//   // --- Live Data States ---
//   const [liveFirstName, setLiveFirstName] = useState('Loading...');
//   const [tasksStats, setTasksStats] = useState({ todo: 0, inProgress: 0, completed: 0 });
//   const [leaveBalance, setLeaveBalance] = useState('--');
//   const [announcements, setAnnouncements] = useState([]);
//   const [holidays, setHolidays] = useState([]);
//   const [upcomingBirthdays, setUpcomingBirthdays] = useState([]); 
//   const [teamOnLeave, setTeamOnLeave] = useState([]); 
//   const [isDataLoading, setIsDataLoading] = useState(true);

//   // --- Attendance States ---
//   const [attendanceStatus, setAttendanceStatus] = useState('checked_out'); 
//   const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
//   const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
//   const [breakCount, setBreakCount] = useState(0);
//   const [geoError, setGeoError] = useState('');
//   const [isActionLoading, setIsActionLoading] = useState(false);

//   // Display strings based on API Response
//   const [checkInTimeDisplay, setCheckInTimeDisplay] = useState('--:--');
//   const [checkOutTimeDisplay, setCheckOutTimeDisplay] = useState('--:--');
//   const [totalWorkTimeDisplay, setTotalWorkTimeDisplay] = useState('0h 0m');
//   const [totalBreakTime, setTotalBreakTime] = useState(0);

//   const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80';

//   const userId = user?.employee?._id || user?.profile?._id || user?._id;

//   // --- Sync Attendance Across Devices ---
//   const syncAttendance = useCallback(async () => {
//     if (!userId) return;
//     try {
//       const res = await api.get(`/api/attendance/history/${userId}`);
//       const history = res.data?.data || res.data || [];
//       if (!Array.isArray(history)) return;

//       const todayStr = new Date().toISOString().split('T')[0];
//       const todayRecord = history.find(r => 
//         r.createdAt?.startsWith(todayStr) || 
//         r.checkInTime?.startsWith(todayStr) ||
//         r.date?.startsWith(todayStr)
//       );

//       if (todayRecord) {
//         setHasCheckedInToday(!!todayRecord.checkInTime);
//         setHasCheckedOutToday(!!todayRecord.checkOutTime);
        
//         if (todayRecord.checkInTimeDisplay) setCheckInTimeDisplay(todayRecord.checkInTimeDisplay);
//         if (todayRecord.checkOutTimeDisplay) setCheckOutTimeDisplay(todayRecord.checkOutTimeDisplay);
//         if (todayRecord.totalWorkTimeDisplay) setTotalWorkTimeDisplay(todayRecord.totalWorkTimeDisplay);
//         if (todayRecord.totalBreakTime) setTotalBreakTime(todayRecord.totalBreakTime);

//         const breaks = todayRecord.breaks || [];
//         setBreakCount(breaks.length);

//         if (todayRecord.checkOutTime) {
//           setAttendanceStatus('checked_out');
//         } else if (breaks.length > 0 && !breaks[breaks.length - 1].endTime) {
//           setAttendanceStatus('on_break');
//         } else if (todayRecord.checkInTime) {
//           setAttendanceStatus('checked_in');
//         }
//       }
//     } catch (error) {
//       console.error("Failed to sync attendance:", error);
//     }
//   }, [userId]);

//   useEffect(() => {
//     syncAttendance();
//     window.addEventListener('focus', syncAttendance);
//     const interval = setInterval(syncAttendance, 30000);
//     return () => {
//       window.removeEventListener('focus', syncAttendance);
//       clearInterval(interval);
//     };
//   }, [syncAttendance]);

//   // --- Fetch Dashboard Live Data ---
//   useEffect(() => {
//     const fetchDashboardData = async () => {
//       setIsDataLoading(true);
//       try {
//         const pRes = await api.get('/api/users/profile');
//         const pData = pRes.data?.data || pRes.data || {};
//         const realName = pData.employee?.firstName || pData.employee?.name || pData.profile?.name || user?.name || 'Employee';
//         setLiveFirstName(realName.split(' ')[0]);
//       } catch (e) {
//         setLiveFirstName('Team Member');
//       }

//       try {
//         const dashRes = await api.get('/api/employee-panel/dashboard');
//         if (dashRes.data?.success) {
//           const dData = dashRes.data?.data || dashRes.data || {};
//           setUpcomingBirthdays(dData.upcomingBirthdays || dashRes.data.upcomingBirthdays || []);
//           setTeamOnLeave(dData.teamMembersOnLeave || dashRes.data.teamMembersOnLeave || []);
          
//           // Extract the Paid Balance from the stats object correctly
//           const stats = dData.stats || dashRes.data.stats;
//           if (stats && stats.leaveBalance !== undefined) {
//             setLeaveBalance(`${stats.leaveBalance} Days`);
//           }
//         }
//       } catch (e) { console.error("Error fetching dash stats", e); }

//       try {
//         if (userId) {
//           const taskRes = await api.get(`/api/task/employee/${userId}`);
//           const tasksList = taskRes.data?.tasks || taskRes.data?.data || taskRes.data || [];
//           setTasksStats({
//             todo: tasksList.filter(t => t.status === 'Assigned').length,
//             inProgress: tasksList.filter(t => t.status === 'In Progress').length,
//             completed: tasksList.filter(t => t.status === 'Completed').length,
//           });
//         }
//       } catch (e) {}

//       // Fallback: If stats.leaveBalance wasn't found, try the dedicated API
//       if (leaveBalance === '--') {
//         try {
//           if (userId) {
//             const leaveRes = await api.get('/api/employee-panel/leaves/overview');
//             if (leaveRes.data?.success && leaveRes.data?.summary) {
//               setLeaveBalance(`${leaveRes.data.summary.remainingLeaves} Days`);
//             }
//           }
//         } catch (e) {}
//       }

//       try {
//         const annRes = await api.get('/api/notification/announcement/all');
//         if (annRes.data?.success && annRes.data?.data) {
//           setAnnouncements(annRes.data.data);
//         }
//       } catch (e) {}

//       try {
//         const holRes = await api.get('/api/holiday/all');
//         if (holRes.data?.success && holRes.data?.holidays) {
//           const currentMonth = new Date().getMonth();
//           const currentYear = new Date().getFullYear();
//           const upcoming = holRes.data.holidays.filter(h => {
//             const hDate = new Date(h.holidayDate);
//             return hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear && hDate >= new Date();
//           });
//           setHolidays(upcoming);
//         }
//       } catch (e) {}

//       setIsDataLoading(false);
//     };

//     fetchDashboardData();
//   }, [userId, user?.name]);

//   // --- Geolocation & Verification ---
//   const verifyLocationAndExecute = (actionCallback, isTestOnly = false) => {
//     setGeoError('');
//     setIsActionLoading(true);

//     if (!navigator.geolocation) {
//       setGeoError("Location tracking is not supported by your browser.");
//       setIsActionLoading(false);
//       return;
//     }

//     navigator.geolocation.getCurrentPosition(
//       (position) => {
//         const { latitude, longitude } = position.coords;
//         const distance = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
        
//         if (isTestOnly) {
//           setGeoError(`TEST GPS SUCCESS: You are at [${latitude.toFixed(5)}, ${longitude.toFixed(5)}]. Distance to office: ${distance.toFixed(2)} km.`);
//           setIsActionLoading(false);
//           return;
//         }

//         if (distance <= GEOFENCE_RADIUS_KM) {
//           actionCallback(latitude, longitude);
//         } else {
//           setGeoError(`Verification Failed: You are ${distance.toFixed(2)} km away from the office. (Detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
//           setIsActionLoading(false);
//         }
//       },
//       (error) => {
//         let errorMsg = "Location error occurred.";
//         if (error.code === 1) errorMsg = "Permission Denied: Please allow location access in your browser settings.";
//         else if (error.code === 2) errorMsg = "Position Unavailable: GPS/Network location could not be determined.";
//         else if (error.code === 3) errorMsg = "Timeout: Failed to get location in time. Please step outside or near a window.";
        
//         setGeoError(errorMsg);
//         setIsActionLoading(false);
//       },
//       { 
//         enableHighAccuracy: true, 
//         timeout: 30000, 
//         maximumAge: 5000 
//       } 
//     );
//   };

  
//   // --- Attendance API Call Handlers ---
//   const handleAttendanceAction = async (endpoint, lat, lng) => {
//     try {
//       const payload = { userId, latitude: lat, longitude: lng };
//       const response = await api.post(endpoint, payload);
      
//       if (response.data?.success) {
//         syncAttendance(); 
//       } else {
//         setGeoError(response.data?.message || "Action failed.");
//       }
//     } catch (err) {
//       setGeoError(err.response?.data?.message || err.message || "Server Error");
//     } finally {
//       setIsActionLoading(false);
//     }
//   };

//   const onCheckInClick = () => {
//     if (hasCheckedInToday) {
//       setGeoError("You have already checked in today.");
//       return;
//     }
//     verifyLocationAndExecute((lat, lng) => handleAttendanceAction('/api/attendance/check-in', lat, lng));
//   };

//   const onStartBreakClick = () => {
//     if (breakCount >= 2) {
//       setGeoError("You have exhausted your 2 breaks for today.");
//       return;
//     }
//     verifyLocationAndExecute((lat, lng) => handleAttendanceAction('/api/attendance/break/start', lat, lng));
//   };

//   const onResumeWorkClick = () => verifyLocationAndExecute((lat, lng) => handleAttendanceAction('/api/attendance/break/end', lat, lng));

//   const onCheckOutClick = () => {
//     if (attendanceStatus === 'on_break') {
//       setGeoError("Action Denied: You must end your break before checking out.");
//       return;
//     }
//     if (hasCheckedOutToday) {
//       setGeoError("You have already checked out today.");
//       return;
//     }
//     verifyLocationAndExecute((lat, lng) => handleAttendanceAction('/api/attendance/check-out', lat, lng));
//   };

//   return (
//     <div className="min-h-full space-y-6">
      
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
//             Welcome back, {liveFirstName}
//           </h1>
//           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here is your daily overview and active tracking.</p>
//         </div>
//         <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-2 shadow-sm">
//           <Calendar size={16} className="text-blue-600 dark:text-blue-500" />
//           <span className="font-medium">Today's Overview</span>
//         </div>
//       </div>

//       {/* KPI Cards (Live Data) */}
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//         {[
//           { label: 'Tasks To Do', value: tasksStats.todo, icon: CheckSquare, accent: 'border-l-slate-400' },
//           { label: 'In Progress', value: tasksStats.inProgress, icon: TrendingUp, accent: 'border-l-amber-500' },
//           { label: 'Completed', value: tasksStats.completed, icon: FileCheck, accent: 'border-l-green-500' },
//           { label: 'Paid Balance', value: leaveBalance, icon: Calendar, accent: 'border-l-indigo-500' } // Renamed to Paid Balance
//         ].map((item, idx) => {
//           const Icon = item.icon;
//           return (
//             <div key={`kpi-${idx}`} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm`}>
//               <div className="flex items-start justify-between gap-2">
//                 <div>
//                   <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
//                   <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
//                     {isDataLoading ? <Loader2 size={20} className="animate-spin text-slate-400 mt-1" /> : item.value}
//                   </p>
//                 </div>
//                 <Icon size={18} className="text-slate-400 dark:text-slate-500" />
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
//         {/* Attendance Control Panel */}
//         <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden transition-colors flex flex-col shadow-sm">
//           <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//             <div className="flex items-center gap-3">
//               <Clock size={20} className="text-slate-700 dark:text-slate-300" />
//               <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Time & Attendance</h2>
//             </div>
            
//             <div className="flex items-center gap-4">
//               <button 
//                 onClick={() => verifyLocationAndExecute(null, true)}
//                 className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider transition-colors cursor-pointer"
//               >
//                 <Map size={12} /> Test GPS
//               </button>
              
//               {attendanceStatus === 'checked_in' && (
//                 <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wider">
//                   <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Active
//                 </span>
//               )}
//               {attendanceStatus === 'on_break' && (
//                 <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
//                   <Pause size={14} /> On Break
//                 </span>
//               )}
//               {attendanceStatus === 'checked_out' && hasCheckedOutToday && (
//                 <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
//                   <LogOut size={14} /> Completed
//                 </span>
//               )}
//             </div>
//           </div>

//           <div className="p-5 flex-1 flex flex-col justify-between">
//             {geoError && (
//               <div className={`mb-5 p-3 rounded-md text-sm font-medium flex items-center gap-2 ${geoError.includes('TEST GPS SUCCESS') ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400' : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400'}`}>
//                 {geoError.includes('TEST GPS SUCCESS') ? <CheckSquare size={16} /> : <AlertCircle size={16} />} 
//                 <span className="break-all">{geoError}</span>
//               </div>
//             )}

//             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
//               <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
//                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check In</p>
//                 <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">{checkInTimeDisplay}</p>
//               </div>
//               <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
//                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check Out</p>
//                 <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">{checkOutTimeDisplay}</p>
//               </div>
//               <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
//                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Work Time</p>
//                 <p className="text-xl font-bold text-blue-600 dark:text-blue-500 mt-2">{totalWorkTimeDisplay}</p>
//               </div>
//               <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
//                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Breaks</p>
//                 <div className="flex items-end justify-between mt-2">
//                   <p className="text-xl font-bold text-amber-600 dark:text-amber-500">{totalBreakTime}m</p>
//                   <span className="text-xs font-semibold text-slate-400">({breakCount}/2 Used)</span>
//                 </div>
//               </div>
//             </div>

//             <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
              
//               {/* Check In */}
//               {attendanceStatus === 'checked_out' && !hasCheckedOutToday && !hasCheckedInToday && (
//                 <button 
//                   onClick={onCheckInClick} 
//                   disabled={isActionLoading}
//                   className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
//                 >
//                   {isActionLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} Check In
//                 </button>
//               )}

//               {/* Start Break */}
//               {attendanceStatus === 'checked_in' && breakCount < 2 && (
//                 <button 
//                   onClick={onStartBreakClick} 
//                   disabled={isActionLoading}
//                   className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
//                 >
//                   {isActionLoading ? <Loader2 size={18} className="animate-spin" /> : <Pause size={18} />} Start Break
//                 </button>
//               )}

//               {/* Resume Work */}
//               {attendanceStatus === 'on_break' && (
//                 <button 
//                   onClick={onResumeWorkClick} 
//                   disabled={isActionLoading}
//                   className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
//                 >
//                   {isActionLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} Resume Work
//                 </button>
//               )}
              
//               {/* Check Out */}
//               {attendanceStatus === 'checked_in' && !hasCheckedOutToday && (
//                 <button 
//                   onClick={onCheckOutClick} 
//                   disabled={isActionLoading}
//                   className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3 rounded-md bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
//                 >
//                   {isActionLoading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />} Check Out
//                 </button>
//               )}

//               {/* Completion Message */}
//               {hasCheckedOutToday && (
//                 <div className="w-full text-center py-2 text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
//                   Shift Completed
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Live Announcements */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors flex flex-col h-full overflow-hidden shadow-sm">
//           <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
//             <div className="flex items-center gap-3">
//               <Bell size={20} className="text-blue-500" />
//               <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Announcements</h2>
//             </div>
//             <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-sm uppercase">
//               {announcements.length} Updates
//             </span>
//           </div>
//           <div className="p-0 divide-y divide-slate-100 dark:divide-slate-800/60 flex-1 overflow-y-auto max-h-[350px]">
//             {isDataLoading ? (
//               <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
//             ) : announcements.length === 0 ? (
//               <div className="flex flex-col items-center justify-center p-8 text-center h-full">
//                 <Bell size={32} className="text-slate-300 dark:text-slate-700 mb-3" />
//                 <p className="text-sm text-slate-500 dark:text-slate-400">No active announcements.</p>
//               </div>
//             ) : (
//               announcements.map((ann, index) => (
//                 <div key={`ann-${ann._id || index}`} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
//                   <div className="flex items-center justify-between gap-2 mb-2">
//                     <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{ann.title}</span>
//                   </div>
//                   <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ann.message}</p>
//                   <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
//                     <Calendar size={12} /> {ann.createdAtIST || (ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'Recent')}
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
//         {/* Live Upcoming Birthdays */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm">
//           <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
//             <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Gift size={16} className="text-slate-400" /> Birthdays
//             </h3>
//             <span className="text-xs text-slate-500 font-medium">Upcoming</span>
//           </div>
//           <div className="p-0 divide-y divide-slate-100 dark:divide-slate-800/60">
//             {isDataLoading ? (
//               <div className="flex justify-center p-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
//             ) : upcomingBirthdays.length === 0 ? (
//                <p className="text-sm text-slate-500 p-6 text-center">No birthdays this month.</p>
//             ) : (
//               upcomingBirthdays.map((b, index) => (
//                 <div key={`bday-${index}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
//                   <div className="flex items-center gap-3 min-w-0">
//                     <img src={b.profilePhoto || defaultAvatar} alt={b.name} className="w-9 h-9 rounded-md object-cover border border-slate-200 dark:border-slate-700 bg-slate-100" />
//                     <div className="min-w-0">
//                       <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{b.name}</p>
//                       <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{b.designation}</p>
//                     </div>
//                   </div>
//                   <div className="text-right shrink-0">
//                     <p className="text-sm font-medium text-slate-800 dark:text-slate-300">
//                       {b.birthdayDate ? new Date(b.birthdayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
//                     </p>
//                     <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
//                       {b.daysRemaining === 0 ? 'Today' : `${b.daysRemaining}d away`}
//                     </span>
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>

//         {/* Live Upcoming Holidays (Current Month) */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm">
//           <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
//             <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Sun size={16} className="text-slate-400" /> Upcoming Holidays
//             </h3>
//             <span className="text-xs text-slate-500 font-medium">This Month</span>
//           </div>
//           <div className="p-0 divide-y divide-slate-100 dark:divide-slate-800/60">
//             {isDataLoading ? (
//               <div className="flex justify-center p-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
//             ) : holidays.length === 0 ? (
//               <p className="text-sm text-slate-500 p-6 text-center">No more holidays this month.</p>
//             ) : (
//               holidays.map((holiday, index) => {
//                 const holidayDate = new Date(holiday.holidayDate);
//                 const daysRemaining = Math.max(0, Math.ceil((holidayDate - new Date()) / (1000 * 60 * 60 * 24)));
//                 return (
//                   <div key={`hol-${holiday._id || index}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
//                     <div className="min-w-0">
//                       <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{holiday.holidayName}</p>
//                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
//                         {holidayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
//                       </p>
//                     </div>
//                     <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-sm border border-slate-200 dark:border-slate-700">
//                       {daysRemaining === 0 ? 'Today' : `${daysRemaining}d away`}
//                     </span>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* Live Team On Leave */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm">
//           <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
//             <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Users size={16} className="text-slate-400" /> Team On Leave
//             </h3>
//             <span className="text-xs text-slate-500 font-medium">Today</span>
//           </div>
//           <div className="p-0 divide-y divide-slate-100 dark:divide-slate-800/60">
//             {isDataLoading ? (
//                <div className="flex justify-center p-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
//             ) : teamOnLeave.length === 0 ? (
//                <div className="p-6 flex flex-col items-center justify-center text-center">
//                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No data pending for today.</p>
//                  <span className="text-[10px] uppercase font-bold text-slate-400 mt-2 tracking-widest">Clear Status</span>
//                </div>
//             ) : (
//               teamOnLeave.map((t, index) => (
//                 <div key={`leave-${index}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
//                   <div className="flex items-center gap-3 min-w-0">
//                     <img src={t.profilePhoto || defaultAvatar} alt={t.name} className="w-9 h-9 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
//                     <div className="min-w-0">
//                       <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{t.name}</p>
//                       <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.designation}</p>
//                     </div>
//                   </div>
//                   <div className="text-right shrink-0">
//                     <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-sm">
//                       {t.leaveType}
//                     </p>
//                     <p className="text-[10px] font-semibold text-slate-500 mt-1">{t.numberOfDays} Days</p>
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       </div>

//     </div>
//   );
// };

// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// import React, { useEffect, useState, useCallback } from 'react';
// import { 
//   Clock, Pause, LogOut, Calendar, Gift, 
//   Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, AlertCircle, Map,
//   Umbrella, LogIn, Coffee, ChevronLeft, ChevronRight, Loader2
// } from 'lucide-react';
// import { useApp } from '../../context/AppContext.jsx';
// import api from '../../api/axios.js';

// // --- Geofencing Configuration ---
// const TARGET_LAT = 23.057808;
// const TARGET_LNG = 72.538926;
// const GEOFENCE_RADIUS_KM = 0.5; 

// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//   const R = 6371; 
//   const dLat = (lat2 - lat1) * (Math.PI / 180);
//   const dLon = (lon2 - lon1) * (Math.PI / 180);
//   const a = 
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
//     Math.sin(dLon / 2) * Math.sin(dLon / 2); 
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
//   return R * c; 
// };

// export const DashboardView = () => {
//   const { user } = useApp();

//   // --- Live Data States ---
//   const [liveFirstName, setLiveFirstName] = useState('Loading...');
//   const [tasksStats, setTasksStats] = useState({ todo: 0, inProgress: 0, completed: 0 });
//   const [leaveBalance, setLeaveBalance] = useState('--');
//   const [announcements, setAnnouncements] = useState([]);
//   const [currentAnnIndex, setCurrentAnnIndex] = useState(0);
//   const [holidays, setHolidays] = useState([]);
//   const [upcomingBirthdays, setUpcomingBirthdays] = useState([]); 
//   const [teamOnLeave, setTeamOnLeave] = useState([]); 
//   const [isDataLoading, setIsDataLoading] = useState(true);

//   // --- Attendance & Timeline States ---
//   const [attendanceStatus, setAttendanceStatus] = useState('checked_out'); 
//   const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
//   const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
//   const [breakCount, setBreakCount] = useState(0);
//   const [geoError, setGeoError] = useState('');
//   const [isActionLoading, setIsActionLoading] = useState(false);
//   const [todaySegments, setTodaySegments] = useState([]);
  
//   // Track active break start time to calculate duration on break end
//   const [activeBreakIsoStart, setActiveBreakIsoStart] = useState(null);

//   // Display strings based on API Response
//   const [checkInTimeDisplay, setCheckInTimeDisplay] = useState('--:--');
//   const [checkOutTimeDisplay, setCheckOutTimeDisplay] = useState('--:--');
//   const [totalWorkTimeDisplay, setTotalWorkTimeDisplay] = useState('0h 0m');
//   const [breakInTimeDisplay, setBreakInTimeDisplay] = useState('--:--');
//   const [breakOutTimeDisplay, setBreakOutTimeDisplay] = useState('--:--');

//   const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80';
//   const userId = user?.employee?._id || user?.profile?._id || user?._id;

//   // --- Announcement Controls ---
//   const handlePrevAnnouncement = () => {
//     setCurrentAnnIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
//   };
//   const handleNextAnnouncement = () => {
//     setCurrentAnnIndex((prev) => (prev + 1) % announcements.length);
//   };

//   // --- Timeline Converters ---
//   const convertUTCMinutesToLocal = (utcMinutes) => {
//     const d = new Date();
//     d.setUTCHours(Math.floor(utcMinutes / 60), utcMinutes % 60, 0, 0);
//     return d.getHours() * 60 + d.getMinutes();
//   };

//   const formatMinutesToTimeStr = (totalMinutes) => {
//     const d = new Date();
//     d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
//     return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
//   };

//   // --- Sync Attendance Across Devices ---
//   const syncAttendance = useCallback(async () => {
//     if (!userId) return;
//     try {
//       const res = await api.get(`/api/attendance/history/${userId}`);
//       const history = res.data?.data || res.data || [];
//       if (Array.isArray(history)) {
//         const todayStr = new Date().toISOString().split('T')[0];
//         const todayRecord = history.find(r => 
//           r.createdAt?.startsWith(todayStr) || 
//           r.checkInTime?.startsWith(todayStr) ||
//           r.date?.startsWith(todayStr)
//         );

//         if (todayRecord) {
//           setHasCheckedInToday(!!todayRecord.checkInTime);
//           setHasCheckedOutToday(!!todayRecord.checkOutTime);
          
//           if (todayRecord.checkInTimeDisplay) setCheckInTimeDisplay(todayRecord.checkInTimeDisplay);
//           if (todayRecord.checkOutTimeDisplay) setCheckOutTimeDisplay(todayRecord.checkOutTimeDisplay);
//           if (todayRecord.totalWorkTimeDisplay) setTotalWorkTimeDisplay(todayRecord.totalWorkTimeDisplay);

//           const breaks = todayRecord.breaks || [];
//           setBreakCount(breaks.length);
//           if (breaks.length > 0) {
//             setBreakInTimeDisplay(breaks[breaks.length - 1].startTimeDisplay || '--:--');
//             if (breaks[breaks.length - 1].endTime) {
//               setBreakOutTimeDisplay(breaks[breaks.length - 1].endTimeDisplay || '--:--');
//               setActiveBreakIsoStart(null);
//             } else {
//               setActiveBreakIsoStart(breaks[breaks.length - 1].startTime);
//             }
//           }

//           if (todayRecord.checkOutTime) {
//             setAttendanceStatus('checked_out');
//           } else if (breaks.length > 0 && !breaks[breaks.length - 1].endTime) {
//             setAttendanceStatus('on_break');
//           } else if (todayRecord.checkInTime) {
//             setAttendanceStatus('checked_in');
//           }
//         }
//       }

//       // Fetch Today's Timeline Segments
//       const tlRes = await api.get('/api/employee-panel/attendance/timeline?filter=today');
//       if (tlRes.data?.data && tlRes.data.data.length > 0) {
//         setTodaySegments(tlRes.data.data[0].timelineSegments || []);
//       } else {
//         setTodaySegments([]);
//       }

//     } catch (error) {
//       console.error("Failed to sync attendance:", error);
//     }
//   }, [userId]);

//   useEffect(() => {
//     syncAttendance();
//     window.addEventListener('focus', syncAttendance);
//     const interval = setInterval(syncAttendance, 30000);
//     return () => {
//       window.removeEventListener('focus', syncAttendance);
//       clearInterval(interval);
//     };
//   }, [syncAttendance]);

//   // --- Fetch Dashboard Live Data ---
//   useEffect(() => {
//     const fetchDashboardData = async () => {
//       setIsDataLoading(true);
//       try {
//         const pRes = await api.get('/api/users/profile');
//         const pData = pRes.data?.data || pRes.data || {};
//         const realName = pData.employee?.firstName || pData.employee?.name || pData.profile?.name || user?.name || 'Employee';
//         setLiveFirstName(realName.split(' ')[0]);
//       } catch (e) {
//         setLiveFirstName('Team Member');
//       }

//       try {
//         const dashRes = await api.get('/api/employee-panel/dashboard');
//         if (dashRes.data?.success) {
//           const dData = dashRes.data?.data || dashRes.data || {};
//           setUpcomingBirthdays(dData.upcomingBirthdays || dashRes.data.upcomingBirthdays || []);
//           setTeamOnLeave(dData.teamMembersOnLeave || dashRes.data.teamMembersOnLeave || []);
          
//           const stats = dData.stats || dashRes.data.stats;
//           if (stats && stats.leaveBalance !== undefined) {
//             setLeaveBalance(`${stats.leaveBalance} Days`);
//           }
//         }
//       } catch (e) { console.error("Error fetching dash stats", e); }

//       try {
//         if (userId) {
//           const taskRes = await api.get(`/api/task/employee/${userId}`);
//           const tasksList = taskRes.data?.tasks || taskRes.data?.data || taskRes.data || [];
//           setTasksStats({
//             todo: tasksList.filter(t => t.status === 'Assigned').length,
//             inProgress: tasksList.filter(t => t.status === 'In Progress').length,
//             completed: tasksList.filter(t => t.status === 'Completed').length,
//           });
//         }
//       } catch (e) {}

//       if (leaveBalance === '--') {
//         try {
//           if (userId) {
//             const leaveRes = await api.get('/api/employee-panel/leaves/overview');
//             if (leaveRes.data?.success && leaveRes.data?.summary) {
//               setLeaveBalance(`${leaveRes.data.summary.remainingLeaves} Days`);
//             }
//           }
//         } catch (e) {}
//       }

//       try {
//         const annRes = await api.get('/api/notification/announcement/all');
//         if (annRes.data?.success && annRes.data?.data) {
//           setAnnouncements(annRes.data.data);
//         }
//       } catch (e) {}

//       try {
//         const holRes = await api.get('/api/holiday/all');
//         if (holRes.data?.success && holRes.data?.holidays) {
//           const currentMonth = new Date().getMonth();
//           const currentYear = new Date().getFullYear();
//           const upcoming = holRes.data.holidays.filter(h => {
//             const hDate = new Date(h.holidayDate);
//             return hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear && hDate >= new Date();
//           });
//           setHolidays(upcoming);
//         }
//       } catch (e) {}

//       setIsDataLoading(false);
//     };

//     fetchDashboardData();
//   }, [userId, user?.name]);

//   // --- Strict Verification and Custom Error Handling ---
//   const verifyLocationAndExecute = (actionCallback) => {
//     setGeoError('');
//     setIsActionLoading(true);

//     if (!navigator.geolocation) {
//       setGeoError("Location tracking is not supported by your browser.");
//       setIsActionLoading(false);
//       return;
//     }

//     navigator.geolocation.getCurrentPosition(
//       (position) => {
//         const { latitude, longitude } = position.coords;
//         const distance = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
        
//         if (distance <= GEOFENCE_RADIUS_KM) {
//           actionCallback(latitude, longitude, distance);
//         } else {
//           setGeoError(`Out of Range Location: You are ${distance.toFixed(2)} km away. You must be within ${GEOFENCE_RADIUS_KM * 1000} meters of the office.`);
//           setIsActionLoading(false);
//         }
//       },
//       (error) => {
//         let errorMsg = "Location error occurred.";
//         switch(error.code) {
//           case error.PERMISSION_DENIED:
//             errorMsg = "Location Permissions Denied: Please allow location access in your device/browser settings.";
//             break;
//           case error.POSITION_UNAVAILABLE:
//             errorMsg = "Location Off: GPS or Location Service is turned off on your device.";
//             break;
//           case error.TIMEOUT:
//             errorMsg = "Time out: Failed to get location in time. Please step outside or connect to a stable network.";
//             break;
//         }
//         setGeoError(errorMsg);
//         setIsActionLoading(false);
//       },
//       { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 } 
//     );
//   };
  
//   const handleAttendanceAction = async (endpoint, payload) => {
//     try {
//       const response = await api.post(endpoint, payload);
//       if (response.data?.success) {
//         syncAttendance(); 
//       } else {
//         setGeoError(response.data?.message || "Action failed.");
//       }
//     } catch (err) {
//       setGeoError(err.response?.data?.message || err.message || "Server Error");
//     } finally {
//       setIsActionLoading(false);
//     }
//   };

//   // --- Exact Mapped Action Payloads ---
//   const onCheckInClick = () => {
//     if (hasCheckedInToday) return;
//     verifyLocationAndExecute((lat, lng, distance) => {
//       const payload = {
//         userId,
//         date: new Date().toISOString().split('T')[0],
//         checkInTime: new Date().toISOString(),
//         checkInLocation: {
//           latitude: lat,
//           longitude: lng,
//           distanceFromOffice: parseFloat(distance.toFixed(2))
//         },
//         isLate: false, 
//         status: "present",
//         isActiveSession: true
//       };
//       handleAttendanceAction('/api/attendance/check-in', payload);
//     });
//   };

//   const onStartBreakClick = () => {
//     if (breakCount >= 2 || attendanceStatus !== 'checked_in') return;
//     verifyLocationAndExecute((lat, lng, distance) => {
//       const payload = {
//         userId,
//         date: new Date().toISOString().split('T')[0],
//         startTime: new Date().toISOString(),
//         startLocation: {
//           latitude: lat,
//           longitude: lng,
//           distanceFromOffice: parseFloat(distance.toFixed(2))
//         }
//       };
//       handleAttendanceAction('/api/attendance/break/start', payload);
//     });
//   };

//   const onResumeWorkClick = () => {
//     if (attendanceStatus !== 'on_break') return;
//     verifyLocationAndExecute((lat, lng, distance) => {
//       const endTime = new Date();
//       // Calculate duration dynamically based on the start time fetched from backend
//       const duration = activeBreakIsoStart 
//         ? Math.max(0, Math.round((endTime - new Date(activeBreakIsoStart)) / 60000)) 
//         : 0;

//       const payload = {
//         userId,
//         date: new Date().toISOString().split('T')[0],
//         endTime: endTime.toISOString(),
//         duration: duration,
//         endLocation: {
//           latitude: lat,
//           longitude: lng,
//           distanceFromOffice: parseFloat(distance.toFixed(2))
//         }
//       };
//       handleAttendanceAction('/api/attendance/break/end', payload);
//     });
//   };

//   const onCheckOutClick = () => {
//     if (attendanceStatus === 'on_break' || hasCheckedOutToday || !hasCheckedInToday) return;
//     verifyLocationAndExecute((lat, lng, distance) => {
//       const payload = {
//         userId,
//         date: new Date().toISOString().split('T')[0],
//         checkOutTime: new Date().toISOString(),
//         checkOutLocation: {
//           latitude: lat,
//           longitude: lng,
//           distanceFromOffice: parseFloat(distance.toFixed(2))
//         },
//         isActiveSession: false
//       };
//       handleAttendanceAction('/api/attendance/check-out', payload);
//     });
//   };

//   const formatDateDayMonth = (isoString) => {
//     if (!isoString) return '';
//     const d = new Date(isoString);
//     return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
//   };

//   // --- Calculate Timeline Layout Variables ---
//   const activeSegments = todaySegments.filter(seg => seg.type !== 'grey');
//   let minMinutes = Infinity;
//   let maxMinutes = 0;

//   activeSegments.forEach(seg => {
//     const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
//     const localTo = convertUTCMinutesToLocal(seg.toMinutes);
//     if (localFrom < minMinutes) minMinutes = localFrom;
//     if (localTo > maxMinutes) maxMinutes = localTo;
//   });

//   if (minMinutes === Infinity) {
//     minMinutes = 540; // Fallback 9:00 AM
//     maxMinutes = 1080; // Fallback 6:00 PM
//   }
//   const totalDurationMinutes = maxMinutes - minMinutes || 1;
//   const breakSegment = activeSegments.find(s => s.type === 'yellow');
//   const breakStartTime = breakSegment ? formatMinutesToTimeStr(convertUTCMinutesToLocal(breakSegment.fromMinutes)) : '';

//   return (
//     <div className="min-h-full space-y-6">
      
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
//             Welcome back, {liveFirstName}
//           </h1>
//           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here is your daily overview and active tracking.</p>
//         </div>
//         <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-2 shadow-sm">
//           <Calendar size={16} className="text-blue-600 dark:text-blue-500" />
//           <span className="font-medium">Today's Overview</span>
//         </div>
//       </div>

//       {/* KPI Cards (5 items) */}
//       <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
//         {[
//           { label: 'Today Work Hours', value: totalWorkTimeDisplay, icon: Clock, accent: 'border-l-blue-500' },
//           { label: 'Tasks To Do', value: tasksStats.todo, icon: CheckSquare, accent: 'border-l-slate-400' },
//           { label: 'In Progress', value: tasksStats.inProgress, icon: TrendingUp, accent: 'border-l-amber-500' },
//           { label: 'Completed', value: tasksStats.completed, icon: FileCheck, accent: 'border-l-green-500' },
//           { label: 'Paid Balance', value: leaveBalance, icon: Calendar, accent: 'border-l-indigo-500' }
//         ].map((item, idx) => {
//           const Icon = item.icon;
//           return (
//             <div key={`kpi-${idx}`} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm flex flex-col justify-between h-24`}>
//               <div className="flex justify-between items-start w-full">
//                 <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</span>
//                 <Icon size={14} className="text-slate-400 dark:text-slate-500" />
//               </div>
//               <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
//                 {isDataLoading && idx !== 0 ? <Loader2 size={20} className="animate-spin text-slate-400" /> : item.value}
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
//         {/* TIME & ATTENDANCE - QUICK ACTIONS & TIMELINE */}
//         <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors shadow-sm p-4 sm:p-6 flex flex-col justify-center">

//           {geoError && (
//             <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-semibold flex items-center justify-center gap-2">
//               <AlertCircle size={14} /> {geoError}
//             </div>
//           )}

//           {/* Quick Actions */}
//           <div>
//             <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
//               <Clock size={16} className="text-slate-400" /> Quick Actions
//             </h3>
            
//             <div className="flex justify-between items-center px-2">
//               {/* Check In */}
//               <button 
//                 onClick={onCheckInClick}
//                 disabled={isActionLoading || hasCheckedInToday}
//                 className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${hasCheckedInToday ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
//               >
//                 <div className={`w-14 h-14 rounded-full flex items-center justify-center ${hasCheckedInToday ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#ECFDF5] text-[#10B981] shadow-sm'}`}>
//                   {isActionLoading && !hasCheckedInToday ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
//                 </div>
//                 <div className="text-center">
//                   <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Check In</p>
//                   <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkInTimeDisplay}</p>
//                 </div>
//               </button>

//               {/* Break In */}
//               <button 
//                 onClick={onStartBreakClick}
//                 disabled={isActionLoading || attendanceStatus !== 'checked_in' || breakCount >= 2}
//                 className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${attendanceStatus !== 'checked_in' || breakCount >= 2 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
//               >
//                 <div className={`w-14 h-14 rounded-full flex items-center justify-center ${attendanceStatus !== 'checked_in' || breakCount >= 2 ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#FFFBEB] text-[#F59E0B] shadow-sm'}`}>
//                   {isActionLoading && attendanceStatus === 'checked_in' ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
//                 </div>
//                 <div className="text-center">
//                   <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Break In</p>
//                   <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakInTimeDisplay}</p>
//                 </div>
//               </button>

//               {/* Break Out */}
//               <button 
//                 onClick={onResumeWorkClick}
//                 disabled={isActionLoading || attendanceStatus !== 'on_break'}
//                 className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${attendanceStatus !== 'on_break' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
//               >
//                 <div className={`w-14 h-14 rounded-full flex items-center justify-center ${attendanceStatus !== 'on_break' ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-slate-100 text-slate-600 shadow-sm'}`}>
//                   {isActionLoading && attendanceStatus === 'on_break' ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
//                 </div>
//                 <div className="text-center">
//                   <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Break Out</p>
//                   <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakOutTimeDisplay}</p>
//                 </div>
//               </button>

//               {/* Check Out */}
//               <button 
//                 onClick={onCheckOutClick}
//                 disabled={isActionLoading || !hasCheckedInToday || hasCheckedOutToday || attendanceStatus === 'on_break'}
//                 className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${!hasCheckedInToday || hasCheckedOutToday || attendanceStatus === 'on_break' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
//               >
//                 <div className={`w-14 h-14 rounded-full flex items-center justify-center ${!hasCheckedInToday || hasCheckedOutToday || attendanceStatus === 'on_break' ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#FEF2F2] text-[#EF4444] shadow-sm'}`}>
//                   {isActionLoading && attendanceStatus === 'checked_in' ? <Loader2 className="animate-spin" size={24} /> : <LogOut size={24} />}
//                 </div>
//                 <div className="text-center">
//                   <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Check Out</p>
//                   <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkOutTimeDisplay}</p>
//                 </div>
//               </button>
//             </div>
//           </div>

//           {/* Timeline Visualizer */}
//           <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
//             <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
//               {activeSegments.length > 0 ? (
//                 activeSegments.map((seg, sIdx) => {
//                   const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
//                   const localTo = convertUTCMinutesToLocal(seg.toMinutes);
                  
//                   const startPercent = Math.max(0, ((localFrom - minMinutes) / totalDurationMinutes) * 100);
//                   const widthPercent = Math.min(100 - startPercent, ((localTo - localFrom) / totalDurationMinutes) * 100);
                  
//                   let colorClass = 'bg-[#3B82F6]'; // Default Blue
//                   if (seg.type === 'yellow') colorClass = 'bg-[#F59E0B]'; // Amber Break

//                   return (
//                     <div 
//                       key={sIdx}
//                       title={`${seg.label} (${formatMinutesToTimeStr(localFrom)} - ${formatMinutesToTimeStr(localTo)})`}
//                       style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
//                       className={`absolute top-0 bottom-0 h-full ${colorClass} transition-all border-r border-white/20`}
//                     />
//                   );
//                 })
//               ) : (
//                 <div className="w-full h-full bg-slate-100 dark:bg-slate-800"></div>
//               )}
//             </div>
//             <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-wider font-mono">
//               <span>{activeSegments.length > 0 ? formatMinutesToTimeStr(minMinutes) : '--:--'}</span>
//               {breakStartTime && <span>{breakStartTime}</span>}
//               <span>{activeSegments.length > 0 && hasCheckedOutToday ? formatMinutesToTimeStr(maxMinutes) : '--:--'}</span>
//             </div>
//           </div>
//         </div>

//         {/* VERTICAL ANNOUNCEMENTS LIST */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-sm">
//           <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
//             <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Bell size={16} className="text-[#2563EB]" /> Announcements
//             </h2>
//             {announcements.length > 0 && (
//               <span className="bg-[#EFF6FF] dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
//                 {announcements.length} Updates
//               </span>
//             )}
//           </div>
//           <div className="p-0 flex-1 overflow-y-auto max-h-[220px] divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
//             {isDataLoading ? (
//               <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
//             ) : announcements.length === 0 ? (
//               <div className="text-center p-8">
//                 <Bell size={24} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
//                 <p className="text-sm text-slate-500">No announcements.</p>
//               </div>
//             ) : (
//               announcements.map((ann, idx) => (
//                 <div key={idx} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
//                   <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-tight">
//                     {ann.title}
//                   </h3>
//                   <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
//                     {ann.message}
//                   </p>
//                   <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
//                     <Calendar size={12} /> 
//                     {ann.createdAtIST || (ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'Recent')}
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
//         {/* HOLIDAYS - HORIZONTAL DESIGN */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
//           <div className="flex items-center justify-between mb-4">
//             <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Umbrella size={16} className="text-[#10B981]" /> Upcoming Holidays
//               <span className="bg-[#ECFDF5] dark:bg-green-900/20 text-[#10B981] px-1.5 py-0.5 rounded-full text-[10px]">{holidays.length}</span>
//             </h3>
//           </div>
//           <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
//             {isDataLoading ? (
//               <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
//             ) : holidays.length === 0 ? (
//               <p className="text-sm text-slate-500 w-full text-center">No holidays this month.</p>
//             ) : (
//               holidays.map((h, i) => {
//                 const dateObj = new Date(h.holidayDate);
//                 const day = dateObj.getDate();
//                 const month = dateObj.toLocaleString('en-US', { month: 'short' });
//                 return (
//                   <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
//                     <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-green-900/10 flex flex-col items-center justify-center border border-[#D1EBE5] dark:border-green-800/30 mb-2 group-hover:scale-105 transition-transform">
//                       <span className="text-sm font-bold text-[#10B981] leading-none">{day}</span>
//                       <span className="text-[10px] font-bold text-[#10B981] uppercase mt-0.5">{month}</span>
//                     </div>
//                     <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize truncate w-full px-1">{h.holidayName}</p>
//                     <p className="text-[9px] font-bold text-[#10B981] uppercase mt-1 bg-[#ECFDF5] dark:bg-green-900/20 px-1.5 py-0.5 rounded-sm">Public</p>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* BIRTHDAYS - HORIZONTAL DESIGN */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
//           <div className="flex items-center justify-between mb-4">
//             <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Gift size={16} className="text-[#8B5CF6]" /> Upcoming Birthdays
//               <span className="bg-[#F5F3FF] dark:bg-purple-900/20 text-[#8B5CF6] px-1.5 py-0.5 rounded-full text-[10px]">{upcomingBirthdays.length}</span>
//             </h3>
//           </div>
//           <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
//             {isDataLoading ? (
//               <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
//             ) : upcomingBirthdays.length === 0 ? (
//                <p className="text-sm text-slate-500 w-full text-center">No birthdays upcoming.</p>
//             ) : (
//               upcomingBirthdays.map((b, i) => {
//                 const initials = b.name ? b.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'BD';
//                 const d = new Date(b.birthdayDate);
//                 const dateStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
                
//                 return (
//                   <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
//                     <div className="w-14 h-14 rounded-full bg-[#F5F3FF] dark:bg-purple-900/10 flex items-center justify-center text-[#8B5CF6] font-bold text-lg border border-[#E9E4FF] dark:border-purple-800/30 mb-2 group-hover:scale-105 transition-transform">
//                       {initials}
//                     </div>
//                     <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{b.name}</p>
//                     <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{dateStr}</p>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* TEAM ON LEAVE - HORIZONTAL DESIGN */}
//         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm xl:col-span-1 lg:col-span-2">
//           <div className="flex items-center justify-between mb-4">
//             <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//               <Users size={16} className="text-[#F59E0B]" /> Team On Leave
//               <span className="bg-[#FFFBEB] dark:bg-amber-900/20 text-[#F59E0B] px-1.5 py-0.5 rounded-full text-[10px]">{teamOnLeave.length}</span>
//             </h3>
//           </div>
//           <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
//             {isDataLoading ? (
//                <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
//             ) : teamOnLeave.length === 0 ? (
//                <p className="text-sm text-slate-500 w-full text-center">Everyone is present today.</p>
//             ) : (
//               teamOnLeave.map((t, i) => (
//                 <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
//                   <img src={t.profilePhoto || defaultAvatar} alt={t.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#FFFBEB] dark:border-amber-900/30 mb-2 group-hover:scale-105 transition-transform" />
//                   <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{t.name}</p>
//                   <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate w-full px-1">{t.designation}</p>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// };




import React, { useEffect, useState, useCallback } from 'react';
import { 
  Clock, Pause, LogOut, Calendar, Gift, 
  Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, AlertCircle, Map,
  Umbrella, LogIn, Coffee, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';

// --- Geofencing Configuration ---
const TARGET_LAT = 23.057808;
const TARGET_LNG = 72.538926;
const GEOFENCE_RADIUS_KM = 0.5; 

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
};

export const DashboardView = () => {
  const { user } = useApp();

  // --- Live Data States ---
  const [actualUserId, setActualUserId] = useState(null); // The true MongoDB _id
  const [liveFirstName, setLiveFirstName] = useState('Loading...');
  const [tasksStats, setTasksStats] = useState({ todo: 0, inProgress: 0, completed: 0 });
  const [leaveBalance, setLeaveBalance] = useState('--');
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnIndex, setCurrentAnnIndex] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]); 
  const [teamOnLeave, setTeamOnLeave] = useState([]); 
  const [isDataLoading, setIsDataLoading] = useState(true);

  // --- Attendance & Timeline States ---
  const [geoError, setGeoError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [todaySegments, setTodaySegments] = useState([]);
  
  const [attendanceStatus, setAttendanceStatus] = useState('not_checked_in'); 
  const [actionsAvailable, setActionsAvailable] = useState({
    canCheckIn: true,
    canStartBreak: false,
    canEndBreak: false,
    canCheckOut: false
  });

  const [activeBreakIsoStart, setActiveBreakIsoStart] = useState(null);
  const [checkInTimeDisplay, setCheckInTimeDisplay] = useState('--:--');
  const [checkOutTimeDisplay, setCheckOutTimeDisplay] = useState('--:--');
  const [totalWorkTimeDisplay, setTotalWorkTimeDisplay] = useState('0h 0m');
  const [breakInTimeDisplay, setBreakInTimeDisplay] = useState('--:--');
  const [breakOutTimeDisplay, setBreakOutTimeDisplay] = useState('--:--');
  const [totalBreakTimeDisplay, setTotalBreakTimeDisplay] = useState('0m');

  const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80';

  // --- Announcement Controls ---
  const handlePrevAnnouncement = () => {
    setCurrentAnnIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
  };
  const handleNextAnnouncement = () => {
    setCurrentAnnIndex((prev) => (prev + 1) % announcements.length);
  };

  // --- Timeline Converters ---
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

  const formatISOToLocalTime = (isoStr) => {
    if (!isoStr) return '--:--';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // --- Core Sync Logic ---
  const syncDashboardAndAttendance = useCallback(async (resolvedUserId) => {
    try {
      // 1. Fetch Dashboard (includes todayAttendance, holidays, birthdays, leaves)
      const dashRes = await api.get('/api/employee-panel/dashboard');
      const dData = dashRes.data?.data || dashRes.data || {};
      
      setUpcomingBirthdays(dData.upcomingBirthdays || []);
      setTeamOnLeave(dData.teamMembersOnLeave || []);
      if (dData.stats?.leaveBalance !== undefined) {
        setLeaveBalance(`${dData.stats.leaveBalance} Days`);
      }

      // Map Live Attendance Status
      if (dData.todayAttendance) {
        const ta = dData.todayAttendance;
        setAttendanceStatus(ta.status || 'not_checked_in');
        if (ta.actionsAvailable) setActionsAvailable(ta.actionsAvailable);
        
        if (ta.checkInTime) setCheckInTimeDisplay(formatISOToLocalTime(ta.checkInTime));
        if (ta.currentWorkingHours !== undefined) setTotalWorkTimeDisplay(`${ta.currentWorkingHours}h`);
        if (ta.breakDuration !== undefined) setTotalBreakTimeDisplay(`${ta.breakDuration}m`);
      }

      // 2. Fetch Timeline (for the visual bar and specific check-out/break boundaries)
      const tlRes = await api.get('/api/employee-panel/attendance/timeline?filter=today');
      if (tlRes.data?.data && tlRes.data.data.length > 0) {
        const todayData = tlRes.data.data[0];
        const segments = todayData.timelineSegments || [];
        setTodaySegments(segments);

        if (todayData.checkOutTime) setCheckOutTimeDisplay(formatISOToLocalTime(todayData.checkOutTime));

        // Extract latest break times
        const yellowSegments = segments.filter(s => s.type === 'yellow');
        if (yellowSegments.length > 0) {
          const lastBreak = yellowSegments[yellowSegments.length - 1];
          setBreakInTimeDisplay(formatMinutesToTimeStr(convertUTCMinutesToLocal(lastBreak.fromMinutes)));
          if (lastBreak.toMinutes > lastBreak.fromMinutes) {
            setBreakOutTimeDisplay(formatMinutesToTimeStr(convertUTCMinutesToLocal(lastBreak.toMinutes)));
          }
        }
      } else {
        setTodaySegments([]);
      }

      // 3. Fetch Tasks (Using valid MongoDB ID to prevent 500 error)
      if (resolvedUserId) {
        try {
          const taskRes = await api.get(`/api/task/employee/${resolvedUserId}`);
          const tasksList = taskRes.data?.tasks || taskRes.data?.data || taskRes.data || [];
          setTasksStats({
            todo: tasksList.filter(t => t.status === 'Assigned').length,
            inProgress: tasksList.filter(t => t.status === 'In Progress').length,
            completed: tasksList.filter(t => t.status === 'Completed').length,
          });
        } catch (e) { console.warn("Tasks sync failed:", e); }
      }

    } catch (error) {
      console.error("Failed to sync dashboard:", error);
    }
  }, []);

  // --- Initial Mount & Bootstrapper ---
  useEffect(() => {
    const bootstrapDashboard = async () => {
      setIsDataLoading(true);
      let validUserId = null;

      // Ensure we get the correct 24-character MongoDB ID from the profile API
      try {
        const pRes = await api.get('/api/users/profile');
        const prof = pRes.data?.data || pRes.data || {};
        setLiveFirstName((prof.employee?.firstName || prof.employee?.name || prof.name || 'User').split(' ')[0]);
        validUserId = prof.employee?._id || prof._id;
        setActualUserId(validUserId);
      } catch (e) {
        console.warn("Profile fetch failed. Using fallback user context.");
      }

      // Load core module data
      await syncDashboardAndAttendance(validUserId);

      // Fetch independent data (Announcements, Holidays)
      try {
        const annRes = await api.get('/api/notification/announcement/all');
        if (annRes.data?.success && annRes.data?.data) setAnnouncements(annRes.data.data);
      } catch (e) {}

      try {
        const holRes = await api.get('/api/holiday/all');
        if (holRes.data?.success && holRes.data?.holidays) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          setHolidays(holRes.data.holidays.filter(h => {
            const hDate = new Date(h.holidayDate);
            return hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear && hDate >= new Date();
          }));
        }
      } catch (e) {}

      setIsDataLoading(false);
    };

    bootstrapDashboard();

    // Auto-refresh interval
    const interval = setInterval(() => syncDashboardAndAttendance(actualUserId), 30000);
    return () => clearInterval(interval);
  }, [syncDashboardAndAttendance, actualUserId]);

  // --- Robust Geolocation & Verification ---
  const verifyLocationAndExecute = (actionCallback) => {
    setGeoError('');
    setIsActionLoading(true);

    if (!actualUserId) {
      setGeoError("User profile is syncing. Please wait a moment and try again.");
      setIsActionLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Location tracking is not supported by your browser.");
      setIsActionLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
        
        if (distance <= GEOFENCE_RADIUS_KM) {
          actionCallback(latitude, longitude, distance);
        } else {
          setGeoError(`Out of range location. You are ${distance.toFixed(2)} km away.`);
          setIsActionLoading(false);
        }
      },
      (error) => {
        let errorMsg = "Location permission and GPS coordinates are required to mark attendance.";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Location permissions denied. Please allow location access in your browser/app settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Location off. Please enable GPS on your device.";
            break;
          case error.TIMEOUT:
            errorMsg = "Time out: Failed to get location in time. Please step outside or try again.";
            break;
        }
        setGeoError(errorMsg);
        setIsActionLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } 
    );
  };
  
  const handleAttendanceAction = async (endpoint, payload) => {
    try {
      const response = await api.post(endpoint, payload);
      if (response.data?.success) {
        syncDashboardAndAttendance(actualUserId); 
      } else {
        setGeoError(response.data?.message || "Action failed.");
      }
    } catch (err) {
      setGeoError(err.response?.data?.message || err.response?.data?.error || "Server Error. Please try again.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Strict Mapped Action Payloads ---
  const onCheckInClick = () => {
    if (!actionsAvailable.canCheckIn) return;
    verifyLocationAndExecute((lat, lng, distance) => {
      const payload = {
        userId: actualUserId,
        date: new Date().toISOString().split('T')[0],
        checkInTime: new Date().toISOString(),
        checkInLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat(distance.toFixed(2))
        },
        isLate: false, 
        status: "present",
        isActiveSession: true
      };
      handleAttendanceAction('/api/attendance/check-in', payload);
    });
  };

  const onStartBreakClick = () => {
    if (!actionsAvailable.canStartBreak) return;
    const isoNow = new Date().toISOString();
    setActiveBreakIsoStart(isoNow); // Save locally for Break-Out duration calc
    verifyLocationAndExecute((lat, lng, distance) => {
      const payload = {
        userId: actualUserId,
        date: new Date().toISOString().split('T')[0],
        startTime: isoNow,
        startLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat(distance.toFixed(2))
        }
      };
      handleAttendanceAction('/api/attendance/break/start', payload);
    });
  };

  const onResumeWorkClick = () => {
    if (!actionsAvailable.canEndBreak) return;
    verifyLocationAndExecute((lat, lng, distance) => {
      const endTime = new Date();
      const duration = activeBreakIsoStart 
        ? Math.max(0, Math.round((endTime - new Date(activeBreakIsoStart)) / 60000)) 
        : 0;

      const payload = {
        userId: actualUserId,
        date: new Date().toISOString().split('T')[0],
        endTime: endTime.toISOString(),
        duration: duration,
        endLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat(distance.toFixed(2))
        }
      };
      handleAttendanceAction('/api/attendance/break/end', payload);
    });
  };

  const onCheckOutClick = () => {
    if (!actionsAvailable.canCheckOut) return;
    verifyLocationAndExecute((lat, lng, distance) => {
      const payload = {
        userId: actualUserId,
        date: new Date().toISOString().split('T')[0],
        checkOutTime: new Date().toISOString(),
        checkOutLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat(distance.toFixed(2))
        },
        isActiveSession: false
      };
      handleAttendanceAction('/api/attendance/check-out', payload);
    });
  };

  const formatDateDayMonth = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  // --- Calculate Timeline Layout Variables ---
  const activeSegments = todaySegments.filter(seg => seg.type !== 'grey');
  let minMinutes = Infinity;
  let maxMinutes = 0;

  activeSegments.forEach(seg => {
    const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
    const localTo = convertUTCMinutesToLocal(seg.toMinutes);
    if (localFrom < minMinutes) minMinutes = localFrom;
    if (localTo > maxMinutes) maxMinutes = localTo;
  });

  if (minMinutes === Infinity) {
    minMinutes = 540; 
    maxMinutes = 1080; 
  }
  const totalDurationMinutes = maxMinutes - minMinutes || 1;
  const breakSegment = activeSegments.find(s => s.type === 'yellow');
  const breakStartTime = breakSegment ? formatMinutesToTimeStr(convertUTCMinutesToLocal(breakSegment.fromMinutes)) : '';

  return (
    <div className="min-h-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Welcome back, {liveFirstName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here is your daily overview and active tracking.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-2 shadow-sm">
          <Calendar size={16} className="text-blue-600 dark:text-blue-500" />
          <span className="font-medium">Today's Overview</span>
        </div>
      </div>

      {/* KPI Cards (5 items) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Today Work Hours', value: totalWorkTimeDisplay, icon: Clock, accent: 'border-l-blue-500' },
          { label: 'Tasks To Do', value: tasksStats.todo, icon: CheckSquare, accent: 'border-l-slate-400' },
          { label: 'In Progress', value: tasksStats.inProgress, icon: TrendingUp, accent: 'border-l-amber-500' },
          { label: 'Completed', value: tasksStats.completed, icon: FileCheck, accent: 'border-l-green-500' },
          { label: 'Paid Balance', value: leaveBalance, icon: Calendar, accent: 'border-l-indigo-500' }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={`kpi-${idx}`} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm flex flex-col justify-between h-24`}>
              <div className="flex justify-between items-start w-full">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</span>
                <Icon size={14} className="text-slate-400 dark:text-slate-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isDataLoading && idx !== 0 ? <Loader2 size={20} className="animate-spin text-slate-400" /> : item.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TIME & ATTENDANCE - QUICK ACTIONS & TIMELINE */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors shadow-sm p-4 sm:p-6 flex flex-col justify-center">

          {geoError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-semibold flex items-center justify-center gap-2 text-center">
              <AlertCircle size={16} className="shrink-0" /> 
              <span>{geoError}</span>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" /> Quick Actions
            </h3>
            
            <div className="flex justify-between items-center px-2">
              {/* Check In */}
              <button 
                onClick={onCheckInClick}
                disabled={isActionLoading || !actionsAvailable.canCheckIn}
                className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${!actionsAvailable.canCheckIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${!actionsAvailable.canCheckIn ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#ECFDF5] text-[#10B981] shadow-sm'}`}>
                  {isActionLoading && actionsAvailable.canCheckIn ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Check In</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkInTimeDisplay}</p>
                </div>
              </button>

              {/* Break In */}
              <button 
                onClick={onStartBreakClick}
                disabled={isActionLoading || !actionsAvailable.canStartBreak}
                className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${!actionsAvailable.canStartBreak ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${!actionsAvailable.canStartBreak ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#FFFBEB] text-[#F59E0B] shadow-sm'}`}>
                  {isActionLoading && actionsAvailable.canStartBreak ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Break In</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakInTimeDisplay}</p>
                </div>
              </button>

              {/* Break Out */}
              <button 
                onClick={onResumeWorkClick}
                disabled={isActionLoading || !actionsAvailable.canEndBreak}
                className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${!actionsAvailable.canEndBreak ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${!actionsAvailable.canEndBreak ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-slate-100 text-slate-600 shadow-sm'}`}>
                  {isActionLoading && actionsAvailable.canEndBreak ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Break Out</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakOutTimeDisplay}</p>
                </div>
              </button>

              {/* Check Out */}
              <button 
                onClick={onCheckOutClick}
                disabled={isActionLoading || !actionsAvailable.canCheckOut}
                className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${!actionsAvailable.canCheckOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${!actionsAvailable.canCheckOut ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#FEF2F2] text-[#EF4444] shadow-sm'}`}>
                  {isActionLoading && actionsAvailable.canCheckOut ? <Loader2 className="animate-spin" size={24} /> : <LogOut size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Check Out</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkOutTimeDisplay}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Timeline Visualizer */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
              {activeSegments.length > 0 ? (
                activeSegments.map((seg, sIdx) => {
                  const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
                  const localTo = convertUTCMinutesToLocal(seg.toMinutes);
                  
                  const startPercent = Math.max(0, ((localFrom - minMinutes) / totalDurationMinutes) * 100);
                  const widthPercent = Math.min(100 - startPercent, ((localTo - localFrom) / totalDurationMinutes) * 100);
                  
                  let colorClass = 'bg-[#3B82F6]'; 
                  if (seg.type === 'yellow') colorClass = 'bg-[#F59E0B]'; 

                  return (
                    <div 
                      key={sIdx}
                      title={`${seg.label} (${formatMinutesToTimeStr(localFrom)} - ${formatMinutesToTimeStr(localTo)})`}
                      style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                      className={`absolute top-0 bottom-0 h-full ${colorClass} transition-all border-r border-white/20`}
                    />
                  );
                })
              ) : (
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800"></div>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-3 uppercase tracking-wider font-mono">
              <span>{activeSegments.length > 0 ? formatMinutesToTimeStr(minMinutes) : '--:--'}</span>
              {breakStartTime && <span>{breakStartTime}</span>}
              <span>{activeSegments.length > 0 && attendanceStatus === 'checked_out' ? formatMinutesToTimeStr(maxMinutes) : '--:--'}</span>
            </div>
          </div>
        </div>

        {/* VERTICAL ANNOUNCEMENTS LIST */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bell size={16} className="text-[#2563EB]" /> Announcements
            </h2>
            {announcements.length > 0 && (
              <span className="bg-[#EFF6FF] dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                {announcements.length} Updates
              </span>
            )}
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-[220px] divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
            {isDataLoading ? (
              <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
            ) : announcements.length === 0 ? (
              <div className="text-center p-8">
                <Bell size={24} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No announcements.</p>
              </div>
            ) : (
              announcements.map((ann, idx) => (
                <div key={idx} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-tight">
                    {ann.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                    {ann.message}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    <Calendar size={12} /> 
                    {ann.createdAtIST || (ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'Recent')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* HOLIDAYS - HORIZONTAL DESIGN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Umbrella size={16} className="text-[#10B981]" /> Upcoming Holidays
              <span className="bg-[#ECFDF5] dark:bg-green-900/20 text-[#10B981] px-1.5 py-0.5 rounded-full text-[10px]">{holidays.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : holidays.length === 0 ? (
              <p className="text-sm text-slate-500 w-full text-center">No holidays this month.</p>
            ) : (
              holidays.map((h, i) => {
                const dateObj = new Date(h.holidayDate);
                const day = dateObj.getDate();
                const month = dateObj.toLocaleString('en-US', { month: 'short' });
                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-green-900/10 flex flex-col items-center justify-center border border-[#D1EBE5] dark:border-green-800/30 mb-2 group-hover:scale-105 transition-transform">
                      <span className="text-sm font-bold text-[#10B981] leading-none">{day}</span>
                      <span className="text-[10px] font-bold text-[#10B981] uppercase mt-0.5">{month}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize truncate w-full px-1">{h.holidayName}</p>
                    <p className="text-[9px] font-bold text-[#10B981] uppercase mt-1 bg-[#ECFDF5] dark:bg-green-900/20 px-1.5 py-0.5 rounded-sm">Public</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BIRTHDAYS - HORIZONTAL DESIGN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Gift size={16} className="text-[#8B5CF6]" /> Upcoming Birthdays
              <span className="bg-[#F5F3FF] dark:bg-purple-900/20 text-[#8B5CF6] px-1.5 py-0.5 rounded-full text-[10px]">{upcomingBirthdays.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : upcomingBirthdays.length === 0 ? (
               <p className="text-sm text-slate-500 w-full text-center">No birthdays upcoming.</p>
            ) : (
              upcomingBirthdays.map((b, i) => {
                const initials = b.name ? b.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'BD';
                const d = new Date(b.birthdayDate);
                const dateStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
                
                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-[#F5F3FF] dark:bg-purple-900/10 flex items-center justify-center text-[#8B5CF6] font-bold text-lg border border-[#E9E4FF] dark:border-purple-800/30 mb-2 group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{b.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{dateStr}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TEAM ON LEAVE - HORIZONTAL DESIGN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm xl:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users size={16} className="text-[#F59E0B]" /> Team On Leave
              <span className="bg-[#FFFBEB] dark:bg-amber-900/20 text-[#F59E0B] px-1.5 py-0.5 rounded-full text-[10px]">{teamOnLeave.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
               <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : teamOnLeave.length === 0 ? (
               <p className="text-sm text-slate-500 w-full text-center">Everyone is present today.</p>
            ) : (
              teamOnLeave.map((t, i) => (
                <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                  <img src={t.profilePhoto || defaultAvatar} alt={t.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#FFFBEB] dark:border-amber-900/30 mb-2 group-hover:scale-105 transition-transform" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{t.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate w-full px-1">{t.designation}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};