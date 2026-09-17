import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, Paperclip, MessageSquare, Send, Upload, CheckSquare, Loader2
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

  const getPriorityBadge = (priority = 'low') => {
    const p = priority.toLowerCase();
    if (p === 'critical' || p === 'urgent') return <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium border border-rose-200/60 text-xs">Critical</span>;
    if (p === 'high') return <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200/60 text-xs">High</span>;
    if (p === 'medium') return <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-medium border border-zinc-200/60 text-xs">Medium</span>;
    return <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium text-xs">Low</span>;
  };

  const handleUpdateStatus = async (newStatus) => {
    setTaskDetails(prev => ({ ...prev, status: newStatus }));
    try {
      await api.put(`/api/task/status/${displayTask._id}`, { status: newStatus });
      if (onTaskUpdate) onTaskUpdate(); // Refresh background Kanban list
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleUpdateProgress = async (e) => {
    const newProgress = parseInt(e.target.value);
    setTaskDetails(prev => ({ ...prev, progress: newProgress }));
    try {
      await api.put(`/api/task/update/${displayTask._id}`, { progress: newProgress });
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
        comment: commentText, 
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop Blur */}
      <div 
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={() => setSelectedTask(null)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center space-x-3">
              {isLoading ? <Loader2 size={20} className="animate-spin text-zinc-400" /> : <CheckSquare size={20} className="text-zinc-300" />}
              <div>
                <span className="text-[10px] text-zinc-400 font-mono font-medium uppercase truncate block max-w-xs">
                  {displayTask.projectId?.projectName || displayTask.projectId?.name || 'Project Task'}
                </span>
                <h2 className="text-sm font-semibold truncate max-w-md">{displayTask.taskTitle || displayTask.title}</h2>
              </div>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            
            {/* Status & Priority */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-50/80 border border-zinc-200/70 rounded-2xl">
              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase block mb-1">Status</span>
                <select
                  value={displayTask.status || 'Assigned'}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-zinc-200/80 rounded-xl text-zinc-800 focus:outline-none transition cursor-pointer"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Testing">Testing</option>
                  <option value="Review">Review</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase block mb-1">Priority</span>
                {getPriorityBadge(displayTask.priority)}
              </div>

              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase block mb-1">Assigned By</span>
                <span className="text-xs font-semibold text-zinc-800">
                  {displayTask.assignedBy?.name || displayTask.assignedBy || 'Manager'}
                </span>
              </div>
            </div>

            {/* Progress Slider */}
            <div className="p-4 bg-zinc-50/80 border border-zinc-200/70 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs font-medium text-zinc-800">
                <span>Task Completion Progress</span>
                <span className="text-zinc-900 font-mono font-semibold">{displayTask.progress || 0}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={displayTask.progress || 0}
                onChange={handleUpdateProgress}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
              />
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-800 uppercase mb-2 tracking-wider">Description</h4>
              <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50/80 p-4 rounded-2xl border border-zinc-200/60 whitespace-pre-wrap">
                {displayTask.taskDescription || displayTask.description || 'No detailed description provided for this task.'}
              </p>
            </div>

            {/* Dates & Hours */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200/60">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Due Date</span>
                <span className="font-semibold text-zinc-800">
                  {displayTask.dueDate ? displayTask.dueDate.split('T')[0] : 'Not Set'}
                </span>
              </div>
              <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200/60">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Est. Hours</span>
                <span className="font-mono font-semibold text-zinc-800">{displayTask.estimatedHours || 0} hrs</span>
              </div>
              <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200/60">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Task Created</span>
                <span className="font-semibold text-zinc-800">
                  {displayTask.createdAt ? displayTask.createdAt.split('T')[0] : 'N/A'}
                </span>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Paperclip size={14} className="text-zinc-400" />
                  <span>Attachments ({attachments.length})</span>
                </h4>
                <button 
                  onClick={() => alert('File Upload Interface Triggered')}
                  className="text-xs font-semibold text-zinc-800 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <Upload size={13} />
                  <span>Upload File</span>
                </button>
              </div>

              {attachments.length === 0 ? (
                <div className="p-4 bg-zinc-50/80 border border-dashed border-zinc-200 rounded-2xl text-center text-xs text-zinc-400">
                  No files attached yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <a 
                      key={att._id || idx} 
                      href={typeof att === 'string' ? att : att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 bg-zinc-50/80 border border-zinc-200/60 rounded-xl text-xs hover:border-zinc-400 transition"
                    >
                      <span className="font-semibold text-zinc-800 truncate block max-w-[200px]">
                        {typeof att === 'string' ? 'Attachment Link' : att.name || 'Attachment'}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Comments Thread */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider flex items-center space-x-1.5">
                <MessageSquare size={14} className="text-zinc-400" />
                <span>Comments & Discussion ({comments.length})</span>
              </h4>

              <div className="space-y-2.5">
                {comments.map((c, idx) => (
                  <div key={c._id || idx} className="p-3 bg-zinc-50/80 border border-zinc-200/60 rounded-2xl flex items-start space-x-3 text-xs">
                    <img 
                      src={c.commentedBy?.profilePhoto || c.commentedBy?.profileImage || defaultAvatar} 
                      alt="User" 
                      className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-zinc-200 bg-white" 
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-zinc-900">{c.commentedBy?.name || 'User'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                      <p className="text-zinc-600 mt-1">{c.comment}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCommentSubmit} className="flex items-center space-x-2 pt-2">
                <input 
                  type="text" 
                  placeholder="Add a comment or work note..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-zinc-50 border border-zinc-200/80 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/10 transition"
                />
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-zinc-50/80 border-t border-zinc-200/80 flex justify-between items-center">
            <button
              onClick={() => handleUpdateStatus('Completed')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Mark as Completed</span>
            </button>
            <button
              onClick={() => setSelectedTask(null)}
              className="px-4 py-2 bg-zinc-200/80 text-zinc-800 hover:bg-zinc-300/80 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};