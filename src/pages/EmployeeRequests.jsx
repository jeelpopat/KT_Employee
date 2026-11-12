import React, { useEffect, useRef, useState } from 'react';
import { LoadingScreen, TableSkeleton } from '../components/common/Loader.jsx';
import {
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Droplet,
  Hash,
  Building,
  User,
  Clock,
  RefreshCw,
  Building2,
  CheckCheck,
  AlertCircle,
  X,
  ShieldCheck,
  Crown,
  Landmark,
  UserCheck,
  Download,
  MoreVertical,
  ArrowLeft,
  Home,
  Mail
} from 'lucide-react';
import api from '../api/axios';
import { BASE_URL } from '../api/config';
import {
  isFinanceOrExcludedUser,
  filterOutUnknownUsers,
  isUnknownEmployeeOrUser,
  resolveRoleName,
} from '../utils/roleFilters';
import { fetchTeamsList } from '../utils/teamLeadUtils';

const roleLookupCache = new Map();
const roleFields = ['role', 'userRole', 'roleName', 'employeeRole', 'roleType', 'roleId', 'roleID', 'role_id'];
const nestedRoleRecordFields = ['user', 'userId', 'userID', 'employee', 'employeeId', 'employeeID', 'profile'];

const getRoleIds = (record) => {
  const pending = [record];
  const visited = new Set();
  const ids = new Set();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    roleFields.forEach((field) => {
      const value = current[field];
      if (typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value.trim())) {
        ids.add(value.trim().toLowerCase());
      } else if (value && typeof value === 'object') {
        const roleName = value.roleName || value.name || value.title || value.displayName;
        if (!roleName) {
          const id = value._id || value.id || value.roleId || value.roleID || value.role_id;
          if (id && /^[0-9a-f]{24}$/i.test(String(id).trim())) {
            ids.add(String(id).trim().toLowerCase());
          }
        }
      }
    });

    nestedRoleRecordFields.forEach((field) => {
      const value = current[field];
      if (value && typeof value === 'object') pending.push(value);
    });
  }

  return [...ids];
};

const fetchRoleName = (roleId) => {
  if (!roleLookupCache.has(roleId)) {
    const lookup = (async () => {
      for (const endpoint of [`/api/role/get/${roleId}`, `/api/role/${roleId}`]) {
        try {
          const response = await api.get(endpoint);
          const role = response.data?.data || response.data?.role || response.data;
          const name = typeof role === 'string'
            ? role
            : role?.roleName || role?.name || role?.title || role?.displayName;
          if (name && !/^[0-9a-f]{24}$/i.test(String(name).trim())) {
            return String(name).trim();
          }
        } catch {
          // Try the alternate role-by-id route before reporting an unresolved ID.
        }
      }

      console.warn('Could not resolve one or more employee request roles by ID; retaining available user role data.');
      return '';
    })();
    roleLookupCache.set(roleId, lookup);
  }

  return roleLookupCache.get(roleId);
};

// Helper to determine if a user has the role of Team Leader (TL)
export const isTeamLeadUser = (u) => {
  if (!u) return false;
  if (isFinanceOrExcludedUser(u)) return false;
  const role = String(u.role || '').toLowerCase().trim();
  const desig = typeof u.designation === 'object'
    ? String(u.designation?.designationName || u.designation?.name || u.designation?.title || '').toLowerCase().trim()
    : String(u.designation || '').toLowerCase().trim();
  return (
    u.isTeamLead === true ||
    u.isTeamLeader === true ||
    role === 'team lead' ||
    role === 'team_leader' ||
    role === 'team leader' ||
    role === 'tl' ||
    role === 'teamlead' ||
    role.includes('team lead') ||
    role.includes('team_leader') ||
    (role.includes('lead') && !role.includes('clean') && !role.includes('plead')) ||
    desig === 'team lead' ||
    desig === 'team_leader' ||
    desig === 'team leader' ||
    desig === 'tl' ||
    desig.includes('team lead') ||
    desig.includes('team leader')
  );
};

const isUserApproved = (user) =>
  user?.isApproved === true ||
  user?.approved === true ||
  String(user?.status || '').trim().toLowerCase() === 'approved';

const isUserInactive = (user) =>
  user?.isActive === false ||
  ['inactive', 'rejected'].includes(String(user?.status || '').trim().toLowerCase()) ||
  String(user?.employeeStatus || '').trim().toLowerCase() === 'inactive';

const isReadOnlyRequestRole = (user) => {
  if (isTeamLeadUser(user)) return false;

  const roleValues = [
    user?.role,
    user?.userRole,
    user?.roleName,
    user?.employeeRole,
    user?.roleType,
  ];

  const normalizeRole = (value) => {
    const roleName = typeof value === 'string'
      ? value
      : value?.roleName || value?.name || value?.title || value?.designationName || '';
    return String(roleName).toLowerCase().replace(/[_-]+/g, ' ').trim();
  };
  const isRestrictedRole = (role) =>
    /\b(ca|chartered accountant|accountant|admin|administrator|hr|human resources)\b/.test(role);
  const availableRoles = roleValues.map(normalizeRole).filter(Boolean);

  if (availableRoles.length > 0) return availableRoles.some(isRestrictedRole);
  return isRestrictedRole(normalizeRole(user?.designation));
};

