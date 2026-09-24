import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase, Calendar, Users, CheckCircle2, Clock, 
  Search, Filter, Loader2, RefreshCw, FolderKanban,
  CheckSquare, TrendingUp, AlertCircle, X, ExternalLink,
  Shield, Mail, Award, UserCheck, ChevronRight, User,
  Plus, Edit3, Trash2, Save, Check
} from 'lucide-react';
import api from '../../api/axios.js';
import { useApp } from '../../context/AppContext.jsx';

// Helper to normalize and build assigned member list from project and /members endpoint data
const buildAssignedMemberList = (proj, membersData) => {
  const list = [];
  const addedIds = new Set();
  const addedEmails = new Set();

  const addMember = (m, defaultRole, roleType, isLead = false) => {
    if (!m) return;
    const id = m._id || m.id;
    const email = (m.email || '').toLowerCase().trim();

    // Deduplicate by ID or email
    if (id && addedIds.has(String(id))) return;
    if (email && addedEmails.has(email)) return;

    if (id) addedIds.add(String(id));
    if (email) addedEmails.add(email);

    const name = m.fullName || m.name || (m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : (email ? email.split('@')[0] : 'Team Member'));

    list.push({
      id: id || `mem-${Math.random()}`,
      name,
      email: m.email || '',
      employeeID: m.employeeID || '',
      role: m.role || defaultRole,
      roleType,
      isLead
    });
  };

  // 1. Team Lead Employee & User
  const tlEmp = membersData?.teamLeadEmployee || proj.teamLeadEmployee;
  const tlUser = membersData?.teamLeadUser || proj.teamLeadUser;
  if (tlEmp) {
    addMember(
      { ...tlEmp, name: tlEmp.fullName || tlEmp.name || tlUser?.name },
      'Team Leader',
      'TL',
      true
    );
  } else if (tlUser) {
    addMember(tlUser, 'Team Leader', 'TL', true);
  }

  // 2. Assigned Employees from membersData + proj.employees
  const emps = [
    ...(Array.isArray(membersData?.employees) ? membersData.employees : []),
    ...(Array.isArray(proj.employees) ? proj.employees : [])
  ];
  emps.forEach(emp => {
    if (emp) {
      // Find if we have richer name or fields in proj.employees
      const enriched = (Array.isArray(proj.employees) 
        ? proj.employees.find(pe => pe?._id === emp._id || (pe?.email && pe?.email === emp.email)) 
        : null) || emp;
      addMember(enriched, 'Employee', 'EMP', false);
    }
  });

  // 3. Assigned Interns from membersData + proj.interns
  const interns = [
    ...(Array.isArray(membersData?.interns) ? membersData.interns : []),
    ...(Array.isArray(proj.interns) ? proj.interns : [])
  ];
  interns.forEach(intern => {
    if (intern) {
      const enriched = (Array.isArray(proj.interns) 
        ? proj.interns.find(pi => pi?._id === intern._id || (pi?.email && pi?.email === intern.email)) 
        : null) || intern;
      addMember(enriched, 'Intern', 'INT', false);
    }
  });

  return list;
};

