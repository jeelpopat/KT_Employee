import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, User, LogOut, ChevronDown, 
  Camera, CheckCircle2, AlertCircle, CheckCheck, Plus
} from 'lucide-react';
import { useApp, resolveEmployeeName, resolveEmployeeData, fetchLiveUserProfile } from '../../context/AppContext.jsx';
import api from '../../api/axios.js'; 
import companyLogo from '../../assets/Logo.png';
import { tabToPath } from '../../utils/navigation.js';

export const Header = ({ onSignOut }) => {
  const { 
    user, currentTab, setCurrentTab, 
    attendanceStatus, handleCheckOut,
    userRole, updateUserProfile
  } = useApp();
  const navigate = useNavigate();

  const handleOpenProfile = () => {
    setCurrentTab('profile');
    if (tabToPath && tabToPath['profile']) {
      navigate(tabToPath['profile']);
    }
    setIsProfileMenuOpen(false);
  };

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [headerProfileData, setHeaderProfileData] = useState(null);

  // Refs for click-outside functionality
  const notificationRef = useRef(null);
  const profileMenuRef = useRef(null);

  // --- Live Notification States ---
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCountRef = useRef(0);

  // --- Click Outside Event Listener ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current && 
        !notificationRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
      if (
        profileMenuRef.current && 
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Request Browser Notification Permission on Mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Fetch Notifications from API
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/employee-panel/notifications');
      if (res.data?.success) {
        const fetchedList = res.data.data || [];
        const currentUnread = res.data.unreadCount ?? fetchedList.filter(n => !n.isRead).length;

        if (currentUnread > previousUnreadCountRef.current && previousUnreadCountRef.current !== 0) {
          const latestUnread = fetchedList.find(n => !n.isRead);
          if (latestUnread && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(latestUnread.title || 'Kevalon Notification', {
              body: latestUnread.message || 'You have a new update.',
              icon: '/favicon.ico'
            });
          }
        }

        previousUnreadCountRef.current = currentUnread;
        setNotifications(fetchedList);
        setUnreadCount(currentUnread);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Poll notifications every 60 seconds across screens (pause when document is hidden)
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) return;
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/api/employee-panel/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/api/employee-panel/notifications/read-all/read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchHeaderProfile = async () => {
      try {
        const pData = await fetchLiveUserProfile();
        if (pData && isMounted) {
          setHeaderProfileData(pData);
          const resolved = resolveEmployeeName(pData);
          if (resolved && updateUserProfile && user?.name !== resolved) {
            updateUserProfile({ name: resolved, fullName: resolved, employee: resolveEmployeeData(pData) });
          }
        }
      } catch (error) {
        console.error("Failed to load profile for header:", error);
      }
    };
    fetchHeaderProfile();
    return () => { isMounted = false; };
  }, []);

  const pageTitles = {
    'dashboard': userRole === 'admin' ? 'Admin Dashboard' : 'Dashboard',
    'admin-dashboard': 'Admin Dashboard',
    'admin-performance': 'Performance Analytics',
    'admin-attendance-logs': 'Attendance Logs',
    'admin-checkin-requests': 'Check-In Requests',
    'admin-leave-requests': 'Leave Requests',
    'admin-adjustments': 'Attendance Adjustments',
    'admin-holidays': 'Holidays & Events',
    'admin-employees': 'Employees Directory',
    'admin-employee-requests': 'Employee Requests',
    'admin-members': 'Team Members',
    'admin-team-lead': 'Team Leads',
    'admin-team-tasks': 'Task Management',
    'admin-office-settings': 'Office Settings',
    'admin-settings': 'System Settings',
    'settings': 'System Settings',
    'admin-applications': 'Job Applications',
    'admin-positions': 'Open Positions',
    'admin-portfolio-leads': 'Portfolio Leads',
    'admin-contacts': 'Contact Inquiries',
    'attendance': 'Attendance Logs',
    'daily-report': 'Daily Work Report',
    'tasks': 'Task Management',
    'leave': 'Leave Portal',
    'profile': 'User Profile',
    'salary': 'Salary & Compensation',
    'performance': 'Performance Analytics',
    'projects': 'Projects',
    'holiday': 'Holidays & Events',
    'team-members': 'Team Members',
    'employees': 'Employees',
    'learning-hub': 'Learning Hub',
    'internship-progress': 'Internship Progress',
    'documents': 'Documents & Records',
    'daily-follow-up': 'Daily Follow-Up',
    'team-tasks': 'Task Management',
    'team-leaves': 'Team Leave Requests',
    'report': 'Performance Analytics',
    'admin-screenshots': 'Screenshot Monitoring Portal'
  };

  const extractPhoto = (source) => {
    if (!source) return '';
    const empData = resolveEmployeeData(source);
    const profData = source.profile || source.user || source;
    return (
      empData.profilePhoto ||
      empData.profileImage ||
      empData.avatar ||
      empData.photoUrl ||
      empData.photo ||
      profData.profilePhoto ||
      profData.profileImage ||
      profData.avatar ||
      profData.photoUrl ||
      profData.photo ||
      source.profilePhoto ||
      source.profileImage ||
      source.avatar ||
      source.photoUrl ||
      source.photo ||
      ''
    );
  };

  const displayName = resolveEmployeeName(headerProfileData) || resolveEmployeeName(user) || 'Employee';
  const displayEmail = user?.email || user?.employee?.email || user?.profile?.email || headerProfileData?.email || headerProfileData?.employee?.email || 'employee@kevalon.com';
  const displayPhoto = extractPhoto(user) || extractPhoto(headerProfileData);
  const [headerImgError, setHeaderImgError] = useState(false);

  useEffect(() => {
    setHeaderImgError(false);
  }, [displayPhoto]);

  return (
    <header className="fixed top-14 left-0 right-0 z-30 h-16 border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur lg:top-0 lg:left-60">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        
        {/* Left: Eyebrow and Page Title matching KT-admin PageHeader */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kevalon Technology</p>
          <h1 className="text-base font-semibold leading-6 text-slate-900 tracking-tight">
            {pageTitles[currentTab] || 'Overview'}
          </h1>
        </div>

        {/* Right: Actions, Notifications & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active monitoring badge for employees */}
          {userRole !== 'hr' && attendanceStatus === 'checked_in' && (
            <button 
              type="button"
              onClick={() => setCurrentTab('admin-screenshots')}
              title="Screenshot Monitoring is Active"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-medium hover:bg-emerald-100/70 transition-colors cursor-pointer"
            >
              <Camera size={14} className="text-emerald-600" />
              <span>Monitoring Active</span>
            </button>
          )}

          {/* Admin Announcement Trigger Button */}
          {userRole === 'admin' && (
            <button
              type="button"
              title="Post Announcement"
              onClick={() => {
                if (currentTab !== 'admin-dashboard') {
                  setCurrentTab('admin-dashboard');
                  setTimeout(() => {
                    window.dispatchEvent(new Event("open-announcement"));
                  }, 150);
                } else {
                  window.dispatchEvent(new Event("open-announcement"));
                }
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} className="text-indigo-600" />
              <span>Announcement</span>
            </button>
          )}

          {/* Notifications Button */}
          <div className="relative" ref={notificationRef}>
            <button 
              type="button"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="View notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors relative cursor-pointer"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {/* Notification Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200/80 rounded-xl shadow-card z-50 overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-800">Notifications ({unreadCount} unread)</span>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">No notifications available</div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif._id}
                        onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                        className={`p-3.5 flex items-start gap-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors ${!notif.isRead ? 'bg-indigo-50/30' : ''}`}
                      >
                        <div className="mt-0.5 shrink-0 text-slate-500">
                          {notif.type === 'SYSTEM' ? <CheckCircle2 size={15} className="text-indigo-600" /> : 
                           notif.type === 'ANNOUNCEMENT' ? <Bell size={15} className="text-amber-500" /> : <AlertCircle size={15} className="text-slate-400" />}
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="font-semibold text-slate-800 flex justify-between items-center">
                            <span className="truncate max-w-[180px]">{notif.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">{notif.message}</p>
                        </div>
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 self-center shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button 
              type="button"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-slate-200/80 bg-white shadow-xs"
            >
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {displayPhoto && !headerImgError ? (
                    <img 
                      src={displayPhoto} 
                      alt={displayName} 
                      onError={() => setHeaderImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={companyLogo} 
                      alt="Logo" 
                      className="w-full h-full object-contain p-0.5"
                    />
                  )}
                </div>
                <span 
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" 
                  title="Online" 
                />
              </div>
              
              <div className="hidden sm:flex items-center gap-1.5 pr-1">
                <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                  {displayName}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                  userRole === 'admin'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                    : userRole === 'team_leader'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                    : userRole === 'hr'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                }`}>
                  {userRole === 'admin' ? 'ADMIN' : userRole === 'team_leader' ? 'TL' : userRole === 'hr' ? 'HR' : 'EMP'}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-400 hidden sm:inline" />
            </button>
            
            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/80 rounded-xl shadow-card z-50 py-1 divide-y divide-slate-100 animate-fade-in">
                <div 
                  onClick={handleOpenProfile}
                  className="px-3.5 py-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  title="View full profile"
                >
                  <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {displayPhoto && !headerImgError ? (
                      <img 
                        src={displayPhoto} 
                        alt={displayName} 
                        onError={() => setHeaderImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img 
                        src={companyLogo} 
                        alt="Logo" 
                        className="w-full h-full object-contain p-0.5"
                      />
                    )}
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{displayEmail}</p>
                  </div>
                </div>
                
                <div className="py-1">
                  <button 
                    type="button"
                    onClick={handleOpenProfile}
                    className="w-full px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <User size={14} className="text-slate-400" />
                    <span>My Profile</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => { 
                      handleCheckOut(); 
                      setIsProfileMenuOpen(false); 
                      if (onSignOut) onSignOut(); 
                    }}
                    className="w-full px-3.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50/80 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <LogOut size={14} className="text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;