const EmployeeRequests = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingState, setProcessingState] = useState(null);
  const usersFetchSequenceRef = useRef(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [dateRange, setDateRange] = useState('30d');
  const [openActionsFor, setOpenActionsFor] = useState(null);

  useEffect(() => {
    if (!selectedUser) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedUser(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedUser]);

  // ================= APPROVAL MODAL & METADATA STATE =================
  const [approvingUser, setApprovingUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchLoadError, setBranchLoadError] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingFY, setLoadingFY] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [successNotification, setSuccessNotification] = useState('');

  // ================= TEAM LEAD STATE =================
  const [teamLeads, setTeamLeads] = useState([]);
  const [loadingTeamLeads, setLoadingTeamLeads] = useState(false);
  const [selectedTeamLeadId, setSelectedTeamLeadId] = useState('');
  const [tlAssignmentMode, setTlAssignmentMode] = useState('existing');
  const [backendTeams, setBackendTeams] = useState([]);

  // Fetch users from API
  const fetchUsers = async (isSilent = false) => {
    const fetchSequence = ++usersFetchSequenceRef.current;
    try {
      if (!isSilent) {
        setLoading(true);
        setError('');
      }
      let userList = [];
      const freshUrl = `${BASE_URL}/api/users/all?_t=${Date.now()}`;
      try {
        const res = await api.get(`/api/users/all?_t=${Date.now()}`);
        userList = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.data || [];
      } catch {
        // Fallback to direct fetch
        const response = await fetch(freshUrl);
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        userList = Array.isArray(data) ? data : data?.users || data?.data || [];
      }

      const unresolvedRoleIds = [...new Set(userList.flatMap(getRoleIds))];
      const roleNamesById = new Map(
        await Promise.all(unresolvedRoleIds.map(async (roleId) => [roleId, await fetchRoleName(roleId)]))
      );
      userList = userList.map(user => {
        const role = resolveRoleName(user, roleNamesById);
        const rawDepartment = user?.department || user?.departmentName || user?.dept;
        const department = rawDepartment && typeof rawDepartment === 'object'
          ? rawDepartment.name || rawDepartment.departmentName || rawDepartment.title || ''
          : rawDepartment;
        return {
          ...user,
          ...(role ? { role: String(role) } : {}),
          ...(department ? { department: String(department) } : {})
        };
      });

      if (fetchSequence === usersFetchSequenceRef.current) {
        setUsers(filterOutUnknownUsers(userList));
      }
      return userList;
    } catch (err) {
      if (!isSilent) {
        setError(err.message || 'Something went wrong while loading users');
      }
      return [];
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  const getAuthToken = () => {
    try {
      return localStorage.getItem('auth_token') || localStorage.getItem('token') || null;
    } catch {
      return null;
    }
  };

  // 1. Fetch Companies dynamically: GET /api/company
  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      let companyList = [];
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      try {
        const compRes = await api.get('/api/company', { headers });
        const cData = compRes.data?.data || compRes.data?.companies || (Array.isArray(compRes.data) ? compRes.data : []);
        if (Array.isArray(cData) && cData.length > 0) companyList = cData;
      } catch (cErr) {
        console.warn('GET /api/company via api instance encountered error:', cErr?.message);
      }

      if (companyList.length === 0) {
        try {
          const compRes = await api.get('/api/company/', { headers });
          const cData = compRes.data?.data || compRes.data?.companies || (Array.isArray(compRes.data) ? compRes.data : []);
          if (Array.isArray(cData) && cData.length > 0) companyList = cData;
        } catch { }
      }

      if (companyList.length === 0) {
        try {
          const fetchRes = await fetch(`${BASE_URL}/api/company`, { headers });
          if (fetchRes.ok) {
            const compData = await fetchRes.json();
            const cData = compData?.data || compData?.companies || (Array.isArray(compData) ? compData : []);
            if (Array.isArray(cData) && cData.length > 0) companyList = cData;
          }
        } catch { }
      }

      if (companyList.length === 0) {
        try {
          const fetchRes = await fetch(`${BASE_URL}/api/company/`, { headers });
          if (fetchRes.ok) {
            const compData = await fetchRes.json();
            const cData = compData?.data || compData?.companies || (Array.isArray(compData) ? compData : []);
            if (Array.isArray(cData) && cData.length > 0) companyList = cData;
          }
        } catch { }
      }

      const cleanCompanies = companyList.map(c => ({
        _id: String(c._id || c.id || ''),
        id: String(c._id || c.id || ''),
        companyName: c.companyName || c.name || c.title || 'Kevalon Technology',
        ...c
      }));

      setCompanies(cleanCompanies);
      return cleanCompanies;
    } catch (err) {
      console.error('Failed to load companies:', err);
      setCompanies([]);
      return [];
    } finally {
      setLoadingCompanies(false);
    }
  };

  // 2. Fetch Branches dynamically from API
  // All branches: GET /api/branch
  // Company branches: GET /api/branch?companyId=<companyId>
  const fetchBranches = async (companyId = null) => {
    setBranchLoadError('');
    const rawCompId = typeof companyId === 'object' && companyId !== null
      ? (companyId._id || companyId.id || companyId.companyId || '')
      : String(companyId || '').trim();

    // With companyId: /api/branch?companyId=<id>
    // Without companyId: /api/branch (fetches all branches)
    const endpoint = rawCompId
      ? `/api/branch?companyId=${encodeURIComponent(rawCompId)}`
      : '/api/branch';
    const directUrl = rawCompId
      ? `${BASE_URL}/api/branch?companyId=${encodeURIComponent(rawCompId)}`
      : `${BASE_URL}/api/branch`;

    setLoadingBranches(true);
    try {
      let branchList = [];
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // 1. Primary: via api axios client
      try {
        const branchRes = await api.get(endpoint, { headers });
        const bData = branchRes.data?.data || branchRes.data?.branches || (Array.isArray(branchRes.data) ? branchRes.data : []);
        if (Array.isArray(bData) && bData.length > 0) branchList = bData;
      } catch (bErr) {
        console.warn(`GET ${endpoint} via api encountered error:`, bErr?.message);
      }

      // 2. Direct fetch fallback
      if (branchList.length === 0) {
        try {
          const fetchRes = await fetch(directUrl, { headers });
          if (fetchRes.ok) {
            const bJson = await fetchRes.json();
            const bData = bJson?.data || bJson?.branches || (Array.isArray(bJson) ? bJson : []);
            if (Array.isArray(bData) && bData.length > 0) branchList = bData;
          }
        } catch (fErr) {
          console.warn(`GET ${directUrl} via direct fetch error:`, fErr?.message);
        }
      }

      // 3. Fallback: if companyId query returned empty, fetch all branches and filter by companyId
      if (branchList.length === 0 && rawCompId) {
        try {
          let allBranches = [];
          try {
            const allRes = await api.get('/api/branch', { headers });
            const allData = allRes.data?.data || allRes.data?.branches || (Array.isArray(allRes.data) ? allRes.data : []);
            if (Array.isArray(allData) && allData.length > 0) allBranches = allData;
          } catch {
            const fetchAll = await fetch(`${BASE_URL}/api/branch`, { headers });
            if (fetchAll.ok) {
              const allJson = await fetchAll.json();
              const allData = allJson?.data || allJson?.branches || (Array.isArray(allJson) ? allJson : []);
              if (Array.isArray(allData) && allData.length > 0) allBranches = allData;
            }
          }

          if (allBranches.length > 0) {
            const matched = allBranches.filter(b => {
              const cId = typeof b.companyId === 'object' && b.companyId !== null
                ? (b.companyId._id || b.companyId.id)
                : (b.companyId || b.company);
              return !cId || String(cId) === String(rawCompId);
            });
            if (matched.length > 0) {
              branchList = matched;
            } else {
              branchList = allBranches;
            }
          }
        } catch (allErr) {
          console.warn('GET /api/branch fallback error:', allErr?.message);
        }
      }

      // Format clean JSON branch records strictly conforming to the Branch model schema:
      // _id, companyId, branchName, branchCode, address, city, state, pincode, country, phone, email, manager, isHeadOffice, status
      const cleanBranchList = branchList.map((b) => {
        const idVal = String(b._id || b.id || b.branchId || '');
        const compVal = typeof b.companyId === 'object' && b.companyId !== null
          ? String(b.companyId._id || b.companyId.id || rawCompId)
          : String(b.companyId || rawCompId || '');

        return {
          _id: idVal,
          id: idVal,
          branchId: idVal,
          companyId: compVal,
          branchName: b.branchName || b.name || b.title || 'Ahmedabad',
          branchCode: b.branchCode || '',
          address: b.address || 'Ahmedabad, Gujarat',
          city: b.city || 'Ahmedabad',
          state: b.state || 'Gujarat',
          pincode: b.pincode || '',
          country: b.country || 'India',
          phone: b.phone || '',
          email: b.email || '',
          manager: b.manager || '',
          isHeadOffice: Boolean(b.isHeadOffice),
          status: b.status || 'active',
          createdAt: b.createdAt || '',
          updatedAt: b.updatedAt || '',
          __v: b.__v
        };
      });

      setBranches(cleanBranchList);
      if (cleanBranchList.length === 0 && rawCompId) {
        setBranchLoadError('No branches found for the selected company.');
      }
      return cleanBranchList;
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches([]);
      setBranchLoadError(err.response?.data?.message || err.message || 'Failed to load branches.');
      return [];
    } finally {
      setLoadingBranches(false);
    }
  };

  // 3. Fetch Financial Year dynamically from API
  const fetchFinancialYears = async (branchId, companyId) => {
    const rawBranchId = typeof branchId === 'object' && branchId !== null
      ? (branchId._id || branchId.id || '')
      : String(branchId || '').trim();

    if (!rawBranchId) {
      setFinancialYears([]);
      return [];
    }
    setLoadingFY(true);
    try {
      let fyList = [];
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      try {
        const fyRes = await api.get(`/api/financial-year?branchId=${encodeURIComponent(rawBranchId)}`, { headers });
        const fData = fyRes.data?.data || fyRes.data?.financialYears || fyRes.data?.years || (Array.isArray(fyRes.data) ? fyRes.data : []);
        if (Array.isArray(fData) && fData.length > 0) fyList = fData;
      } catch (fErr) {
        console.warn('GET /api/financial-year?branchId via api encountered error:', fErr?.message);
      }

      if (fyList.length === 0) {
        try {
          const fetchRes = await fetch(`${BASE_URL}/api/financial-year?branchId=${encodeURIComponent(rawBranchId)}`, { headers });
          if (fetchRes.ok) {
            const fData = await fetchRes.json();
            const list = fData?.data || fData?.financialYears || fData?.years || (Array.isArray(fData) ? fData : []);
            if (Array.isArray(list) && list.length > 0) fyList = list;
          }
        } catch { }
      }

      if (fyList.length === 0) {
        try {
          const fetchRes = await fetch(`${BASE_URL}/api/financial-year`, { headers });
          if (fetchRes.ok) {
            const fData = await fetchRes.json();
            const list = fData?.data || fData?.financialYears || fData?.years || (Array.isArray(fData) ? fData : []);
            if (Array.isArray(list) && list.length > 0) {
              fyList = list.filter(f => {
                const bId = f.branchId?._id || f.branchId || f.branch;
                return !bId || String(bId) === String(rawBranchId);
              });
            }
          }
        } catch { }
      }

      const cleanFyList = fyList.map(f => ({
        _id: String(f._id || f.id || ''),
        id: String(f._id || f.id || ''),
        yearLabel: f.yearLabel || f.year || f.financialYear || f.name || '',
        status: f.status || 'active',
        ...f
      }));

      setFinancialYears(cleanFyList);
      return cleanFyList;
    } catch (err) {
      console.error('Failed to load financial years:', err);
      setFinancialYears([]);
      return [];
    } finally {
      setLoadingFY(false);
    }
  };


  // Fetch Backend Teams from GET /api/teamLead/team
  const fetchBackendTeams = async () => {
    try {
      const teams = await fetchTeamsList();
      if (Array.isArray(teams)) {
        setBackendTeams(teams);
        return teams;
      }
    } catch (err) {
      console.warn('Notice loading backend teams:', err?.message);
    }
    return [];
  };

  // Fetch available team leads from the users roster.
  const fetchTeamLeads = async () => {
    setLoadingTeamLeads(true);
    try {
      const leads = [];

      const roster = users.length > 0 ? users : await fetchUsers(true);
      const userTLs = roster.filter(u => u && !isFinanceOrExcludedUser(u) && isTeamLeadUser(u));
      leads.push(...userTLs);

      // Also include team leads from GET /api/teamLead/team
      try {
        const teams = await fetchTeamsList();
        (teams || []).forEach(team => {
          const rawLead = team.teamLead || team.lead;
          if (rawLead && typeof rawLead === 'object' && !isFinanceOrExcludedUser(rawLead)) {
            leads.push(rawLead);
          }
        });
      } catch {}

      // Deduplicate leads by identifier or normalized name
      const seen = new Set();
      const uniqueLeads = [];
      for (const item of leads) {
        if (!item) continue;
        const id = String(item._id || item.id || item.userId || item.userID || item.email || '').toLowerCase().trim();
        const normName = String(item.name || item.fullName || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '')).toLowerCase().trim();
        const key = id || normName;
        if (!key || seen.has(key) || (normName && seen.has(normName))) continue;
        seen.add(key);
        if (normName) seen.add(normName);

        const cleanName = item.name || item.fullName || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : null);
        const cleanRole = item.role || null;
        const cleanDesig = typeof item.designation === 'object'
          ? (item.designation?.designationName || item.designation?.name || null)
          : (item.designation || null);

        uniqueLeads.push({
          ...item,
          _id: String(item._id || item.id || item.userId || item.userID),
          id: String(item._id || item.id || item.userId || item.userID),
          userId: String(item.userId || item.userID || item._id || item.id),
          userID: String(item.userID || item.userId || item._id || item.id),
          name: cleanName,
          fullName: cleanName,
          email: item.email || null,
          role: cleanRole,
          department: item.department || null,
          designation: cleanDesig
        });
      }

      setTeamLeads(uniqueLeads);
      return uniqueLeads;
    } catch (err) {
      console.error('Failed to load team leads:', err);
      setTeamLeads([]);
      return [];
    } finally {
      setLoadingTeamLeads(false);
    }
  };

  // Initial load of metadata: fetch companies, initial branches, FY, team leads & live teams
  const fetchApprovalMetadata = async () => {
    try {
      await Promise.all([
        fetchTeamLeads(),
        fetchBackendTeams()
      ]);
      const compList = await fetchCompanies();
      if (Array.isArray(compList) && compList.length > 0) {
        const firstCompId = compList[0]._id || compList[0].id;
        if (firstCompId) {
          const bList = await fetchBranches(firstCompId);
          if (Array.isArray(bList) && bList.length > 0) {
            const firstBranchId = bList[0]._id || bList[0].id;
            if (firstBranchId) {
              await fetchFinancialYears(firstBranchId, firstCompId);
            }
          }
        }
      } else {
        await fetchBranches();
      }
    } catch (err) {
      console.error('Failed to load approval metadata:', err);
    }
  };

  useEffect(() => {
    fetchUsers(false);
    fetchApprovalMetadata();

    // Silent auto-refresh every 8s for new employee join requests and team updates
    const interval = setInterval(() => {
      fetchUsers(true);
      fetchBackendTeams();
    }, 8000);

    const handleFocus = () => {
      fetchUsers(true);
      fetchBackendTeams();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchUsers(true);
        fetchBackendTeams();
      }
    };

    // Real-time synchronization when TL is reassigned or updated from TeamLead page
    const handleTeamAssignmentUpdated = () => {
      fetchBackendTeams();
      fetchUsers(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("kt_team_assignment_updated", handleTeamAssignmentUpdated);
    window.addEventListener("storage", handleTeamAssignmentUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("kt_team_assignment_updated", handleTeamAssignmentUpdated);
      window.removeEventListener("storage", handleTeamAssignmentUpdated);
    };
  }, []);

  const getUserIdentifier = (user, fallbackIndex) => {
    return user?._id || user?.id || user?.userId || user?.email || `user-${fallbackIndex}`;
  };

  // ================= ENTITY NAME RESOLVERS =================
  const getCompanyName = (compVal, userObj) => {
    if (userObj?.companyName) return userObj.companyName;
    if (!compVal) return null;
    const compId = typeof compVal === 'object' ? (compVal._id || compVal.id) : String(compVal);
    const found = companies.find(c => String(c._id || c.id) === compId);
    if (found) return found.companyName || found.name || found.title || null;
    if (typeof compVal === 'object' && (compVal.companyName || compVal.name)) return compVal.companyName || compVal.name;
    return null;
  };

  const getBranchName = (branchVal, userObj) => {
    if (userObj?.branchName) return userObj.branchName;
    const rawVal = branchVal || userObj?.branchId || userObj?.branch || userObj?.employee?.branchId || userObj?.employee?.branch;
    if (!rawVal) return null;
    if (typeof rawVal === 'object' && (rawVal.branchName || rawVal.name)) return rawVal.branchName || rawVal.name;
    const bId = typeof rawVal === 'object' ? String(rawVal._id || rawVal.id || rawVal.branchId || '') : String(rawVal);
    const found = branches.find(b => String(b._id || b.id || b.branchId) === bId);
    if (found) return found.branchName || found.name || found.title || null;
    return null;
  };

  const getFinancialYearName = (fyVal, userObj) => {
    if (userObj?.yearLabel || userObj?.financialYearLabel || userObj?.financialYearName) {
      return userObj.yearLabel || userObj.financialYearLabel || userObj.financialYearName;
    }
    if (!fyVal) return null;
    const fId = typeof fyVal === 'object' ? (fyVal._id || fyVal.id) : String(fyVal);
    const found = financialYears.find(f => String(f._id || f.id) === fId);
    if (found) return found.yearLabel || found.year || found.financialYear || found.name || null;
    if (typeof fyVal === 'object' && (fyVal.yearLabel || fyVal.year || fyVal.financialYear || fyVal.name)) {
      return fyVal.yearLabel || fyVal.year || fyVal.financialYear || fyVal.name;
    }
    return null;
  };

  // Resolver for Assigned Team Lead (Live and Dynamic only, prioritized for updates from Team Lead page)
  const getAssignedTeamLead = (userObj) => {
    if (!userObj) return null;

    // Critical: If the user themselves is a Team Lead, they do NOT have a Team Lead assigned!
    if (isTeamLeadUser(userObj)) {
      return null;
    }

    const userId = String(getUserIdentifier(userObj, 0));
    const userIds = [
      userObj._id,
      userObj.id,
      userObj.userId,
      userObj.userID,
      userObj.employeeId,
      userObj.employeeID,
      userObj.empId,
      userId
    ].filter(Boolean).map(x => String(x).toLowerCase().trim());

    const userEmails = [
      userObj.email,
      userObj.user?.email
    ].filter(Boolean).map(x => String(x).toLowerCase().trim());

    // 1. HIGHEST PRIORITY: Live backend teams from GET /api/teamLead/team
    // When TL is changed in TeamLead page, this guarantees the updated TL name is immediately reflected here!
    if (Array.isArray(backendTeams) && backendTeams.length > 0) {
      for (const team of backendTeams) {
        if (!team) continue;
        const teamEmployees = Array.isArray(team.employees) ? team.employees : [];
        const isMember = teamEmployees.some(emp => {
          if (!emp) return false;
          if (typeof emp === 'string' || typeof emp === 'number') {
            const empStr = String(emp).toLowerCase().trim();
            return userIds.includes(empStr);
          }
          if (typeof emp === 'object') {
            const empIds = [
              emp._id,
              emp.id,
              emp.userId,
              emp.userID,
              emp.employeeId,
              emp.employeeID
            ].filter(Boolean).map(x => String(x).toLowerCase().trim());
            if (empIds.some(id => userIds.includes(id))) return true;

            const empEmail = String(emp.email || '').toLowerCase().trim();
            if (empEmail && userEmails.includes(empEmail)) return true;
          }
          return false;
        });

        if (isMember) {
          const rawTL = team.teamLead || team.teamLeadUser || team.teamLeadEmployee || team.lead;
          if (rawTL && typeof rawTL === 'object') {
            return {
              id: rawTL._id || rawTL.id || rawTL.userId || null,
              name: rawTL.name || rawTL.fullName || (rawTL.firstName ? `${rawTL.firstName} ${rawTL.lastName || ''}`.trim() : null),
              email: rawTL.email || null,
              department: rawTL.department || null,
              designation: rawTL.designation || null
            };
          }
          if (rawTL) {
            const rawTLId = String(rawTL).toLowerCase().trim();
            const matched = teamLeads.find(tl =>
              String(tl._id).toLowerCase().trim() === rawTLId ||
              String(tl.userId || '').toLowerCase().trim() === rawTLId ||
              String(tl.id || '').toLowerCase().trim() === rawTLId
            );
            if (matched) {
              return {
                id: matched._id || matched.id,
                name: matched.name || matched.fullName,
                email: matched.email || null,
                department: matched.department || null,
                designation: matched.designation || null
              };
            }
            return {
              id: rawTL,
              name: team.teamLeadName || 'Team Lead',
              email: null
            };
          }
        }
      }
    }

    // 2. PRIORITY 2: Check localStorage 'kt_user_assigned_tl' (synced in real-time by TeamLead page onSave)
    try {
      const savedUserTL = JSON.parse(localStorage.getItem('kt_user_assigned_tl') || '{}');
      for (const id of userIds) {
        if (savedUserTL[id] && savedUserTL[id].name) {
          return savedUserTL[id];
        }
      }
      for (const email of userEmails) {
        if (savedUserTL[email] && savedUserTL[email].name) {
          return savedUserTL[email];
        }
      }
    } catch { }

    // 3. PRIORITY 3: Check localStorage 'teamLeadAssignedEmployees'
    try {
      const assignments = JSON.parse(localStorage.getItem('teamLeadAssignedEmployees') || '{}');
      for (const [tlId, empIds] of Object.entries(assignments)) {
        if (Array.isArray(empIds) && empIds.some(eId => userIds.includes(String(eId).toLowerCase().trim()))) {
          const match = teamLeads.find(tl =>
            String(tl._id).toLowerCase().trim() === String(tlId).toLowerCase().trim() ||
            String(tl.userId || '').toLowerCase().trim() === String(tlId).toLowerCase().trim()
          );
          if (match) {
            return {
              id: tlId,
              name: match.name || match.fullName || null,
              email: match.email || null,
              department: match.department || null,
              designation: match.designation || null
            };
          }
        }
      }
    } catch { }

    // 4. PRIORITY 4: User object direct properties (only if no live team assignment found above)
    if (userObj.teamLeadName) {
      return {
        id: userObj.teamLeadId || userObj.teamLead || null,
        name: userObj.teamLeadName,
        email: userObj.teamLeadEmail || null
      };
    }

    const candidateTlId = userObj.teamLeadId || userObj.teamLead || userObj.assignedTL || userObj.teamLeader;
    if (candidateTlId) {
      const match = teamLeads.find(tl =>
        String(tl._id) === String(candidateTlId) ||
        String(tl.userId) === String(candidateTlId) ||
        String(tl.id) === String(candidateTlId)
      );
      if (match) {
        return {
          id: candidateTlId,
          name: match.name || match.fullName || null,
          email: match.email || null,
          department: match.department || null,
          designation: match.designation || null
        };
      }
      if (typeof candidateTlId === 'object' && (candidateTlId.name || candidateTlId.fullName)) {
        return {
          id: candidateTlId._id || candidateTlId.id || null,
          name: candidateTlId.name || candidateTlId.fullName || null,
          email: candidateTlId.email || null
        };
      }
    }

    return null;
  };

  // Resolver for Employee Bank Details (Live and Dynamic only)
  const getUserBankDetails = (userObj) => {
    if (!userObj) return null;
    const userId = String(getUserIdentifier(userObj, 0));

    // 1. Direct user properties
    if (userObj.bankName || userObj.accountNumber || userObj.bankAccount || userObj.bankAccountNumber) {
      return {
        bankName: userObj.bankName || null,
        accountNumber: userObj.accountNumber || userObj.bankAccount || userObj.bankAccountNumber || null,
        ifscCode: userObj.ifscCode || userObj.IFSC || null,
        accountHolderName: userObj.accountHolderName || userObj.name || null,
        bankBranch: userObj.bankBranch || null,
        upiId: userObj.upiId || userObj.upiID || userObj.upi || null,
        isBankDetailGiven: true
      };
    }

    if (userObj.bankDetails && typeof userObj.bankDetails === 'object') {
      const b = userObj.bankDetails;
      if (b.bankName || b.accountNumber || b.bankAccountNumber || b.bankAccount) {
        return {
          bankName: b.bankName || null,
          accountNumber: b.accountNumber || b.bankAccountNumber || b.bankAccount || null,
          ifscCode: b.ifscCode || b.IFSC || null,
          accountHolderName: b.accountHolderName || userObj.name || null,
          bankBranch: b.bankBranch || null,
          upiId: b.upiId || b.upiID || b.upi || null,
          isBankDetailGiven: true
        };
      }
    }

    // 2. Check localStorage 'kt_employee_bank_details'
    try {
      const savedBank = JSON.parse(localStorage.getItem('kt_employee_bank_details') || '{}');
      if (savedBank[userId]) {
        return savedBank[userId];
      }
      if (userObj._id && savedBank[String(userObj._id)]) {
        return savedBank[String(userObj._id)];
      }
    } catch { }

    return null;
  };

  // ================= OPEN APPROVAL MODAL =================
  const handleApproveClick = async (user) => {
    setApprovalError('');
    setApprovingUser(user);

    // If applicant role is Team Lead, TL assignment is not applicable
    const isApplicantTL = isTeamLeadUser(user);
    setTlAssignmentMode('existing');
    if (isApplicantTL) {
      setSelectedTeamLeadId('');
    } else {
      // 1. Ensure Team Leads are loaded and pre-fill existing TL if available
      let currentTLs = teamLeads;
      if (!currentTLs || currentTLs.length === 0) {
        currentTLs = await fetchTeamLeads();
      }
      const existingTL = getAssignedTeamLead(user);
      if (existingTL?.id && currentTLs.some(t => String(t._id || t.userId || t.id) === String(existingTL.id))) {
        setSelectedTeamLeadId(String(existingTL.id));
      } else {
        setSelectedTeamLeadId('');
      }
    }

    // 2. Ensure companies are loaded
    let currentCompanies = companies;
    if (!currentCompanies || currentCompanies.length === 0) {
      currentCompanies = await fetchCompanies();
    }

    // 4. Identify default companyId from user object or first company
    const userCompId = typeof user?.companyId === 'object' ? (user?.companyId?._id || user?.companyId?.id) : user?.companyId;
    const defaultCompanyId = (userCompId && currentCompanies.some(c => String(c._id || c.id) === String(userCompId)))
      ? userCompId
      : (currentCompanies.length > 0 ? (currentCompanies[0]._id || currentCompanies[0].id) : '');

    setSelectedCompanyId(defaultCompanyId);

    // 5. Fetch branches for the selected company or all branches
    let defaultBranchId = '';
    const bList = await fetchBranches(defaultCompanyId || null);
    const userBranchVal = user?.branchId || user?.branch || user?.employee?.branchId || user?.employee?.branch;
    const userBranchId = typeof userBranchVal === 'object' && userBranchVal !== null
      ? String(userBranchVal._id || userBranchVal.id || userBranchVal.branchId || '')
      : String(userBranchVal || '').trim();

    if (userBranchId && bList.some(b => String(b._id || b.id || b.branchId) === userBranchId)) {
      defaultBranchId = userBranchId;
    } else if (bList.length > 0) {
      const headOffice = bList.find(b => b.isHeadOffice) || bList[0];
      defaultBranchId = String(headOffice._id || headOffice.id || headOffice.branchId || '');
    }

    setSelectedBranchId(defaultBranchId);

    // 6. Fetch financial years for the branch
    let defaultFyId = '';
    if (defaultBranchId) {
      const fyList = await fetchFinancialYears(defaultBranchId, defaultCompanyId);
      const userFyId = typeof user?.financialYearId === 'object' ? (user?.financialYearId?._id || user?.financialYearId?.id) : user?.financialYearId;
      const activeFy = fyList.find(f => f.status === 'active');
      defaultFyId = (userFyId && fyList.some(f => String(f._id || f.id) === String(userFyId)))
        ? userFyId
        : (activeFy ? (activeFy._id || activeFy.id) : (fyList.length > 0 ? (fyList[0]._id || fyList[0].id) : ''));
    } else {
      setFinancialYears([]);
    }

    setSelectedFinancialYearId(defaultFyId);
  };

  // ================= MODAL DROPDOWN INTERACTION HANDLERS =================
  const handleCompanyChange = async (newCompanyId) => {
    setSelectedCompanyId(newCompanyId);
    setSelectedBranchId('');
    setSelectedFinancialYearId('');
    const bList = await fetchBranches(newCompanyId || null);
    if (bList.length > 0) {
      const headOffice = bList.find(b => b.isHeadOffice) || bList[0];
      const defaultBranchId = String(headOffice._id || headOffice.id || headOffice.branchId || '');
      setSelectedBranchId(defaultBranchId);
      const fyList = await fetchFinancialYears(defaultBranchId, newCompanyId);
      if (fyList.length > 0) {
        const activeFy = fyList.find(f => f.status === 'active');
        setSelectedFinancialYearId(activeFy ? String(activeFy._id || activeFy.id) : String(fyList[0]._id || fyList[0].id));
      }
    } else {
      setFinancialYears([]);
    }
  };

  const handleBranchChange = async (newBranchId) => {
    const rawBranchId = typeof newBranchId === 'object' && newBranchId !== null
      ? String(newBranchId._id || newBranchId.id || '')
      : String(newBranchId || '').trim();
    setSelectedBranchId(rawBranchId);
    setSelectedFinancialYearId('');
    if (rawBranchId) {
      const fyList = await fetchFinancialYears(rawBranchId, selectedCompanyId);
      if (fyList.length > 0) {
        const activeFy = fyList.find(f => f.status === 'active');
        setSelectedFinancialYearId(activeFy ? String(activeFy._id || activeFy.id) : String(fyList[0]._id || fyList[0].id));
      }
    } else {
      setFinancialYears([]);
    }
  };

  // ================= SUBMIT APPROVAL WITH TL ASSIGNMENT & ORGANIZATION =================
  const submitApproval = async (e) => {
    if (e) e.preventDefault();
    if (!approvingUser) return;

    const isAlreadyApproved = isUserApproved(approvingUser);
    const isApplicantTL = isTeamLeadUser(approvingUser);
    const shouldPromoteToTeamLead = !isApplicantTL && tlAssignmentMode === 'promote';

    // Validate the selected assignment mode and required organization details.
    const missingFields = [];
    if (!isApplicantTL && !shouldPromoteToTeamLead && (!selectedTeamLeadId || !String(selectedTeamLeadId).trim())) {
      missingFields.push('Team Leader (TL)');
    }
    if (!isAlreadyApproved) {
      if (!selectedCompanyId || !String(selectedCompanyId).trim()) {
        missingFields.push('Company Name');
      }
      if (!selectedBranchId || !String(selectedBranchId).trim()) {
        missingFields.push('Branch');
      }
      if (!selectedFinancialYearId || !String(selectedFinancialYearId).trim()) {
        missingFields.push('Financial Year');
      }
    }

    if (missingFields.length > 0) {
      setApprovalError(
        `Cannot approve employee: ${missingFields.join(', ')} ${missingFields.length === 1 ? 'is' : 'are'} required. Please complete all required details before approving.`
      );
      return;
    }

    const userId = getUserIdentifier(approvingUser, 0);
    setSubmittingApproval(true);
    setApprovalError('');

    // Find selected Team Lead record (dynamic only, null if applicant is TL)
    const selectedTL = (!isApplicantTL && selectedTeamLeadId)
      ? teamLeads.find(t =>
        String(t._id) === String(selectedTeamLeadId) ||
        String(t.userId) === String(selectedTeamLeadId) ||
        String(t.id) === String(selectedTeamLeadId)
      )
      : null;
    const tlNameVal = selectedTL ? (selectedTL.name || selectedTL.fullName || null) : null;
    const tlEmailVal = selectedTL?.email || null;

    // Organization entity labels (dynamic only, null if missing)
    const matchedComp = selectedCompanyId ? companies.find(c => String(c._id || c.id) === String(selectedCompanyId)) : null;
    const matchedBranch = selectedBranchId ? branches.find(b => String(b._id || b.id) === String(selectedBranchId)) : null;
    const companyNameVal = matchedComp ? (matchedComp.companyName || matchedComp.name || null) : null;
    const branchNameVal = matchedBranch ? (matchedBranch.branchName || matchedBranch.name || null) : null;
    const matchedFy = selectedFinancialYearId ? financialYears.find(f => String(f._id || f.id) === String(selectedFinancialYearId)) : null;
    const fyLabelVal = matchedFy ? (matchedFy.yearLabel || matchedFy.name || matchedFy.year || null) : null;

    // Preserve existing bank details if already associated with employee (dynamic only, null if missing)
    const existingBank = getUserBankDetails(approvingUser);
    const hasBankDetails = existingBank?.bankName || approvingUser?.bankName || existingBank?.accountNumber || approvingUser?.accountNumber;
    const bankData = hasBankDetails ? {
      bankName: existingBank?.bankName || approvingUser?.bankName || null,
      bankBranch: existingBank?.bankBranch || approvingUser?.bankBranch || null,
      accountHolderName: existingBank?.accountHolderName || approvingUser?.accountHolderName || approvingUser?.name || null,
      bankAccount: existingBank?.accountNumber || approvingUser?.accountNumber || approvingUser?.bankAccount || null,
      bankAccountNumber: existingBank?.accountNumber || approvingUser?.accountNumber || approvingUser?.bankAccount || null,
      accountNumber: existingBank?.accountNumber || approvingUser?.accountNumber || approvingUser?.bankAccount || null,
      IFSC: existingBank?.ifscCode || approvingUser?.ifscCode || approvingUser?.IFSC || null,
      ifscCode: existingBank?.ifscCode || approvingUser?.ifscCode || approvingUser?.IFSC || null,
      upiId: existingBank?.upiId || approvingUser?.upiId || null,
      upiID: existingBank?.upiId || approvingUser?.upiId || null,
      upi: existingBank?.upiId || approvingUser?.upiId || null,
      isBankDetailGiven: true,
      bankDetailGiven: true,
      bankDetailsGiven: true,
      isBankDetailsGiven: true
    } : {};

    const payload = {
      id: userId,
      userId,
      _id: userId,
      email: approvingUser?.email || null,
      // Organization Assignment (dynamically passed or null if no data)
      companyId: selectedCompanyId || null,
      company: selectedCompanyId || null,
      companyName: companyNameVal || null,
      branchId: selectedBranchId || null,
      branch: selectedBranchId || null,
      branchName: branchNameVal || null,
      financialYearId: selectedFinancialYearId || null,
      financialYear: selectedFinancialYearId || null,
      financialYearLabel: fyLabelVal || null,
      yearLabel: fyLabelVal || null,
      // Approval Status
      isApproved: true,
      approved: true,
      status: 'approved',
      ...(shouldPromoteToTeamLead ? {
        role: 'team_leader',
        userRole: 'team_leader',
        isTeamLead: true,
        isTeamLeader: true,
        position: 'TL',
        positionShort: 'TL',
        positionLabel: 'Team Leader'
      } : {}),
      // Assigned Team Lead Details (only set if not applicant TL)
      teamLead: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
      teamLeadId: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
      assignedTL: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
      teamLeader: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
      teamLeadName: (!isApplicantTL && tlNameVal) ? tlNameVal : null,
      teamLeadEmail: (!isApplicantTL && tlEmailVal) ? tlEmailVal : null,
      // Bank & Payout Details (if previously recorded)
      ...bankData,
      ...(Object.keys(bankData).length > 0 ? { bankDetails: { ...bankData } } : {})
    };

    try {
      let isSuccess = false;
      let resData = null;

      const assignAsTeamLead = async () => {
        const getEmployeeRecordId = (employee) => {
          const employeeId = employee?.employeeId;
          const employeeID = employee?.employeeID;
          const directIds = [
            employee?.employee?._id,
            employee?.employee?.id,
            typeof employeeId === 'object' ? employeeId?._id || employeeId?.id : employeeId,
            typeof employeeID === 'object' ? employeeID?._id || employeeID?.id : employeeID
          ];
          const directId = directIds.find((id) => /^[0-9a-f]{24}$/i.test(String(id || '').trim()));
          if (directId) return String(directId).trim();

          return null;
        };

        let employeeRecordId =
          getEmployeeRecordId(approvingUser) ||
          getEmployeeRecordId(resData?.data) ||
          getEmployeeRecordId(resData);
        if (!employeeRecordId) {
          const employeeResponse = await api.get('/api/employee/list');
          const employeeList = employeeResponse.data?.data ||
            employeeResponse.data?.employees ||
            employeeResponse.data?.employeesList ||
            (Array.isArray(employeeResponse.data) ? employeeResponse.data : []);
          const userEmail = String(approvingUser?.email || '').trim().toLowerCase();
          const userCode = String(approvingUser?.employeeID || approvingUser?.employeeCode || '').trim().toLowerCase();
          const matchingEmployee = (Array.isArray(employeeList) ? employeeList : []).find((employee) => {
            if (!employee) return false;
            const linkedUser = employee.user || employee.userId || employee.userID;
            const linkedUserId = String(
              typeof linkedUser === 'object'
                ? linkedUser?._id || linkedUser?.id || ''
                : linkedUser || ''
            ).trim().toLowerCase();
            const employeeEmail = String(employee.email || employee.user?.email || '').trim().toLowerCase();
            const employeeCode = String(employee.employeeID || employee.employeeCode || '').trim().toLowerCase();
            return (linkedUserId && linkedUserId === String(userId).trim().toLowerCase()) ||
              (userEmail && employeeEmail === userEmail) ||
              (userCode && employeeCode === userCode);
          });
          employeeRecordId = matchingEmployee?._id || matchingEmployee?.id || null;
        }

        if (!employeeRecordId) {
          throw new Error('Could not find this employee record to promote them to Team Lead.');
        }

        const token = getAuthToken();
        const response = await fetch(
          `${BASE_URL}/api/employee/assign-tl/${encodeURIComponent(String(employeeRecordId))}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
          }
        );
        const promotionData = await response.json().catch(() => ({}));
        if (!response.ok || promotionData?.success === false) {
          throw new Error(promotionData?.message || 'Failed to promote this employee to Team Lead.');
        }

        return promotionData;
      };

      // 1. Primary: PUT /api/users/approve using authenticated api instance
      try {
        const response = await api.put('/api/users/approve', payload);
        if (response.status >= 200 && response.status < 300) {
          isSuccess = true;
          resData = response.data;
        }
      } catch (apiErr) {
        console.warn('api.put failed, trying fallback raw fetch with auth token:', apiErr?.message);
        const token = getAuthToken();
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const fetchRes = await fetch(`${BASE_URL}/api/users/approve`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });

        if (fetchRes.ok) {
          isSuccess = true;
          resData = await fetchRes.json().catch(() => ({}));
        } else {
          const errData = await fetchRes.json().catch(() => ({}));
          throw new Error(errData.message || apiErr.response?.data?.message || 'Approval request failed');
        }
      }

      if (!isSuccess || resData?.success === false) {
        throw new Error(resData?.message || 'Approval request failed');
      }

      if (shouldPromoteToTeamLead) {
        const promotionData = await assignAsTeamLead();
        if (!resData) resData = promotionData;
      }

      // 2. Synchronize Team Lead and Team Linkage via backend API: POST /api/teamLead/create-team
      let resolvedEmpRecordId = null;
      if (selectedTeamLeadId && !isApplicantTL) {
        try {
          const token = getAuthToken();
          const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          };

          // Step A: Fetch current teams from backend
          let currentTeams = [];
          try {
            currentTeams = await fetchTeamsList();
          } catch {
            try {
              const teamRes = await api.get('/api/teamLead/team', { headers });
              currentTeams = teamRes.data?.data || teamRes.data?.teams || (Array.isArray(teamRes.data) ? teamRes.data : []);
            } catch {}
          }
          if (!Array.isArray(currentTeams)) currentTeams = [];

          // Step B: Resolve IDs from the roster and /api/employee/list
          const matchedEmp = users.find(e => {
            if (!e) return false;
            const eEmail = String(e.email || '').toLowerCase().trim();
            const uEmail = String(approvingUser?.email || '').toLowerCase().trim();
            if (eEmail && uEmail && eEmail === uEmail) return true;
            const rawUserId = e.userId || e.userID;
            const eUserId = String(
              rawUserId && typeof rawUserId === 'object'
                ? rawUserId._id || rawUserId.id || ''
                : rawUserId || ''
            ).toLowerCase().trim();
            if (eUserId && eUserId === String(userId).toLowerCase().trim()) return true;
            const eCode = String(e.employeeID || e.employeeCode || '').trim();
            const uCode = String(approvingUser?.employeeID || approvingUser?.employeeCode || '').trim();
            return Boolean(eCode && uCode && eCode === uCode);
          });
          const employeeRecordId = matchedEmp?.employeeId?._id ||
            matchedEmp?.employeeID?._id ||
            matchedEmp?._id;
          if (employeeRecordId) {
            resolvedEmpRecordId = String(employeeRecordId);
          }

          // Also check live /api/employee/list for the newly created employee record
          let freshEmployeeId = null;
          try {
            const empListRes = await api.get('/api/employee/list', { headers });
            const empList = empListRes.data?.data || empListRes.data?.employees || (Array.isArray(empListRes.data) ? empListRes.data : []);
            const foundEmp = (Array.isArray(empList) ? empList : []).find(e => {
              if (!e) return false;
              const eUId = String(typeof e.user === 'object' ? (e.user?._id || e.user?.id) : (e.user || e.userId || e.userID || '')).toLowerCase().trim();
              if (eUId && eUId === String(userId).toLowerCase().trim()) return true;
              const eEmail = String(e.email || '').toLowerCase().trim();
              const uEmail = String(approvingUser?.email || '').toLowerCase().trim();
              return Boolean(eEmail && uEmail && eEmail === uEmail);
            });
            if (foundEmp?._id) freshEmployeeId = String(foundEmp._id);
          } catch {}

          const employeeIdentifiersToAdd = [freshEmployeeId, resolvedEmpRecordId, String(userId)].filter(Boolean);
          const empIdentifiersLower = employeeIdentifiersToAdd.map(x => String(x).toLowerCase().trim());

          const extractMemberId = (emp) => {
            if (!emp) return null;
            if (typeof emp === 'string' || typeof emp === 'number') return String(emp).trim();
            if (typeof emp === 'object') {
              return String(emp._id || emp.id || emp.userId || emp.employeeId || '').trim();
            }
            return null;
          };

          // Step C: If employee was already in another Team Lead's team, remove them from that other team lead
          const targetTLIdentifiers = [
            selectedTeamLeadId,
            selectedTL?._id,
            selectedTL?.id,
            selectedTL?.userId,
            selectedTL?.userID,
            selectedTL?.employeeId,
            selectedTL?.employeeID,
          ].filter(Boolean).map(x => String(x).toLowerCase().trim());
          const targetTLEmail = selectedTL?.email ? String(selectedTL.email).toLowerCase().trim() : '';
          const targetTLName = (selectedTL?.name || selectedTL?.fullName || '').toLowerCase().trim();

          const isTeamMatchingTarget = (team) => {
            if (!team) return false;
            const rawLead = team.teamLead || team.lead || team.teamLeadId;
            const leadIds = [
              team.teamLeadId,
              team.leadId,
              typeof rawLead === 'object' ? (rawLead?._id || rawLead?.id || rawLead?.userId || rawLead?.employeeId) : rawLead,
              rawLead?.user?._id || rawLead?.user,
              rawLead?.employee?._id || rawLead?.employee,
            ].filter(Boolean).map(x => String(x).toLowerCase().trim());

            if (leadIds.some(id => targetTLIdentifiers.includes(id))) return true;

            const leadEmail = typeof rawLead === 'object' ? String(rawLead?.email || '').toLowerCase().trim() : '';
            if (leadEmail && targetTLEmail && leadEmail === targetTLEmail) return true;

            const leadName = typeof rawLead === 'object' ? String(rawLead?.name || rawLead?.fullName || '').toLowerCase().trim() : '';
            if (leadName && targetTLName && leadName === targetTLName) return true;

            return false;
          };

          for (const team of currentTeams) {
            const isThisTargetTeam = isTeamMatchingTarget(team);
            if (!isThisTargetTeam && Array.isArray(team.employees)) {
              const prevCount = team.employees.length;
              const remainingEmps = team.employees.filter(emp => {
                if (!emp) return false;
                const mId = extractMemberId(emp)?.toLowerCase();
                const mEmail = typeof emp === 'object' && emp.email ? String(emp.email).toLowerCase().trim() : '';
                return !empIdentifiersLower.includes(mId) && (!mEmail || !empIdentifiersLower.includes(mEmail));
              });

              if (remainingEmps.length !== prevCount) {
                try {
                  const rawLead = team.teamLead || team.lead || team.teamLeadId;
                  const otherLeadBackendId = typeof rawLead === 'object' ? (rawLead._id || rawLead.id || rawLead.userId) : rawLead;
                  if (otherLeadBackendId) {
                    const removePayload = {
                      teamLead: String(otherLeadBackendId),
                      employees: remainingEmps.map(extractMemberId).filter(Boolean)
                    };
                    await api.post('/api/teamLead/create-team', removePayload, { headers }).catch(async () => {
                      await fetch(`${BASE_URL}/api/teamLead/create-team`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(removePayload)
                      }).catch(() => {});
                    });
                  }
                } catch {}
              }
            }
          }

          // Step D: Find existing team document for target team lead and merge members
          const targetTeamDoc = currentTeams.find(isTeamMatchingTarget);

          const existingTargetMembers = Array.isArray(targetTeamDoc?.employees)
            ? targetTeamDoc.employees.map(extractMemberId).filter(Boolean)
            : [];

          const mergedTargetMembers = Array.from(new Set([
            ...existingTargetMembers,
            ...employeeIdentifiersToAdd
          ])).filter(Boolean);

          // Step E: Call POST /api/teamLead/create-team
          const rawTargetLead = targetTeamDoc?.teamLead || targetTeamDoc?.lead || targetTeamDoc?.teamLeadId;
          const existingLeadId = typeof rawTargetLead === 'object' ? (rawTargetLead?._id || rawTargetLead?.id || rawTargetLead?.userId) : rawTargetLead;
          const backendTLId = existingLeadId ? String(existingLeadId) : String(selectedTL?._id || selectedTeamLeadId);

          if (backendTLId) {
            const teamPayload = {
              teamLead: backendTLId,
              employees: mergedTargetMembers
            };

            let createSuccess = false;
            try {
              const postRes = await api.post('/api/teamLead/create-team', teamPayload, { headers });
              if (postRes.status >= 200 && postRes.status < 300) {
                createSuccess = true;
              }
            } catch (err) {
              console.warn('api.post to /api/teamLead/create-team error, attempting raw fetch:', err?.message);
            }

            if (!createSuccess) {
              try {
                await fetch(`${BASE_URL}/api/teamLead/create-team`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(teamPayload)
                });
              } catch (rawErr) {
                console.error('fetch to /api/teamLead/create-team error:', rawErr?.message);
              }
            }
          }

          // Step F: Refresh local backendTeams
          await fetchBackendTeams();
        } catch (linkErr) {
          console.warn('Backend team linkage notice:', linkErr?.message);
        }
      }

      if (isSuccess) {
        const resolvedCompName = resData?.data?.companyName || companyNameVal;
        const resolvedBranchName = resData?.data?.branchName || branchNameVal;

        // Persist TL assignment in localStorage for seamless cross-panel continuity if assigned
        if (selectedTeamLeadId && !isApplicantTL) {
          const allUserIdentifiers = [
            String(userId),
            approvingUser?._id ? String(approvingUser._id) : null,
            resolvedEmpRecordId,
            approvingUser?.email ? String(approvingUser.email).trim().toLowerCase() : null,
            approvingUser?.employeeID ? String(approvingUser.employeeID).trim() : null
          ].filter(Boolean);

          try {
            const currentAssignments = JSON.parse(localStorage.getItem('teamLeadAssignedEmployees') || '{}');
            const targetIds = [selectedTeamLeadId, selectedTL?._id, selectedTL?.userId].filter(Boolean).map(String);

            // Clean this employee out of all other team leads in localStorage
            Object.keys(currentAssignments).forEach(otherTlId => {
              if (!targetIds.map(x => String(x).toLowerCase().trim()).includes(String(otherTlId).toLowerCase().trim())) {
                const list = currentAssignments[otherTlId];
                if (Array.isArray(list)) {
                  currentAssignments[otherTlId] = list.filter(id => !allUserIdentifiers.map(x => String(x).toLowerCase().trim()).includes(String(id).toLowerCase().trim()));
                }
              }
            });

            targetIds.forEach(tId => {
              const existingList = currentAssignments[tId] || [];
              const updatedList = Array.from(new Set([...existingList, ...allUserIdentifiers]));
              currentAssignments[tId] = updatedList;
            });

            localStorage.setItem('teamLeadAssignedEmployees', JSON.stringify(currentAssignments));
            localStorage.setItem('kt_assigned_employees', JSON.stringify(currentAssignments));
          } catch { }

          // Persist User -> Team Lead mapping for all identifiers
          try {
            const currentTLMap = JSON.parse(localStorage.getItem('kt_user_assigned_tl') || '{}');
            const tlRecord = {
              id: selectedTeamLeadId,
              teamLeadId: selectedTeamLeadId,
              name: tlNameVal,
              email: tlEmailVal,
              assignedAt: new Date().toISOString()
            };
            allUserIdentifiers.forEach(id => {
              currentTLMap[id] = tlRecord;
            });
            localStorage.setItem('kt_user_assigned_tl', JSON.stringify(currentTLMap));
          } catch { }

          // Broadcast events for cross-tab and cross-page real-time synchronization
          window.dispatchEvent(new Event('kt_team_assignment_updated'));
          window.dispatchEvent(new Event('storage'));
        }

        // Persist User -> Bank Details mapping (if details exist)
        if (Object.keys(bankData).length > 0) {
          try {
            const currentBankMap = JSON.parse(localStorage.getItem('kt_employee_bank_details') || '{}');
            currentBankMap[userId] = bankData;
            localStorage.setItem('kt_employee_bank_details', JSON.stringify(currentBankMap));
          } catch { }
        }

        // Update user state locally
        setUsers((prevUsers) =>
          prevUsers.map((item, index) => {
            const itemId = getUserIdentifier(item, index);
            if (itemId !== userId) return item;
            return {
              ...item,
              ...(resData?.data || {}),
              isApproved: true,
              approved: true,
              status: 'approved',
              companyId: selectedCompanyId || null,
              companyName: resolvedCompName || null,
              branchId: selectedBranchId || null,
              branchName: resolvedBranchName || null,
              financialYearId: selectedFinancialYearId || null,
              financialYearLabel: fyLabelVal || null,
              yearLabel: fyLabelVal || null,
              ...(shouldPromoteToTeamLead ? {
                role: 'team_leader',
                userRole: 'team_leader',
                isTeamLead: true,
                isTeamLeader: true,
                position: 'TL',
                positionShort: 'TL',
                positionLabel: 'Team Leader'
              } : {}),
              teamLead: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
              teamLeadId: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
              assignedTL: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
              teamLeader: (!isApplicantTL && selectedTeamLeadId) ? selectedTeamLeadId : null,
              teamLeadName: (!isApplicantTL && tlNameVal) ? tlNameVal : null,
              teamLeadEmail: (!isApplicantTL && tlEmailVal) ? tlEmailVal : null,
              ...bankData,
              ...(Object.keys(bankData).length > 0 ? { bankDetails: { ...bankData } } : {})
            };
          })
        );

        if (shouldPromoteToTeamLead) {
          const promotedLeadId = String(approvingUser?._id || approvingUser?.id || userId);
          const promotedLead = {
            ...approvingUser,
            _id: promotedLeadId,
            id: promotedLeadId,
            userId: promotedLeadId,
            userID: promotedLeadId,
            role: 'team_leader',
            userRole: 'team_leader',
            isTeamLead: true,
            isTeamLeader: true
          };
          setTeamLeads((currentLeads) => {
            const existingIndex = currentLeads.findIndex((lead) =>
              String(lead._id || lead.id || lead.userId) === promotedLeadId
            );
            if (existingIndex < 0) return [...currentLeads, promotedLead];
            return currentLeads.map((lead, index) => index === existingIndex ? { ...lead, ...promotedLead } : lead);
          });
          window.dispatchEvent(new Event('kt_team_assignment_updated'));
          window.dispatchEvent(new Event('storage'));
        }

        const approvedName = approvingUser?.name || approvingUser?.fullName || (approvingUser?.email ? approvingUser.email.split('@')[0] : 'User');
        const successMsg = isAlreadyApproved && shouldPromoteToTeamLead
          ? `Promoted ${approvedName} to Team Leader successfully!`
          : isApplicantTL || shouldPromoteToTeamLead
          ? `Approved Team Leader ${approvedName} successfully!`
          : tlNameVal
            ? `Approved ${approvedName} and assigned Team Lead "${tlNameVal}" successfully!`
            : `Approved ${approvedName} successfully!`;
        setSuccessNotification(successMsg);
        setTimeout(() => setSuccessNotification(''), 4500);
        setApprovingUser(null);
      }
    } catch (err) {
      console.error('Approval failed:', err);
      setApprovalError(err.message || 'Failed to complete approval. Please try again.');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // ================= REJECT / REVOKE ACTION =================
  const handleAction = async (user, action) => {
    if (action === 'approve') {
      handleApproveClick(user);
      return;
    }
    const wasApproved = isUserApproved(user);
    const userId = getUserIdentifier(user, 0);
    const targetUserId = String(user?._id || user?.id || user?.userId || userId || '').trim();

    setProcessingState({ userId, action });
    setError('');

    try {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // 1. Resolve all identifiers for this user
      const matchedEmp = users.find(e => {
        if (!e) return false;
        const eEmail = String(e.email || '').toLowerCase().trim();
        const uEmail = String(user?.email || '').toLowerCase().trim();
        if (eEmail && uEmail && eEmail === uEmail) return true;
        const rawUserId = e.userId || e.userID;
        const eUserId = String(
          rawUserId && typeof rawUserId === 'object'
            ? rawUserId._id || rawUserId.id || ''
            : rawUserId || ''
        ).toLowerCase().trim();
        if (eUserId && (eUserId === targetUserId.toLowerCase() || eUserId === String(userId).toLowerCase())) return true;
        const eCode = String(e.employeeID || e.employeeCode || '').trim();
        const uCode = String(user?.employeeID || user?.employeeCode || '').trim();
        return Boolean(eCode && uCode && eCode === uCode);
      });

      // Crucial: Only consider employeeRecordId if it's explicitly from employeeId/employeeID object,
      // NOT falling back to matchedEmp?._id which is the User ID!
      const explicitEmpDocId =
        (typeof matchedEmp?.employeeId === 'object' ? (matchedEmp.employeeId?._id || matchedEmp.employeeId?.id) : null) ||
        (typeof matchedEmp?.employeeID === 'object' ? (matchedEmp.employeeID?._id || matchedEmp.employeeID?.id) : null) ||
        (typeof user?.employeeId === 'object' ? (user.employeeId?._id || user.employeeId?.id) : null) ||
        (typeof user?.employeeID === 'object' ? (user.employeeID?._id || user.employeeID?.id) : null);

      const allUserIdentifiers = [
        targetUserId,
        String(userId),
        user?._id ? String(user._id) : null,
        user?.id ? String(user.id) : null,
        user?.userId ? String(user.userId) : null,
        user?.userID ? String(user.userID) : null,
        explicitEmpDocId,
        user?.employeeID ? String(user.employeeID).trim() : null,
        user?.employeeCode ? String(user.employeeCode).trim() : null,
        user?.email ? String(user.email).trim().toLowerCase() : null
      ].filter(Boolean);

      const userIdentifierStrs = allUserIdentifiers.map(x => String(x).toLowerCase().trim());

      // 2. Fetch current backend teams: GET /api/teamLead/team
      let currentTeams = [];
      try {
        const teamRes = await api.get('/api/teamLead/team', { headers });
        currentTeams = teamRes.data?.data || teamRes.data?.teams || (Array.isArray(teamRes.data) ? teamRes.data : []);
      } catch {
        try {
          const fetchTeamsRes = await fetch(`${BASE_URL}/api/teamLead/team`, { headers });
          if (fetchTeamsRes.ok) {
            const tData = await fetchTeamsRes.json().catch(() => ({}));
            currentTeams = tData?.data || tData?.teams || (Array.isArray(tData) ? tData : []);
          }
        } catch {}
      }
      if (!Array.isArray(currentTeams)) currentTeams = [];

      // 3. REMOVE user from all teams via POST /api/teamLead/create-team
      for (const team of currentTeams) {
        if (!Array.isArray(team.employees) || team.employees.length === 0) continue;

        const isUserInTeam = team.employees.some(emp => {
          if (!emp) return false;
          if (typeof emp === 'string' || typeof emp === 'number') {
            return userIdentifierStrs.includes(String(emp).toLowerCase().trim());
          }
          if (typeof emp === 'object') {
            const empIds = [
              emp._id,
              emp.id,
              emp.userId,
              emp.userID,
              emp.employeeId,
              emp.employeeID
            ].filter(Boolean).map(x => String(x).toLowerCase().trim());
            if (empIds.some(id => userIdentifierStrs.includes(id))) return true;

            const empEmail = String(emp.email || '').toLowerCase().trim();
            if (empEmail && userIdentifierStrs.includes(empEmail)) return true;
          }
          return false;
        });

        if (isUserInTeam) {
          const remainingEmployees = team.employees.filter(emp => {
            if (!emp) return false;
            if (typeof emp === 'string' || typeof emp === 'number') {
              return !userIdentifierStrs.includes(String(emp).toLowerCase().trim());
            }
            if (typeof emp === 'object') {
              const empIds = [
                emp._id,
                emp.id,
                emp.userId,
                emp.userID,
                emp.employeeId,
                emp.employeeID
              ].filter(Boolean).map(x => String(x).toLowerCase().trim());
              if (empIds.some(id => userIdentifierStrs.includes(id))) return false;

              const empEmail = String(emp.email || '').toLowerCase().trim();
              if (empEmail && userIdentifierStrs.includes(empEmail)) return false;
            }
            return true;
          });

          const rawLead = team.teamLead || team.lead || team.teamLeadId;
          const leadId = typeof rawLead === 'object' ? (rawLead._id || rawLead.id || rawLead.userId) : rawLead;

          if (leadId) {
            const teamPayload = {
              teamLead: leadId,
              employees: remainingEmployees.map(e => typeof e === 'object' ? String(e._id || e.id || e.userId) : String(e))
            };
            try {
              await api.post('/api/teamLead/create-team', teamPayload, { headers });
            } catch (apiError) {
              await fetch(`${BASE_URL}/api/teamLead/create-team`, {
                method: 'POST',
                headers,
                body: JSON.stringify(teamPayload)
              }).catch(() => {});
            }
          }
        }
      }

      // 4. Revoke returns the request to pending; reject keeps the employee inactive.
      const isRevoking = action === 'revoke';
      const statusPayload = {
        id: targetUserId,
        userId: targetUserId,
        _id: targetUserId,
        email: user?.email,
        isApproved: false,
        approved: false,
        status: isRevoking ? 'pending' : 'rejected',
        isActive: isRevoking,
        employeeStatus: isRevoking ? 'Active' : 'Inactive',
        teamLead: null,
        teamLeadId: null,
        assignedTL: null,
        teamLeader: null,
        teamLeadName: null,
        teamLeadEmail: null
      };

      let statusUpdated = false;
      let lastErrMsg = '';

      // Try primary: PUT /api/users/reject
      try {
        const response = await api.put('/api/users/reject', statusPayload);
        if (response.data?.success !== false) {
          statusUpdated = true;
        }
      } catch (axiosErr) {
        lastErrMsg = axiosErr.response?.data?.message || axiosErr.message || '';
        try {
          const fetchRes = await fetch(`${BASE_URL}/api/users/reject`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(statusPayload),
          });
          if (fetchRes.ok) {
            const resData = await fetchRes.json().catch(() => ({}));
            if (resData?.success !== false) {
              statusUpdated = true;
            }
          }
        } catch {}
      }

      // If /api/users/reject returned "User not found" or 404, try by route param: PUT /api/users/reject/:id
      if (!statusUpdated && targetUserId) {
        try {
          const res = await api.put(`/api/users/reject/${encodeURIComponent(targetUserId)}`, statusPayload);
          if (res.data?.success !== false) {
            statusUpdated = true;
          }
        } catch (err2) {
          lastErrMsg = err2.response?.data?.message || err2.message || lastErrMsg;
        }
      }

      // If still not updated, try PUT /api/users/approve (which updates status & approval flags on user document)
      if (!statusUpdated) {
        try {
          const res = await api.put('/api/users/approve', statusPayload);
          if (res.data?.success !== false) {
            statusUpdated = true;
          }
        } catch (err3) {
          lastErrMsg = err3.response?.data?.message || err3.message || lastErrMsg;
        }
      }

      // If still not updated, try PUT /api/users/:id or PUT /api/users/edit/:id
      if (!statusUpdated && targetUserId) {
        try {
          const res = await api.put(`/api/users/${encodeURIComponent(targetUserId)}`, statusPayload);
          if (res.data?.success !== false) {
            statusUpdated = true;
          }
        } catch (err4) {
          try {
            const res2 = await api.put(`/api/users/edit/${encodeURIComponent(targetUserId)}`, statusPayload);
            if (res2.data?.success !== false) {
              statusUpdated = true;
            }
          } catch {}
        }
      }

      // If all network updates for the user doc failed with a real critical error, report it
      if (!statusUpdated && lastErrMsg && !lastErrMsg.toLowerCase().includes('not found')) {
        throw new Error(lastErrMsg || 'Failed to update employee request.');
      }

      // 5. Update employee list record ONLY IF a real employee document ID exists in employee collection
      let actualEmployeeDocId = explicitEmpDocId;
      if (!actualEmployeeDocId && wasApproved) {
        try {
          const empListRes = await api.get('/api/employee/list', { headers });
          const empList = empListRes.data?.data || empListRes.data?.employees || (Array.isArray(empListRes.data) ? empListRes.data : []);
          const foundEmp = (Array.isArray(empList) ? empList : []).find(e => {
            if (!e) return false;
            const eUId = String(typeof e.user === 'object' ? (e.user?._id || e.user?.id) : (e.user || e.userId || e.userID || '')).toLowerCase().trim();
            if (eUId && (eUId === targetUserId.toLowerCase() || eUId === String(userId).toLowerCase())) return true;
            const eEmail = String(e.email || '').toLowerCase().trim();
            const uEmail = String(user?.email || '').toLowerCase().trim();
            return Boolean(eEmail && uEmail && eEmail === uEmail);
          });
          if (foundEmp?._id) actualEmployeeDocId = String(foundEmp._id);
        } catch {}
      }

      if (actualEmployeeDocId) {
        const employeeStatusPayload = {
          isActive: isRevoking,
          employeeStatus: isRevoking ? 'Active' : 'Inactive',
          status: isRevoking ? 'active' : 'inactive',
          teamLead: null,
          teamLeadId: null
        };
        try {
          await api.put(`/api/employee/edit/${actualEmployeeDocId}`, employeeStatusPayload);
        } catch (apiError) {
          try {
            await fetch(`${BASE_URL}/api/employee/edit/${actualEmployeeDocId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(employeeStatusPayload)
            });
          } catch (ignErr) {
            console.warn('Notice: Employee collection sync notice:', ignErr?.message);
          }
        }
      }

      // 6. Remove user from localStorage
      try {
        const currentTLMap = JSON.parse(localStorage.getItem('kt_user_assigned_tl') || '{}');
        allUserIdentifiers.forEach(id => {
          delete currentTLMap[id];
        });
        localStorage.setItem('kt_user_assigned_tl', JSON.stringify(currentTLMap));
      } catch {}

      try {
        const currentAssignments = JSON.parse(localStorage.getItem('teamLeadAssignedEmployees') || '{}');
        Object.keys(currentAssignments).forEach(tlId => {
          const list = currentAssignments[tlId];
          if (Array.isArray(list)) {
            currentAssignments[tlId] = list.filter(id => !userIdentifierStrs.includes(String(id).toLowerCase().trim()));
          }
        });
        localStorage.setItem('teamLeadAssignedEmployees', JSON.stringify(currentAssignments));
        localStorage.setItem('kt_assigned_employees', JSON.stringify(currentAssignments));
      } catch {}

      // 7. Broadcast real-time events & refresh backendTeams
      window.dispatchEvent(new Event('kt_team_assignment_updated'));
      window.dispatchEvent(new Event('storage'));
      await fetchBackendTeams();

      // 8. Update React state
      usersFetchSequenceRef.current += 1;
      setUsers((prevUsers) =>
        prevUsers.map((item, index) => {
          const itemId = getUserIdentifier(item, index);
          const itemTargetId = String(item?._id || item?.id || item?.userId || itemId || '');
          if (itemId !== userId && itemTargetId !== targetUserId) return item;

          return {
            ...item,
            isApproved: false,
            approved: false,
            isActive: action === 'revoke',
            employeeStatus: action === 'revoke' ? 'Active' : 'Inactive',
            status: action === 'revoke' ? 'pending' : 'rejected',
            teamLead: null,
            teamLeadId: null,
            assignedTL: null,
            teamLeader: null,
            teamLeadName: null,
            teamLeadEmail: null
          };
        })
      );

      const userName = user?.name || user?.fullName || 'User';
      const successMsg = action === 'revoke'
        ? `Successfully revoked approval for ${userName}.`
        : `Successfully rejected ${userName}.`;

      setError('');
      setSuccessNotification(successMsg);
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      console.error('Action error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setProcessingState(null);
    }
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const getGradientColor = (name) => {
    const gradients = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-rose-500',
      'from-green-500 to-emerald-600',
      'from-indigo-500 to-indigo-600',
      'from-orange-500 to-orange-600',
      'from-teal-500 to-teal-600',
      'from-red-500 to-red-600'
    ];
    const index = (name?.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
  };

  const getStatusBadge = (user) => {
    if (isUserApproved(user)) {
      return {
        text: 'Approved',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle
      };
    }
    if (isUserInactive(user)) {
      return {
        text: 'Inactive',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: XCircle
      };
    }
    return {
      text: 'Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock
    };
  };

  const eligibleUsers = users.filter((user) => !isUnknownEmployeeOrUser(user));

  // Keep the summary counts independent from search and list filters.
  const stats = {
    total: eligibleUsers.length,
    pending: eligibleUsers.filter((user) =>
      !isUserApproved(user) && !isUserInactive(user)
    ).length,
    approved: eligibleUsers.filter(isUserApproved).length,
    rejected: eligibleUsers.filter((user) =>
      !isUserApproved(user) && isUserInactive(user)
    ).length
  };

  const baseUsers = eligibleUsers.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    const searchMatch = !term ||
      String(user?.name || user?.fullName || '').toLowerCase().includes(term) ||
      String(user?.email || '').toLowerCase().includes(term) ||
      String(user?.department || '').toLowerCase().includes(term) ||
      String(user?.role || '').toLowerCase().includes(term) ||
      String(user?.requestId || user?.uniqueID || user?._id || user?.id || '').toLowerCase().includes(term);

    const requestDateValue = user?.createdAt || user?.requestedAt || user?.date;
    const requestDate = requestDateValue ? new Date(requestDateValue) : null;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - (dateRange === '90d' ? 90 : 30));
    const matchesDateRange = dateRange === 'all' ||
      !requestDate ||
      Number.isNaN(requestDate.getTime()) ||
      requestDate >= dateThreshold;

    return searchMatch && matchesDateRange;
  });

  const filteredUsers = baseUsers
    .filter((user) => {
      const isApproved = isUserApproved(user);
      const isRejected = isUserInactive(user);
      if (filterStatus === 'approved') return isApproved;
      if (filterStatus === 'pending') return !isApproved && !isRejected;
      if (filterStatus === 'rejected') return isRejected;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.requestedAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.requestedAt || b.date || 0);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const exportRequests = () => {
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Request ID', 'Employee Name', 'Email', 'Role', 'Department', 'Request Date', 'Status'],
      ...filteredUsers.map((user, index) => {
        const recordId = getUserIdentifier(user, index);
        const requestId = user.requestId || `REQ-${String(recordId).slice(-6).toUpperCase()}`;
        const requestDate = user.createdAt || user.requestedAt || user.date;
        return [
          requestId,
          user.name || user.fullName || '',
          user.email || '',
          user.role || '',
          user.department || '',
          requestDate ? new Date(requestDate).toLocaleDateString() : '',
          getStatusBadge(user).text
        ];
      })
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `employee-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const selectedUserStatus = selectedUser ? getStatusBadge(selectedUser) : null;
  const SelectedUserStatusIcon = selectedUserStatus?.icon;
  const selectedUserApproved = selectedUser ? isUserApproved(selectedUser) : false;
  const selectedUserRequestId = selectedUser
    ? selectedUser.requestId || `REQ-${String(getUserIdentifier(selectedUser, 0)).slice(-6).toUpperCase()}`
    : '';
  const selectedUserRequestDate = selectedUser?.createdAt || selectedUser?.requestedAt || selectedUser?.date;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-7 pb-6">
      {selectedUser ? (() => {
        const teamLead = getAssignedTeamLead(selectedUser);
        const bankDetails = getUserBankDetails(selectedUser);
        const photoValue = selectedUser.profileImage || selectedUser.profileImg || selectedUser.avatar || selectedUser.photo || selectedUser.image;
        const photo = typeof photoValue === 'string'
          ? photoValue
          : photoValue?.url || photoValue?.path || photoValue?.secure_url || '';
        const photoUrl = typeof photo === 'string'
          ? (/^(https?:|data:|blob:)/i.test(photo) ? photo : `${BASE_URL}${photo.startsWith('/') ? '' : '/'}${photo}`)
          : '';
        const displayValue = (value) => {
          if (!value || typeof value !== 'object') return value;
          return value.name || value.departmentName || value.designationName || value.title || value.yearLabel || value.year || '';
        };
        const detailValue = (value) => displayValue(value) || '—';
        const infoCard = (title, Icon, iconClass, rows) => (
          <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
            <header className="flex items-center gap-2.5 border-b border-blue-50 px-4 py-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-[#102b5c]">{title}</h2>
            </header>
            <div className="space-y-2.5 px-4 py-3.5">
              {rows.map(({ label, value, Icon: RowIcon }) => (
                <div key={label} className="grid min-w-0 grid-cols-[minmax(100px,0.8fr)_minmax(0,1.2fr)] items-center gap-2 text-xs sm:text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="flex min-w-0 items-center gap-2 font-medium text-[#14284d]">
                    {RowIcon && <RowIcon className="h-3.5 w-3.5 shrink-0 text-[#173c7b]" />}
                    <span className="truncate">{detailValue(value)}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
        return (
          <div className="space-y-4 sm:space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
                  <Home className="h-3.5 w-3.5" />
                  <span>/</span>
                  <span>Employees</span>
                  <span>/</span>
                  <span className="font-semibold text-[#14284d]">Employee Profile</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#102b5c] sm:text-3xl">Employee Profile</h1>
                <p className="mt-1 text-sm text-slate-600">View detailed information about the employee.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#173c7b] shadow-sm transition hover:bg-blue-50 sm:self-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Directory
              </button>
            </div>

            <section className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-[#f0f6ff] via-white to-[#dceaff] p-4 shadow-sm sm:p-5">
              <div className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full bg-blue-200/50 blur-3xl" />
              <div className="relative grid gap-5 md:grid-cols-[1.3fr_0.9fr] md:items-center">
                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-blue-400 bg-white shadow-sm sm:h-28 sm:w-28">
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGradientColor(selectedUser?.name || selectedUser?.fullName)} text-2xl font-bold text-white`}>
                      {getInitials(selectedUser?.name || selectedUser?.fullName)}
                    </div>
                    {photoUrl && (
                      <img
                        src={photoUrl}
                        alt={selectedUser?.name || selectedUser?.fullName || 'Employee'}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-[#102b5c] sm:text-2xl">
                        {selectedUser?.name || selectedUser?.fullName || 'Employee'}
                      </h2>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${selectedUserStatus?.className}`}>
                        {SelectedUserStatusIcon && <SelectedUserStatusIcon className="h-3 w-3" />}
                        {selectedUserStatus?.text}
                      </span>
                    </div>
                    <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-[#173c7b]">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{selectedUser?.email || 'No email provided'}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-lg border border-blue-200 bg-blue-100/80 px-2.5 py-1 font-mono font-semibold text-[#173c7b]">{selectedUserRequestId}</span>
                      <span className="inline-flex items-center gap-1.5 text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-[#173c7b]" />
                        Request received: {selectedUserRequestDate && !Number.isNaN(new Date(selectedUserRequestDate).getTime())
                          ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(selectedUserRequestDate))
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-blue-200/80 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <div className="flex items-center gap-2 text-[#0b55c8]">
                    <Users className="h-5 w-5" />
                    <h3 className="text-sm font-bold text-[#102b5c]">Assigned Team Lead (TL)</h3>
                  </div>
                  <span className="ml-7 mt-1 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold text-blue-800">
                    {isTeamLeadUser(selectedUser) ? 'Team Lead' : 'Team Member'}
                  </span>
                  <div className="ml-7 mt-2 flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-700">
                      <Crown className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#14284d]">
                        {teamLead?.name || (isTeamLeadUser(selectedUser) ? selectedUser?.name || selectedUser?.fullName : 'No Team Lead assigned')}
                      </p>
                      <p className="truncate text-xs text-slate-600">{teamLead?.email || (isTeamLeadUser(selectedUser) ? 'Team Lead account' : '—')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              {infoCard('Bank Account Details', Landmark, 'bg-blue-100 text-blue-700', [
                { label: 'Bank Name', value: bankDetails?.bankName },
                { label: 'Account Number', value: bankDetails?.accountNumber },
                { label: 'IFSC Code', value: bankDetails?.ifscCode },
                { label: 'Account Holder', value: bankDetails?.accountHolderName || selectedUser?.name || selectedUser?.fullName },
                { label: 'Branch', value: bankDetails?.bankBranch },
                { label: 'UPI ID', value: bankDetails?.upiId },
              ])}
              {infoCard('Organization Assignment', Building2, 'bg-blue-100 text-blue-700', [
                { label: 'Company', value: getCompanyName(selectedUser?.companyId, selectedUser) },
                { label: 'Branch', value: getBranchName(selectedUser?.branchId, selectedUser) },
                { label: 'Financial Year', value: getFinancialYearName(selectedUser?.financialYearId, selectedUser) },
              ])}
              {infoCard('Personal Information', User, 'bg-blue-100 text-blue-700', [
                { label: 'Phone', value: selectedUser?.phoneNumber || selectedUser?.phone, Icon: Phone },
                { label: 'Date of Birth', value: selectedUser?.dob, Icon: Calendar },
                { label: 'Gender', value: selectedUser?.gender, Icon: User },
                { label: 'Blood Group', value: selectedUser?.bloodGroup, Icon: Droplet },
              ])}
              {infoCard('Professional Details', Briefcase, 'bg-blue-100 text-blue-700', [
                { label: 'Department', value: selectedUser?.department, Icon: Building },
                { label: 'Designation', value: selectedUser?.designation, Icon: Briefcase },
                { label: 'Role', value: selectedUser?.role, Icon: User },
                { label: 'Unique ID', value: selectedUser?.uniqueID, Icon: Hash },
              ])}
            </div>

            <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
              <header className="flex items-center gap-2.5 border-b border-blue-50 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><MapPin className="h-4 w-4" /></span>
                <h2 className="text-sm font-bold text-[#102b5c]">Address</h2>
              </header>
              <div className="flex items-start gap-3 px-4 py-3.5 text-sm text-[#14284d]">
                <Home className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                <p className="break-words">{selectedUser?.address || 'No address provided'}</p>
              </div>
            </section>

            {!isReadOnlyRequestRole(selectedUser) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const employee = selectedUser;
                    setSelectedUser(null);
                    handleApproveClick(employee);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
                    selectedUserApproved ? 'bg-[#173c7b] hover:bg-[#102b5c]' : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {selectedUserApproved ? <UserCheck size={16} /> : <ShieldCheck size={16} />}
                  {selectedUserApproved ? 'Edit assignment' : 'Approve request'}
                </button>
              </div>
            )}
          </div>
        );
      })() : (
      <>
      {/* Floating Success Toast */}
      {successNotification && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium bg-emerald-50 text-emerald-800 border-emerald-200 animate-in fade-in slide-in-from-top-4">
          <CheckCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}

      {/* Page heading */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#075985] to-[#0284c7] text-white shadow-lg shadow-sky-900/15 sm:h-14 sm:w-14">
              <UserCheck size={24} />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">People management</span>
                {stats.pending > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    {stats.pending} awaiting review
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Employee Requests</h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
                Review new staff accounts, assign team leads, and confirm organization details.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 shadow-sm sm:self-center">
            <Users className="h-4 w-4 text-sky-700" />
            <span className="text-xs font-medium text-slate-500">All requests</span>
            <span className="text-sm font-bold tabular-nums text-slate-900">{stats.total}</span>
          </div>
        </div>
      </div>

      {/* Request metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {[
          {
            key: 'all',
            label: 'Total requests',
            caption: 'All employee accounts',
            value: stats.total,
            Icon: Users,
            activeClass: 'border-sky-300 bg-sky-50/70 ring-2 ring-sky-100',
            iconClass: 'bg-sky-100 text-sky-700',
            valueClass: 'text-slate-950',
          },
          {
            key: 'pending',
            label: 'Pending review',
            caption: 'Require your attention',
            value: stats.pending,
            Icon: Clock,
            activeClass: 'border-amber-300 bg-amber-50/70 ring-2 ring-amber-100',
            iconClass: 'bg-amber-100 text-amber-700',
            valueClass: 'text-amber-700',
          },
          {
            key: 'approved',
            label: 'Approved',
            caption: 'Cleared to get started',
            value: stats.approved,
            Icon: CheckCircle,
            activeClass: 'border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-100',
            iconClass: 'bg-emerald-100 text-emerald-700',
            valueClass: 'text-emerald-700',
          },
          {
            key: 'rejected',
            label: 'Inactive / rejected',
            caption: 'Not active employee accounts',
            value: stats.rejected,
            Icon: XCircle,
            activeClass: 'border-rose-300 bg-rose-50/70 ring-2 ring-rose-100',
            iconClass: 'bg-rose-100 text-rose-700',
            valueClass: 'text-rose-700',
          },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => setFilterStatus(filterStatus === item.key && item.key !== 'all' ? 'all' : item.key)}
              aria-pressed={isSelected}
              className={`group flex w-full items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:p-5 ${
                isSelected
                  ? item.activeClass
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${item.iconClass}`}>
                  <item.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.caption}</p>
                </div>
              </div>
              <span className={`ml-3 text-2xl font-bold tabular-nums sm:text-3xl ${item.valueClass}`}>{item.value}</span>
            </button>
          );
        })}
      </div>

      {/* Search and filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Find a request</h2>
            <p className="mt-0.5 text-xs text-slate-500">Search by employee details or adjust the list view.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'result' : 'results'}
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter requests by status"
              className="h-11 min-w-32 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Inactive / rejected</option>
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Filter requests by date"
              className="h-11 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort requests"
              className="h-11 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <button
              type="button"
              onClick={exportRequests}
              className="flex h-11 items-center gap-2 rounded-xl border border-sky-700 bg-sky-700 px-3.5 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <Download size={15} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fetchUsers();
                fetchApprovalMetadata();
              }}
              title="Refresh"
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {!loading && !error && filteredUsers.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Requests</h2>
            <p className="mt-0.5 text-xs text-slate-500">Select a request to review the employee profile and take action.</p>
          </div>
          <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex">
            {filterStatus === 'all' ? 'All statuses' : `${filterStatus.charAt(0).toUpperCase()}${filterStatus.slice(1)} requests`}
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <TableSkeleton rows={8} cols={8} />
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 sm:p-4 text-xs sm:text-sm text-red-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && filteredUsers.length === 0 && (
        <div className="flex h-48 sm:h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm">
          <Users className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300" />
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500">No employee requests found</p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-blue-600 hover:underline cursor-pointer"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {!loading && !error && filteredUsers.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Employee request list</h2>
              <p className="mt-0.5 text-xs text-slate-500">Review applicants and manage their organization access.</p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'request' : 'requests'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Request ID</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Request date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user, index) => {
                  const userId = getUserIdentifier(user, index);
                  const name = user?.name || user?.fullName || 'No Name';
                  const requestDate = user?.createdAt || user?.requestedAt || user?.date;
                  const requestId = user?.requestId || `REQ-${String(userId).slice(-6).toUpperCase()}`;
                  const status = getStatusBadge(user);
                  const StatusIcon = status.icon;
                  const isApproved = isUserApproved(user);
                  const isProcessing = processingState?.userId === userId &&
                    (processingState?.action === 'revoke' || processingState?.action === 'reject');
                  const menuOpen = openActionsFor === userId;

                  return (
                    <tr key={userId} className="transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-sky-700">
                        {requestId}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          aria-label={`Open ${name} profile`}
                          className="flex min-w-[170px] items-center gap-2.5 rounded-lg text-left hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getGradientColor(name)} text-xs font-bold text-white`}>
                            {getInitials(name)}
                          </div>
                          <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                        </button>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3.5 text-sm text-slate-500">
                        {user?.email || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex max-w-[150px] truncate rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium capitalize text-indigo-700">
                          {user?.role || 'Employee'}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-sm text-slate-600">
                        {user?.department || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">
                        {requestDate && !Number.isNaN(new Date(requestDate).getTime())
                          ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(requestDate))
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                          <StatusIcon size={13} />
                          {status.text}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            View
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              aria-label={`More actions for ${name}`}
                              aria-expanded={menuOpen}
                              onClick={() => setOpenActionsFor(menuOpen ? null : userId)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuOpen && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setOpenActionsFor(null);
                                  }}
                                  className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  View profile
                                </button>
                                {!isReadOnlyRequestRole(user) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsFor(null);
                                      handleApproveClick(user);
                                    }}
                                    className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    {isApproved ? 'Change team lead' : 'Review request'}
                                  </button>
                                )}
                                {isApproved && !isReadOnlyRequestRole(user) && (
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => {
                                      setOpenActionsFor(null);
                                      handleAction(user, 'revoke');
                                    }}
                                    className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    {isProcessing ? 'Updating…' : 'Revoke approval'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ==================================================== */}
      {/* APPROVE EMPLOYEE MODAL (COMPANY, BRANCH & FINANCIAL YEAR) */}
      {/* ==================================================== */}
      {approvingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !submittingApproval && setApprovingUser(null)}
        >
          <div
            className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {isUserApproved(approvingUser) ? 'Update Employee Role' : 'Approve Employee'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isUserApproved(approvingUser) && tlAssignmentMode === 'promote'
                      ? 'Promote this approved employee directly to Team Lead.'
                      : isTeamLeadUser(approvingUser)
                        ? 'Confirm organization details and approve this Team Lead.'
                      : 'Choose an existing Team Lead or approve this employee as a Team Lead.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                disabled={submittingApproval}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={submitApproval} className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1">
              {/* Target Employee Summary Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradientColor(approvingUser?.name)} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}>
                    {getInitials(approvingUser?.name || approvingUser?.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {approvingUser?.name || approvingUser?.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {approvingUser?.email}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                    {approvingUser?.role || 'employee'}
                  </span>
                  {approvingUser?.department && (
                    <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[120px]">
                      {approvingUser?.department}
                    </p>
                  )}
                </div>
              </div>

              {/* Error Alert */}
              {approvalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{approvalError}</span>
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 1: ASSIGN TEAM LEAD (DYNAMIC - BLUE THEME) */}
              {/* ==================================================== */}
              {isTeamLeadUser(approvingUser) ? (
                <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200/90 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                      <Crown size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Applicant Role: Team Leader (TL)</span>
                        <span className="text-[10px] font-semibold bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded">Lead Account</span>
                      </h4>
                      <p className="text-xs text-purple-700 mt-0.5">
                        This employee is registering as a Team Leader. TL assignment is not required.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-blue-100 text-blue-700">
                        <Crown size={15} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                          <span>1. Team Lead Option</span>
                        </label>
                      </div>
                    </div>
                    {loadingTeamLeads && (
                      <span className="flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Loading TLs...</span>
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${tlAssignmentMode === 'existing' ? 'border-blue-400 bg-white ring-1 ring-blue-200' : 'border-blue-200 bg-white/60 hover:bg-white'}`}>
                      <input
                        type="radio"
                        name="tlAssignmentMode"
                        value="existing"
                        checked={tlAssignmentMode === 'existing'}
                        onChange={() => {
                          setTlAssignmentMode('existing');
                          if (approvalError) setApprovalError('');
                        }}
                        disabled={submittingApproval}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">Assign an existing TL</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">Choose a Team Lead from the dropdown.</span>
                      </span>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${tlAssignmentMode === 'promote' ? 'border-purple-400 bg-white ring-1 ring-purple-200' : 'border-blue-200 bg-white/60 hover:bg-white'}`}>
                      <input
                        type="radio"
                        name="tlAssignmentMode"
                        value="promote"
                        checked={tlAssignmentMode === 'promote'}
                        onChange={() => {
                          setTlAssignmentMode('promote');
                          setSelectedTeamLeadId('');
                          if (approvalError) setApprovalError('');
                        }}
                        disabled={submittingApproval}
                        className="mt-0.5 accent-purple-600"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">Make this employee a TL</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">Approve them directly as a Team Lead.</span>
                      </span>
                    </label>
                  </div>

                  {tlAssignmentMode === 'existing' && (
                    <>
                      <div className="relative">
                        <Crown size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
                        <select
                          value={selectedTeamLeadId}
                          onChange={(e) => {
                            setSelectedTeamLeadId(e.target.value);
                            if (approvalError) setApprovalError('');
                          }}
                          disabled={submittingApproval || loadingTeamLeads}
                          className={`w-full h-11 pl-10 pr-8 text-xs sm:text-sm bg-white rounded-xl focus:outline-none focus:ring-2 transition text-slate-900 font-medium ${!selectedTeamLeadId && approvalError
                            ? 'border-2 border-rose-400 ring-2 ring-rose-100 focus:border-rose-600 focus:ring-rose-200'
                            : 'border border-blue-300 focus:ring-blue-500/20 focus:border-blue-600'
                            }`}
                        >
                          <option value="">
                            -- {loadingTeamLeads ? 'Loading Team Leads...' : teamLeads.length === 0 ? 'No Team Leads available' : 'Select Team Leader'} --
                          </option>
                          {teamLeads.map((tl) => {
                            const tlId = String(tl._id || tl.id || tl.userId);
                            const tlName = tl.name || tl.fullName || 'Team Lead';
                            const desig = tl.designation || tl.department || tl.role || '';
                            return (
                              <option key={tlId} value={tlId}>
                                {tlName} {desig ? `(${desig})` : ''} {tl.email ? `• ${tl.email}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {selectedTeamLeadId ? (() => {
                        const currentTL = teamLeads.find(t => String(t._id || t.id || t.userId) === String(selectedTeamLeadId));
                        if (!currentTL) return null;
                        return (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-200 text-xs shadow-xs">
                            <div className="flex items-center gap-2">
                              <UserCheck size={14} className="text-blue-600" />
                              <span className="font-semibold text-slate-800">{currentTL.name || currentTL.fullName}</span>
                              {currentTL.department && (
                                <span className="text-[10px] text-slate-500">Dept: {currentTL.department}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-blue-800 uppercase px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                              {currentTL.designation || 'Team Lead'}
                            </span>
                          </div>
                        );
                      })() : (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle size={13} className="shrink-0 text-rose-500" />
                          <span>Select an existing Team Lead or choose to make this employee a TL.</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 2: ORGANIZATION DETAILS */}
              {/* ==================================================== */}
              <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                      <Building2 size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                        <span>2. Organization Details</span>
                        <span className="text-rose-500 font-bold">*</span>
                        <span className="text-rose-600 font-semibold text-[10px] lowercase bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">required</span>
                      </h4>

                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        fetchCompanies();
                        if (selectedCompanyId) {
                          fetchBranches(selectedCompanyId);
                          if (selectedBranchId) {
                            fetchFinancialYears(selectedBranchId, selectedCompanyId);
                          }
                        }
                      }}
                      title="Sync live organization entities"
                      className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-[10px] font-semibold text-indigo-700 flex items-center gap-1 cursor-pointer transition"
                    >
                      <RefreshCw size={11} />
                      <span>Sync Live</span>
                    </button>
                  </div>
                </div>

                {/* Field 1: Company Name */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <span>Company Name</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      disabled={submittingApproval || loadingCompanies}
                      className={`w-full h-10 pl-10 pr-8 text-xs sm:text-sm bg-white rounded-xl focus:outline-none focus:ring-2 transition text-slate-900 ${!selectedCompanyId && approvalError
                        ? 'border-2 border-rose-400 ring-2 ring-rose-100 focus:border-rose-600 focus:ring-rose-200'
                        : 'border border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-600'
                        }`}
                    >
                      <option value="">
                        -- {loadingCompanies ? 'Loading Companies...' : companies.length === 0 ? 'No Companies available' : 'Select Company Name (Required) *'} --
                      </option>
                      {companies.map((c) => {
                        const id = c._id || c.id;
                        const label = c.companyName || c.name || c.title || id;
                        return (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {!selectedCompanyId && (
                    <p className="text-[10px] text-rose-500 font-medium">Company Name is required</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Field 2: Branch */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>Branch</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={selectedBranchId}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        disabled={submittingApproval || loadingBranches || !selectedCompanyId}
                        className={`w-full h-10 pl-10 pr-8 text-xs sm:text-sm bg-white rounded-xl focus:outline-none focus:ring-2 transition text-slate-900 ${!selectedBranchId && approvalError
                          ? 'border-2 border-rose-400 ring-2 ring-rose-100 focus:border-rose-600 focus:ring-rose-200'
                          : 'border border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-600'
                          }`}
                      >
                        <option value="">
                          {loadingBranches
                            ? 'Loading branches...'
                            : !selectedCompanyId
                              ? '-- Select Company First --'
                              : branches.length === 0
                                ? 'No branches available'
                                : '-- Select Branch (Required) * --'}
                        </option>
                        {branches.map((b) => {
                          const id = b._id || b.id;
                          const codeText = b.branchCode ? ` (${b.branchCode})` : '';
                          const hoBadge = b.isHeadOffice ? ' [Head Office]' : '';
                          const cityText = b.city ? ` - ${b.city}` : '';
                          const label = b.branchName || b.name || b.title || id;
                          return (
                            <option key={id} value={id}>
                              {label}{codeText}{hoBadge}{cityText}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {!selectedBranchId && selectedCompanyId && (
                      <p className="text-[10px] text-rose-500 font-medium">
                        {branchLoadError || 'Branch is required'}
                      </p>
                    )}
                  </div>

                  {/* Field 3: Financial Year */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>Financial Year</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={selectedFinancialYearId}
                        onChange={(e) => {
                          setSelectedFinancialYearId(e.target.value);
                          if (approvalError) setApprovalError('');
                        }}
                        disabled={submittingApproval || loadingFY || !selectedBranchId}
                        className={`w-full h-10 pl-10 pr-8 text-xs sm:text-sm bg-white rounded-xl focus:outline-none focus:ring-2 transition text-slate-900 font-mono ${!selectedFinancialYearId && approvalError
                          ? 'border-2 border-rose-400 ring-2 ring-rose-100 focus:border-rose-600 focus:ring-rose-200'
                          : 'border border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-600'
                          }`}
                      >
                        <option value="">
                          {loadingFY
                            ? 'Loading Financial Years...'
                            : !selectedBranchId
                              ? '-- Select Branch First --'
                              : financialYears.length === 0
                                ? 'No Financial Years available'
                                : '-- Select Financial Year (Required) * --'}
                        </option>
                        {financialYears.map((fy) => {
                          const id = fy._id || fy.id;
                          const label = fy.yearLabel || fy.year || fy.financialYear || fy.name || id;
                          const isCurrent = fy.status === 'active';
                          return (
                            <option key={id} value={id}>
                              {label}{isCurrent ? ' (Active)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {!selectedFinancialYearId && selectedBranchId && (
                      <p className="text-[10px] text-rose-500 font-medium">Financial Year is required</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                {((!isTeamLeadUser(approvingUser) && tlAssignmentMode === 'existing' && !selectedTeamLeadId) || (!isUserApproved(approvingUser) && (!selectedCompanyId || !selectedBranchId || !selectedFinancialYearId))) ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">

                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">

                  </div>
                )}

                <div className="flex items-center justify-end gap-3 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setApprovingUser(null)}
                    disabled={submittingApproval}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submittingApproval ||
                      (!isTeamLeadUser(approvingUser) && tlAssignmentMode === 'existing' && !selectedTeamLeadId) ||
                      (!isUserApproved(approvingUser) && (
                        !selectedCompanyId ||
                        !selectedBranchId ||
                        !selectedFinancialYearId
                      ))
                    }
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      (!isTeamLeadUser(approvingUser) && tlAssignmentMode === 'existing' && !selectedTeamLeadId) || (!isUserApproved(approvingUser) && (!selectedCompanyId || !selectedBranchId || !selectedFinancialYearId))
                        ? 'Please fill in all required details to approve'
                        : isUserApproved(approvingUser) && tlAssignmentMode === 'promote'
                          ? 'Promote employee to Team Lead'
                          : 'Confirm and Approve Employee'
                    }
                  >
                    {submittingApproval ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Submitting Approval...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        <span>
                          {isUserApproved(approvingUser) && tlAssignmentMode === 'promote'
                            ? 'Promote to Team Lead'
                            : 'Confirm & Approve'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ==================================================== */}
      {/* ENHANCED FULL DETAIL MODAL (MOBILE RESPONSIVE) */}
      {/* ==================================================== */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
          onClick={() => setSelectedUser(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-profile-title"
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-slate-50 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-5 sm:px-7 sm:py-6">
              <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" />
              <button
                type="button"
                aria-label="Close employee profile"
                onClick={() => setSelectedUser(null)}
                className="absolute right-4 top-4 z-10 rounded-xl border border-white/15 bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative flex flex-col gap-4 pr-10 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl font-bold text-white shadow-lg ring-4 ring-white/5">
                  {getInitials(selectedUser?.name || selectedUser?.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200">Employee profile</p>
                  <h2 id="employee-profile-title" className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">
                    {selectedUser?.name || selectedUser?.fullName || 'Employee'}
                  </h2>
                  <p className="mt-1 break-all text-sm text-slate-300">{selectedUser?.email || 'No email provided'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {SelectedUserStatusIcon && <SelectedUserStatusIcon size={13} />}
                      {selectedUserStatus?.text}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-200">
                      {selectedUser?.role || 'Employee'}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[10px] text-slate-300">
                      {selectedUserRequestId}
                    </span>
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Request received</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {selectedUserRequestDate && !Number.isNaN(new Date(selectedUserRequestDate).getTime())
                      ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(selectedUserRequestDate))
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
              {/* Assigned Team Lead */}
              {(() => {
                const suTL = getAssignedTeamLead(selectedUser);
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Crown className="h-4 w-4 text-amber-500" />
                      Assigned Team Lead (TL)
                    </h3>
                    <div className="mt-3">
                      {suTL ? (
                        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3">
                          <Crown className="h-4 w-4 text-amber-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-amber-700">Team Lead</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {suTL.name}
                            </p>
                            {suTL.email && <p className="text-[10px] text-slate-500 truncate">{suTL.email}</p>}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase shrink-0">
                            Assigned TL
                          </span>
                        </div>
                      ) : isTeamLeadUser(selectedUser) ? (
                        <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-3">
                          <Crown className="h-4 w-4 text-purple-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-purple-700 font-bold uppercase tracking-wider">Role: Team Leader</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {selectedUser.name || selectedUser.fullName || 'Team Leader'} (Lead Role)
                            </p>
                            <p className="text-[10px] text-slate-500">This account is a Team Leader</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 uppercase shrink-0">
                            Team Leader
                          </span>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0 text-slate-400" />
                          <span>No Team Lead assigned (No data)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Bank & Disbursement Details */}
              {(() => {
                const suBank = getUserBankDetails(selectedUser);
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Landmark className="h-4 w-4 text-emerald-600" />
                      Bank Account Details
                    </h3>
                    <div className="mt-3">
                      {suBank ? (
                        <div className="space-y-2.5 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                          <div className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-slate-500">Bank Name</span>
                            <span className="font-semibold text-slate-900">{suBank.bankName || <span className="text-slate-400 italic font-normal">No data</span>}</span>
                          </div>
                          <div className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-slate-500">Account Number</span>
                            <span className="font-mono font-bold text-slate-900">{suBank.accountNumber || <span className="text-slate-400 italic font-normal">No data</span>}</span>
                          </div>
                          <div className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-slate-500">IFSC Code</span>
                            <span className="font-mono font-semibold text-indigo-700 uppercase">{suBank.ifscCode || <span className="text-slate-400 italic font-normal">No data</span>}</span>
                          </div>
                          {suBank.accountHolderName && (
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-500">Account Holder</span>
                              <span className="font-medium text-slate-800">{suBank.accountHolderName}</span>
                            </div>
                          )}
                          {suBank.bankBranch && (
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-500">Branch</span>
                              <span className="text-slate-700">{suBank.bankBranch}</span>
                            </div>
                          )}
                          {suBank.upiId && (
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-500">UPI ID</span>
                              <span className="font-mono text-emerald-700">{suBank.upiId}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0 text-slate-400" />
                          <span>No bank account details provided (No data)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Organization Assignment */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  Organization Assignment
                </h3>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <Building2 className="h-4 w-4 shrink-0 text-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Company</p>
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {getCompanyName(selectedUser?.companyId, selectedUser) || <span className="text-slate-400 italic font-normal">No data</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Branch</p>
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {getBranchName(selectedUser?.branchId, selectedUser) || <span className="text-slate-400 italic font-normal">No data</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <Calendar className="h-4 w-4 shrink-0 text-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Financial Year</p>
                      <p className="truncate font-mono text-sm font-semibold text-slate-800">
                        {getFinancialYearName(selectedUser?.financialYearId, selectedUser) || <span className="text-slate-400 italic font-normal">No data</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <User className="h-4 w-4 text-sky-600" />
                  Personal Information
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    { icon: Phone, label: 'Phone', value: selectedUser?.phoneNumber || selectedUser?.phone },
                    { icon: Calendar, label: 'Date of Birth', value: selectedUser?.dob },
                    { icon: User, label: 'Gender', value: selectedUser?.gender },
                    { icon: Droplet, label: 'Blood Group', value: selectedUser?.bloodGroup }
                  ].map((item, idx) => (
                    <div key={idx} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <item.icon className="h-4 w-4 shrink-0 text-sky-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                        <p className="truncate text-sm font-medium text-slate-700">
                          {item.value || <span className="text-slate-400 italic font-normal">No data</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Professional Info */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Briefcase className="h-4 w-4 text-violet-600" />
                  Professional Details
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    { icon: Building, label: 'Department', value: selectedUser?.department },
                    {
                      icon: Briefcase,
                      label: 'Designation',
                      value: typeof selectedUser?.designation === 'object'
                        ? (selectedUser?.designation?.name || selectedUser?.designation?.designationName)
                        : selectedUser?.designation
                    },
                    { icon: Briefcase, label: 'Role', value: selectedUser?.role },
                    { icon: Hash, label: 'Unique ID', value: selectedUser?.uniqueID }
                  ].map((item, idx) => (
                    <div key={idx} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <item.icon className="h-4 w-4 shrink-0 text-violet-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                        <p className="truncate text-sm font-medium text-slate-700">
                          {item.value || <span className="text-slate-400 italic font-normal">No data</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <MapPin className="h-4 w-4 text-rose-600" />
                  Address
                </h3>
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="break-words text-sm leading-6 text-slate-700">
                    {selectedUser?.address || <span className="text-slate-400 italic font-normal">No data</span>}
                  </p>
                </div>
              </div>

              {/* Status & Quick Action */}
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {SelectedUserStatusIcon && (
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${selectedUserStatus?.className}`}>
                      <SelectedUserStatusIcon className="h-5 w-5" />
                    </span>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Request status</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-800">{selectedUserStatus?.text}</p>
                  </div>
                </div>

                {!isReadOnlyRequestRole(selectedUser) && (selectedUserApproved ? (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleApproveClick(u);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 sm:w-auto"
                  >
                    <UserCheck size={16} />
                    <span>Edit assignment</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleApproveClick(u);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
                  >
                    <ShieldCheck size={16} />
                    <span>Approve request</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default EmployeeRequests;