import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, History, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import api from '../api/axios.js';

const PAGE_SIZE = 20;
const AUDIT_LOGS_ENDPOINT = '/api/audit-logs';
const RECORD_KEYS = ['auditLogs', 'logs', 'items', 'records', 'results', 'data'];
const ENVELOPE_KEYS = ['data', 'result', 'payload'];

const findAuditRecords = (payload, depth = 0) => {
  if (Array.isArray(payload)) return { records: payload, envelope: {} };
  if (!payload || typeof payload !== 'object' || depth > 4) return null;

  for (const key of RECORD_KEYS) {
    if (Array.isArray(payload[key])) return { records: payload[key], envelope: payload };
  }

  for (const key of ENVELOPE_KEYS) {
    const result = findAuditRecords(payload[key], depth + 1);
    if (result) return result;
  }

  return null;
};

const getActorName = (record) => {
  const actor = record.actor || record.performedBy || record.user || record.userId;
  if (actor && typeof actor === 'object') {
    return actor.displayName || actor.fullName || actor.name || actor.email || actor._id || 'Unknown actor';
  }
  return record.actorName || record.performedByName || actor || 'Unknown actor';
};

const getActorRole = (record) => {
  const actor = record.actor || record.performedBy || record.user || record.userId;
  const role = record.actorRole || record.role || (actor && typeof actor === 'object' ? actor.role : '');
  if (role && typeof role === 'object') return role.roleName || role.name || '';
  return role || '';
};

const getAuditChanges = (record) => {
  const oldValues = record.oldValues ?? record.oldValue ?? record.before ?? {};
  const newValues = record.newValues ?? record.newValue ?? record.after ?? {};
  const oldObject = oldValues && typeof oldValues === 'object' && !Array.isArray(oldValues)
    ? oldValues
    : { value: oldValues };
  const newObject = newValues && typeof newValues === 'object' && !Array.isArray(newValues)
    ? newValues
    : { value: newValues };
  const fields = new Set([...Object.keys(oldObject), ...Object.keys(newObject)]);

  return [...fields]
    .filter((field) => JSON.stringify(oldObject[field]) !== JSON.stringify(newObject[field]))
    .map((field) => ({
      field,
      oldValue: oldObject[field],
      newValue: newObject[field],
    }));
};