export const ProjectView = () => {
  const { user, setSelectedTask } = useApp();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all'); // 'all' | 'assigned_to_me'
  const [selectedProjectModal, setSelectedProjectModal] = useState(null);

  // Modals and form state for Create / Edit / Delete projects
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyStaff, setCompanyStaff] = useState([]);
  const [formError, setFormError] = useState('');

  const initialFormState = {
    projectName: '',
    clientName: '',
    clientEmail: '',
    projectDescription: '',
    projectBudget: '',
    startDate: '',
    endDate: '',
    priority: 'medium',
    status: 'pending',
    teamLeadUser: '',
    employees: [],
    interns: []
  };
  const [formData, setFormData] = useState(initialFormState);

  // Fetch company staff for assigning team leads, employees, interns
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await api.get('/api/users/all');
        const list = res.data?.users || res.data?.data || [];
        setCompanyStaff(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn('Could not load company staff for project assignments', e);
      }
    };
    fetchStaff();
  }, []);

  const openCreateModal = () => {
    setEditingProject(null);
    setFormData(initialFormState);
    setFormError('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (prj) => {
    setEditingProject(prj);
    setFormError('');
    setFormData({
      projectName: prj.projectName || '',
      clientName: prj.clientName || '',
      clientEmail: prj.clientEmail || '',
      projectDescription: prj.projectDescription || '',
      projectBudget: prj.projectBudget || '',
      startDate: prj.startDate ? prj.startDate.split('T')[0] : '',
      endDate: prj.endDate ? prj.endDate.split('T')[0] : '',
      priority: prj.priority || 'medium',
      status: prj.status || 'pending',
      teamLeadUser: prj.teamLeadUser?._id || prj.teamLeadUser || '',
      employees: Array.isArray(prj.employees) ? prj.employees.map(e => typeof e === 'object' ? e._id : e) : [],
      interns: Array.isArray(prj.interns) ? prj.interns.map(i => typeof i === 'object' ? i._id : i) : []
    });
    setIsFormModalOpen(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!formData.projectName.trim() || !formData.clientName.trim()) {
      setFormError('Project Name and Client Name are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        projectName: formData.projectName.trim(),
        clientName: formData.clientName.trim(),
        clientEmail: formData.clientEmail.trim(),
        projectDescription: formData.projectDescription.trim(),
        priority: formData.priority,
        status: formData.status
      };
      if (formData.projectBudget) payload.projectBudget = Number(formData.projectBudget);
      if (formData.startDate) payload.startDate = formData.startDate;
      if (formData.endDate) payload.endDate = formData.endDate;
      if (formData.teamLeadUser) payload.teamLeadUser = formData.teamLeadUser;
      if (formData.employees && formData.employees.length > 0) payload.employees = formData.employees;
      if (formData.interns && formData.interns.length > 0) payload.interns = formData.interns;

      if (editingProject) {
        // UPDATE PROJECT: PUT /api/projectManage/project/:id
        await api.put(`/api/projectManage/project/${editingProject._id}`, payload);
      } else {
        // CREATE PROJECT: POST /api/projectManage/project/create
        await api.post('/api/projectManage/project/create', payload);
      }

      setIsFormModalOpen(false);
      setEditingProject(null);
      await fetchLiveProjectsAndTasks();
    } catch (err) {
      console.error('Failed to save project:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject?._id) return;
    setIsSubmitting(true);
    try {
      // DELETE PROJECT: DELETE /api/projectManage/project/delete/:id
      await api.delete(`/api/projectManage/project/delete/${deletingProject._id}`);
      setDeletingProject(null);
      if (selectedProjectModal?._id === deletingProject._id) {
        setSelectedProjectModal(null);
      }
      await fetchLiveProjectsAndTasks();
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert(err.response?.data?.message || 'Failed to delete project');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch live projects from /api/projectManage/project/all, members from /api/projectManage/project/members/:id, and tasks from /api/task/all
  const fetchLiveProjectsAndTasks = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch live tasks and projects in parallel
      const [projectsRes, tasksRes] = await Promise.allSettled([
        api.get('/api/projectManage/project/all'),
        api.get('/api/task/all')
      ]);

      const liveTasks = tasksRes.status === 'fulfilled' 
        ? (tasksRes.value.data?.data || tasksRes.value.data?.tasks || []) 
        : [];
      const tasksList = Array.isArray(liveTasks) ? liveTasks : [];
      setTasks(tasksList);

      let baseProjects = [];
      if (projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value.data?.data)) {
        baseProjects = projectsRes.value.data.data;
      }

      // If /api/projectManage/project/all didn't return projects, fallback to aggregating from tasks
      if (baseProjects.length === 0) {
        const projectMap = new Map();
        for (const task of tasksList) {
          if (!task.projectId) continue;
          const p = task.projectId;
          const pId = typeof p === 'object' ? p._id : p;
          if (!pId) continue;

          if (!projectMap.has(pId)) {
            projectMap.set(pId, {
              _id: pId,
              projectName: (typeof p === 'object' ? p.projectName : null) || 'Project ' + String(pId).slice(-4),
              projectDescription: typeof p === 'object' ? (p.projectDescription || '') : '',
              clientName: typeof p === 'object' ? p.clientName : null,
              clientEmail: typeof p === 'object' ? p.clientEmail : null,
              projectBudget: typeof p === 'object' ? p.projectBudget : null,
              startDate: typeof p === 'object' ? p.startDate : null,
              endDate: typeof p === 'object' ? p.endDate : null,
              status: typeof p === 'object' ? (p.status || 'active') : 'active',
              priority: typeof p === 'object' ? (p.priority || 'medium') : 'medium',
              progress: typeof p === 'object' ? (p.progress || 0) : 0,
              employees: typeof p === 'object' ? (p.employees || []) : [],
              interns: typeof p === 'object' ? (p.interns || []) : []
            });
          }
        }
        baseProjects = Array.from(projectMap.values());
      }

      // 2. For each project, fetch its assigned members via GET /api/projectManage/project/members/:projectId
      const projectWithMembersList = await Promise.all(
        baseProjects.map(async (proj) => {
          let membersData = null;
          try {
            const memRes = await api.get(`/api/projectManage/project/members/${proj._id}`);
            if (memRes.data?.success && memRes.data?.data) {
              membersData = memRes.data.data;
            }
          } catch (err) {
            // Silently fall back to member information embedded in project
          }

          // Build unified assigned members list
          const allAssigned = buildAssignedMemberList(proj, membersData);

          // Find team lead
          const leadMember = allAssigned.find(m => m.isLead) || null;

          // Find tasks belonging to this project
          const projectTasks = tasksList.filter(t => {
            if (!t.projectId) return false;
            const tPId = typeof t.projectId === 'object' ? t.projectId._id : t.projectId;
            return String(tPId) === String(proj._id);
          });

          // Calculate progress if 0 and tasks exist
          let progressVal = proj.progress || 0;
          if (progressVal === 0 && projectTasks.length > 0) {
            const completedCount = projectTasks.filter(t => {
              const s = String(t.status || '').toLowerCase();
              return s === 'completed' || s === 'done';
            }).length;
            progressVal = Math.round((completedCount / projectTasks.length) * 100);
          }

          return {
            ...proj,
            members: membersData,
            allAssigned,
            leadMember,
            tasks: projectTasks,
            progress: progressVal
          };
        })
      );

      setProjects(projectWithMembersList);
    } catch (error) {
      console.error("Failed to fetch live projects/members/tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveProjectsAndTasks();
  }, []);

  // Filter projects by search, status, and assignment
  const filteredProjects = useMemo(() => {
    const userEmail = (user?.email || user?.user?.email || '').toLowerCase().trim();
    const userId = String(user?._id || user?.id || user?.employee?._id || user?.employeeId || '');

    return projects.filter(p => {
      const q = searchQuery.toLowerCase().trim();

      // Search matches project name, client, description, or any assigned member's name/email
      const matchesSearch = !q || (
        (p.projectName || '').toLowerCase().includes(q) ||
        (p.projectDescription || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.allAssigned || []).some(m => 
          (m.name || '').toLowerCase().includes(q) || 
          (m.email || '').toLowerCase().includes(q)
        )
      );

      // Status filter
      const statusLower = String(p.status || '').toLowerCase();
      const matchesStatus = 
        selectedStatusFilter === 'all' || 
        statusLower === selectedStatusFilter.toLowerCase();

      // Assignment filter ("Assigned to Me" vs "All")
      let matchesAssignment = true;
      if (assignedFilter === 'assigned_to_me') {
        const hasMemberMatch = (p.allAssigned || []).some(m => {
          const mEmail = (m.email || '').toLowerCase();
          const mId = String(m.id || '');
          return (userEmail && mEmail === userEmail) || (userId && mId === userId);
        });

        // Also check if any task inside the project is assigned to user
        const hasTaskMatch = (p.tasks || []).some(t => {
          const aEmp = t.assignedEmployee;
          const aInt = t.assignedIntern;
          const aTlU = t.assignedTeamLeadUser;
          const aTlE = t.assignedTeamLeadEmployee;

          const ids = [
            typeof aEmp === 'object' ? aEmp?._id : aEmp,
            typeof aInt === 'object' ? aInt?._id : aInt,
            typeof aTlU === 'object' ? aTlU?._id : aTlU,
            typeof aTlE === 'object' ? aTlE?._id : aTlE,
          ].filter(Boolean).map(String);

          const emails = [
            typeof aEmp === 'object' ? aEmp?.email : null,
            typeof aInt === 'object' ? aInt?.email : null,
            typeof aTlU === 'object' ? aTlU?.email : null,
            typeof aTlE === 'object' ? aTlE?.email : null,
          ].filter(Boolean).map(e => String(e).toLowerCase());

          return (userId && ids.includes(userId)) || (userEmail && emails.includes(userEmail));
        });

        matchesAssignment = hasMemberMatch || hasTaskMatch;
      }

      return matchesSearch && matchesStatus && matchesAssignment;
    });
  }, [projects, searchQuery, selectedStatusFilter, assignedFilter, user]);

  // Overall KPI metrics
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => {
    const s = String(p.status || '').toLowerCase();
    return s === 'active' || s === 'in_progress' || s === 'pending';
  }).length;
  const completedProjects = projects.filter(p => String(p.status || '').toLowerCase() === 'completed').length;
  
  // Total unique assigned members across all projects
  const totalUniqueAssignedMembers = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      (p.allAssigned || []).forEach(m => {
        if (m.email) set.add(m.email.toLowerCase());
        else if (m.id) set.add(m.id);
      });
    });
    return set.size;
  }, [projects]);

  const getStatusBadge = (status = 'active') => {
    const s = String(status).toLowerCase();
    if (s === 'completed') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          Completed
        </span>
      );
    }
    if (s === 'review' || s === 'testing') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
          Review
        </span>
      );
    }
    if (s === 'pending') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          Pending
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
        Active
      </span>
    );
  };

  const getPriorityBadge = (priority = 'medium') => {
    const p = String(priority).toLowerCase();
    if (p === 'high' || p === 'urgent' || p === 'critical') {
      return <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">High</span>;
    }
    if (p === 'medium') {
      return <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">Medium</span>;
    }
    return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">Low</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <FolderKanban size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Live Projects & Assigned Teams</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Active projects, assigned team members, leaders, deliverables, and progress tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Create Project</span>
          </button>

          <button
            onClick={fetchLiveProjectsAndTasks}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-60"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: totalProjects, accent: 'border-l-blue-500' },
          { label: 'Active Projects', value: activeProjects, accent: 'border-l-amber-500' },
          { label: 'Completed', value: completedProjects, accent: 'border-l-emerald-500' },
          { label: 'Assigned Members', value: totalUniqueAssignedMembers, accent: 'border-l-indigo-500' }
        ].map((item, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-xs flex justify-between items-center`}>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {isLoading ? <Loader2 size={20} className="animate-spin text-slate-400" /> : item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar: Search, Status Filter & Assignment Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex flex-col lg:flex-row items-center justify-between gap-4 transition-colors shadow-xs">
        {/* Search */}
        <div className="relative w-full lg:w-96">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by project, client, or assigned member name/email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          {/* Assignment Filter Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-md text-xs">
            <button
              onClick={() => setAssignedFilter('all')}
              className={`px-3 py-1.5 rounded font-medium transition cursor-pointer ${
                assignedFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Projects
            </button>
            <button
              onClick={() => setAssignedFilter('assigned_to_me')}
              className={`px-3 py-1.5 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                assignedFilter === 'assigned_to_me'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <UserCheck size={13} />
              <span>Assigned to Me</span>
            </button>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Loading live projects and assigned team members...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center shadow-xs">
          <FolderKanban size={40} className="mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Projects Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {assignedFilter === 'assigned_to_me'
              ? 'You do not have any projects assigned to you directly or via tasks.'
              : searchQuery 
                ? 'No projects or assigned members match your search query.' 
                : 'There are currently no active projects linked to the system.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((prj) => {
            const completedTasks = prj.tasks.filter(t => {
              const s = String(t.status || '').toLowerCase();
              return s === 'completed' || s === 'done';
            }).length;

            const targetDateStr = prj.endDate ? prj.endDate.split('T')[0] : 'N/A';
            const assignedMembers = prj.allAssigned || [];
            const lead = prj.leadMember;

            return (
              <div 
                key={prj._id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-all hover:border-blue-300 dark:hover:border-slate-700 flex flex-col justify-between space-y-4 hover:shadow-md"
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 uppercase">
                          PRJ-{String(prj._id).slice(-4)}
                        </span>
                        {prj.priority && getPriorityBadge(prj.priority)}
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2 truncate" title={prj.projectName}>
                        {prj.projectName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getStatusBadge(prj.status)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(prj);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(prj);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {prj.projectDescription && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {prj.projectDescription}
                    </p>
                  )}
                </div>

                {/* Assigned Members Section */}
                <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Users size={13} className="text-blue-500" /> Assigned Team
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {assignedMembers.length} {assignedMembers.length === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>

                  {/* Team Lead Indicator */}
                  {lead && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        <Shield size={10} />
                      </div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {lead.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 shrink-0">
                        Lead
                      </span>
                    </div>
                  )}

                  {/* Member Avatars Stack */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {assignedMembers.slice(0, 4).map((member, mIdx) => {
                        const initials = member.name
                          .split(' ')
                          .map(w => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || 'M';

                        return (
                          <div
                            key={member.id || mIdx}
                            title={`${member.name} (${member.role}) - ${member.email}`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900 shadow-xs cursor-pointer ${
                              member.isLead
                                ? 'bg-amber-500 text-white'
                                : member.roleType === 'INT'
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-blue-600 text-white'
                            }`}
                          >
                            {initials}
                          </div>
                        );
                      })}
                      {assignedMembers.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900">
                          +{assignedMembers.length - 4}
                        </div>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {prj.tasks.length} {prj.tasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-blue-500" /> Progress
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{prj.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(0, prj.progress))}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>{completedTasks} of {prj.tasks.length} tasks completed</span>
                  </div>
                </div>

                {/* Metadata & Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-slate-400">Client</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {prj.clientName || 'In-House'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-slate-400">Target Date</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                        {targetDateStr}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProjectModal(prj)}
                    className="w-full py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Project & Team ({assignedMembers.length} Members)</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProjectModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedProjectModal(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Briefcase size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">PRJ-{String(selectedProjectModal._id).slice(-4)}</span>
                    {getStatusBadge(selectedProjectModal.status)}
                    {getPriorityBadge(selectedProjectModal.priority)}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                    {selectedProjectModal.projectName}
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProjectModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Project Overview Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Client Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProjectModal.clientName || 'In-House'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Client Email</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 truncate block">{selectedProjectModal.clientEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Start Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {selectedProjectModal.startDate ? selectedProjectModal.startDate.split('T')[0] : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Target End Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {selectedProjectModal.endDate ? selectedProjectModal.endDate.split('T')[0] : 'N/A'}
                  </span>
                </div>
                {selectedProjectModal.projectBudget && (
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Project Budget</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">${Number(selectedProjectModal.projectBudget).toLocaleString()}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Progress</span>
                  <span className="font-bold font-mono text-blue-600 dark:text-blue-400">{selectedProjectModal.progress}%</span>
                </div>
              </div>

              {/* Description */}
              {selectedProjectModal.projectDescription && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed whitespace-pre-wrap">
                    {selectedProjectModal.projectDescription}
                  </p>
                </div>
              )}

              {/* Assigned Project Team Members (Live /members API) */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users size={15} className="text-blue-500" />
                    <span>Assigned Project Members ({selectedProjectModal.allAssigned?.length || 0})</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Fetched from live project assignments
                  </span>
                </h4>

                {(!selectedProjectModal.allAssigned || selectedProjectModal.allAssigned.length === 0) ? (
                  <p className="text-xs text-slate-400 text-center py-5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    No team members are currently assigned to this project.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Team Leader Card */}
                    {selectedProjectModal.leadMember && (
                      <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                            <Shield size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {selectedProjectModal.leadMember.name}
                              </h5>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                Team Leader
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {selectedProjectModal.leadMember.employeeID && (
                                <span className="font-mono font-medium">ID: {selectedProjectModal.leadMember.employeeID}</span>
                              )}
                              {selectedProjectModal.leadMember.email && (
                                <a 
                                  href={`mailto:${selectedProjectModal.leadMember.email}`} 
                                  className="flex items-center gap-1 hover:text-blue-500 truncate"
                                >
                                  <Mail size={12} /> {selectedProjectModal.leadMember.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assigned Employees and Interns Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedProjectModal.allAssigned
                        .filter(m => !m.isLead)
                        .map((member, idx) => {
                          const initials = member.name
                            .split(' ')
                            .map(w => w[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || 'M';

                          const isIntern = member.roleType === 'INT';

                          return (
                            <div 
                              key={member.id || idx}
                              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                                  isIntern ? 'bg-purple-600' : 'bg-blue-600'
                                }`}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {member.name}
                                    </h5>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      isIntern 
                                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    }`}>
                                      {isIntern ? 'Intern' : 'Employee'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {member.employeeID && <span className="font-mono mr-2">ID: {member.employeeID}</span>}
                                    <span>{member.email}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Associated Live Tasks */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Linked Tasks ({selectedProjectModal.tasks.length})</span>
                </h4>

                {selectedProjectModal.tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    No tasks currently created for this project.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedProjectModal.tasks.map((task) => (
                      <div 
                        key={task._id}
                        onClick={() => {
                          setSelectedProjectModal(null);
                          if (setSelectedTask) setSelectedTask(task);
                        }}
                        className="p-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border border-slate-200 dark:border-slate-800 hover:border-blue-300 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {task.taskTitle || task.title}
                          </h5>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                            <span>Assignee: {task.assignedEmployee?.name || task.assignedIntern?.name || 'Unassigned'}</span>
                            {task.dueDate && <span>Due: {task.dueDate.split('T')[0]}</span>}
                            <span>Progress: {task.progress || 0}%</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {getPriorityBadge(task.priority)}
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {task.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const p = selectedProjectModal;
                    setSelectedProjectModal(null);
                    openEditModal(p);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Edit Project</span>
                </button>
                <button
                  onClick={() => {
                    const p = selectedProjectModal;
                    setSelectedProjectModal(null);
                    setDeletingProject(p);
                  }}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-800/50"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>

              <button 
                onClick={() => setSelectedProjectModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isFormModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isSubmitting && setIsFormModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  {editingProject ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingProject ? 'Edit Project' : 'Create New Project'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingProject ? 'Update deliverables, client, and team allocation' : 'Configure deliverables, budget, and assign team members'}
                  </p>
                </div>
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProject} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Project Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KT CRM & HRMS"
                    value={formData.projectName}
                    onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kevalon Technology"
                    value={formData.clientName}
                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Client Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client Email
                  </label>
                  <input
                    type="email"
                    placeholder="client@company.com"
                    value={formData.clientEmail}
                    onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Budget ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={formData.projectBudget}
                    onChange={e => setFormData({ ...formData, projectBudget: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Dates */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Team Leader */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assign Team Leader
                  </label>
                  <select
                    value={formData.teamLeadUser}
                    onChange={e => setFormData({ ...formData, teamLeadUser: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Select Team Leader --</option>
                    {companyStaff.map(st => (
                      <option key={st._id} value={st._id}>
                        {st.name} ({st.role || 'Staff'}) - {st.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Overview of project scope, objectives, and deliverables..."
                    value={formData.projectDescription}
                    onChange={e => setFormData({ ...formData, projectDescription: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>{editingProject ? 'Update Project' : 'Create Project'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isSubmitting && setDeletingProject(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 size={20} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete Project?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">{deletingProject.projectName}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Delete Project</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

