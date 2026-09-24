import React, { useState, useEffect, useMemo } from 'react';
import {
  List, Kanban, Search, Clock, Paperclip, MessageSquare,
  CheckSquare, TrendingUp, FileCheck, AlertCircle, Loader2,
  RefreshCw, Filter, FolderKanban, User, CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { TaskDetailDrawer } from './TaskDetailDrawer.jsx';
import api from '../../api/axios.js';

export const TaskManagementView = () => {
  const { user, setSelectedTask } = useApp();

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [viewMode, setViewMode] = useState('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [dragOverCol, setDragOverCol] = useState(null);

  // Status Normalizer: maps live schema and legacy status values to standard keys
  const normalizeStatus = (status = '') => {
    const s = String(status || '').toLowerCase().trim().replace(/[- ]/g, '_');
    if (['pending', 'assigned', 'to_do', 'todo'].includes(s)) return 'pending';
    if (['in_progress', 'working', 'doing'].includes(s)) return 'in_progress';
    if (['testing', 'review', 'in_review'].includes(s)) return 'review';
    if (['completed', 'done', 'finished'].includes(s)) return 'completed';
    if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
    return 'pending';
  };

  // Helper to verify if a task is assigned to the current logged-in user
  const isMyTask = (t, currentUser) => {
    if (!currentUser) return false;
    const myIds = [
      currentUser?._id,
      currentUser?.id,
      currentUser?.employee?._id,
      currentUser?.employee?.id,
      currentUser?.profile?._id,
      currentUser?.employeeId,
      currentUser?.employeeID
    ].filter(Boolean).map(String);

    const myEmail = (currentUser?.email || currentUser?.user?.email || '').toLowerCase().trim();

    // 1. Assigned Employee
    const aEmp = t.assignedEmployee;
    const aEmpId = typeof aEmp === 'object' ? aEmp?._id : aEmp;
    const aEmpEmail = typeof aEmp === 'object' ? aEmp?.email : null;
    if (aEmpId && myIds.includes(String(aEmpId))) return true;
    if (myEmail && aEmpEmail && String(aEmpEmail).toLowerCase() === myEmail) return true;

    // 2. Assigned Intern
    const aInt = t.assignedIntern;
    const aIntId = typeof aInt === 'object' ? aInt?._id : aInt;
    const aIntEmail = typeof aInt === 'object' ? aInt?.email : null;
    if (aIntId && myIds.includes(String(aIntId))) return true;
    if (myEmail && aIntEmail && String(aIntEmail).toLowerCase() === myEmail) return true;

    // 3. Assigned Team Lead (if user is team leader viewing their personal assigned tasks)
    const aTlE = t.assignedTeamLeadEmployee;
    const aTlEId = typeof aTlE === 'object' ? aTlE?._id : aTlE;
    const aTlEEmail = typeof aTlE === 'object' ? aTlE?.email : null;
    if (aTlEId && myIds.includes(String(aTlEId))) return true;
    if (myEmail && aTlEEmail && String(aTlEEmail).toLowerCase() === myEmail) return true;

    const aTlU = t.assignedTeamLeadUser;
    const aTlUId = typeof aTlU === 'object' ? aTlU?._id : aTlU;
    const aTlUEmail = typeof aTlU === 'object' ? aTlU?.email : null;
    if (aTlUId && myIds.includes(String(aTlUId))) return true;
    if (myEmail && aTlUEmail && String(aTlUEmail).toLowerCase() === myEmail) return true;

    return false;
  };

  // Fetch Live Tasks for current employee: GET /api/task/employee/:employeeId
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const empId = user?.employee?._id || user?._id || user?.id || user?.profile?._id || user?.employeeId;
      let tasksData = [];

      // 1. Primary: Fetch via GET /api/task/employee/:employeeId
      if (empId) {
        try {
          const empRes = await api.get(`/api/task/employee/${empId}`);
          const list = empRes.data?.data || empRes.data?.tasks || empRes.data;
          if (Array.isArray(list) && list.length > 0) {
            tasksData = list;
          }
        } catch (e) {
          console.warn("Could not fetch from /api/task/employee/:id:", e);
        }
      }

      // 2. Fallback: If empty or no empId, fetch from /api/task/all and strictly filter to only my tasks
      if (tasksData.length === 0) {
        try {
          const response = await api.get('/api/task/all');
          const allTasks = response.data?.data || response.data?.tasks || response.data || [];
          if (Array.isArray(allTasks)) {
            tasksData = allTasks.filter(t => isMyTask(t, user));
          }
        } catch (err) {
          console.error("Failed fallback to /api/task/all:", err);
        }
      }

      // Strictly ensure ONLY tasks assigned to the current user are set in state
      const onlyMyTasks = tasksData.filter(t => isMyTask(t, user));
      setTasks(onlyMyTasks.length > 0 ? onlyMyTasks : (tasksData.length > 0 && empId ? tasksData : []));
    } catch (error) {
      console.error("Failed to fetch my tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Handle Drag-and-Drop or Dropdown Status Updates
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    setIsUpdating(true);
    try {
      // Optimistically update UI instantly for a smooth experience
      setTasks(prevTasks => prevTasks.map(t =>
        t._id === taskId ? { ...t, status: newStatus } : t
      ));

      // Execute actual API PUT request to live backend: primary /api/projectManage/task/update/:id
      try {
        await api.put(`/api/projectManage/task/update/${taskId}`, { status: newStatus });
      } catch (pmErr) {
        const msg = pmErr.response?.data?.message || pmErr.message || '';
        if (!msg.includes('milestoneId')) {
          await api.put(`/api/task/status/${taskId}`, { status: newStatus });
        }
      }
    } catch (error) {
      console.error("Failed to update task status:", error);
      fetchTasks(); // Revert on failure
    } finally {
      setIsUpdating(false);
    }
  };

  // Distinct projects available in loaded tasks for filtering
  const projectOptions = useMemo(() => {
    const names = new Set();
    tasks.forEach(t => {
      const pName = t.projectId?.projectName || t.projectId?.name || (typeof t.projectId === 'string' ? t.projectId : null);
      if (pName) names.add(pName);
    });
    return Array.from(names);
  }, [tasks]);

  // Local Filters
  const filteredTasks = tasks.filter(task => {
    const title = task.taskTitle || task.title || '';
    const desc = task.taskDescription || task.description || '';
    const pName = task.projectId?.projectName || task.projectId?.name || '';
    const q = searchQuery.toLowerCase();

    const matchesSearch = title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || pName.toLowerCase().includes(q);
    const matchesPriority = selectedPriorityFilter === 'all' || (task.priority || '').toLowerCase() === selectedPriorityFilter.toLowerCase();
    
    const taskNormStatus = normalizeStatus(task.status);
    const matchesStatus = selectedStatusFilter === 'all' || 
      taskNormStatus === selectedStatusFilter.toLowerCase() ||
      (task.status || '').toLowerCase() === selectedStatusFilter.toLowerCase();

    const matchesProject = selectedProjectFilter === 'all' || pName === selectedProjectFilter;

    return matchesSearch && matchesPriority && matchesStatus && matchesProject;
  });

  // Analytics Metrics using normalized statuses
  const totalCount = tasks.length;
  const pendingCount = tasks.filter(t => normalizeStatus(t.status) === 'pending').length;
  const inProgressCount = tasks.filter(t => normalizeStatus(t.status) === 'in_progress').length;
  const reviewCount = tasks.filter(t => normalizeStatus(t.status) === 'review').length;
  const completedCount = tasks.filter(t => normalizeStatus(t.status) === 'completed').length;

  const getPriorityBadge = (priority = 'medium') => {
    const p = String(priority || '').toLowerCase();
    if (p === 'critical' || p === 'urgent') {
      return <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold text-[10px] border border-red-200 dark:border-red-800/50">Critical</span>;
    }
    if (p === 'high') {
      return <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold text-[10px] border border-amber-200 dark:border-amber-800/50">High</span>;
    }
    if (p === 'medium') {
      return <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold text-[10px] border border-blue-200 dark:border-blue-800/50">Medium</span>;
    }
    return <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] border border-slate-200 dark:border-slate-700">Low</span>;
  };

  const kanbanColumns = [
    { id: 'pending', title: 'To Do', count: pendingCount, borderAccent: 'border-t-slate-400' },
    { id: 'in_progress', title: 'In Progress', count: inProgressCount, borderAccent: 'border-t-amber-500' },
    { id: 'review', title: 'In Review / Testing', count: reviewCount, borderAccent: 'border-t-indigo-500' },
    { id: 'completed', title: 'Completed', count: completedCount, borderAccent: 'border-t-green-500' }
  ];

  // Mobile-Optimized and Desktop List View Table
  const ListViewTable = () => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden transition-colors w-full shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 md:px-5 py-4">Task Title</th>
              <th className="px-4 md:px-5 py-4">Project</th>
              <th className="hidden lg:table-cell px-5 py-4">Assignee</th>
              <th className="hidden md:table-cell px-5 py-4">Priority</th>
              <th className="hidden md:table-cell px-5 py-4">Due Date</th>
              <th className="hidden md:table-cell px-5 py-4">Progress</th>
              <th className="px-4 md:px-5 py-4 w-40">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-500">No tasks found matching your filters.</td>
              </tr>
            ) : (
              filteredTasks.map(task => {
                const normStatus = normalizeStatus(task.status);
                const projectName = task.projectId?.projectName || task.projectId?.name || (typeof task.projectId === 'string' ? task.projectId : 'Project Task');
                const assigneeName = task.assignedEmployee?.name || task.assignedIntern?.name || 'Unassigned';

                return (
                  <tr 
                    key={task._id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group" 
                    onClick={() => setSelectedTask(task)}
                  >
                    <td className="px-4 md:px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex flex-col">
                        <span>{task.taskTitle || task.title}</span>
                        {task.taskDescription && (
                          <span className="text-xs text-slate-400 truncate max-w-xs font-normal">
                            {task.taskDescription}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-5 py-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-sm font-medium text-[10px] md:text-xs border border-slate-200 dark:border-slate-700 truncate max-w-[140px] md:max-w-none inline-block">
                        {projectName}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-5 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {assigneeName}
                    </td>
                    <td className="hidden md:table-cell px-5 py-4 whitespace-nowrap">
                      {getPriorityBadge(task.priority)}
                    </td>
                    <td className="hidden md:table-cell px-5 py-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {task.dueDate ? task.dueDate.split('T')[0] : 'N/A'}
                    </td>
                    <td className="hidden md:table-cell px-5 py-4">
                      <div className="w-24 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${task.progress || 0}%` }} />
                        </div>
                        <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">{task.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-5 py-4" onClick={e => e.stopPropagation()}>
                      <select
                        className="w-full text-xs font-semibold uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                        value={normStatus}
                        onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
                      >
                        <option value="pending">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <CheckSquare size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Tasks</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Personal deliverables and tasks assigned directly to you
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Assigned', value: totalCount, icon: CheckSquare, accent: 'border-l-blue-500' },
          { label: 'To Do', value: pendingCount, icon: Clock, accent: 'border-l-slate-400' },
          { label: 'In Progress', value: inProgressCount, icon: TrendingUp, accent: 'border-l-amber-500' },
          { label: 'In Review / Testing', value: reviewCount, icon: AlertCircle, accent: 'border-l-indigo-500' },
          { label: 'Completed', value: completedCount, icon: FileCheck, accent: 'border-l-green-500' }
        ].map((item, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm`}>
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {isLoading ? <Loader2 size={18} className="animate-spin text-slate-400" /> : item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors shadow-sm">
        
        {/* Board / List switcher & Refresh */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-md border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                viewMode === 'kanban' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Kanban size={15} /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <List size={15} /> List
            </button>
          </div>

          <button
            onClick={fetchTasks}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-60"
            title="Refresh Live Tasks"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks or projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Project Filter */}
          {projectOptions.length > 0 && (
            <select
              value={selectedProjectFilter}
              onChange={e => setSelectedProjectFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer max-w-[160px] truncate"
            >
              <option value="all">All Projects</option>
              {projectOptions.map((name, i) => (
                <option key={i} value={name}>{name}</option>
              ))}
            </select>
          )}

          {/* Priority Filter */}
          <select
            value={selectedPriorityFilter}
            onChange={e => setSelectedPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review / Testing</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-sm text-slate-500">Loading live tasks...</p>
        </div>
      ) : (
        <>
          {viewMode === 'kanban' ? (
            <>
              {/* Desktop Kanban Board */}
              <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {kanbanColumns.map(col => {
                  const columnTasks = filteredTasks.filter(t => normalizeStatus(t.status) === col.id);
                  const isDragOver = dragOverCol === col.id;

                  return (
                    <div
                      key={col.id}
                      className={`bg-slate-50/50 dark:bg-slate-900/50 border rounded-md p-4 flex flex-col space-y-4 min-h-[520px] border-t-4 ${col.borderAccent} transition-colors ${
                        isDragOver ? 'border-blue-400 bg-blue-50/20 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCol(col.id);
                      }}
                      onDragLeave={() => setDragOverCol(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCol(null);
                        const taskId = e.dataTransfer.getData('taskId');
                        if (taskId) {
                          handleUpdateTaskStatus(taskId, col.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{col.title}</h3>
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-sm text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {columnTasks.length}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                        {columnTasks.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-md">
                            Drop tasks here
                          </div>
                        ) : (
                          columnTasks.map(task => {
                            const projectName = task.projectId?.projectName || task.projectId?.name || (typeof task.projectId === 'string' ? task.projectId : 'Project Task');
                            const assigneeName = task.assignedEmployee?.name || task.assignedIntern?.name || 'Unassigned';

                            return (
                              <div
                                key={task._id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('taskId', task._id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onClick={() => setSelectedTask(task)}
                                className="bg-white dark:bg-slate-950 p-4 rounded-md border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-grab active:cursor-grabbing flex flex-col gap-3 shadow-sm hover:shadow-md"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span 
                                    className="text-[10px] font-semibold font-mono text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-sm truncate max-w-[130px]" 
                                    title={projectName}
                                  >
                                    {projectName}
                                  </span>
                                  {getPriorityBadge(task.priority)}
                                </div>

                                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                                  {task.taskTitle || task.title}
                                </h4>

                                {task.taskDescription && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                    {task.taskDescription}
                                  </p>
                                )}

                                <div className="space-y-1.5 mt-1">
                                  <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <span>Progress</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">{task.progress || 0}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                    <div
                                      className="h-full bg-blue-500 rounded-full transition-all"
                                      style={{ width: `${task.progress || 0}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="flex items-center font-mono text-[11px]">
                                    <Clock size={13} className="mr-1 text-slate-400" /> 
                                    {task.dueDate ? task.dueDate.split('T')[0] : 'No Date'}
                                  </span>

                                  <div className="flex items-center gap-2.5">
                                    {task.attachments?.length > 0 && (
                                      <span className="flex items-center gap-1 text-[11px]" title="Attachments">
                                        <Paperclip size={13} />
                                        <span>{task.attachments.length}</span>
                                      </span>
                                    )}
                                    {task.comments?.length > 0 && (
                                      <span className="flex items-center gap-1 text-[11px]" title="Comments">
                                        <MessageSquare size={13} />
                                        <span>{task.comments.length}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Fallback to List View */}
              <div className="block md:hidden">
                <ListViewTable />
              </div>
            </>
          ) : (
            <div className="block">
              <ListViewTable />
            </div>
          )}
        </>
      )}

      {/* Detail Drawer */}
      <TaskDetailDrawer onTaskUpdate={fetchTasks} />
    </div>
  );
};