import { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Briefcase, 
  Clock, 
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  MoreVertical,
  UserCheck,
  UserX,
  Activity,
  Calendar,
  X,
  Phone,
  MapPin,
  Award,
  BookOpen,
  Smile,
  Star,
  Building2,
  BadgeCheck,
  Loader2,
  FolderOpen,
  FileText
} from 'lucide-react';
import { isFinanceOrExcludedUser } from '../../utils/roleFilters';

const avatarColors = [
  'from-indigo-500 to-indigo-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-emerald-500 to-emerald-600',
  'from-sky-500 to-sky-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600'
];

const getAvatarColor = (index) => avatarColors[index % avatarColors.length];

const getInitials = (name) => {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return 'EM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const getStatusStyle = (status) => {
  const normalizedStatus = (status || '').toLowerCase();
   
  const statusMap = {
    'active': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Active' },
    'active now': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Active Now' },
    'inactive': { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Inactive' },
    'on leave': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', label: 'On Leave' },
    'remote': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400', label: 'Remote' },
    'busy': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400', label: 'Busy' },
  };
  
  return statusMap[normalizedStatus] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', label: status || 'Unknown' };
};

const getPunctualityIcon = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('online') || normalized.includes('active') || normalized.includes('probation')) return <Activity className="w-3 h-3 text-emerald-500" />;
  if (normalized.includes('away') || normalized.includes('break')) return <Clock className="w-3 h-3 text-amber-500" />;
  if (normalized.includes('offline') || normalized.includes('inactive')) return <UserX className="w-3 h-3 text-slate-400" />;
  return <UserCheck className="w-3 h-3 text-blue-500" />;
};

const getAttendanceStatusStyle = (status) => {
  const normalized = (status || '').toLowerCase();

  if (normalized.includes('present') || normalized.includes('active') || normalized.includes('on time')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' };
  }

  if (normalized.includes('late')) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' };
  }

  if (normalized.includes('absent') || normalized.includes('leave')) {
    return { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' };
  }

  if (normalized.includes('half')) {
    return { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' };
  }

  return { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };
};

const normalizeAttendanceRecords = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.attendance)) return payload.attendance;
  if (Array.isArray(payload.logs)) return payload.logs;
  if (Array.isArray(payload.records)) return payload.records;
  return [];
};

const getAttendanceStatusText = (record) => {
  const rawStatus = record?.status || record?.attendanceStatus || record?.currentStatus || record?.state || record?.attendance?.status || '';
  return rawStatus ? String(rawStatus).trim() : 'No status';
};

const getAttendanceName = (record) => {
  const candidates = [
    record?.employeeName,
    record?.name,
    record?.employee?.name,
    record?.employee?.fullName,
    record?.user?.name,
    record?.user?.fullName,
    [record?.employee?.firstName, record?.employee?.lastName].filter(Boolean).join(' '),
    [record?.user?.firstName, record?.user?.lastName].filter(Boolean).join(' '),
  ];

  return candidates.find(Boolean) || '';
};

const getAttendanceEmail = (record) => {
  return record?.email || record?.employee?.email || record?.user?.email || '';
};
 
const getAttendanceId = (record) => {
  return record?.employeeID || record?.employeeId || record?.employee?._id || record?.user?._id || record?.employee?._id || record?.id || record?._id || '';
};

const isAttendanceMatch = (member, record) => {
  const memberId = String(member?.employeeId || member?.id || '').trim().toLowerCase();
  const recordId = String(getAttendanceId(record)).trim().toLowerCase();

  if (memberId && recordId && memberId === recordId) return true;

  const memberEmail = String(member?.email || '').trim().toLowerCase();
  const recordEmail = String(getAttendanceEmail(record)).trim().toLowerCase();
  if (memberEmail && recordEmail && memberEmail === recordEmail) return true;

  const memberName = String(member?.name || '').trim().toLowerCase();
  const recordName = String(getAttendanceName(record)).trim().toLowerCase();

  if (!memberName || !recordName) return false;
  return memberName === recordName || recordName.includes(memberName) || memberName.includes(recordName);
};

const PROJECT_API_BASE = 'https://kt-backend-yzr4.onrender.com/api/projectManage';

const normalizeArrayPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.projects)) return payload.projects;
  if (Array.isArray(payload.tasks)) return payload.tasks;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.dailyUpdates)) return payload.dailyUpdates;
  if (Array.isArray(payload.updates)) return payload.updates;
  return [];
};

const getMemberIdentityValues = (member = {}) => {
  const candidates = [
    member?.id,
    member?._id,
    member?.employeeId,
    member?.userId,
    member?.email,
  ].filter(Boolean);

  return candidates
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
};

const hasMemberMatch = (value, member) => {
  if (!value || !member) return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasMemberMatch(item, member));
  }

  const memberIds = getMemberIdentityValues(member);

  if (typeof value === 'object') {
    const objectIds = [
      value?._id,
      value?.id,
      value?.userId,
      value?.employeeId,
      value?.userID,
    ]
      .filter(Boolean)
      .map((id) => String(id).trim().toLowerCase());

    return objectIds.some((id) => memberIds.includes(id));
  }

  const valueId = String(value).trim().toLowerCase();

  return memberIds.includes(valueId);
};

const projectMatchesMember = (project, member) => {
  if (!project || !member) return false;

  const fields = [
    // Team Lead
    project?.teamLeadUser,
    project?.teamLeadEmployee,
    project?.teamLead,

    // Members
    project?.employees,
    project?.interns,

    // Other possible fields
    project?.assignedEmployee,
    project?.assignedTL,
    project?.assignedIntern,
    project?.createdBy,
    project?.projectLead,
    project?.members,
    project?.projectMembers,
    project?.assignedTo,
    project?.employee,
    project?.user
  ];

  return fields.some((field) => hasMemberMatch(field, member));
};

const taskMatchesMember = (task, member) => {
  if (!task || !member) return false;

  const fields = [
    task?.assignedTo,
    task?.assignedEmployee,
    task?.assignedIntern,
    task?.assignedTeamLeadUser,
    task?.assignedTeamLeadEmployee,
    task?.employee,
    task?.user,
    task?.assignedUser,
    task?.assignee
  ];

  return fields.some((field) => hasMemberMatch(field, member));
};

