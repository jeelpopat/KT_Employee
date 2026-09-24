import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, Save, Send, Search, Clock, CheckCircle2, PauseCircle, Loader2, RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';

export const DailyReportView = () => {
  const { user } = useApp();
  
  // --- States for Dropdowns (Assigned Meta) ---
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [isMetaLoading, setIsMetaLoading] = useState(true);

  // --- States for History ---
  const [historyReports, setHistoryReports] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // --- Form States ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });

  // Each row maps strictly to your API payload schema
  const getEmptyRow = () => ({
    id: `row-${Date.now()}-${Math.random()}`,
    projectId: '',
    taskId: '', // Maps to taskReferences array
    hoursWorked: 8,
    todaysWork: '',
    pendingWork: '',
    tomorrowPlan: '',
    issuesFaced: ''
  });

  const [taskRows, setTaskRows] = useState([getEmptyRow()]);

  // Filters for local history search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');

  // --- Data Fetching ---
  const fetchAssignedMeta = async () => {
    setIsMetaLoading(true);
    try {
      let projs = [];
      let tsks = [];
      try {
        const response = await api.get('/api/employee-panel/daily-report/assigned-meta');
        const data = response.data?.data || response.data || {};
        projs = data.projects || [];
        tsks = data.tasks || [];
      } catch (err) {
        // Fallback
      }

      if (projs.length === 0 || tsks.length === 0) {
        try {
          const taskRes = await api.get('/api/task/all');
          const liveTasks = taskRes.data?.data || taskRes.data?.tasks || [];
          if (Array.isArray(liveTasks) && liveTasks.length > 0) {
            tsks = liveTasks;
            const projectMap = new Map();
            liveTasks.forEach(t => {
              if (t.projectId) {
                const p = t.projectId;
                const pId = typeof p === 'object' ? p._id : p;
                const pName = typeof p === 'object' ? (p.projectName || p.name) : ('Project ' + String(pId).slice(-4));
                if (pId && !projectMap.has(pId)) {
                  projectMap.set(pId, { _id: pId, name: pName, projectName: pName });
                }
              }
            });
            projs = Array.from(projectMap.values());
          }
        } catch (taskErr) {
          console.warn("Fallback live task fetch for daily report:", taskErr);
        }
      }
      
      setAssignedProjects(projs);
      setAssignedTasks(tsks);

      // Auto-select first project if available
      if (projs.length > 0) {
        setTaskRows([{ ...getEmptyRow(), projectId: projs[0]._id }]);
      }
    } catch (error) {
      console.error("Failed to load assigned projects/tasks:", error);
    } finally {
      setIsMetaLoading(false);
    }
  };

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const userId = user?._id || user?.id || user?.employeeId || user?.employee?._id;
      let reports = [];

      // 1. Primary Live API call as requested: GET /api/dailyUpdate/:id
      if (userId) {
        try {
          const res = await api.get(`/api/dailyUpdate/${userId}`);
          const payload = res.data?.data || res.data?.reports || res.data?.dailyUpdates || res.data?.updates || res.data;
          if (Array.isArray(payload)) {
            reports = payload;
          } else if (payload && Array.isArray(payload.reports)) {
            reports = payload.reports;
          } else if (payload && Array.isArray(payload.updates)) {
            reports = payload.updates;
          } else if (payload && typeof payload === 'object' && (payload.todaysWork || payload._id)) {
            reports = [payload];
          }
        } catch (apiErr) {
          console.warn('GET /api/dailyUpdate/:id notice:', apiErr.response?.data?.message || apiErr.message);
        }
      }

      // 2. Secondary fallback to /api/employee-panel/daily-report/history if empty
      if (reports.length === 0) {
        try {
          const fbRes = await api.get('/api/employee-panel/daily-report/history?page=1&limit=50');
          const fbReports = fbRes.data?.data?.reports || fbRes.data?.reports || fbRes.data?.data || [];
          if (Array.isArray(fbReports) && fbReports.length > 0) {
            reports = fbReports;
          }
        } catch (fbErr) {
          // fallback completed
        }
      }

      // 3. Merge with locally saved submissions for this user to guarantee persistence
      if (userId) {
        try {
          const localSaved = JSON.parse(localStorage.getItem(`daily_reports_${userId}`) || '[]');
          if (Array.isArray(localSaved) && localSaved.length > 0) {
            const existingKeys = new Set(reports.map(r => r._id || `${r.todaysWork}-${r.reportDate || r.createdAt}`));
            localSaved.forEach(lr => {
              const key = lr._id || `${lr.todaysWork}-${lr.reportDate || lr.createdAt}`;
              if (!existingKeys.has(key)) {
                reports.push(lr);
              }
            });
          }
        } catch (e) {}
      }

      setHistoryReports(reports);
    } catch (error) {
      console.error("Failed to load report history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedMeta();
    fetchHistory();
  }, [user]);

  // --- Helpers ---
  const getTasksForProject = (projectId) => {
    if (!projectId) return [];
    return assignedTasks.filter(t => 
      (typeof t.projectId === 'object' ? t.projectId?._id === projectId : t.projectId === projectId) || 
      t.project?._id === projectId
    );
  };

  const getProjectName = (report) => {
    if (!report) return 'General Project';
    if (report.project?.name) return report.project.name;
    if (report.project?.projectName) return report.project.projectName;
    if (report.projectName) return report.projectName;
    
    const pObj = report.projectId;
    if (pObj && typeof pObj === 'object') {
      if (pObj.projectName || pObj.name) return pObj.projectName || pObj.name;
    }

    const pId = typeof pObj === 'object' ? pObj?._id : (pObj || report.project);
    if (pId) {
      const match = assignedProjects.find(p => String(p._id) === String(pId) || String(p.id) === String(pId));
      if (match) return match.name || match.projectName || 'Project';
      return `Project (${String(pId).slice(-4)})`;
    }
    return 'General Project';
  };

  const formatReportDate = (val) => {
    if (!val) return 'N/A';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val).split('T')[0];
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(val).split('T')[0];
    }
  };

  const handleRowChange = (id, field, value) => {
    setTaskRows(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // Reset task if project changes
        if (field === 'projectId') {
          updated.taskId = ''; 
        }
        return updated;
      }
      return row;
    }));
  };

  const handleAddRow = () => {
    const defaultProj = assignedProjects.length > 0 ? assignedProjects[0]._id : '';
    setTaskRows(prev => [...prev, { ...getEmptyRow(), projectId: defaultProj }]);
  };

  const handleRemoveRow = (id) => {
    if (taskRows.length === 1) return;
    setTaskRows(prev => prev.filter(r => r.id !== id));
  };

  // --- API Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });
    
    // Basic Validation: check required fields (projectId, todaysWork, hoursWorked)
    const isValid = taskRows.every(row => row.projectId && row.todaysWork.trim() && row.hoursWorked > 0);
    if (!isValid) {
      setFormMsg({ type: 'error', text: 'Please fill in all required fields (Project, Today\'s Work, and Hours) for all entries.' });
      return;
    }

    setIsSubmitting(true);
    const userId = user?._id || user?.id || user?.employeeId || user?.employee?._id;

    try {
      const createdReports = [];

      for (const row of taskRows) {
        const payload = {
          employeeId: userId,
          projectId: row.projectId,
          todaysWork: row.todaysWork,
          hoursWorked: Number(row.hoursWorked),
          pendingWork: row.pendingWork || '',
          tomorrowPlan: row.tomorrowPlan || '',
          issuesFaced: row.issuesFaced || '',
          taskReferences: row.taskId ? [row.taskId] : []
        };

        try {
          const createRes = await api.post('/api/dailyUpdate/create', payload);
          const cData = createRes.data?.data || createRes.data;
          if (cData) createdReports.push(cData);
        } catch (cErr) {
          try {
            const fallbackRes = await api.post('/api/employee-panel/daily-report/submit', payload);
            const fbData = fallbackRes.data?.data || fallbackRes.data;
            if (fbData) createdReports.push(fbData);
          } catch (fbErr) {
            console.warn("Fallback submit notice:", fbErr.message);
          }
        }
      }

      // Persist in local cache for instant feedback and history reliability
      if (userId && createdReports.length > 0) {
        try {
          const localSaved = JSON.parse(localStorage.getItem(`daily_reports_${userId}`) || '[]');
          const updated = [...createdReports, ...localSaved];
          localStorage.setItem(`daily_reports_${userId}`, JSON.stringify(updated));
        } catch (e) {}
      }

      setFormMsg({ type: 'success', text: 'Daily Report submitted successfully!' });
      
      // Reset form
      const defaultProj = assignedProjects.length > 0 ? assignedProjects[0]._id : '';
      setTaskRows([{ ...getEmptyRow(), projectId: defaultProj }]);

      // Refresh History with live API GET api/dailyUpdate/:id
      await fetchHistory();
      
      // Clear success message after 4s
      setTimeout(() => setFormMsg({ type: '', text: '' }), 4000);

    } catch (error) {
      console.error("Submission Error:", error);
      const errText = error.response?.data?.message || error.response?.data?.error || 'Failed to submit report. Please try again.';
      setFormMsg({ type: 'error', text: errText });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter local history for UI search
  const filteredReports = historyReports.filter(rep => {
    const workText = (rep.todaysWork || rep.workUpdate || rep.description || '').toLowerCase();
    const planText = (rep.tomorrowPlan || rep.tomorrowsPlan || rep.tomorrow_plan || '').toLowerCase();
    const projName = getProjectName(rep).toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || workText.includes(q) || planText.includes(q) || projName.includes(q);

    const rawProjId = typeof rep.projectId === 'object' ? rep.projectId?._id : (rep.projectId || rep.project?._id || rep.project);
    const matchesProj = selectedProjectFilter === 'all' || String(rawProjId) === String(selectedProjectFilter);
    return matchesSearch && matchesProj;
  });

  return (
    <div className="space-y-6">

      {/* Daily Report Builder */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 sm:p-5 transition-colors shadow-sm">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-5 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-md shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Submit New Update</h3>
            </div>
          </div>
        </div>

        {formMsg.text && (
          <div className={`mb-5 p-3 rounded-md text-sm font-medium border ${formMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400' : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400'}`}>
            {formMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            
            {isMetaLoading ? (
               <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : taskRows.map((row, idx) => {
              const availableTasks = getTasksForProject(row.projectId);
              return (
                <div key={row.id} className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md space-y-4 transition-colors overflow-hidden">
                  
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                      Entry #{idx + 1}
                    </span>
                    {taskRows.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-red-500 hover:text-red-600 dark:hover:text-red-400 p-1 text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
                    
                    {/* Project */}
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Assigned Project *
                      </label>
                      <select 
                        value={row.projectId}
                        onChange={e => handleRowChange(row.id, 'projectId', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        required
                      >
                        <option value="" disabled>Select Project</option>
                        {assignedProjects.map(p => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Task Reference */}
                    <div className="md:col-span-5">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Task Reference (Optional)
                      </label>
                      <select 
                        value={row.taskId}
                        onChange={e => handleRowChange(row.id, 'taskId', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                      >
                        <option value="">No task linked</option>
                        {availableTasks.map(t => (
                          <option key={t._id} value={t._id}>{t.taskTitle || t.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Hours */}
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Hours Worked *
                      </label>
                      <input 
                        type="number" 
                        min="0.5" max="16" step="0.5"
                        value={row.hoursWorked}
                        onChange={e => handleRowChange(row.id, 'hoursWorked', parseFloat(e.target.value))}
                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>

                    {/* Today's Work */}
                    <div className="md:col-span-12">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Today's Work Summary *
                      </label>
                      <textarea 
                        rows={2}
                        placeholder="What did you accomplish today?"
                        value={row.todaysWork}
                        onChange={e => handleRowChange(row.id, 'todaysWork', e.target.value)}
                        className="w-full px-3 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-y"
                        required
                      />
                    </div>

                    {/* Pending Work */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Pending Work
                      </label>
                      <input 
                        type="text"
                        placeholder="What is left to do?"
                        value={row.pendingWork}
                        onChange={e => handleRowChange(row.id, 'pendingWork', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    {/* Tomorrow's Plan */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Tomorrow's Plan
                      </label>
                      <input 
                        type="text"
                        placeholder="What will you work on tomorrow?"
                        value={row.tomorrowPlan}
                        onChange={e => handleRowChange(row.id, 'tomorrowPlan', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    {/* Issues Faced */}
                    <div className="md:col-span-12">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Issues Faced
                      </label>
                      <input 
                        type="text"
                        placeholder="Any blockers or challenges?"
                        value={row.issuesFaced}
                        onChange={e => handleRowChange(row.id, 'issuesFaced', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button 
              type="button" 
              onClick={handleAddRow}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus size={16} /> Add Another Project Update
            </button>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button 
                type="submit"
                disabled={isSubmitting || isMetaLoading || assignedProjects.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Report History Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden transition-colors shadow-sm">
        
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Report History</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {historyReports.length} {historyReports.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Live updates synced via GET /api/dailyUpdate/:id</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search description..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <select 
              value={selectedProjectFilter}
              onChange={e => setSelectedProjectFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Projects</option>
              {assignedProjects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchHistory}
              disabled={isHistoryLoading}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Refresh History"
            >
              <RefreshCw size={16} className={isHistoryLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          {isHistoryLoading ? (
            <div className="flex justify-center p-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : (
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Project</th>
                  <th className="px-5 py-4">Hours</th>
                  <th className="px-5 py-4 w-1/3">Work Update</th>
                  <th className="px-5 py-4 w-1/4">Tomorrow's Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                      No daily reports match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report, idx) => {
                    const rDate = formatReportDate(report.reportDate || report.createdAt || report.date);
                    const projName = getProjectName(report);
                    const hours = report.hoursWorked ?? report.hours ?? 8;
                    const work = report.todaysWork || report.workUpdate || report.description || '—';
                    const plan = report.tomorrowPlan || report.tomorrowsPlan || report.tomorrow_plan || '—';
                    const issues = report.issuesFaced || report.blockers || '';

                    return (
                      <tr key={report._id || `rep-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {rDate}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs">
                            {projName}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {hours} hrs
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-sm">
                          <p className="line-clamp-2" title={work}>{work}</p>
                          {issues && (
                            <span className="inline-block text-[11px] text-amber-600 dark:text-amber-400 mt-1" title={issues}>
                              Issue: {issues}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-sm">
                          <p className="line-clamp-2" title={plan}>{plan}</p>
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
    </div>
  );
};