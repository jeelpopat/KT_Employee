import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, FileText, RefreshCw, Search } from 'lucide-react';
import api from '../../api/axios.js';
import { EmployeeAvatar } from '../common/EmployeeAvatar.jsx';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getEmployeeName = (report) => {
  const employee = report.employeeId;
  return employee?.name ||
    [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') ||
    report.employeeName ||
    'Employee';
};

export const AdminDailyTaskView = () => {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await api.get('/api/dailyUpdate/admin/list');
      if (!response.data?.success || !Array.isArray(response.data.data)) {
        throw new Error(response.data?.message || 'The server returned an invalid daily report list.');
      }
      setReports(response.data.data);
    } catch (error) {
      console.error('Failed to load employee daily reports:', error);
      setErrorMessage(
        error.response?.data?.message ||
        error.message ||
        'Could not load employee daily reports. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((report) => {
      const values = [
        getEmployeeName(report),
        report.employeeId?.email,
        report.employeeId?.uniqueID,
        report.projectId?.projectName,
        report.otherProjectName,
        report.todaysWork,
        report.pendingWork,
        report.tomorrowPlan,
        report.issuesFaced,
        ...(report.taskReferences || []).map((task) => task?.taskTitle),
      ];
      return values.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [reports, search]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 animate-fade-in font-poppins">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
            <span>People &amp; Organization</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Daily Task</span>
          </div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            <span className="rounded-lg border border-indigo-100 bg-indigo-50 p-1.5 text-indigo-600">
              <FileText size={18} />
            </span>
            Employee Daily Reports
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Review daily work updates submitted by employees in your company.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchReports}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="text-xs font-semibold text-slate-700">
            {isLoading ? 'Loading reports…' : `${filteredReports.length} report${filteredReports.length === 1 ? '' : 's'}`}
          </div>
          <label className="relative block w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, project, or report…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        {errorMessage ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-700">Could not load daily reports</p>
            <p className="mt-1 text-xs text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={fetchReports}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-500">
            <RefreshCw size={16} className="animate-spin text-indigo-500" />
            Loading employee daily reports…
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">
              {search ? 'No matching reports found' : 'No daily reports submitted yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {search ? 'Try another search term.' : 'Employee submissions will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredReports.map((report) => {
              const employeeName = getEmployeeName(report);
              const projectName =
                report.projectId?.projectName ||
                report.otherProjectName ||
                report.projectName ||
                'General work';
              const taskNames = (report.taskReferences || [])
                .map((task) => task?.taskTitle)
                .filter(Boolean);

              return (
                <article key={report._id} className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar
                          employee={report.employeeId}
                          alt={`${employeeName} profile`}
                          className="h-9 w-9 border border-slate-200 shadow-2xs"
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h2 className="text-sm font-bold text-slate-900">{employeeName}</h2>
                          {report.employeeId?.uniqueID && (
                            <span className="font-mono text-[11px] text-slate-400">
                              {report.employeeId.uniqueID}
                            </span>
                          )}
                          {report.employeeId?.email && (
                            <span className="text-[11px] text-slate-500">{report.employeeId.email}</span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs font-medium text-indigo-700">{projectName}</p>
                      {taskNames.length > 0 && (
                        <p className="mt-1 text-[11px] text-slate-500">{taskNames.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={13} />
                        {formatDate(report.reportDate || report.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <Clock3 size={13} />
                        {Number(report.hoursWorked || 0)} hours
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <h3 className="mb-1 font-semibold text-slate-700">Today&apos;s Work</h3>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-600">{report.todaysWork || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <h3 className="mb-1 font-semibold text-slate-700">Tomorrow&apos;s Plan</h3>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-600">{report.tomorrowPlan || '—'}</p>
                    </div>
                    {report.pendingWork && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                        <h3 className="mb-1 font-semibold text-amber-800">Pending Work</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-600">{report.pendingWork}</p>
                      </div>
                    )}
                    {report.issuesFaced && (
                      <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3">
                        <h3 className="mb-1 font-semibold text-rose-800">Issues Faced</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-600">{report.issuesFaced}</p>
                      </div>
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
};
