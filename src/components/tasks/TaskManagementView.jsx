import React, { useState, useEffect } from 'react';
import { 
  List, Kanban, Search, Clock, Paperclip, MessageSquare, 
  CheckSquare, TrendingUp, FileCheck, AlertCircle, Loader2 
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
  const [dragOverCol, setDragOverCol] = useState(null);

  // Fetch Live Tasks for the logged-in Employee
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const userId = user?.employee?._id || user?.profile?._id || user?._id;
      if (!userId) return;

      const response = await api.get(`/api/task/employee/${userId}`);
      const tasksData = response.data?.tasks || response.data?.data || response.data || [];
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Handle Drag-and-Drop or Mobile Dropdown Status Updates
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    setIsUpdating(true);
    try {
      // Optimistically update UI instantly for a smooth experience
      setTasks(prevTasks => prevTasks.map(t => 
        t._id === taskId ? { ...t, status: newStatus } : t
      ));

      // Execute actual API PUT request
      await api.put(`/api/task/status/${taskId}`, { status: newStatus });
    } catch (error) {
      console.error("Failed to update task status:", error);
      fetchTasks(); // Revert on failure
    } finally {
      setIsUpdating(false);
    }
  };

  // Local Filters
  const filteredTasks = tasks.filter(task => {
    const title = task.taskTitle || task.title || '';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = selectedPriorityFilter === 'all' || (task.priority || '').toLowerCase() === selectedPriorityFilter.toLowerCase();
    const matchesStatus = selectedStatusFilter === 'all' || (task.status || '').toLowerCase() === selectedStatusFilter.toLowerCase();
    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Analytics Metrics (Using strict API status capitalization)
  const totalCount = tasks.length;
  const pendingCount = tasks.filter(t => t.status === 'Assigned').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const reviewCount = tasks.filter(t => t.status === 'Testing' || t.status === 'Review').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  const getPriorityBadge = (priority = 'Low') => {
    const p = priority.toLowerCase();
    if (p === 'critical' || p === 'urgent') return <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold text-[10px] border border-red-200 dark:border-red-800/50">Critical</span>;
    if (p === 'high') return <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold text-[10px] border border-amber-200 dark:border-amber-800/50">High</span>;
    if (p === 'medium') return <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold text-[10px] border border-blue-200 dark:border-blue-800/50">Medium</span>;
    return <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] border border-slate-200 dark:border-slate-700">Low</span>;
  };

  const kanbanColumns = [
    { id: 'To do', title: 'To do', count: pendingCount, borderAccent: 'border-t-slate-400' },
    { id: 'In Progress', title: 'In Progress', count: inProgressCount, borderAccent: 'border-t-amber-500' },
    { id: 'Review', title: 'In Review', count: reviewCount, borderAccent: 'border-t-indigo-500' },
    { id: 'Completed', title: 'Completed', count: completedCount, borderAccent: 'border-t-green-500' }
  ];

  // Mobile-Optimized List View
  const ListViewTable = () => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden transition-colors w-full shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 md:px-5 py-4">Task Title</th>
              <th className="px-4 md:px-5 py-4">Project</th>
              <th className="hidden md:table-cell px-5 py-4">Priority</th>
              <th className="hidden md:table-cell px-5 py-4">Due Date</th>
              <th className="hidden md:table-cell px-5 py-4">Progress</th>
              <th className="px-4 md:px-5 py-4 w-36">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">No tasks found.</td>
              </tr>
            ) : (
              filteredTasks.map(task => (
                <tr key={task._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group" onClick={() => setSelectedTask(task)}>
                  <td className="px-4 md:px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">{task.taskTitle || task.title}</td>
                  <td className="px-4 md:px-5 py-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-sm font-medium text-[10px] md:text-xs border border-slate-200 dark:border-slate-700 truncate max-w-[120px] md:max-w-none inline-block">
                      {task.projectId?.projectName || task.projectId?.name || task.projectId || 'N/A'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-5 py-4 whitespace-nowrap">{getPriorityBadge(task.priority)}</td>
                  <td className="hidden md:table-cell px-5 py-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {task.dueDate ? task.dueDate.split('T')[0] : 'N/A'}
                  </td>
                  <td className="hidden md:table-cell px-5 py-4">
                    <div className="w-24 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="h-full bg-blue-500" style={{ width: `${task.progress || 0}%` }} />
                      </div>
                      <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">{task.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-4">
                    <span className="hidden md:inline-block uppercase font-semibold text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {task.status}
                    </span>
                    <select
                      className="md:hidden w-full text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-1 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      value={task.status || 'Assigned'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateTaskStatus(task._id, e.target.value);
                      }}
                    >
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Testing">Testing</option>
                      <option value="Review">Review</option>
                      <option value="Completed">Completed</option>
                      <option value="Delayed">Delayed</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {isLoading ? (
        <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin text-blue-500" size={30} /></div>
      ) : (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Assigned', value: totalCount, icon: CheckSquare, accent: 'border-l-blue-500', iconColor: 'text-blue-500' },
              { label: 'To do ', value: pendingCount, icon: Clock, accent: 'border-l-slate-400', iconColor: 'text-slate-500' },
              { label: 'In Progress', value: inProgressCount, icon: TrendingUp, accent: 'border-l-amber-500', iconColor: 'text-amber-500' },
              { label: 'In Review', value: reviewCount, icon: AlertCircle, accent: 'border-l-indigo-500', iconColor: 'text-indigo-500' },
              { label: 'Completed', value: completedCount, icon: FileCheck, accent: 'border-l-green-500', iconColor: 'text-green-500' }
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm`}>
                  <div>
                    <div className="flex items-start justify-between ">
                      <p className="text-2xs  font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
                      <p className="px-2 items-end text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
                    </div>
                    {/* <Icon size={18} className={item.iconColor} /> */}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors shadow-sm">
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-md border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Kanban size={16} /> Board
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <List size={16} /> List
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
              <div className="relative w-full sm:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  value={selectedPriorityFilter}
                  onChange={e => setSelectedPriorityFilter(e.target.value)}
                  className="w-1/2 sm:w-auto px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="all">Priority</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="w-1/2 sm:w-auto px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="all">Status</option>
                  <option value="assigned">Assigned</option>
                  <option value="in progress">In Progress</option>
                  <option value="testing">Testing</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {viewMode === 'kanban' ? (
            <>
              {/* Desktop Kanban Board */}
              <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {kanbanColumns.map(col => {
                  const columnTasks = filteredTasks.filter(t => 
                    col.id === 'Review' ? (t.status === 'Review' || t.status === 'Testing') : t.status === col.id
                  );
                  const isDragOver = dragOverCol === col.id;
                  
                  return (
                    <div 
                      key={col.id} 
                      className={`bg-slate-50/50 dark:bg-slate-900/50 border rounded-md p-4 flex flex-col space-y-4 min-h-[500px] border-t-4 ${col.borderAccent} transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50/20 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800'}`}
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
                          columnTasks.map(task => (
                            <div
                              key={task._id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('taskId', task._id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onClick={() => setSelectedTask(task)}
                              className="bg-white dark:bg-slate-950 p-4 rounded-md border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-grab active:cursor-grabbing flex flex-col gap-3 shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-semibold font-mono text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-sm truncate max-w-[120px]" title={task.projectId?.projectName || task.projectId?.name}>
                                  {task.projectId?.projectName || task.projectId?.name || 'Project Task'}
                                </span>
                                {getPriorityBadge(task.priority)}
                              </div>
                              
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                                {task.taskTitle || task.title}
                              </h4>

                              <div className="space-y-1.5 mt-2">
                                <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                  <span>Progress</span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300">{task.progress || 0}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${task.progress || 0}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center font-mono">
                                  <Clock size={14} className="mr-1.5 text-slate-400" /> {task.dueDate ? task.dueDate.split('T')[0] : 'Not Set'}
                                </span>
                                <div className="flex items-center gap-3">
                                  {task.attachments?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Paperclip size={14} />
                                      <span>{task.attachments.length}</span>
                                    </span>
                                  )}
                                  {task.comments?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <MessageSquare size={14} />
                                      <span>{task.comments.length}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Fallback */}
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

      {/* Detail Drawer - Triggered by Context. We pass fetchTasks down to allow the drawer to refresh the main board on change. */}
      <TaskDetailDrawer onTaskUpdate={fetchTasks} />
    </div>
  );
};