const formatValue = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getActionStyle = (action) => {
  const normalized = String(action || '').toLowerCase();
  if (normalized.includes('delete') || normalized.includes('reject')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (normalized.includes('create') || normalized.includes('approve')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  return 'bg-sky-50 text-sky-700 border-sky-200';
};

const getErrorMessage = (error) => {
  const status = error.response?.status;
  if (status === 404) return `Audit log API is not available yet (${AUDIT_LOGS_ENDPOINT}).`;
  return error.response?.data?.message || error.message || 'Unable to load audit logs. Please try again.';
};

export default function AuditLogs() {
  const [filters, setFilters] = useState({ actor: '', action: '', entity: '', from: '', to: '' });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadAuditLogs = async () => {
      setIsLoading(true);
      setError('');
      const params = { page, limit: PAGE_SIZE };
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      try {
        const response = await api.get(AUDIT_LOGS_ENDPOINT, { params, skipCache: true });
        const result = findAuditRecords(response.data);
        if (!result) throw new Error('The audit log API returned an unsupported response format.');

        const validRecords = result.records.filter((record) =>
          record && typeof record === 'object' && !Array.isArray(record)
        );
        const pagination = result.envelope.pagination || result.envelope.meta || {};
        const nextTotal = Number(
          result.envelope.total ?? result.envelope.totalCount ?? pagination.total ?? pagination.totalCount
        );
        const nextPage = Number(result.envelope.page ?? pagination.page ?? page);
        const nextPageSize = Number(result.envelope.limit ?? pagination.limit ?? PAGE_SIZE);
        const nextTotalPages = Number(
          result.envelope.totalPages ??
          pagination.totalPages ??
          (Number.isFinite(nextTotal) ? Math.ceil(nextTotal / Math.max(nextPageSize, 1)) : 1)
        );

        if (active) {
          setRecords(validRecords);
          setTotal(Number.isFinite(nextTotal) ? nextTotal : validRecords.length);
          setTotalPages(Number.isFinite(nextTotalPages) ? Math.max(nextTotalPages, 1) : 1);
          if (Number.isFinite(nextPage) && nextPage !== page) setPage(nextPage);
        }
      } catch (loadError) {
        console.error('Audit log fetch failed:', loadError);
        if (active) {
          setRecords([]);
          setTotal(0);
          setTotalPages(1);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadAuditLogs();
    return () => {
      active = false;
    };
  }, [filters, page, refreshKey]);

  const pageSummary = useMemo(() => {
    if (total === 0) return 'No audit events';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + records.length - 1, total);
    return `Showing ${start}-${end} of ${total}`;
  }, [page, records.length, total]);

  const updateDraftFilter = (key, value) => {
    setDraftFilters((previous) => ({ ...previous, [key]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) {
      setError('Start date must be on or before end date.');
      return;
    }
    setPage(1);
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    const emptyFilters = { actor: '', action: '', entity: '', from: '', to: '' };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700">
            <History size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Audit Logs</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Review sensitive changes and who made them.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <form onSubmit={applyFilters} className="grid gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-6">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Actor
          <input
            value={draftFilters.actor}
            onChange={(event) => updateDraftFilter('actor', event.target.value)}
            placeholder="Name, email or ID"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Action
          <select
            value={draftFilters.action}
            onChange={(event) => updateDraftFilter('action', event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Entity
          <input
            value={draftFilters.entity}
            onChange={(event) => updateDraftFilter('entity', event.target.value)}
            placeholder="Employee, salary, leave..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          From
          <input
            type="date"
            value={draftFilters.from}
            max={draftFilters.to || undefined}
            onChange={(event) => updateDraftFilter('from', event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          To
          <input
            type="date"
            value={draftFilters.to}
            min={draftFilters.from || undefined}
            onChange={(event) => updateDraftFilter('to', event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-800">
            <Search size={14} />
            Apply
          </button>
          <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{error}</p>
            {error.includes('not available yet') && (
              <p className="mt-1 text-rose-600">Connect the backend audit endpoint to load recorded events.</p>
            )}
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Sensitive change history</h2>
          </div>
          <span className="text-xs text-slate-500">{pageSummary}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500">
            <RefreshCw size={16} className="animate-spin" />
            Loading audit logs...
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500">
            Audit events will appear here when the audit API is available.
          </div>
        ) : records.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <History size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No audit events found</p>
            <p className="mt-1 text-xs text-slate-500">Try changing or clearing the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record, index) => {
                  const actor = getActorName(record);
                  const role = getActorRole(record);
                  const action = record.action || record.event || 'Change';
                  const entity = record.entityType || record.entity || record.resource || '—';
                  const entityId = record.entityId || record.resourceId || record.targetId || '';
                  const changes = getAuditChanges(record);
                  return (
                    <tr key={record._id || record.id || `${record.timestamp || record.createdAt}-${index}`} className="align-top hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatTimestamp(record.timestamp || record.createdAt || record.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{actor}</div>
                        {role && <div className="mt-0.5 text-[10px] capitalize text-slate-500">{String(role).replace(/[_-]/g, ' ')}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${getActionStyle(action)}`}>
                          {String(action).replace(/[_-]+/g, ' ')}
                        </span>
                      </td>
                      <td className="max-w-52 px-4 py-3">
                        <div className="font-medium text-slate-700">{String(entity).replace(/[_-]+/g, ' ')}</div>
                        {entityId && <div className="mt-0.5 break-all font-mono text-[10px] text-slate-400">{entityId}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {changes.length === 0 ? (
                          <span className="text-slate-400">No field values recorded</span>
                        ) : (
                          <details className="group">
                            <summary className="cursor-pointer font-semibold text-sky-700 hover:text-sky-900">
                              View {changes.length} change{changes.length === 1 ? '' : 's'}
                            </summary>
                            <div className="mt-2 min-w-80 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              {changes.map((change) => (
                                <div key={change.field} className="grid grid-cols-[minmax(70px,0.6fr)_1fr_1fr] gap-2 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                                  <span className="break-words font-semibold text-slate-600">{change.field}</span>
                                  <pre className="whitespace-pre-wrap break-words text-[10px] text-rose-700">{formatValue(change.oldValue)}</pre>
                                  <pre className="whitespace-pre-wrap break-words text-[10px] text-emerald-700">{formatValue(change.newValue)}</pre>
                                </div>
                              ))}
                              <div className="grid grid-cols-[minmax(70px,0.6fr)_1fr_1fr] gap-2 text-[9px] font-bold uppercase text-slate-400">
                                <span />
                                <span>Old value</span>
                                <span>New value</span>
                              </div>
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-xs text-slate-500">{pageSummary}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={isLoading || page <= 1}
              aria-label="Previous page"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-20 text-center text-xs text-slate-600">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={isLoading || page >= totalPages}
              aria-label="Next page"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
