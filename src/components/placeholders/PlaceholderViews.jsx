import React, { useState } from 'react';
import {
  Wallet, TrendingUp, Briefcase, Users, BookOpen, GraduationCap,
  FileBadge, PhoneCall, ListTodo, CalendarX, ClipboardCheck,
  BarChart, Download, Search, CheckCircle2, Clock, Eye, AlertCircle,
  ExternalLink, FileText, ChevronRight, Filter, Plus, Check, X,
  Shield, Award, BookCheck, Sparkles, Building2, UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// 1. SALARY VIEW (Employee & Team Leader)
export const SalaryView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md">
            <Wallet size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Salary & Compensation</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Monthly payslips, earnings breakdown, and tax deductions</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto">
          <Download size={14} /> Download Form 16 / Annual Slip
        </button>
      </div>

      {/* Salary Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Annual CTC</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">₹ 8,40,000</p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 inline-block font-medium">Standard Employee Band</span>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Monthly In-Hand</span>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">₹ 64,500</p>
          <span className="text-[11px] text-slate-500 mt-1 inline-block">Credited by 1st of month</span>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Deductions</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">₹ 5,500</p>
          <span className="text-[11px] text-slate-500 mt-1 inline-block">PF + PT + Professional Tax</span>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Performance Bonus</span>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">₹ 15,000</p>
          <span className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1 inline-block font-medium">Quarterly payout pending</span>
        </div>
      </div>

      {/* Payslip History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Payslip History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Month & Year</th>
                <th className="py-3 px-4 font-semibold">Gross Pay</th>
                <th className="py-3 px-4 font-semibold">Deductions</th>
                <th className="py-3 px-4 font-semibold">Net Pay</th>
                <th className="py-3 px-4 font-semibold">Payment Date</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { month: 'August 2026', gross: '₹ 70,000', ded: '₹ 5,500', net: '₹ 64,500', date: '31 Aug 2026', status: 'Paid' },
                { month: 'July 2026', gross: '₹ 70,000', ded: '₹ 5,500', net: '₹ 64,500', date: '31 Jul 2026', status: 'Paid' },
                { month: 'June 2026', gross: '₹ 70,000', ded: '₹ 5,500', net: '₹ 64,500', date: '30 Jun 2026', status: 'Paid' },
                { month: 'May 2026', gross: '₹ 70,000', ded: '₹ 5,500', net: '₹ 64,500', date: '31 May 2026', status: 'Paid' }
              ].map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{item.month}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{item.gross}</td>
                  <td className="py-3 px-4 text-red-600 dark:text-red-400">{item.ded}</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{item.net}</td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{item.date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-xs font-semibold cursor-pointer">
                      <Download size={13} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 2. PERFORMANCE VIEW (Employee)
export const PerformanceView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Performance Scorecard</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Quarterly evaluations, key performance metrics, and manager feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-md text-xs font-bold">
            Rating: 4.8 / 5.0 (Exceeding Expectations)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sprint Velocity</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">96%</span>
            <span className="text-xs text-emerald-600 font-medium">↑ 4% from last sprint</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '96%' }} />
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance & Punctuality</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">98.5%</span>
            <span className="text-xs text-emerald-600 font-medium">High reliability</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98.5%' }} />
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Code Quality & Reviews</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">94%</span>
            <span className="text-xs text-emerald-600 font-medium">Zero blocker bugs</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full" style={{ width: '94%' }} />
          </div>
        </div>
      </div>

      {/* Reviewer Feedback */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Team Leader & Manager Feedback (Q3 2026)</h3>
        <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Sarah Jenkins (Engineering Team Lead)</span>
            <span className="text-xs text-slate-400">Reviewed on 15 Aug 2026</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            "Alex demonstrated exceptional technical craftsmanship throughout the Kevalon CRM & HRMS rebuild. Delivered code ahead of schedule, assisted interns effectively, and maintained steady active work session adherence."
          </p>
        </div>
      </div>
    </div>
  );
};

