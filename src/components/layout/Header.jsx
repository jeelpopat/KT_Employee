import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, Menu, User, LogOut, ChevronDown, 
  Camera, CheckCircle2, AlertCircle, Sun, Moon, CheckCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js'; 

export const Header = ({ onSignOut }) => {
  const { 
    user, currentTab, setCurrentTab, setIsMobileSidebarOpen, 
    globalSearchQuery, setGlobalSearchQuery, attendanceStatus, handleCheckOut 
  } = useApp();

  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
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

  // Helper function to get initials from full name
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'EP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

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

  // Safe dark mode initialization
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Force apply dark mode class to HTML tag
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

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

  // Poll notifications every 30 seconds across screens
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
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
    const fetchHeaderProfile = async () => {
      try {
        const response = await api.get('/api/users/profile');
        setHeaderProfileData(response.data?.data || response.data);
      } catch (error) {
        console.error("Failed to load profile for header:", error);
      }
    };
    fetchHeaderProfile();
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      setDateString(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, []);

  const pageTitles = {
    'dashboard': 'Dashboard Overview',
    'attendance': 'Attendance Log',
    'daily-report': 'Daily Work Report',
    'tasks': 'Task Management',
    'leave': 'Leave Portal',
    'profile': 'Employee Profile'
  };

  const emp = headerProfileData?.employee || user?.employee || {};
  const prof = headerProfileData?.profile || user?.profile || user || {};

  const displayName = emp.name || prof.name || 'Employee';
  const displayEmail = emp.email || prof.email || 'emp@gmail.com';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors">
      
      <div className="flex items-center space-x-3">
        <button 
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 text-slate-500 dark:text-slate-400 rounded-md lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-wide">
            {pageTitles[currentTab] || 'Employee Management'}
          </h1>
        </div>
      </div>

      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {attendanceStatus === 'checked_in' && (
          <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-md text-xs font-medium text-green-700 dark:text-green-400">
            <Camera size={14} className="text-green-600 dark:text-green-500" />
            <span className="hidden sm:inline">Monitoring Active</span>
          </div>
        )}

        <button 
          onClick={toggleTheme}
          className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer border-none bg-transparent"
          >
            <Bell size={24} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] bg-blue-600 dark:bg-blue-500 text-white text-[11px] font-bold rounded-[4px] shadow-sm animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
          
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notifications ({unreadCount} unread)</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No notifications available</div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif._id}
                      onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                      className={`p-4 flex items-start space-x-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${!notif.isRead ? 'bg-blue-50/40 dark:bg-slate-800/40' : ''}`}
                    >
                      <div className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">
                        {notif.type === 'SYSTEM' ? <CheckCircle2 size={16} className="text-blue-500" /> : 
                         notif.type === 'ANNOUNCEMENT' ? <Bell size={16} className="text-amber-500" /> : <AlertCircle size={16} />}
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
                          <span className="truncate max-w-[200px]">{notif.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 text-xs leading-relaxed">{notif.message}</p>
                      </div>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 self-center shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu Dropdown with Dynamic Initials Avatar */}
        <div className="relative" ref={profileMenuRef}>
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center space-x-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent"
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 flex items-center justify-center text-sm font-bold tracking-wider shadow-xs">
                {getInitials(displayName)}
              </div>
              <span 
                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-slate-900" 
                title="Online" 
              />
            </div>
            
            <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
              {displayName}
            </span>
            <ChevronDown size={16} className="text-slate-400 hidden sm:inline" />
          </button>
          
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-50 py-1 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-4 py-3 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 flex items-center justify-center text-base font-bold tracking-wider shrink-0">
                  {getInitials(displayName)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{displayEmail}</p>
                </div>
              </div>
              <div className="py-1">
                <button 
                  onClick={() => { setCurrentTab('profile'); setIsProfileMenuOpen(false); }}
                  className="w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-3 transition-colors cursor-pointer"
                >
                  <User size={16} />
                  <span>My Profile</span>
                </button>
                <button 
                  onClick={() => { 
                    handleCheckOut(); 
                    setIsProfileMenuOpen(false); 
                    if (onSignOut) onSignOut(); 
                  }}
                  className="w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-3 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};