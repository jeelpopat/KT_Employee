import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, Paperclip, MessageSquare, Send, Upload, CheckSquare, Loader2,
  Calendar, Clock, User, Briefcase, FileText, CheckCheck, ListChecks, Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';

export const TaskDetailDrawer = ({ onTaskUpdate }) => {
  const { user, selectedTask, setSelectedTask } = useApp();

  const [taskDetails, setTaskDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch full task details whenever a task is selected
  useEffect(() => {
    const fetchTaskDetails = async () => {
      if (!selectedTask?._id) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/api/task/${selectedTask._id}`);
        setTaskDetails(res.data?.data || res.data?.task || res.data);
      } catch (error) {
        console.error("Failed to fetch full task details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTaskDetails();
  }, [selectedTask]);

  if (!selectedTask) return null;

  // Use full details if loaded, otherwise fallback to the basic list data
  const displayTask = taskDetails || selectedTask;

  const normalizeStatus = (status = '') => {
    const s = String(status || '').toLowerCase().trim().replace(/[- ]/g, '_');
    if (['pending', 'assigned', 'to_do', 'todo'].includes(s)) return 'pending';
    if (['in_progress', 'working', 'doing'].includes(s)) return 'in_progress';
    if (['testing'].includes(s)) return 'testing';
    if (['review', 'in_review'].includes(s)) return 'review';
    if (['completed', 'done', 'finished'].includes(s)) return 'completed';
    if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
    return 'pending';
  };

  const currentNormalizedStatus = normalizeStatus(displayTask.status);

  const getPriorityBadge = (priority = 'low') => {
    const p = String(priority || '').toLowerCase();
    if (p === 'critical' || p === 'urgent') return <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium border border-rose-200/60 text-xs">Critical</span>;
    if (p === 'high') return <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200/60 text-xs">High</span>;
    if (p === 'medium') return <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200/60 text-xs">Medium</span>;
    return <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-xs">Low</span>;
  };

  const handleUpdateStatus = async (newStatus) => {
    setTaskDetails(prev => ({ ...prev, status: newStatus }));
    try {
      try {
        await api.put(`/api/projectManage/task/update/${displayTask._id}`, { status: newStatus });
      } catch (pmErr) {
        const msg = pmErr.response?.data?.message || pmErr.message || '';
        if (!msg.includes('milestoneId')) {
          await api.put(`/api/task/status/${displayTask._id}`, { status: newStatus });
        }
      }
      if (onTaskUpdate) onTaskUpdate(); // Refresh background Kanban list
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleUpdateProgress = async (e) => {
    const newProgress = parseInt(e.target.value);
    setTaskDetails(prev => ({ ...prev, progress: newProgress }));
    try {
      try {
        await api.put(`/api/projectManage/task/update/${displayTask._id}`, { progress: newProgress });
      } catch (pmErr) {
        const msg = pmErr.response?.data?.message || pmErr.message || '';
        if (!msg.includes('milestoneId')) {
          await api.put(`/api/task/update/${displayTask._id}`, { progress: newProgress });
        }
      }
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error("Failed to update progress:", error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsUpdating(true);
    
    try {
      const userId = user?.employee?._id || user?.profile?._id || user?._id;
      await api.post(`/api/task/comment/${displayTask._id}`, { 
        text: commentText,
        comment: commentText, 
        userId: userId,
        commentedBy: userId 
      });
      setCommentText('');
      
      // Refresh task details to load the new comment
      const res = await api.get(`/api/task/${displayTask._id}`);
      setTaskDetails(res.data?.data || res.data?.task || res.data);
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80';
  const comments = displayTask.comments || [];
  const attachments = displayTask.attachments || [];
  const subTasks = displayTask.subTasks || [];
  const checklist = displayTask.checklist || [];
  const projectObj = typeof displayTask.projectId === 'object' ? displayTask.projectId : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop Blur */}
      <div 
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={() => setSelectedTask(null)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-slate-800">
          
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3 min-w-0">
              {isLoading ? <Loader2 size={20} className="animate-spin text-slate-400" /> : <CheckSquare size={20} className="text-blue-400" />}
              <div className="min-w-0">
                <span className="text-[10px] text-blue-300 font-mono font-medium uppercase truncate block max-w-xs">
                  {projectObj?.projectName || displayTask.projectId?.name || (typeof displayTask.projectId === 'string' ? displayTask.projectId : 'Project Task')}
                </span>
                <h2 className="text-sm font-semibold truncate max-w-md">{displayTask.taskTitle || displayTask.title}</h2>
              </div>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Status & Priority */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Status</span>
                <select
                  value={currentNormalizedStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none transition cursor-pointer"
                >
                  <option value="pending">To Do (Pending)</option>
                  <option value="in_progress">In Progress</option>
                  <option value="testing">Testing</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Priority</span>
                {getPriorityBadge(displayTask.priority)}
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Assigned By</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {displayTask.assignedBy?.name || displayTask.assignedBy?.email || 'Admin'}
                </span>
              </div>
            </div>

            {/* People & Assignments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1 flex items-center gap-1">
                  <User size={12} /> Assigned Employee
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {displayTask.assignedEmployee?.name || displayTask.assignedIntern?.name || 'Unassigned'}
                </p>
                {(displayTask.assignedEmployee?.email || displayTask.assignedIntern?.email) && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                    {displayTask.assignedEmployee?.email || displayTask.assignedIntern?.email}
                  </p>
                )}
              </div>

              {projectObj?.clientName && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1 flex items-center gap-1">
                    <Briefcase size={12} /> Client & Budget
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {projectObj.clientName}
                  </p>
                  {projectObj.projectBudget && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-0.5">
                      Budget: ${Number(projectObj.projectBudget).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Progress Slider */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-800 dark:text-slate-200">
                <span>Task Completion Progress</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">{displayTask.progress || 0}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={displayTask.progress || 0}
                onChange={handleUpdateProgress}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-wider">
                Task Description
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                {displayTask.taskDescription || displayTask.description || 'No detailed description provided for this task.'}
              </p>
            </div>

            {/* Dates & Hours */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Due Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {displayTask.dueDate ? displayTask.dueDate.split('T')[0] : 'Not Set'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Est. Hours</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{displayTask.estimatedHours || 0} hrs</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Created On</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {displayTask.createdAt ? displayTask.createdAt.split('T')[0] : 'N/A'}
                </span>
              </div>
            </div>

            {/* Subtasks or Checklist */}
            {(subTasks.length > 0 || checklist.length > 0) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ListChecks size={14} className="text-slate-400" />
                  <span>Checklist & Subtasks</span>
                </h4>
                <div className="space-y-1.5">
                  {[...subTasks, ...checklist].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-900">
                        <Check size={11} className="text-blue-500" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">{typeof item === 'string' ? item : item.title || item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Paperclip size={14} className="text-slate-400" />
                  <span>Attachments ({attachments.length})</span>
                </h4>
              </div>

              {attachments.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400">
                  No attachments linked to this task.
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <a 
                      key={att._id || idx} 
                      href={att.fileUrl || att.url || (typeof att === 'string' ? att : '#')}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs hover:border-blue-400 transition"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block max-w-[200px]">
                        {att.fileName || att.name || 'Attachment ' + (idx + 1)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Comments Thread */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <MessageSquare size={14} className="text-slate-400" />
                <span>Comments & Discussion ({comments.length})</span>
              </h4>

              <div className="space-y-2.5">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    No comments yet. Start the conversation below.
                  </p>
                ) : (
                  comments.map((c, idx) => (
                    <div key={c._id || idx} className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start space-x-3 text-xs">
                      <img 
                        src={defaultAvatar} 
                        alt="User" 
                        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700 bg-white" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {c.userId?.name || c.commentedBy?.name || 'Team Member'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">{c.text || c.comment}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className="flex items-center space-x-2 pt-2">
                <input 
                  type="text" 
                  placeholder="Add a comment or work update..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                />
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
            {currentNormalizedStatus !== 'completed' ? (
              <button
                onClick={() => handleUpdateStatus('completed')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 size={15} />
                <span>Mark as Completed</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} /> Task Completed
              </span>
            )}
            <button
              onClick={() => setSelectedTask(null)}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};