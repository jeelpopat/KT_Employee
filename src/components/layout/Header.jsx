import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell, User, LogOut,
  Camera, CheckCircle2, AlertCircle, CheckCheck, Plus,
  Menu, X, Calendar, Clock, Edit3, Trash2, ExternalLink, Activity
} from 'lucide-react';
import { useApp, resolveEmployeeName, resolveEmployeeData, fetchLiveUserProfile } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';
import companyLogo from '../../assets/Logo.png';
import whiteLogo from '../../assets/white logo.png';
import { tabToPath, pathToTab } from '../../utils/navigation.js';
import { useConfirm } from '../common/ConfirmDialog.jsx';
import { showToast } from '../common/Toast.jsx';

export const Header = ({ onSignOut }) => {
  const {
    user, setCurrentTab,
    attendanceStatus, handleCheckOut,
    userRole, updateUserProfile,
    isMobileSidebarOpen, setIsMobileSidebarOpen
  } = useApp();
  const navigate = useNavigate();
  const { confirm, confirmationDialog } = useConfirm();

  const isAdmin = userRole === 'admin' || userRole === 'hr';

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
  const profilePhotoResetRef = useRef(false);

  // Refs for click-outside functionality
  const notificationRef = useRef(null);
  const profileMenuRef = useRef(null);

  // --- Admin Notifications Feed States ---
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [adminTab, setAdminTab] = useState('unread'); // 'unread' | 'all' | 'read' | 'requests' | 'announcements'
  const previousAdminUnreadRef = useRef(0);

  // --- Global Announcement Management States (Admin) ---
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showAllAnnouncementsModal, setShowAllAnnouncementsModal] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    type: 'ANNOUNCEMENT'
  });
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

  // --- Employee / TL Private Notifications States ---
  const [employeeNotifications, setEmployeeNotifications] = useState([]);
  const [employeeUnreadCount, setEmployeeUnreadCount] = useState(0);
  const [employeeTab, setEmployeeTab] = useState('unread'); // 'unread' | 'all' | 'read'
  const previousEmployeeUnreadRef = useRef(0);

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

  // Helper date formatter: e.g. "9 Oct, 06:54 pm"
  const formatNotificationDate = (dateValue) => {
    if (!dateValue) return '';
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;
    return parsedDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Helper icons and backgrounds for notifications
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'LEAVE_REQUEST':
        return <Calendar className="h-4 w-4 text-amber-600" />;
      case 'CHECKIN_REQUEST':
        return <Clock className="h-4 w-4 text-indigo-600" />;
      case 'ADJUSTMENT_REQUEST':
        return <AlertCircle className="h-4 w-4 text-purple-600" />;
      case 'ANNOUNCEMENT':
        return <Bell className="h-4 w-4 text-emerald-600" />;
      case 'HOLIDAY':
        return <Calendar className="h-4 w-4 text-rose-600" />;
      default:
        return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  const getNotificationBg = (type) => {
    switch (type) {
      case 'LEAVE_REQUEST':
        return 'bg-amber-50 border-amber-200/70';
      case 'CHECKIN_REQUEST':
        return 'bg-indigo-50 border-indigo-200/70';
      case 'ADJUSTMENT_REQUEST':
        return 'bg-purple-50 border-purple-200/70';
      case 'ANNOUNCEMENT':
        return 'bg-emerald-50 border-emerald-200/70';
      case 'HOLIDAY':
        return 'bg-rose-50 border-rose-200/70';
      default:
        return 'bg-blue-50 border-blue-200/70';
    }
  };

  // ==========================================================
  // 1. ADMIN NOTIFICATIONS LOGIC (Runs ONLY for admin / hr)
  // ==========================================================
  const fetchAdminNotificationsFeed = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const readIds = new Set(JSON.parse(localStorage.getItem('adminReadNotifications') || '[]'));

      let unifiedList = [];
      let backendSucceeded = false;

      // Try unified backend endpoint first
      try {
        const response = await fetch('https://kt-backend-yzr4.onrender.com/api/notification/admin/all', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            unifiedList = data.data;
            backendSucceeded = true;
            if (data.announcements && Array.isArray(data.announcements)) {
              setAnnouncements(data.announcements);
            }
          }
        }
      } catch (e) {
        // Fallback to aggregation
      }

      // Client-side aggregation fallback if backend unified feed returned empty or failed
      if (!backendSucceeded) {
        let announcementsList = [];
        try {
          const annRes = await fetch('https://kt-backend-yzr4.onrender.com/api/notification/announcement/all', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const annData = await annRes.json();
          if (Array.isArray(annData)) {
            announcementsList = annData;
          } else if (annData.data && Array.isArray(annData.data)) {
            announcementsList = annData.data;
          } else if (annData.announcements && Array.isArray(annData.announcements)) {
            announcementsList = annData.announcements;
          }
        } catch (e) {
          console.error('Announcement fetch error:', e);
        }

        const sortedAnn = announcementsList
          .filter((item) => item && (item.title || item.message))
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        setAnnouncements(sortedAnn);

        sortedAnn.forEach((ann) => {
          const id = ann._id || ann.id;
          unifiedList.push({
            _id: id,
            id: id,
            title: ann.title || 'Announcement',
            message: ann.message || '',
            type: ann.type || 'ANNOUNCEMENT',
            category: 'announcement',
            isRead: readIds.has(id),
            createdAt: ann.createdAt || new Date(),
          });
        });

        // Fetch pending leaves
        try {
          const leaveRes = await fetch('https://kt-backend-yzr4.onrender.com/api/leave/all', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const leaveData = await leaveRes.json();
          const leaveList = Array.isArray(leaveData) ? leaveData : leaveData.data || [];
          const pendingLeaves = leaveList.filter((l) => (l.status || '').toLowerCase().includes('pending'));
          pendingLeaves.forEach((l) => {
            const id = `leave_${l._id || l.id}`;
            const applicantName = l.employeeName || l.employeeId?.name || 'Employee';
            unifiedList.push({
              _id: id,
              id: id,
              title: 'New Leave Application',
              message: `${applicantName} applied for ${l.leaveType || 'Leave'} (${l.totalDays || 1} day(s))`,
              type: 'LEAVE_REQUEST',
              category: 'request',
              isRead: readIds.has(id),
              createdAt: l.createdAt || l.startDate || new Date(),
              link: '/attendance/leave-request',
            });
          });
        } catch (e) {
          // ignore
        }

        // Fetch upcoming holidays
        try {
          const holRes = await fetch('https://kt-backend-yzr4.onrender.com/api/holiday/current-month');
          if (holRes.ok) {
            const holData = await holRes.json();
            const holList = Array.isArray(holData)
              ? holData
              : holData.data || holData.holidays || holData.currentMonthHolidays || [];
            holList.forEach((h) => {
              const id = `holiday_${h._id || h.id || h.holidayName}`;
              unifiedList.push({
                _id: id,
                id: id,
                title: `Upcoming Holiday: ${h.holidayName || h.name || 'Holiday'}`,
                message: `Office Holiday on ${h.holidayDate ? new Date(h.holidayDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'this month'}`,
                type: 'HOLIDAY',
                category: 'announcement',
                isRead: readIds.has(id),
                createdAt: h.createdAt || new Date(),
                link: '/attendance/holidays',
              });
            });
          }
        } catch (e) {
          // ignore
        }
      }

      // Apply read status from local storage
      const listWithReadStatus = unifiedList.map((item) => {
        const itemId = item.id || item._id;
        return {
          ...item,
          isRead: item.isRead || readIds.has(itemId),
        };
      });

      listWithReadStatus.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setAdminNotifications(listWithReadStatus);
      const unread = listWithReadStatus.filter((n) => !n.isRead).length;

      if (unread > previousAdminUnreadRef.current && previousAdminUnreadRef.current !== 0) {
        const latestUnread = listWithReadStatus.find((n) => !n.isRead);
        if (latestUnread && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(latestUnread.title || 'New Admin Notification', {
            body: latestUnread.message || 'You have a new update.',
            icon: '/logo.png',
          });
        }
      }

      previousAdminUnreadRef.current = unread;
      setAdminUnreadCount(unread);
    } catch (err) {
      console.error('Error in fetchAdminNotificationsFeed:', err);
    }
  }, []);

  // Poll Admin notifications every 20 seconds and on window focus
  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) return;

    fetchAdminNotificationsFeed();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAdminNotificationsFeed();
    }, 20000);

    const onFocus = () => {
      fetchAdminNotificationsFeed();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAdmin, fetchAdminNotificationsFeed]);

  const handleAdminMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const readIds = new Set(JSON.parse(localStorage.getItem('adminReadNotifications') || '[]'));
      if (id) readIds.add(id);
      localStorage.setItem('adminReadNotifications', JSON.stringify(Array.from(readIds)));

      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (token && id && !id.startsWith('leave_') && !id.startsWith('holiday_')) {
        fetch(`https://kt-backend-yzr4.onrender.com/api/notification/read/${id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { });
      }
      setAdminNotifications((prev) =>
        prev.map((n) => (n.id === id || n._id === id ? { ...n, isRead: true } : n))
      );
      setAdminUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking admin notification as read:', err);
    }
  };

  const handleAdminMarkAllAsRead = async () => {
    try {
      const allIds = adminNotifications.map((n) => n.id || n._id);
      localStorage.setItem('adminReadNotifications', JSON.stringify(allIds));

      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (token) {
        fetch('https://kt-backend-yzr4.onrender.com/api/notification/read-all', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { });
      }
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setAdminUnreadCount(0);
    } catch (err) {
      console.error('Error marking all admin notifications as read:', err);
    }
  };

  const handleAdminNotificationClick = (item) => {
    const id = item.id || item._id;
    if (!item.isRead) {
      handleAdminMarkAsRead(id);
    }
    setIsNotificationsOpen(false);
    if (item.link) {
      navigate(item.link);
      const targetTab = pathToTab[item.link] || pathToTab[item.link.replace(/^\//, '')];
      if (targetTab && setCurrentTab) {
        setCurrentTab(targetTab);
      }
    }
  };

  const handleAnnouncementSubmit = async () => {
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      showToast('Please fill both title and message before posting.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const payload = {
        title: announcementForm.title.trim(),
        message: announcementForm.message.trim(),
        type: announcementForm.type || 'ANNOUNCEMENT',
      };

      const endpoint = editingAnnouncementId
        ? `https://kt-backend-yzr4.onrender.com/api/notification/announcement/${editingAnnouncementId}`
        : 'https://kt-backend-yzr4.onrender.com/api/notification/announcement/create';
      const method = editingAnnouncementId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      const success = response.ok && (data?.success || data?.message || data?.data);
      if (success) {
        setAnnouncementForm({
          title: '',
          message: '',
          type: 'ANNOUNCEMENT',
        });
        setEditingAnnouncementId(null);
        setShowAnnouncementModal(false);
        await fetchAdminNotificationsFeed();
        showToast('Announcement published successfully!', 'success');
      } else {
        showToast(data?.message || 'Failed to save announcement. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error posting announcement:', error);
      showToast('Failed to save announcement. Please try again.', 'error');
    }
  };

  const handleAnnouncementEdit = (announcement) => {
    setAnnouncementForm({
      title: announcement.title || '',
      message: announcement.message || '',
      type: announcement.type || 'ANNOUNCEMENT',
    });
    setEditingAnnouncementId(announcement._id || announcement.id || null);
    setShowAnnouncementModal(true);
  };

  const handleAnnouncementDelete = async (announcementId) => {
    const confirmed = await confirm({
      title: 'Delete announcement?',
      message: 'Are you sure you want to delete this announcement?',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/notification/announcement/${announcementId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        await fetchAdminNotificationsFeed();
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  // Admin filter lists
  const unreadAdminList = adminNotifications.filter((n) => !n.isRead);
  const readAdminList = adminNotifications.filter((n) => n.isRead);
  const adminRequestsCount = adminNotifications.filter(
    (n) => n.category === 'request' || n.type === 'LEAVE_REQUEST' || n.type === 'CHECKIN_REQUEST' || n.type === 'ADJUSTMENT_REQUEST'
  ).length;
  const adminAnnouncementsCount = adminNotifications.filter(
    (n) => n.category === 'announcement' || n.type === 'ANNOUNCEMENT' || n.type === 'HOLIDAY'
  ).length;

  const filteredAdminNotifications = adminNotifications.filter((n) => {
    if (adminTab === 'unread') return !n.isRead;
    if (adminTab === 'read') return n.isRead;
    if (adminTab === 'requests') {
      return n.category === 'request' || n.type === 'LEAVE_REQUEST' || n.type === 'CHECKIN_REQUEST' || n.type === 'ADJUSTMENT_REQUEST';
    }
    if (adminTab === 'announcements') {
      return n.category === 'announcement' || n.type === 'ANNOUNCEMENT' || n.type === 'HOLIDAY';
    }
    return true;
  });

  // ==========================================================
  // 2. EMPLOYEE & TL ISOLATED NOTIFICATIONS (userRole !== 'admin')
  // ==========================================================
  const fetchEmployeeNotifications = async () => {
    try {
      const res = await api.get('/api/employee-panel/notifications');
      if (res.data?.success) {
        const fetchedList = res.data.data || [];
        const currentUnread = res.data.unreadCount ?? fetchedList.filter((n) => !n.isRead).length;

        if (currentUnread > previousEmployeeUnreadRef.current && previousEmployeeUnreadRef.current !== 0) {
          const latestUnread = fetchedList.find((n) => !n.isRead);
          if (latestUnread && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(latestUnread.title || 'Kevalon Notification', {
              body: latestUnread.message || 'You have a new update.',
              icon: '/logo.png',
            });
          }
        }

        previousEmployeeUnreadRef.current = currentUnread;
        setEmployeeNotifications(fetchedList);
        setEmployeeUnreadCount(currentUnread);
      }
    } catch (error) {
      console.error('Failed to fetch employee notifications:', error);
    }
  };

  useEffect(() => {
    if (isAdmin) return;
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) return;

    fetchEmployeeNotifications();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchEmployeeNotifications();
    }, 45000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleEmployeeMarkAsRead = async (id) => {
    try {
      await api.put(`/api/employee-panel/notifications/${id}/read`);
      setEmployeeNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setEmployeeUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark employee notification as read:', error);
    }
  };

  const handleEmployeeMarkAllAsRead = async () => {
    try {
      await api.put('/api/employee-panel/notifications/read-all/read');
      setEmployeeNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setEmployeeUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all employee notifications as read:', error);
    }
  };

  const filteredEmployeeNotifications = employeeNotifications.filter((n) => {
    if (employeeTab === 'unread') return !n.isRead;
    if (employeeTab === 'read') return n.isRead;
    return true;
  });

  // User Profile Data
  useEffect(() => {
    let isMounted = true;
    const fetchHeaderProfile = async () => {
      try {
        const pData = await fetchLiveUserProfile();
        if (pData && isMounted) {
          setHeaderProfileData(profilePhotoResetRef.current ? null : pData);
          const resolved = resolveEmployeeName(pData);
          if (resolved && updateUserProfile && user?.name !== resolved) {
            updateUserProfile({
              name: resolved,
              fullName: resolved,
              ...(!profilePhotoResetRef.current && { employee: resolveEmployeeData(pData) })
            });
          }
        }
      } catch (error) {
        console.error('Failed to load profile for header:', error);
      }
    };
    fetchHeaderProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleProfilePhotoUpdated = (event) => {
      if (!Object.prototype.hasOwnProperty.call(event.detail || {}, 'photoUrl')) return;
      profilePhotoResetRef.current = !event.detail.photoUrl;
      if (profilePhotoResetRef.current) {
        setHeaderProfileData(null);
      }
    };

    window.addEventListener('kt_profile_photo_updated', handleProfilePhotoUpdated);
    return () => window.removeEventListener('kt_profile_photo_updated', handleProfilePhotoUpdated);
  }, []);

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

  const displayName = resolveEmployeeName(headerProfileData) || resolveEmployeeName(user) || (user?.email ? user.email.split('@')[0] : '') || '';
  const displayEmail =
    user?.email ||
    user?.employee?.email ||
    user?.profile?.email ||
    headerProfileData?.email ||
    headerProfileData?.employee?.email ||
    '';
  const displayPhoto = extractPhoto(user) || extractPhoto(headerProfileData);
  const [headerImgError, setHeaderImgError] = useState(false);

  useEffect(() => {
    setHeaderImgError(false);
  }, [displayPhoto]);

  const activeUnreadCount = isAdmin ? adminUnreadCount : employeeUnreadCount;

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 h-16 border-b border-[#00334d] bg-[#003d5b] text-white transition-colors shadow-xs">
      <div className="flex h-full items-center justify-between px-3 sm:px-6">

        {/* Left: Mobile Sidebar Toggle & White Brand Logo */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsMobileSidebarOpen((prev) => !prev);
              setIsNotificationsOpen(false);
              setIsProfileMenuOpen(false);
            }}
            aria-label={isMobileSidebarOpen ? 'Close navigation' : 'Open navigation'}
            className="p-1.5 rounded-lg text-white/90 hover:bg-white/10 hover:text-white focus:outline-none cursor-pointer lg:hidden transition-colors"
          >
            {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div
            onClick={() => {
              const homeTab = (userRole === 'admin' || userRole === 'hr') ? 'admin-dashboard' : 'dashboard';
              setCurrentTab(homeTab);
              if (tabToPath && tabToPath[homeTab]) {
                navigate(tabToPath[homeTab]);
              }
            }}
            className="flex items-center cursor-pointer select-none py-0.5"
            title="Kevalon Technology"
          >
            <img
              src={whiteLogo}
              alt="Kevalon Technology"
              className="h-10 sm:h-11 md:h-12 w-auto max-h-12 object-contain shrink-0 drop-shadow-xs"
            />
          </div>
        </div>

        {/* Right: Actions, Notifications, Profile & Mobile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Active monitoring badge for employees and team leads */}
          {userRole !== 'hr' && userRole !== 'admin' && attendanceStatus === 'checked_in' && (
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

          {/* Admin Announcement Trigger Button - Opens Modal Directly from Any Page */}
          {userRole === 'admin' && (
            <button
              type="button"
              title="Post Announcement"
              onClick={() => {
                setAnnouncementForm({ title: '', message: '', type: 'ANNOUNCEMENT' });
                setEditingAnnouncementId(null);
                setShowAnnouncementModal(true);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-slate-800 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} className="text-slate-800" />
              <span>Announcement</span>
            </button>
          )}

          {/* Notifications Button */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen((prev) => !prev);
                setIsProfileMenuOpen(false);
              }}
              aria-label={`Notifications${activeUnreadCount > 0 ? `, ${activeUnreadCount} unread` : ''}`}
              title="View notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors relative cursor-pointer"
            >
              <Bell size={18} />
              {activeUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-rose-500 text-white font-bold rounded-full text-[9px] ring-2 ring-[#003d5b] animate-pulse flex items-center justify-center">
                  {activeUnreadCount > 99 ? '99+' : activeUnreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown - Tailored per role */}
            {isNotificationsOpen && (
              <div className="fixed inset-x-2.5 top-[68px] sm:top-full sm:mt-2 sm:absolute sm:right-0 sm:left-auto sm:inset-x-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)] bg-white border border-slate-200/90 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in text-xs">
                {isAdmin ? (
                  <>
                    {/* Admin Header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                        {adminUnreadCount > 0 && (
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {adminUnreadCount} unread
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {adminUnreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleAdminMarkAllAsRead}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors hover:underline cursor-pointer"
                            title="Mark all as read"
                          >
                            <CheckCheck size={13} /> Mark all read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            setAnnouncementForm({ title: '', message: '', type: 'ANNOUNCEMENT' });
                            setEditingAnnouncementId(null);
                            setShowAnnouncementModal(true);
                          }}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-100 cursor-pointer transition-colors"
                        >
                          <Plus size={13} /> New
                        </button>
                      </div>
                    </div>

                    {/* Admin Filter Tabs */}
                    <div className="flex items-center border-b border-slate-100 bg-white px-2 pt-1 gap-1 text-[11px] overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setAdminTab('unread')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 cursor-pointer ${adminTab === 'unread'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Unread ({unreadAdminList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminTab('all')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 cursor-pointer ${adminTab === 'all'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        All ({adminNotifications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminTab('read')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 cursor-pointer ${adminTab === 'read'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Read ({readAdminList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminTab('requests')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 cursor-pointer ${adminTab === 'requests'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Requests ({adminRequestsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminTab('announcements')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 cursor-pointer ${adminTab === 'announcements'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Announcements ({adminAnnouncementsCount})
                      </button>
                    </div>

                    {/* Admin Items List */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100/80">
                      {filteredAdminNotifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">
                          {adminTab === 'unread' ? (
                            <>
                              <CheckCircle2 className="h-8 w-8 mx-auto mb-1.5 text-emerald-500 opacity-80" />
                              <p className="font-semibold text-slate-700 text-xs">All Caught Up!</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">No unread notifications at the moment.</p>
                            </>
                          ) : (
                            <>
                              <Bell className="h-8 w-8 mx-auto mb-1.5 text-slate-300 opacity-60" />
                              <p className="font-medium text-slate-600 text-xs">No notifications in this tab</p>
                            </>
                          )}
                        </div>
                      ) : (
                        filteredAdminNotifications.slice(0, 30).map((item, idx) => (
                          <div
                            key={item._id || item.id || idx}
                            onClick={() => handleAdminNotificationClick(item)}
                            className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer group ${!item.isRead ? 'bg-indigo-50/30 hover:bg-indigo-50/60' : 'hover:bg-slate-50 opacity-85'
                              }`}
                          >
                            <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${getNotificationBg(item.type)}`}>
                              {getNotificationIcon(item.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-xs break-words leading-snug ${!item.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                  {item.title}
                                </p>
                                {!item.isRead && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed break-words whitespace-pre-wrap">
                                {item.message}
                              </p>
                              <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                                <span>{formatNotificationDate(item.createdAt)}</span>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.category === 'announcement' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAnnouncementEdit(item);
                                        }}
                                        className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                        title="Edit"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAnnouncementDelete(item._id || item.id);
                                        }}
                                        className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                        title="Delete"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </>
                                  )}
                                  {item.link && (
                                    <span className="text-indigo-600 font-medium flex items-center gap-0.5 text-[10px]">
                                      Open <ExternalLink size={10} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Admin Footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 px-3.5 py-2.5 bg-slate-50/60">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          setShowAllAnnouncementsModal(true);
                        }}
                        className="text-[11px] font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        View all Announcements
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate('/attendance/leave-request');
                          if (setCurrentTab) {
                            setCurrentTab(pathToTab['/attendance/leave-request'] || 'admin-leave-requests');
                          }
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                      >
                        All Requests &rarr;
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Employee / TL Isolated View */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-800">
                        Notifications ({employeeUnreadCount} unread)
                      </span>
                      {employeeUnreadCount > 0 && (
                        <button
                          onClick={handleEmployeeMarkAllAsRead}
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheck size={13} /> Mark all read
                        </button>
                      )}
                    </div>

                    {/* Employee Filter Tabs */}
                    <div className="flex items-center border-b border-slate-100 bg-white px-2 pt-1 gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEmployeeTab('unread')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all cursor-pointer ${employeeTab === 'unread'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Unread ({employeeNotifications.filter((n) => !n.isRead).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeeTab('all')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all cursor-pointer ${employeeTab === 'all'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        All ({employeeNotifications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeeTab('read')}
                        className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all cursor-pointer ${employeeTab === 'read'
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Read ({employeeNotifications.filter((n) => n.isRead).length})
                      </button>
                    </div>

                    {/* Employee Items List */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {filteredEmployeeNotifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No notifications available
                        </div>
                      ) : (
                        filteredEmployeeNotifications.map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => !notif.isRead && handleEmployeeMarkAsRead(notif._id)}
                            className={`p-3 sm:p-3.5 flex items-start gap-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors ${!notif.isRead ? 'bg-indigo-50/30' : ''
                              }`}
                          >
                            <div className="mt-0.5 shrink-0 text-slate-500">
                              {notif.type === 'SYSTEM' ? (
                                <CheckCircle2 size={15} className="text-indigo-600" />
                              ) : notif.type === 'ANNOUNCEMENT' ? (
                                <Bell size={15} className="text-amber-500" />
                              ) : (
                                <AlertCircle size={15} className="text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="font-semibold text-slate-800 flex justify-between items-start gap-2">
                                <span className="break-words leading-snug">{notif.title}</span>
                                <span className="text-[10px] text-slate-400 font-mono shrink-0 mt-0.5">
                                  {formatNotificationDate(notif.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-600 mt-1 text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                                {notif.message}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 self-center shrink-0 ml-1" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Profile Menu Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen((prev) => !prev);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer bg-transparent"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-white text-[#003d5b] font-bold text-xs flex items-center justify-center ring-2 ring-white/20 shadow-xs overflow-hidden">
                  {isAdmin ? (
                    displayName
                      .split(' ')
                      .map((word) => word.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join('') || 'HK'
                  ) : displayPhoto && !headerImgError ? (
                    <img
                      src={displayPhoto}
                      alt={displayName}
                      onError={() => setHeaderImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={companyLogo}
                      alt="Company logo"
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
                <span className="text-xs font-bold truncate max-w-[150px] tracking-wide text-white uppercase">
                  {displayName || 'HARSH KOTHARI'}
                </span>
              </div>
            </button>

            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200/80 rounded-xl shadow-card z-50 py-1 divide-y divide-slate-100 animate-fade-in">
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

      {/* =======================================================
          GLOBAL MODALS (Portaled to body for unrestricted z-index)
          ======================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Post / Edit Announcement Modal */}
          {showAnnouncementModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div
                className="w-full rounded-xl border border-slate-200/90 bg-white shadow-xl overflow-hidden"
                style={{
                  width: '100%',
                  maxWidth: '28rem',
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-900">
                    {editingAnnouncementId ? 'Edit Announcement' : 'Post Announcement'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnnouncementModal(false);
                      setAnnouncementForm({ title: '', message: '', type: 'ANNOUNCEMENT' });
                      setEditingAnnouncementId(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="Enter title"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200/90 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                    <textarea
                      placeholder="Enter message..."
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200/90 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAnnouncementForm({ title: '', message: '', type: 'ANNOUNCEMENT' });
                        setEditingAnnouncementId(null);
                        setShowAnnouncementModal(false);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAnnouncementSubmit}
                      disabled={!announcementForm.title.trim() || !announcementForm.message.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
                    >
                      {editingAnnouncementId ? 'Update' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View All Announcements Modal */}
          {showAllAnnouncementsModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-xl rounded-xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-900">All Announcements</h3>
                  <button
                    type="button"
                    onClick={() => setShowAllAnnouncementsModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                  {announcements.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      No announcements
                    </div>
                  ) : (
                    announcements.map((announcement, index) => (
                      <div key={announcement._id || index} className="p-3 rounded-lg bg-slate-50/60 border border-slate-100">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-xs font-semibold text-slate-900">{announcement.title}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatNotificationDate(announcement.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{announcement.message}</p>
                        <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-200/60 pt-1.5">
                          <button
                            onClick={() => handleAnnouncementEdit(announcement)}
                            className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleAnnouncementDelete(announcement._id || announcement.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAllAnnouncementsModal(false)}
                    className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Dialog from useConfirm */}
          {confirmationDialog}
        </>,
        document.body
      )}
    </header>
  );
};

export default Header;