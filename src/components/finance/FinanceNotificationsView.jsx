import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Megaphone,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import api from '../../api/axios.js';
import { useApp } from '../../context/AppContext.jsx';
import { pathToTab } from '../../utils/navigation.js';
import { showToast } from '../common/Toast.jsx';

const getNotificationId = (notification) => String(notification?._id || notification?.id || '');

const isSyntheticRequest = (notification) => (
  notification?.category === 'request' ||
  /^(leave|checkin|adj|holiday)_/.test(getNotificationId(notification))
);

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const readStoredIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('adminReadNotifications') || '[]');
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch (error) {
    console.warn('Could not read locally stored notification read states:', error);
    return new Set();
  }
};

const writeStoredIds = (ids) => {
  try {
    localStorage.setItem('adminReadNotifications', JSON.stringify([...ids]));
  } catch (error) {
    console.error('Could not save notification read states:', error);
  }
};

const getNotificationStyle = (notification) => {
  if (notification?.category === 'announcement' || notification?.type === 'ANNOUNCEMENT') {
    return {
      icon: Megaphone,
      iconClass: 'bg-violet-50 text-violet-700',
      badgeClass: 'bg-violet-50 text-violet-700',
      label: 'Announcement',
    };
  }
  if (notification?.category === 'request' || String(notification?.type || '').includes('REQUEST')) {
    return {
      icon: AlertCircle,
      iconClass: 'bg-amber-50 text-amber-700',
      badgeClass: 'bg-amber-50 text-amber-700',
      label: 'Request',
    };
  }
  return {
    icon: Bell,
    iconClass: 'bg-sky-50 text-sky-700',
    badgeClass: 'bg-sky-50 text-sky-700',
    label: 'System',
  };
};

export default function FinanceNotificationsView() {
  const { setCurrentTab } = useApp();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get('/api/notification/admin/all', { skipCache: true });
        if (response.data?.success !== true || !Array.isArray(response.data.data)) {
          throw new Error(response.data?.message || 'The notification API returned an unsupported response.');
        }
        const locallyReadIds = readStoredIds();
        const records = response.data.data.map((notification) => ({
          ...notification,
          isRead: Boolean(
            notification.isRead ||
            notification.read ||
            locallyReadIds.has(getNotificationId(notification))
          ),
        }));
        if (active) setNotifications(records);
      } catch (loadError) {
        console.error('Finance notification feed failed:', loadError);
        if (active) {
          setNotifications([]);
          setError(loadError.response?.data?.message || loadError.message || 'Could not load notifications.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadNotifications();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter((item) => !item.isRead).length,
    read: notifications.filter((item) => item.isRead).length,
  }), [notifications]);

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (activeTab === 'unread' && notification.isRead) return false;
      if (activeTab === 'read' && !notification.isRead) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        notification.title,
        notification.message,
        notification.type,
        notification.category,
        notification.user?.name,
        notification.user?.email,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeTab, notifications, query]);

  const updateBusyIds = (id, isBusy) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const markAsRead = async (notification) => {
    const id = getNotificationId(notification);
    if (!id || notification.isRead || busyIds.has(id)) return;
    updateBusyIds(id, true);
    try {
      if (isSyntheticRequest(notification)) {
        const locallyReadIds = readStoredIds();
        locallyReadIds.add(id);
        writeStoredIds(locallyReadIds);
      } else {
        const response = await api.put(`/api/notification/read/${encodeURIComponent(id)}`);
        if (response.data?.success !== true) {
          throw new Error(response.data.message || 'Could not mark this notification as read.');
        }
        const locallyReadIds = readStoredIds();
        locallyReadIds.add(id);
        writeStoredIds(locallyReadIds);
      }
      setNotifications((current) => current.map((item) => (
        getNotificationId(item) === id ? { ...item, isRead: true } : item
      )));
    } catch (actionError) {
      console.error('Could not mark notification as read:', actionError);
      showToast(actionError.response?.data?.message || actionError.message || 'Could not mark notification as read.', 'error');
    } finally {
      updateBusyIds(id, false);
    }
  };

  const markAllAsRead = async () => {
    if (counts.unread === 0 || isMarkingAllRead) return;
    setIsMarkingAllRead(true);
    try {
      const response = await api.put('/api/notification/read-all');
      if (response.data?.success !== true) {
        throw new Error(response.data.message || 'Could not mark notifications as read.');
      }
      const locallyReadIds = readStoredIds();
      notifications.forEach((notification) => locallyReadIds.add(getNotificationId(notification)));
      writeStoredIds(locallyReadIds);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (actionError) {
      console.error('Could not mark all notifications as read:', actionError);
      showToast(actionError.response?.data?.message || actionError.message || 'Could not mark all as read.', 'error');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const deleteNotification = async (notification) => {
    const id = getNotificationId(notification);
    if (!id || isSyntheticRequest(notification) || busyIds.has(id)) return;
    updateBusyIds(id, true);
    try {
      const response = await api.delete(`/api/notification/${encodeURIComponent(id)}`);
      if (response.data?.success !== true) {
        throw new Error(response.data.message || 'Could not delete this notification.');
      }
      setNotifications((current) => current.filter((item) => getNotificationId(item) !== id));
      showToast('Notification deleted.', 'success');
    } catch (actionError) {
      console.error('Could not delete notification:', actionError);
      showToast(actionError.response?.data?.message || actionError.message || 'Could not delete notification.', 'error');
    } finally {
      updateBusyIds(id, false);
    }
  };

  const openNotification = (notification) => {
    if (!notification.isRead) markAsRead(notification);
    if (!notification.link) return;
    const tab = pathToTab[notification.link];
    if (tab && setCurrentTab) setCurrentTab(tab);
    navigate(notification.link);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Bell size={21} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200">Finance workspace</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Notifications</h1>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-300 sm:text-sm">
                Announcements, system updates, and approval requests in one place.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={counts.unread === 0 || isMarkingAllRead}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck size={14} />
              {isMarkingAllRead ? 'Updating…' : 'Mark all read'}
            </button>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={isLoading}
              aria-label="Refresh notifications"
              className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { key: 'all', label: 'All notifications', count: counts.all, color: 'text-slate-900' },
          { key: 'unread', label: 'Unread', count: counts.unread, color: 'text-indigo-700' },
          { key: 'read', label: 'Read', count: counts.read, color: 'text-emerald-700' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            aria-pressed={activeTab === item.key}
            className={`rounded-xl border bg-white p-4 text-left shadow-xs transition ${
              activeTab === item.key ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="text-xs font-medium text-slate-500">{item.label}</span>
            <span className={`mt-1 block text-2xl font-bold tabular-nums ${item.color}`}>{item.count}</span>
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Activity feed</h2>
            <p className="mt-0.5 text-xs text-slate-500">{filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notifications"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle size={25} className="text-rose-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Notifications could not be loaded</p>
              <p className="mt-1 text-xs text-rose-700">{error}</p>
            </div>
            <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <RefreshCw size={16} className="animate-spin" /> Loading activity…
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <Bell size={22} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {query ? 'No matching notifications' : activeTab === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500">New updates will appear here when available.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((notification) => {
              const style = getNotificationStyle(notification);
              const Icon = style.icon;
              const id = getNotificationId(notification);
              const canDelete = notification.category !== 'announcement' && !isSyntheticRequest(notification);
              return (
                <article key={id || `${notification.title}-${notification.createdAt}`} className={`flex gap-3 p-4 transition hover:bg-slate-50/70 sm:gap-4 sm:px-5 ${!notification.isRead ? 'bg-indigo-50/25' : ''}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{notification.title || 'Notification'}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badgeClass}`}>{style.label}</span>
                      {!notification.isRead && <span className="h-2 w-2 rounded-full bg-indigo-600" aria-label="Unread" />}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{notification.message || 'No message provided.'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                      {notification.user?.name && <span>From {notification.user.name}</span>}
                      {notification.recipientCount > 1 && <span>Sent to {notification.recipientCount} recipients</span>}
                    </div>
                    {notification.link && (
                      <button type="button" onClick={() => openNotification(notification)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                        Open request <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification)}
                        disabled={busyIds.has(id)}
                        aria-label="Mark as read"
                        title="Mark as read"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                      >
                        <Check size={15} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteNotification(notification)}
                        disabled={busyIds.has(id)}
                        aria-label="Delete notification"
                        title="Delete notification"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