export default function Members() {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [attendanceStatusMap, setAttendanceStatusMap] = useState({});
  const [memberInsights, setMemberInsights] = useState({ projects: [], tasks: [], dailyUpdates: [] });
  const [memberInsightsLoading, setMemberInsightsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

const fetchAllMembers = async () => {
  setLoading(true);
  setError('');

  try {
    const token = localStorage.getItem('token');

    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    // ==========================================
    // FETCH USERS
    // ==========================================
    const usersRes = await fetch(
      'https://kt-backend-yzr4.onrender.com/api/users/all',
      { headers }
    );

    if (!usersRes.ok) {
      throw new Error('Failed to fetch users');
    }

    const usersData = await usersRes.json();

    const usersList =
      usersData?.users ||
      usersData?.data ||
      usersData ||
      [];

    // ==========================================
    // FETCH EMPLOYEES
    // ==========================================
    const employeesRes = await fetch(
      'https://kt-backend-yzr4.onrender.com/api/employee/list',
      { headers }
    );

    let employeesList = [];

    if (employeesRes.ok) {
      const employeesData = await employeesRes.json();

      employeesList =
        employeesData?.employees ||
        employeesData?.data ||
        employeesData?.employeesList ||
        employeesData ||
        [];
    }

    console.log('USERS:', usersList);
    console.log('EMPLOYEES:', employeesList);

    // ==========================================
    // HELPERS
    // ==========================================
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';

      const date = new Date(dateStr);

      return isNaN(date.getTime())
        ? 'N/A'
        : date.toLocaleDateString('en-GB');
    };

    const normalize = (value) =>
      value === null || value === undefined
        ? ''
        : String(value).trim().toLowerCase();

    // ==========================================
    // FIND EMPLOYEE FOR USER
    // ==========================================
    const findEmployee = (user) => {
      const userId = normalize(
        user?._id ||
        user?.id ||
        user?.userID ||
        user?.userId
      );

      const employeeId = normalize(
        user?.employeeID ||
        user?.employeeId
      );

      const email = normalize(user?.email);

      return employeesList.find((employee) => {

        const employeeUserId = normalize(
          employee?.userID?._id ||
          employee?.userID ||
          employee?.userId?._id ||
          employee?.userId
        );

        const employeeIdValue = normalize(
          employee?.employeeID ||
          employee?.employeeId
        );

        const employeeEmail = normalize(
          employee?.email ||
          employee?.userID?.email ||
          employee?.userId?.email
        );

        return (
          (userId && employeeUserId && userId === employeeUserId) ||
          (employeeId && employeeIdValue && employeeId === employeeIdValue) ||
          (email && employeeEmail && email === employeeEmail)
        );
      });
    };

    // ==========================================
    // BUILD MEMBERS
    // ==========================================
    const allMembers = usersList
      .filter((user) => {
        if (!user) return false;
        if (isFinanceOrExcludedUser(user)) return false;

        const name = user.name || user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        const email = user.email || '';
        if (
          !name ||
          name === "Unnamed" ||
          name === "No Name" ||
          name === "Unknown Employee" ||
          name === "Unknown User" ||
          name === "N/A"
        ) {
          return false;
        }

        if (!email || email === "N/A" || !email.includes("@")) {
          return false;
        }

        return true;
      })
      .map((user, index) => {

        // --------------------------------------
        // FIND EMPLOYEE RECORD
        // --------------------------------------
        const employee = findEmployee(user);
        if (employee && isFinanceOrExcludedUser(employee)) {
          return null;
        }

        console.log(
          'USER:',
          user?.email,
          'EMPLOYEE:',
          employee
        );

        const role = String(
          user?.role ||
          user?.userRole ||
          employee?.role ||
          ''
        )
          .toLowerCase()
          .trim();

        const roleType =
          role === 'intern'
            ? 'intern'
            : role === 'teamlead' ||
              role === 'team lead' ||
              role === 'team_lead' ||
              role === 'tl'
            ? 'tl'
            : 'employee';

        // --------------------------------------
        // NAME
        // --------------------------------------
        const fullName =
          [
            employee?.firstName || user?.firstName,
            employee?.lastName || user?.lastName
          ]
            .filter(Boolean)
            .join(' ') ||
          employee?.name ||
          user?.name ||
          'Unnamed User';

        // --------------------------------------
        // DESIGNATION
        // --------------------------------------
        let designation =
          roleType === 'intern'
            ? 'Intern'
            : roleType === 'tl'
            ? 'Team Lead'
            : 'Employee';

        if (employee?.designation) {
          if (
            typeof employee.designation === 'object'
          ) {
            designation =
              employee.designation?.designationName ||
              employee.designation?.name ||
              designation;
          } else {
            designation = employee.designation;
          }
        }

        if (employee?.designationName) {
          designation = employee.designationName;
        }

        if (user?.designation) {
          if (
            typeof user.designation === 'object'
          ) {
            designation =
              user.designation?.designationName ||
              user.designation?.name ||
              designation;
          } else {
            designation = user.designation;
          }
        }

        if (user?.designationName) {
          designation = user.designationName;
        }

        // --------------------------------------
        // DEPARTMENT
        // --------------------------------------
        let department = 'Unassigned';

        const departmentValue =
          employee?.department ||
          employee?.departmentName ||
          user?.department ||
          user?.departmentName;

        if (
          typeof departmentValue === 'object'
        ) {
          department =
            departmentValue?.departmentName ||
            departmentValue?.name ||
            'Unassigned';
        } else if (departmentValue) {
          department = departmentValue;
        }

        // --------------------------------------
        // PERSONAL DETAILS
        // EMPLOYEE FIRST, USER FALLBACK
        // --------------------------------------
        const dob =
          employee?.dob ||
          employee?.dateOfBirth ||
          user?.dob ||
          user?.dateOfBirth ||
          null;

        const bloodGroup =
          employee?.bloodGroup ||
          user?.bloodGroup ||
          'N/A';

        const currentAddress =
          employee?.address ||
          employee?.currentAddress ||
          user?.address ||
          user?.currentAddress ||
          'N/A';

        const permanentAddress =
          employee?.permanentAddress ||
          employee?.permanent_address ||
          user?.permanentAddress ||
          user?.permanent_address ||
          'N/A';

        const mobile =
          employee?.mobile ||
          employee?.phone ||
          employee?.phoneNumber ||
          user?.mobile ||
          user?.phone ||
          user?.phoneNumber ||
          'N/A';

        // --------------------------------------
        // SKILLS
        // --------------------------------------
        const skills =
          Array.isArray(employee?.skills)
            ? employee.skills
            : Array.isArray(user?.skills)
            ? user.skills
            : [];

        // --------------------------------------
        // STATUS
        // --------------------------------------
        const status =
          employee?.employeeStatus ||
          employee?.status ||
          user?.employeeStatus ||
          user?.status ||
          'Active';

        // --------------------------------------
        // JOINING DATE
        // --------------------------------------
        const joiningDate =
          employee?.joiningDate ||
          user?.joiningDate ||
          null;

        // --------------------------------------
        // EMPLOYEE ID
        // --------------------------------------
        const finalEmployeeId =
          employee?.employeeID ||
          employee?.employeeId ||
          user?.employeeID ||
          user?.employeeId ||
          `${roleType.toUpperCase()}${String(
            index + 1
          ).padStart(4, '0')}`;

        // --------------------------------------
        // RETURN MEMBER
        // --------------------------------------
        return {
          id:
            employee?._id ||
            user?._id ||
            user?.id ||
            `${roleType}-${index}`,

          userId:
            user?._id ||
            user?.id ||
            employee?.userID ||
            employee?.userId ||
            '',

          employeeId: finalEmployeeId,

          name: fullName,

          firstName:
            employee?.firstName ||
            user?.firstName ||
            '',

          lastName:
            employee?.lastName ||
            user?.lastName ||
            '',

          email:
            employee?.email ||
            user?.email ||
            'No email',

          mobile,

          phone:
            employee?.phone ||
            employee?.phoneNumber ||
            user?.phone ||
            user?.phoneNumber ||
            'N/A',

          dob: formatDate(dob),

          bloodGroup,

          currentAddress,

          permanentAddress,

          designation,

          department,

          status,

          currentAction:
            employee?.currentAction ||
            user?.currentAction ||
            'Available',

          skills,

          joiningDate:
            formatDate(joiningDate),

          role: role,

          roleType,

          initials: getInitials(fullName),

          avatarColor:
            getAvatarColor(index)
        };
      })
      .filter(Boolean);

    console.log(
      'FINAL MEMBERS:',
      allMembers
    );

    if (isMounted) {
      setMembers(allMembers);
      setFilteredMembers(allMembers);
    }

  } catch (err) {

    console.error(
      '❌ Error fetching members:',
      err
    );

    if (isMounted) {
      setError(
        err.message ||
        'Unable to load team members.'
      );

      setMembers([]);
      setFilteredMembers([]);
    }

  } finally {

    if (isMounted) {
      setLoading(false);
    } 
  }
};

    fetchAllMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!members.length) {
      setAttendanceStatusMap({});
      return () => {
        isMounted = false;
      };
    }

    const fetchAttendanceStatuses = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('https://kt-backend-yzr4.onrender.com/api/attendance/admin/all', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) return;

        const data = await response.json();
        const attendanceRecords = normalizeAttendanceRecords(data);

        const nextStatusMap = {};
        members.forEach((member) => {
          const matchedRecord = attendanceRecords.find((record) => isAttendanceMatch(member, record));
          nextStatusMap[member.id] = matchedRecord ? getAttendanceStatusText(matchedRecord) : '';
        });

        if (isMounted) {
          setAttendanceStatusMap(nextStatusMap);
        }
      } catch (err) {
        console.error('❌ Error fetching attendance status:', err);
      }
    };

    fetchAttendanceStatuses();

    return () => {
      isMounted = false;
    };
  }, [members]);

  useEffect(() => {
    let filtered = members;

    if (searchTerm) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRole !== 'all') {
      filtered = filtered.filter(member =>
        member.roleType === selectedRole
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(member =>
        String(member.status || '').toLowerCase() === selectedStatus.toLowerCase()
      );
    }

    setFilteredMembers(filtered);
  }, [searchTerm, selectedRole, selectedStatus, members]);

  const resolveTeamMemberDetails = async (memberIds, allMembers, token) => {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return [];
  }

  return memberIds
    .map((id) => {
      if (!id) return null;

      const projectMemberId = String(
        id?._id ||
        id?.id ||
        id?.userId ||
        id?.userID ||
        id
      )
        .trim()
        .toLowerCase();

      return allMembers.find((member) => {
        const memberIds = [
          member?.id,
          member?._id,
          member?.userId,
          member?.employeeId
        ]
          .filter(Boolean)
          .map((x) => String(x).trim().toLowerCase());

        return memberIds.includes(projectMemberId);
      });
    })
    .filter(Boolean);
};

  const handleMemberClick = async (member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
    setMemberInsightsLoading(true);
    setMemberInsights({ projects: [], tasks: [], dailyUpdates: [] });

    const memberIdentifier = member?.id || member?.employeeId || member?.email || member?.name || '';
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const projectsPromise = fetch(
        `${PROJECT_API_BASE}/project/all`,
        { headers }
      ).then(async (response) => {
        if (!response.ok) return [];

        const payload = await response.json();

        return normalizeArrayPayload(payload)
          .filter((project) => projectMatchesMember(project, member));
      });

      const tasksPromise = memberIdentifier
        ? fetch(`${PROJECT_API_BASE}/task/employee/${encodeURIComponent(memberIdentifier)}`, { headers }).then(async (response) => {
            if (!response.ok) return [];
            const payload = await response.json();
            return normalizeArrayPayload(payload).filter((task) => taskMatchesMember(task, member));
          })
        : Promise.resolve([]);

      const [projects, tasks] = await Promise.all([projectsPromise, tasksPromise]);

      const enrichedProjects = await Promise.all(
        projects.map(async (project) => {
          const tlIds = Array.isArray(project?.teamLead) ? project.teamLead : project?.teamLead ? [project.teamLead] : [];
          const empIds = Array.isArray(project?.employees) ? project.employees : project?.employees ? [project.employees] : [];
          const internIds = Array.isArray(project?.interns) ? project.interns : project?.interns ? [project.interns] : [];

          const teamLeads = await resolveTeamMemberDetails(tlIds, members, token);
          const employees = await resolveTeamMemberDetails(empIds, members, token);
          const interns = await resolveTeamMemberDetails(internIds, members, token);

          return {
            ...project,
            resolvedTeamLeads: teamLeads,
            resolvedEmployees: employees,
            resolvedInterns: interns
          };
        })
      );

      let dailyUpdates = [];
      try {
        const res = await fetch('https://kt-backend-yzr4.onrender.com/api/dailyUpdate/list', { headers });
        if (res.ok) {
          const payload = await res.json();
          const allReports = normalizeArrayPayload(payload);
          const memberIdStr = String(member?._id || member?.id || member?.userId || member?.employeeId || '').toLowerCase();
          const memberEmailStr = String(member?.email || '').toLowerCase();
          const taskIds = new Set(tasks.map(t => String(t?._id || t?.id || t?.taskId || '')));

          dailyUpdates = allReports.filter(report => {
            if (!report) return false;
            // Match by task references
            if (Array.isArray(report.taskReferences) && report.taskReferences.length > 0) {
              const matchesTask = report.taskReferences.some(ref => {
                const refId = String(typeof ref === 'object' ? (ref._id || ref.id || ref.taskId || '') : ref);
                return refId && taskIds.has(refId);
              });
              if (matchesTask) return true;
            }
            // Match by employee/user
            const empObj = report.employeeId || report.userId || report.user;
            const empId = String(typeof empObj === 'object' ? (empObj?._id || empObj?.id || '') : (empObj || '')).toLowerCase();
            const empEmail = String(typeof empObj === 'object' ? (empObj?.email || '') : (report.employeeEmail || report.email || '')).toLowerCase();
            if (memberIdStr && empId && empId === memberIdStr) return true;
            if (memberEmailStr && empEmail && empEmail === memberEmailStr) return true;
            return false;
          }).map(report => ({
            ...report,
            updateText: report.todaysWork || report.workUpdate || report.updateText || report.description || 'Daily Update',
            taskTitle: (Array.isArray(report.taskReferences) && report.taskReferences[0]?.taskTitle) || 'Project Task'
          }));
        }
      } catch (err) {
        console.error('❌ Error fetching daily updates list:', err);
      }

      setMemberInsights({
        projects: enrichedProjects.slice(0, 5),
        tasks: tasks.slice(0, 5),
        dailyUpdates: dailyUpdates
          .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
          .slice(0, 5)
      });
    } catch (err) {
      console.error('❌ Error fetching member project insights:', err);
      setMemberInsights({ projects: [], tasks: [], dailyUpdates: [] });
    } finally {
      setMemberInsightsLoading(false);
    }
  };

  const roles = ['all', ...new Set(members.map(m => m.roleType))];
  const statuses = ['all', ...new Set(members.map(m => String(m.status || '').toLowerCase()))];

  const getRoleLabel = (role) => {
    const labels = {
      'intern': 'Interns',
      'tl': 'Team Leads',
      'employee': 'Employees',
      'all': 'All Roles'
    };
    return labels[role] || role;
  };

  const getRoleIcon = (roleType) => {
    const icons = {
      'intern': <BookOpen className="w-3.5 h-3.5" />,
      'tl': <Star className="w-3.5 h-3.5" />,
      'employee': <Building2 className="w-3.5 h-3.5" />
    };
    return icons[roleType] || <UserCheck className="w-3.5 h-3.5" />;
  };

  const getRoleBadgeStyle = (roleType) => {
    const styles = {
      'intern': 'bg-violet-50 text-violet-700 border-violet-300',
      'tl': 'bg-amber-50 text-amber-700 border-amber-300',
      'employee': 'bg-blue-50 text-blue-700 border-blue-300'
    };
    return styles[roleType] || 'bg-slate-50 text-slate-700 border-slate-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* Header Section */}
        <div className="mb-5 sm:mb-6 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Team Members</h1>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
                    Directory
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage and overview all staff, team leads, interns, and employees.
                </p>
              </div>
            </div>

            {/* Quick Stat Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  selectedRole === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Total</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  selectedRole === 'all' ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}>
                  {members.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('intern')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  selectedRole === 'intern'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100/80 border border-violet-200/80'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Interns</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  selectedRole === 'intern' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-800'
                }`}>
                  {members.filter(m => m.roleType === 'intern').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('tl')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  selectedRole === 'tl'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 border border-amber-200/80'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>Leads</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  selectedRole === 'tl' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {members.filter(m => m.roleType === 'tl').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('employee')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  selectedRole === 'employee'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100/80 border border-blue-200/80'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Employees</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  selectedRole === 'employee' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {members.filter(m => m.roleType === 'employee').length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters Section - Compact & Modern */}
        <div className="mb-4 flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search members by name, email, designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-2xs transition-all placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-none">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full sm:w-40 pl-3.5 pr-8 py-2 text-sm border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white appearance-none cursor-pointer shadow-2xs font-medium text-slate-700"
              >
                {roles.map(role => (
                  <option key={role} value={role}>
                    {getRoleLabel(role)}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative flex-1 sm:flex-none">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full sm:w-36 pl-3.5 pr-8 py-2 text-sm border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white appearance-none cursor-pointer shadow-2xs font-medium text-slate-700"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-16 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
          </div>
        ) : error ? (
          <div className="border border-rose-200 bg-rose-50/80 rounded-xl px-4 py-3 text-rose-700 flex items-center gap-2.5 text-sm">
            <UserX className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-2xl bg-white p-8 text-center shadow-xs">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-900">No members found</h3>
            <p className="text-xs text-slate-500 mt-0.5">Try adjusting your search terms or filters</p>
          </div>
        ) : ( 
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredMembers.map((member) => {
              const statusStyle = getStatusStyle(member.status);
              const attendanceStatus = attendanceStatusMap[member.id] || 'No status';
              const attendanceStatusStyle = getAttendanceStatusStyle(attendanceStatus);
              const roleBadgeStyle = getRoleBadgeStyle(member.roleType);
              
              return (
                <div
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="group relative bg-white border border-slate-200/80 hover:border-indigo-300/90 rounded-2xl p-3.5 transition-all hover:shadow-md cursor-pointer flex flex-col justify-between"
                >
                  <button className="absolute top-2.5 right-2.5 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition-opacity">
                    <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <div className="flex gap-3 items-start">
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${member.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
                        {member.initials}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${statusStyle.dot} ring-2 ring-white`}></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-sm font-bold text-slate-900 truncate max-w-[130px] sm:max-w-[150px]">
                          {member.name}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{member.designation}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md border ${roleBadgeStyle}`}>
                          {getRoleIcon(member.roleType)}
                          {member.roleType === 'tl' ? 'Lead' : member.roleType === 'intern' ? 'Intern' : 'Employee'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md ${statusStyle.bg} ${statusStyle.text}`}>
                          {member.status}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-md ${attendanceStatusStyle.bg} ${attendanceStatusStyle.text}`}>
                          {getPunctualityIcon(attendanceStatus)}
                          {attendanceStatus}
                        </span>
                      </div>
                    </div>

                    <div className="self-center p-1 text-slate-300 group-hover:text-indigo-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member Detail Modal - Compact */}
      {showDetailModal && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border border-slate-300">
            
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-300 px-4 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 bg-gradient-to-br ${selectedMember.avatarColor} text-white flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                  {selectedMember.initials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 truncate">{selectedMember.name}</h2>
                  <p className="text-[11px] text-slate-500 truncate">{selectedMember.designation}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedMember(null);
                  setMemberInsights({ projects: [], tasks: [], dailyUpdates: [] });
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-indigo-50/40 p-2 text-center border border-indigo-300">
                  <div className="text-xs font-bold text-indigo-700 truncate">{selectedMember.employeeId}</div>
                  <div className="text-[9px] text-slate-400 font-medium mt-0.5">ID</div>
                </div>
                <div className="bg-amber-50/40 p-2 text-center border border-amber-300">
                  <div className="text-xs font-bold text-amber-700 uppercase truncate">{selectedMember.bloodGroup}</div>
                  <div className="text-[9px] text-slate-400 font-medium mt-0.5">Blood</div>
                </div>
                <div className="bg-rose-50/40 p-2 text-center border border-rose-300">
                  <div className="text-xs font-bold text-rose-700 capitalize truncate">{selectedMember.currentAction}</div>
                  <div className="text-[9px] text-slate-400 font-medium mt-0.5">Action</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-300">
                    <Smile className="w-3.5 h-3.5 text-indigo-500" />
                    Personal Info
                  </h3>
                  
                  <div className="space-y-1.5">
                    <div className="flex gap-2 p-2 bg-slate-50/60 border border-slate-200 items-center">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] text-slate-400">Email</div>
                        <div className="text-xs font-medium text-slate-700 truncate">{selectedMember.email}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 p-2 bg-slate-50/60 border border-slate-200 items-center">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-[9px] text-slate-400">Mobile</div>
                        <div className="text-xs font-medium text-slate-700 truncate">{selectedMember.mobile}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 p-2 bg-slate-50/60 border border-slate-200 items-center">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-[9px] text-slate-400">DOB</div>
                        <div className="text-xs font-medium text-slate-700">{selectedMember.dob}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-300">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    Work Details
                  </h3>
                  
                  <div className="space-y-1.5">
                    <div className="flex gap-2 p-2 bg-slate-50/60 border border-slate-200 items-center">
                      <Award className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-[9px] text-slate-400">Role</div>
                        <div className="text-xs font-medium text-slate-700 truncate">{selectedMember.designation}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 p-2 bg-slate-50/60 border border-slate-200 items-start">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[9px] text-slate-400">Address</div>
                        <div className="text-xs font-medium text-slate-700 leading-tight truncate">{selectedMember.currentAddress}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 p-2 bg-slate-50/60 border border-slate-200 items-center">
                      <Activity className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 flex justify-between items-center">
                        <div>
                          <div className="text-[9px] text-slate-400">Joined</div>
                          <div className="text-xs font-medium text-slate-700">{selectedMember.joiningDate}</div>
                        </div>
                        <div className="flex gap-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium ${getStatusStyle(selectedMember.status).bg} ${getStatusStyle(selectedMember.status).text}`}>
                            {selectedMember.status}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium ${getAttendanceStatusStyle(attendanceStatusMap[selectedMember.id] || 'No status').bg} ${getAttendanceStatusStyle(attendanceStatusMap[selectedMember.id] || 'No status').text}`}>
                            {attendanceStatusMap[selectedMember.id] || 'No status'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {selectedMember.skills && selectedMember.skills.length > 0 && (
                <div className="pt-1">
                  <h3 className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedMember.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-1">
                <div className="border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <h3 className="text-[11px] font-bold text-slate-800">Assigned Projects</h3>
                  </div>

                  {memberInsightsLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading projects...
                    </div>
                  ) : memberInsights.projects.length > 0 ? (
                    <ul className="space-y-2.5">
                      {memberInsights.projects.map((project, idx) => (
                        <li key={project?._id || project?.id || idx} className="text-[11px] text-slate-700 border border-slate-300 p-2 bg-white">
                          <div className="font-medium truncate mb-1.5">{project?.projectName || project?.name || 'Untitled Project'}</div>
                          <div className="text-[10px] text-slate-500 mb-1.5">{project?.status || 'In progress'} • Budget: {project?.projectBudget || 'N/A'}</div>
                          
                          {/* Team Leads */}
                          {project?.resolvedTeamLeads && project.resolvedTeamLeads.length > 0 && (
                            <div className="mb-1.5 pb-1.5 border-b border-slate-200">
                              <div className="text-[9px] font-semibold text-amber-700 mb-1">Team Leads:</div>
                              <div className="flex flex-wrap gap-1">
                                {project.resolvedTeamLeads.map((tl) => (
                                  <span key={tl?.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-medium border border-amber-200">
                                    <Star className="w-2.5 h-2.5" />
                                    {tl?.name || 'TL'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Employees */}
                          {project?.resolvedEmployees && project.resolvedEmployees.length > 0 && (
                            <div className="mb-1.5 pb-1.5 border-b border-slate-200">
                              <div className="text-[9px] font-semibold text-blue-700 mb-1">Employees:</div>
                              <div className="flex flex-wrap gap-1">
                                {project.resolvedEmployees.map((emp) => (
                                  <span key={emp?.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-medium border border-blue-200">
                                    <Building2 className="w-2.5 h-2.5" />
                                    {emp?.name || 'Employee'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Interns */}
                          {project?.resolvedInterns && project.resolvedInterns.length > 0 && (
                            <div>
                              <div className="text-[9px] font-semibold text-violet-700 mb-1">Interns:</div>
                              <div className="flex flex-wrap gap-1">
                                {project.resolvedInterns.map((intern) => (
                                  <span key={intern?.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-50 text-violet-700 text-[9px] font-medium border border-violet-200">
                                    <BookOpen className="w-2.5 h-2.5" />
                                    {intern?.name || 'Intern'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-500">No assigned projects found.</p>
                  )}
                </div>

                <div className="border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <h3 className="text-[11px] font-bold text-slate-800">Assigned Tasks</h3>
                  </div>

                  {memberInsightsLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading tasks...
                    </div>
                  ) : memberInsights.tasks.length > 0 ? (
                    <ul className="space-y-1.5">
                      {memberInsights.tasks.map((task, idx) => (
                        <li key={task?._id || task?.id || idx} className="text-[11px] text-slate-700">
                          <div className="font-medium truncate">{task?.taskTitle || task?.title || 'Untitled Task'}</div>
                          <div className="text-[10px] text-slate-500">{task?.status || 'Pending'} • {task?.progress || 0}%</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-500">No assigned tasks found.</p>
                  )}
                </div>

                <div className="border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <h3 className="text-[11px] font-bold text-slate-800">Daily Reports</h3>
                  </div>

                  {memberInsightsLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading reports...
                    </div>
                  ) : memberInsights.dailyUpdates.length > 0 ? (
                    <ul className="space-y-1.5">
                      {memberInsights.dailyUpdates.map((update, idx) => (
                        <li key={update?._id || update?.id || idx} className="text-[11px] text-slate-700">
                          <div className="font-medium truncate">{update?.taskTitle || 'Task update'}</div>
                          <div className="text-[10px] text-slate-500">{update?.message || update?.description || 'No details provided'}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-500">No daily reports found.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  ); 
}