// 3. PROJECT VIEW (Employee & Team Leader)
export const ProjectView = () => {
  const projects = [
    { name: 'Kevalon CRM Platform', key: 'KEV-CRM', status: 'Active', progress: 75, lead: 'Sarah Jenkins', teamCount: 6, deadline: '15 Oct 2026' },
    { name: 'Tapzy Mobile Application', key: 'TAP-MOB', status: 'Review', progress: 90, lead: 'David Miller', teamCount: 4, deadline: '30 Sep 2026' },
    { name: 'Enterprise HRMS Portal v2.0', key: 'HRM-V2', status: 'Active', progress: 60, lead: 'Alex Morgan', teamCount: 8, deadline: '20 Nov 2026' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md">
            <Briefcase size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Assigned Projects</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Active enterprise engagements, milestones, and deliverables</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((prj, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                  {prj.key}
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">{prj.name}</h4>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                {prj.status}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Milestone Progress</span>
                <span>{prj.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${prj.progress}%` }} />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-400">Team Lead</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{prj.lead}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-400">Target Date</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{prj.deadline}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. TEAM MEMBERS VIEW (Employee)
export const TeamMembersView = () => {
  const members = [
    { name: 'Sarah Jenkins', role: 'Team Leader', email: 'sarah.j@kevalon.com', status: 'Online', dept: 'Engineering' },
    { name: 'Alex Morgan', role: 'Senior Developer', email: 'alex.m@kevalon.com', status: 'Online', dept: 'Engineering' },
    { name: 'Rahul Patel', role: 'UI/UX Designer', email: 'rahul.p@kevalon.com', status: 'Active', dept: 'Product Design' },
    { name: 'Priya Sharma', role: 'QA Lead', email: 'priya.s@kevalon.com', status: 'Online', dept: 'Quality Assurance' },
    { name: 'Karan Mehta', role: 'Frontend Intern', email: 'karan.m@kevalon.com', status: 'Online', dept: 'Engineering' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Team Members</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Immediate colleagues, roles, and communication channels</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
              {m.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{m.name}</h4>
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{m.role}</p>
              <p className="text-[11px] text-slate-400 truncate mt-1">{m.email}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. EMPLOYEES DIRECTORY (Employee #9 - includes INT, TL, EMP)
export const EmployeesView = () => {
  const [filterRole, setFilterRole] = useState('ALL');
  const [search, setSearch] = useState('');

  const directory = [
    { id: 'EMP-001', name: 'Sarah Jenkins', role: 'TL', roleFull: 'Team Leader', dept: 'Engineering', status: 'Active' },
    { id: 'EMP-002', name: 'Alex Morgan', role: 'EMP', roleFull: 'Employee', dept: 'Frontend Dev', status: 'Active' },
    { id: 'EMP-003', name: 'Priya Sharma', role: 'TL', roleFull: 'Team Leader', dept: 'Quality Assurance', status: 'Active' },
    { id: 'INT-101', name: 'Rohan Verma', role: 'INT', roleFull: 'Intern', dept: 'Software Intern', status: 'Active' },
    { id: 'INT-102', name: 'Ananya Rao', role: 'INT', roleFull: 'Intern', dept: 'UI/UX Design', status: 'Active' },
    { id: 'EMP-004', name: 'David Miller', role: 'EMP', roleFull: 'Employee', dept: 'Product Management', status: 'Active' },
    { id: 'EMP-005', name: 'Rahul Patel', role: 'EMP', roleFull: 'Employee', dept: 'UI/UX Lead', status: 'Active' },
    { id: 'INT-103', name: 'Karan Mehta', role: 'INT', roleFull: 'Intern', dept: 'React Engineering', status: 'Active' }
  ];

  const filtered = directory.filter(item => {
    const matchesRole = filterRole === 'ALL' || item.role === filterRole;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.dept.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Kevalon Employee Directory</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">All registered employees including Interns (INT), Team Leaders (TL), and Employees (EMP)</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-md text-xs self-start sm:self-auto">
          {['ALL', 'TL', 'EMP', 'INT'].map(tag => (
            <button
              key={tag}
              onClick={() => setFilterRole(tag)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                filterRole === tag ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {tag === 'ALL' ? 'All Members' : tag === 'TL' ? 'Team Leaders' : tag === 'INT' ? 'Interns' : 'Employees'}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors space-y-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">ID</th>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((emp, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-500 text-xs">{emp.id}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{emp.name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      emp.role === 'TL' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                      emp.role === 'INT' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                      'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }`}>
                      {emp.role} • {emp.roleFull}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{emp.dept}</td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 6. LEARNING HUB (Intern #3)
export const LearningHubView = () => {
  const modules = [
    { title: 'React 19 & Modern Hooks Mastery', level: 'Beginner', hours: '8 hrs', completed: 100 },
    { title: 'Tailwind CSS v4 Design Systems', level: 'Intermediate', hours: '6 hrs', completed: 75 },
    { title: 'REST API & Express Authentication', level: 'Advanced', hours: '12 hrs', completed: 40 },
    { title: 'Git Workflow & Team Collaboration', level: 'Beginner', hours: '4 hrs', completed: 100 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Internship Learning Hub</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Curated training modules, documentation guidelines, and developer roadmaps</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  {mod.level}
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">{mod.title}</h4>
              </div>
              <span className="text-xs font-semibold text-slate-500">{mod.hours}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Completion Status</span>
                <span>{mod.completed}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${mod.completed}%` }} />
              </div>
            </div>

            <button className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
              {mod.completed === 100 ? 'Review Material' : 'Continue Module'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// 7. INTERNSHIP PROGRESS (Intern #4)
export const InternshipProgressView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Internship Progress Tracker</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">3-Month Internship roadmap, weekly evaluations, and mentor checkpoints</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-xs font-bold">
          Month 2 of 3 (65% Completed)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { month: 'Month 1: Foundation & Onboarding', status: 'Completed', score: '95/100', mentor: 'Sarah Jenkins' },
          { month: 'Month 2: Core Feature Development', status: 'In Progress', score: 'Ongoing', mentor: 'Alex Morgan' },
          { month: 'Month 3: Production Review & Capstone', status: 'Upcoming', score: 'Pending', mentor: 'David Miller' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-3">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              item.status === 'Completed' ? 'bg-green-100 text-green-700' : item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {item.status}
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.month}</h4>
            <div className="text-xs text-slate-500 space-y-1">
              <p>Evaluation Score: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.score}</span></p>
              <p>Assigned Mentor: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.mentor}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 8. DOCUMENTS & CERTIFICATE (Intern #7)
export const DocumentsView = () => {
  const docs = [
    { title: 'Internship Offer Letter', date: '01 Jul 2026', size: '1.2 MB', type: 'PDF' },
    { title: 'Non-Disclosure Agreement (NDA)', date: '01 Jul 2026', size: '850 KB', type: 'PDF' },
    { title: 'Company Policy & Code of Conduct', date: '05 Jul 2026', size: '2.4 MB', type: 'PDF' },
    { title: 'Internship Completion Certificate', date: 'Pending Completion (30 Sep 2026)', size: '--', type: 'Certificate' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md">
            <FileBadge size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Documents & Certificates</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Official onboarding documents, signed agreements, and verified certificate portal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {docs.map((doc, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                <FileText size={20} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{doc.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{doc.date} • {doc.size}</p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1">
              <Download size={13} /> View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// 9. DAILY FOLLOW UP (Team Leader #2)
export const DailyFollowUpView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <PhoneCall size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Daily Follow-Up</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Track morning standup check-ins, resolve daily blockers, and conduct status syncs</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer">
          <Plus size={14} /> New Follow-Up Note
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Today's Standup Roster</h3>
          <div className="space-y-2 text-xs">
            {[
              { name: 'Alex Morgan', status: 'Completed', task: 'Implemented Role-based Sidebar' },
              { name: 'Karan Mehta', status: 'Blocker Reported', task: 'Requires API documentation for Leave' },
              { name: 'Priya Sharma', status: 'Completed', task: 'Running automation test suite on staging' }
            ].map((st, i) => (
              <div key={i} className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{st.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">{st.task}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  st.status.includes('Blocker') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {st.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pending Blockers & Actions</h3>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs space-y-1">
            <span className="font-bold text-amber-800 dark:text-amber-300">⚠️ 1 Critical Blocker</span>
            <p className="text-amber-700 dark:text-amber-400">Backend API for role permission sync is being updated on Render. Follow up scheduled at 4 PM.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 10. TEAM TASK MANAGEMENT (Team Leader #3)
export const TeamTaskManagementView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <ListTodo size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Task Management</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Assign sprint tasks, inspect workload distribution, and review submissions</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer">
          <Plus size={14} /> Assign New Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['To Do (4)', 'In Progress (5)', 'Under Review (2)'].map((col, idx) => (
          <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{col}</h4>
            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-2xs text-xs space-y-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Sprint 14</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Refactor Attendance Timeline Canvas</p>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Assigned: Alex M.</span>
                <span className="font-medium text-amber-600">Due Tomorrow</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 11. TEAM LEAVE MANAGEMENT (Team Leader #4)
export const TeamLeaveManagementView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-md">
            <CalendarX size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Leave Approvals</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Review pending leave applications submitted by department team members</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pending Applications (1)</h3>
        <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Karan Mehta</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">Casual Leave</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">Duration: <span className="font-semibold">02 Sep – 03 Sep 2026 (2 Days)</span></p>
            <p className="text-slate-500">Reason: "Attending college university examination."</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1">
              <Check size={14} /> Approve
            </button>
            <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1">
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 12. ATTENDANCE REVIEW (Team Leader #6)
export const AttendanceReviewView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Attendance Review</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Monitor live punch-in times, late arrivals, and total active session duration</p>
          </div>
        </div>
        <button className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5">
          <Download size={14} /> Export Attendance Sheet
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Present Today</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">7 / 8 Members</p>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">On Leave</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">1 Member</p>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Avg Daily Work</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">8 hrs 15 mins</p>
        </div>
      </div>
    </div>
  );
};

// 13. REPORT VIEW (Team Leader #7)
export const ReportView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
            <BarChart size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Reports & Productivity Analytics</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Weekly working hours distribution, project burn-down, and compliance reports</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Weekly Department Utilization</h4>
          <p className="text-xs text-slate-500">Average team output efficiency: 94.2% across current active projects.</p>
          <div className="space-y-2 pt-2">
            {[
              { label: 'Frontend Development', pct: 92 },
              { label: 'Backend & API Integration', pct: 96 },
              { label: 'QA & Regression Testing', pct: 88 }
            ].map((b, i) => (
              <div key={i} className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>{b.label}</span>
                  <span className="font-semibold">{b.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Exportable Audit Reports</h4>
          <div className="space-y-2 text-xs">
            {['Monthly Team Attendance Log.csv', 'Sprint 14 Velocity & Bug Report.pdf', 'Daily Report Summary - August.xlsx'].map((r, i) => (
              <div key={i} className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <span className="font-medium text-slate-800 dark:text-slate-200">{r}</span>
                <button className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
                  <Download size={13} /> Export
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};