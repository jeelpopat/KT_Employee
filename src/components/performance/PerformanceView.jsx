import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, RefreshCw, Loader2, Award } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';

// Deep equality comparison helper for a performance record
const isRecordEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    String(a._id || a.id || '') === String(b._id || b.id || '') &&
    Number(a.performancePercentage ?? a.percentage ?? 0) === Number(b.performancePercentage ?? b.percentage ?? 0) &&
    String(a.rating ?? '') === String(b.rating ?? '') &&
    String(a.feedback ?? '') === String(b.feedback ?? '') &&
    String(a.remarks ?? a.remark ?? '') === String(b.remarks ?? b.remark ?? '') &&
    String(a.updatedAt || a.createdAt || '') === String(b.updatedAt || b.createdAt || '')
  );
};


/**
 * PerformanceView Component
 * Integrated with the new API workflow:
 * 1. GET /api/teamLead/team (fetches team structure and assigned employee IDs if Team Lead)
 * 2. GET /api/performance/all (fetches performance dataset and filters/matches records)
 * Completely eliminates deprecated endpoints (/api/performance/employee/:id, /api/performance/team, etc.)
 */
export const PerformanceView = () => {
  const { user } = useApp();
  const [performanceData, setPerformanceData] = useState(null);

  // Separate initial loading from silent background refreshing
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const fetchMyPerformance = async (isSilent = false) => {
    // Avoid concurrent duplicate network calls
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isSilent && !hasLoadedRef.current) {
      setInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const uEmail = (user?.email || '').toLowerCase().trim();
      const uName = (user?.name || '').toLowerCase().trim();
      const uId = String(user?._id || user?.id || user?.employeeId || '').toLowerCase().trim();
      const isTL = Boolean(
        user?.role === 'team_leader' ||
        user?.role === 'teamlead' ||
        user?.role === 'team_lead' ||
        user?.role === 'tl' ||
        user?.isTeamLeader ||
        user?.isTeamLead
      );

      // 1. If Team Lead, fetch /api/teamLead/team first to resolve team structure
      let teamMemberIds = new Set();
      let teamMemberEmails = new Set();
      if (isTL) {
        try {
          const teamRes = await api.get('/api/teamLead/team');
          const teams = Array.isArray(teamRes.data)
            ? teamRes.data
            : Array.isArray(teamRes.data?.data)
              ? teamRes.data.data
              : Array.isArray(teamRes.data?.teams)
                ? teamRes.data.teams
                : [];
          teams.forEach((t) => {
            const pool = [
              ...(Array.isArray(t.employees) ? t.employees : []),
              ...(Array.isArray(t.assignedEmployees) ? t.assignedEmployees : []),
              ...(Array.isArray(t.assignedMembers) ? t.assignedMembers : []),
              ...(Array.isArray(t.teamMembers) ? t.teamMembers : []),
              ...(Array.isArray(t.members) ? t.members : []),
              ...(Array.isArray(t.teamEmployees) ? t.teamEmployees : []),
              ...(Array.isArray(t.employeeIds) ? t.employeeIds : []),
              ...(Array.isArray(t.team?.employees) ? t.team.employees : []),
            ];
            pool.forEach((m) => {
              if (typeof m === 'string') teamMemberIds.add(m.toLowerCase().trim());
              else if (typeof m === 'object' && m) {
                if (m._id) teamMemberIds.add(String(m._id).toLowerCase().trim());
                if (m.id) teamMemberIds.add(String(m.id).toLowerCase().trim());
                if (m.employeeId) teamMemberIds.add(String(m.employeeId).toLowerCase().trim());
                if (m.userId) teamMemberIds.add(String(m.userId).toLowerCase().trim());
                if (m.email) teamMemberEmails.add(String(m.email).toLowerCase().trim());
              }
            });
          });
        } catch (teamErr) {
          console.warn('Error fetching team structure:', teamErr);
        }
      }

      let matchedData = null;

      // 2. Fetch overall dataset from /api/performance/all and filter/match records
      try {
        const allRes = await api.get('/api/performance/all');
        const list = allRes.data?.data || allRes.data?.performances || allRes.data || [];
        if (Array.isArray(list)) {
          const matched = list.find((p) => {
            if (!p || String(p.remarks || '').toLowerCase().trim() === 'nice work') return false;
            const pEmail = String(p.employeeEmail || p.email || '').toLowerCase().trim();
            const pName = String(p.employeeName || p.name || p.fullName || '').toLowerCase().trim();
            const pEmpId = String(
              (typeof p.employeeID === 'object' ? p.employeeID?._id || p.employeeID?.id : p.employeeID) ||
              (typeof p.employeeId === 'object' ? p.employeeId?._id || p.employeeId?.id : p.employeeId) ||
              p.userId ||
              ''
            ).toLowerCase().trim();

            return (
              (uEmail && pEmail === uEmail) ||
              (uName && pName === uName) ||
              (uId && pEmpId === uId)
            );
          });

          if (matched) {
            matchedData = matched;
          } else if (isTL) {
            // If TL doesn't have a personal evaluation record, find team member evaluation
            const teamMemberRecord = list.find((p) => {
              if (!p || String(p.remarks || '').toLowerCase().trim() === 'nice work') return false;
              const pEmail = String(p.employeeEmail || p.email || '').toLowerCase().trim();
              const pEmpId = String(
                (typeof p.employeeID === 'object' ? p.employeeID?._id || p.employeeID?.id : p.employeeID) ||
                (typeof p.employeeId === 'object' ? p.employeeId?._id || p.employeeId?.id : p.employeeId) ||
                p.userId ||
                ''
              ).toLowerCase().trim();
              const pSubmittedBy = String(
                (typeof p.submittedBy === 'object' ? p.submittedBy?._id || p.submittedBy?.id : p.submittedBy) || ''
              ).toLowerCase().trim();
              const pEvaluatorName = String(p.evaluatorName || '').toLowerCase().trim();

              return (
                teamMemberIds.has(pEmpId) ||
                teamMemberEmails.has(pEmail) ||
                (uId && pSubmittedBy === uId) ||
                (uName && pEvaluatorName === uName) ||
                (teamMemberIds.size === 0 && teamMemberEmails.size === 0)
              );
            });
            if (teamMemberRecord) {
              matchedData = teamMemberRecord;
            }
          }
        }
      } catch (allErr) {
        console.warn('Could not fetch from /api/performance/all:', allErr);
      }

      // Fallback candidate endpoints if /api/performance/all is restricted or didn't find the record
      // Note: Deprecated /api/performance/employee/:id and /api/performance/team endpoints are completely removed
      if (!matchedData && uId) {
        const candidateEndpoints = [
          `/api/performance/user/${uId}`,
          `/api/performance/${uId}`,
          '/api/performance/my'
        ];

        for (const ep of candidateEndpoints) {
          try {
            const res = await api.get(ep);
            const list = Array.isArray(res.data?.data)
              ? res.data.data
              : Array.isArray(res.data?.performances)
                ? res.data.performances
                : res.data?.data || res.data?.performance || res.data;
            if (Array.isArray(list) && list.length > 0) {
              const clean = list.find((p) => p && String(p.remarks || '').toLowerCase().trim() !== 'nice work');
              if (clean) {
                matchedData = clean;
                break;
              }
            } else if (list && typeof list === 'object' && list._id && String(list.remarks || '').toLowerCase().trim() !== 'nice work') {
              matchedData = list;
              break;
            }
          } catch (e) { }
        }
      }

      // Only update state if data actually changed to prevent re-renders
      setPerformanceData((prev) => {
        if (isRecordEqual(prev, matchedData)) {
          return prev;
        }
        return matchedData || null;
      });
    } catch (err) {
      console.error('My Performance fetch error:', err);
    } finally {
      hasLoadedRef.current = true;
      setInitialLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchMyPerformance(false);

    // Silent background auto-refresh every 12 seconds
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchMyPerformance(true);
    }, 12000);

    const handleFocus = () => fetchMyPerformance(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMyPerformance(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  const score = Number(performanceData?.performancePercentage ?? 0);

  const getRatingInfo = (rVal) => {
    const num = parseFloat(rVal);
    if (!isNaN(num)) {
      if (num >= 8.5) return { label: `${num % 1 === 0 ? num : num.toFixed(1)} / 10`, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
      if (num >= 7.0) return { label: `${num % 1 === 0 ? num : num.toFixed(1)} / 10`, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' };
      if (num >= 5.0) return { label: `${num % 1 === 0 ? num : num.toFixed(1)} / 10`, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
      return { label: `${num % 1 === 0 ? num : num.toFixed(1)} / 10`, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' };
    }
    if (rVal) return { label: String(rVal), color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' };
    return { label: 'Pending Evaluation', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' };
  };

  const ratingBadge = getRatingInfo(performanceData?.rating);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">My Performance</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Personal performance percentage (out of 100), rating (out of 10), and feedback
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchMyPerformance(false)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {initialLoading && !hasLoadedRef.current && !performanceData ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white border border-slate-200/80 rounded-xl">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-xs text-slate-500 font-medium">Loading your performance metrics...</p>
        </div>
      ) : !performanceData ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white border border-slate-200/80 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Award size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Performance Records Found</h3>
          <p className="text-xs text-slate-500 max-w-md">
            You do not have any performance evaluations recorded yet. When your administrator completes your evaluation, your score, rating, evaluator remarks, and feedback will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Main Scorecard Banner */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

              {/* Left Details */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Evaluation Scorecard</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${ratingBadge.bg} ${ratingBadge.color}`}>
                    Rating: {ratingBadge.label}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-slate-900">
                  {user?.name || user?.fullName || performanceData?.employeeName || 'Employee'}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>Email: <strong className="text-slate-700">{user?.email || performanceData?.employeeEmail || 'N/A'}</strong></span>
                  <span>Evaluator: <strong className="text-slate-700">{performanceData?.evaluatorName || (typeof performanceData?.submittedBy === 'object' ? (performanceData?.submittedBy?.name || performanceData?.submittedBy?.fullName) : performanceData?.submittedBy) || 'Admin'} ({performanceData?.evaluatorRole || 'Evaluator'})</strong></span>
                  <span>Evaluated Date: <strong className="text-slate-700">{formatDate(performanceData?.updatedAt || performanceData?.createdAt)}</strong></span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2 max-w-xl">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Performance (out of 100)</span>
                    <span>{score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-indigo-600' : score > 0 ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                      style={{ width: `${Math.max(score, 4)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Big Percentage Badge */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200/80 rounded-xl min-w-[180px] text-center shrink-0">
                <span className="text-4xl font-extrabold text-slate-900">
                  {score}%
                </span>
                <span className="text-xs font-semibold text-slate-500 mt-1">
                  Performance Score
                </span>
                <span className="text-xs font-bold text-indigo-600 mt-1">
                  Rating: {ratingBadge.label}
                </span>
              </div>
            </div>

            {/* Evaluator Remarks & Feedback */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Feedback</h4>
                  <p className="text-xs text-slate-700 italic leading-relaxed">
                    {performanceData?.feedback ? `"${performanceData.feedback}"` : "No feedback recorded."}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Remarks</h4>
                  <p className="text-xs text-slate-700 italic leading-relaxed">
                    {performanceData?.remarks || performanceData?.remark ? `"${performanceData.remarks || performanceData.remark}"` : "No remarks recorded."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceView;
