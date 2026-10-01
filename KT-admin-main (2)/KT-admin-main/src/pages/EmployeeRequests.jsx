import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Droplet,
  Hash,
  Building,
  User,
  Star,
  Clock,
  RefreshCw
} from 'lucide-react';
import { isFinanceOrExcludedUser } from '../utils/roleFilters';

const EmployeeRequests = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingState, setProcessingState] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedCards, setExpandedCards] = useState(new Set());

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('https://kt-backend-1.onrender.com/api/users/all');

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        const userList = Array.isArray(data) ? data : data?.users || data?.data || [];
        setUsers(userList);
      } catch (err) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const getUserIdentifier = (user, fallbackIndex) => {
    return user?._id || user?.id || user?.userId || user?.email || `user-${fallbackIndex}`;
  };

  const handleAction = async (user, action) => {
    const userId = getUserIdentifier(user, 0);
    const endpoint = action === 'approve'
      ? 'https://kt-backend-1.onrender.com/api/users/approve'
      : 'https://kt-backend-1.onrender.com/api/users/reject';

    setProcessingState({ userId, action });
    setError('');

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
          userId,
          _id: user?._id,
          email: user?.email,
        }),
      });

      if (!response.ok) {
        throw new Error(`${action === 'approve' ? 'Approval' : 'Rejection'} failed`);
      }

      setUsers((prevUsers) =>
        prevUsers.map((item, index) => {
          const itemId = getUserIdentifier(item, index);
          if (itemId !== userId) return item;

          return {
            ...item,
            isApproved: action === 'approve',
            approved: action === 'approve',
            status: action === 'approve' ? 'approved' : 'rejected',
          };
        })
      );
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setProcessingState(null);
    }
  };

  const toggleExpand = (userId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const getGradientColor = (name) => {
    const gradients = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-rose-500',
      'from-green-500 to-emerald-600',
      'from-indigo-500 to-indigo-600',
      'from-orange-500 to-orange-600',
      'from-teal-500 to-teal-600',
      'from-red-500 to-red-600'
    ];
    const index = (name?.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
  };

  const getStatusBadge = (user) => {
    const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
    if (isApproved) {
      return {
        text: 'Approved',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle
      };
    }
    return {
      text: 'Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock
    };
  };

  const filteredUsers = users
    .filter(user => {
      if (isFinanceOrExcludedUser(user)) return false;
      
      const searchMatch = user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.department?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!searchMatch) return false;

      const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
      if (filterStatus === 'approved') return isApproved;
      if (filterStatus === 'pending') return !isApproved;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const stats = {
    total: filteredUsers.length,
    pending: filteredUsers.filter(u => {
      const isApproved = u?.isApproved === true || u?.approved === true || u?.status === 'approved';
      return !isApproved;
    }).length,
    approved: filteredUsers.filter(u => {
      const isApproved = u?.isApproved === true || u?.approved === true || u?.status === 'approved';
      return isApproved;
    }).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 bg-clip-text text-transparent">
                Employee Requests
              </h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
                Review and manage employee access requests
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white px-3 sm:px-4 py-1.5 sm:py-2 shadow-sm border border-slate-200">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-slate-700">
                  {stats.total} Total
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-amber-50 px-3 sm:px-4 py-1.5 sm:py-2 border border-amber-200">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                <span className="text-xs sm:text-sm font-medium text-amber-700">
                  {stats.pending} Pending
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-emerald-50 px-3 sm:px-4 py-1.5 sm:py-2 border border-emerald-200">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                <span className="text-xs sm:text-sm font-medium text-emerald-700">
                  {stats.approved} Approved
                </span>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="mt-4 sm:mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 sm:py-2.5 sm:pl-10 sm:pr-4 text-xs sm:text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 sm:flex-none rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 sm:flex-none rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-16 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-xl sm:rounded-2xl border border-red-200 bg-red-50/80 backdrop-blur-sm p-3 sm:p-4 text-xs sm:text-sm text-red-700">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && filteredUsers.length === 0 && (
          <div className="flex h-48 sm:h-64 flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300" />
            <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500">No employee requests found</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Employee Cards Grid */}
        <div className="grid gap-3 sm:gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user, index) => {
            const userId = getUserIdentifier(user, index);
            const name = user?.name || user?.fullName || 'No Name';
            const email = user?.email || 'No Email';
            const role = user?.role || 'No Role';
            const department = user?.department || 'Not Specified';
            const phone = user?.phone || user?.phoneNumber || 'Not Specified';
            const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
            const isProcessingApprove = processingState?.userId === userId && processingState?.action === 'approve';
            const isProcessingReject = processingState?.userId === userId && processingState?.action === 'reject';
            const isExpanded = expandedCards.has(userId);
            const StatusBadge = getStatusBadge(user).icon;

            return (
              <div
                key={userId}
                className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1"
              >
                {/* Animated Gradient Border */}
                <div className="absolute inset-x-0 top-0 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                {/* Card Header */}
                <div className="p-3 sm:p-4 md:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`relative h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${getGradientColor(name)} flex items-center justify-center text-base sm:text-lg font-bold text-white shadow-lg flex-shrink-0`}>
                        {getInitials(name)}
                        {!isApproved && (
                          <div className="absolute -right-0.5 -top-0.5 sm:-right-1 sm:-top-1 h-2.5 w-2.5 sm:h-3 sm:w-3 animate-pulse rounded-full bg-amber-400 ring-1 sm:ring-2 ring-white"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">{name}</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 truncate">{email}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium flex-shrink-0 ${getStatusBadge(user).className}`}>
                      <StatusBadge className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span className="hidden xs:inline">{getStatusBadge(user).text}</span>
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-1.5 sm:gap-2">
                    <div className="rounded-lg bg-slate-50/50 px-2 py-1.5 sm:px-3 sm:py-2">
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                        <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span>Role</span>
                      </div>
                      <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-700 truncate">{role}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50/50 px-2 py-1.5 sm:px-3 sm:py-2">
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                        <Building className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span>Department</span>
                      </div>
                      <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-700 truncate">{department}</p>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <div className="mt-2 sm:mt-3">
                    <button
                      onClick={() => toggleExpand(userId)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-50/50 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-slate-600 transition hover:bg-slate-100"
                    >
                      <span className="text-[10px] sm:text-xs font-medium text-slate-500">
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 rounded-lg bg-slate-50/50 p-2 sm:p-3">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-600 truncate">{phone}</span>
                        </div>
                        {user?.address && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 truncate">{user.address}</span>
                          </div>
                        )}
                        {user?.dob && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 truncate">DOB: {user.dob}</span>
                          </div>
                        )}
                        {user?.bloodGroup && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                            <Droplet className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 truncate">Blood: {user.bloodGroup}</span>
                          </div>
                        )}
                        {user?.gender && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 truncate">Gender: {user.gender}</span>
                          </div>
                        )}
                        {user?.designation && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 truncate">Designation: {user.designation}</span>
                          </div>
                        )}
                        {user?.uniqueID && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                            <Hash className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 truncate">ID: {user.uniqueID}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - UPDATED WITH LIGHTER COLORS */}
                  <div className="mt-3 sm:mt-4 flex flex-col xs:flex-row gap-1.5 sm:gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(user, 'approve');
                      }}
                      disabled={isApproved || isProcessingApprove}
                      className={`flex-1 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-medium transition-all duration-200 ${
                        isApproved || isProcessingApprove
                          ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                    >
                      {isApproved ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                          Approved
                        </span>
                      ) : isProcessingApprove ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        'Approve'
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(user, 'reject');
                      }}
                      disabled={isProcessingReject}
                      className={`flex-1 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-medium transition-all duration-200 ${
                        isProcessingReject
                          ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                          : isApproved
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 hover:scale-[1.02] active:scale-[0.98]'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-200 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                    >
                      {isProcessingReject ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          Processing...
                        </span>
                      ) : isApproved ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                          Revoke
                        </span>
                      ) : (
                        'Reject'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Detail Modal - Mobile Responsive */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl sm:rounded-2xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300 mx-1 sm:mx-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient Header */}
            <div className={`bg-gradient-to-r ${getGradientColor(selectedUser?.name)} p-4 sm:p-6 relative`}>
              <button
                onClick={() => setSelectedUser(null)}
                className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full bg-white/20 p-1.5 sm:p-2 text-white transition hover:bg-white/30"
              >
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-gradient-to-br ${getGradientColor(selectedUser?.name)} flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-xl ring-2 sm:ring-4 ring-white/30`}>
                  {getInitials(selectedUser?.name || selectedUser?.fullName)}
                </div>
                <h2 className="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-white">
                  {selectedUser?.name || selectedUser?.fullName}
                </h2>
                <p className="text-xs sm:text-sm text-white/80 break-all">{selectedUser?.email}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Personal Information
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {[
                    { icon: Phone, label: 'Phone', value: selectedUser?.phoneNumber || selectedUser?.phone },
                    { icon: Calendar, label: 'Date of Birth', value: selectedUser?.dob },
                    { icon: User, label: 'Gender', value: selectedUser?.gender },
                    { icon: Droplet, label: 'Blood Group', value: selectedUser?.bloodGroup }
                  ].map((item, idx) => (
                    item.value && (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 px-2 sm:px-3 py-1.5 sm:py-2">
                        <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">{item.label}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">{item.value}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Professional Info */}
              <div className="border-t border-slate-200 pt-3 sm:pt-4">
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Professional Details
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {[
                    { icon: Building, label: 'Department', value: selectedUser?.department },
                    { icon: Briefcase, label: 'Designation', value: selectedUser?.designation },
                    { icon: Briefcase, label: 'Role', value: selectedUser?.role },
                    { icon: Hash, label: 'Unique ID', value: selectedUser?.uniqueID }
                  ].map((item, idx) => (
                    item.value && (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 px-2 sm:px-3 py-1.5 sm:py-2">
                        <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">{item.label}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">{item.value}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Address */}
              {selectedUser?.address && (
                <div className="border-t border-slate-200 pt-3 sm:pt-4">
                  <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Address
                  </h3>
                  <div className="mt-2 sm:mt-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-2 sm:p-3 border border-blue-100">
                    <p className="text-xs sm:text-sm text-slate-700 break-words">{selectedUser.address}</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="border-t border-slate-200 pt-3 sm:pt-4">
                <div className={`rounded-lg p-2 sm:p-3 ${
                  selectedUser?.isApproved ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
                }`}>
                  <p className="text-xs sm:text-sm font-medium text-center">
                    Status: {selectedUser?.isApproved ? '✅ Approved' : '⏳ Pending Review'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRequests;