import React, { useEffect, useRef, useState } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
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
  UserCheck
} from 'lucide-react';
import api from '../api/axios';
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
  const [expandedCards, setExpandedCards] = useState(new Set());

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
      const freshUrl = `https://kt-backend-ttzj.onrender.com/api/users/all?_t=${Date.now()}`;
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
          const fetchRes = await fetch('https://kt-backend-ttzj.onrender.com/api/company', { headers });
          if (fetchRes.ok) {
            const compData = await fetchRes.json();
            const cData = compData?.data || compData?.companies || (Array.isArray(compData) ? compData : []);
            if (Array.isArray(cData) && cData.length > 0) companyList = cData;
          }
        } catch { }
      }

      if (companyList.length === 0) {
        try {
          const fetchRes = await fetch('https://kt-backend-ttzj.onrender.com/api/company/', { headers });
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
  // All branches: GET https://kt-backend-ttzj.onrender.com/api/branch
  // Company branches: GET https://kt-backend-ttzj.onrender.com/api/branch?companyId=<companyId>
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
      ? `https://kt-backend-ttzj.onrender.com/api/branch?companyId=${encodeURIComponent(rawCompId)}`
      : 'https://kt-backend-ttzj.onrender.com/api/branch';

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
            const fetchAll = await fetch('https://kt-backend-ttzj.onrender.com/api/branch', { headers });
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
          const fetchRes = await fetch(`https://kt-backend-ttzj.onrender.com/api/financial-year?branchId=${encodeURIComponent(rawBranchId)}`, { headers });
          if (fetchRes.ok) {
            const fData = await fetchRes.json();
            const list = fData?.data || fData?.financialYears || fData?.years || (Array.isArray(fData) ? fData : []);
            if (Array.isArray(list) && list.length > 0) fyList = list;
          }
        } catch { }
      }

      if (fyList.length === 0) {
        try {
          const fetchRes = await fetch('https://kt-backend-ttzj.onrender.com/api/financial-year', { headers });
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


  // Fetch Backend Teams from GET https://kt-backend-ttzj.onrender.com/api/teamLead/team
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

    const isApplicantTL = isTeamLeadUser(approvingUser);

    // Strict validation: Team Leader (only if not applicant TL), Company Name, Branch, and Financial Year are mandatory!
    const missingFields = [];
    if (!isApplicantTL && (!selectedTeamLeadId || !String(selectedTeamLeadId).trim())) {
      missingFields.push('Team Leader (TL)');
    }
    if (!selectedCompanyId || !String(selectedCompanyId).trim()) {
      missingFields.push('Company Name');
    }
    if (!selectedBranchId || !String(selectedBranchId).trim()) {
      missingFields.push('Branch');
    }
    if (!selectedFinancialYearId || !String(selectedFinancialYearId).trim()) {
      missingFields.push('Financial Year');
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

        const fetchRes = await fetch('https://kt-backend-ttzj.onrender.com/api/users/approve', {
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

      // 2. Synchronize Team Lead and Team Linkage via backend API: POST /api/teamLead/create-team
      let resolvedEmpRecordId = null;
      if (selectedTeamLeadId && !isApplicantTL) {
        try {
          const token = getAuthToken();
          const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          };

          // Step A: Fetch current teams from backend to ensure we merge and preserve existing members
          let currentTeams = [];
          try {
            const teamRes = await api.get('/api/teamLead/team', { headers });
            currentTeams = teamRes.data?.data || teamRes.data?.teams || (Array.isArray(teamRes.data) ? teamRes.data : []);
          } catch {
            try {
              const fetchTeamsRes = await fetch('https://kt-backend-ttzj.onrender.com/api/teamLead/team', { headers });
              if (fetchTeamsRes.ok) {
                const tData = await fetchTeamsRes.json().catch(() => ({}));
                currentTeams = tData?.data || tData?.teams || (Array.isArray(tData) ? tData : []);
              }
            } catch {}
          }
          if (!Array.isArray(currentTeams)) currentTeams = [];

          // Resolve IDs from the roster loaded by /api/users/all.
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

          const employeeIdentifiersToAdd = [resolvedEmpRecordId, String(userId)].filter(Boolean);

          // Step C: If employee was already in another Team Lead's team in currentTeams, remove them from that other team lead
          const targetTLIds = [
            selectedTeamLeadId,
            selectedTL?._id,
            selectedTL?.id,
            selectedTL?.userId
          ].filter(Boolean).map(x => String(x).toLowerCase().trim());

          for (const team of currentTeams) {
            const rawLead = team.teamLead || team.lead || team.teamLeadId;
            const leadIdStr = String(typeof rawLead === 'object' ? (rawLead._id || rawLead.id || rawLead.userId) : rawLead).toLowerCase().trim();
            const isThisTargetTeam = targetTLIds.includes(leadIdStr);

            if (!isThisTargetTeam && Array.isArray(team.employees)) {
              const prevCount = team.employees.length;
              const remainingEmps = team.employees.filter(emp => {
                const empStr = String(typeof emp === 'object' ? (emp._id || emp.id || emp.userId) : emp).toLowerCase().trim();
                return !employeeIdentifiersToAdd.map(x => x.toLowerCase().trim()).includes(empStr);
              });

              if (remainingEmps.length !== prevCount) {
                // Employee was in another team lead; remove and update that team lead via create-team
                try {
                  const otherLeadBackendId = typeof rawLead === 'object' ? (rawLead._id || rawLead.id) : rawLead;
                  await fetch('https://kt-backend-ttzj.onrender.com/api/teamLead/create-team', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      teamLead: otherLeadBackendId,
                      employees: remainingEmps.map(e => typeof e === 'object' ? String(e._id || e.id) : String(e))
                    })
                  }).catch(() => {});
                } catch {}
              }
            }
          }

          // Step D: Find existing team document for target team lead and merge members
          const targetTeamDoc = currentTeams.find(t => {
            const rawLead = t.teamLead || t.lead || t.teamLeadId;
            const leadIdStr = String(typeof rawLead === 'object' ? (rawLead._id || rawLead.id || rawLead.userId) : rawLead).toLowerCase().trim();
            return targetTLIds.includes(leadIdStr);
          });

          const existingTargetMembers = Array.isArray(targetTeamDoc?.employees)
            ? targetTeamDoc.employees.map(e => typeof e === 'object' ? String(e._id || e.id) : String(e))
            : [];

          const mergedTargetMembers = Array.from(new Set([
            ...existingTargetMembers,
            ...employeeIdentifiersToAdd
          ]));

          // Step E: Call POST https://kt-backend-ttzj.onrender.com/api/teamLead/create-team
          const backendTLId = targetTeamDoc?.teamLead?._id || targetTeamDoc?.teamLead || selectedTL?._id || selectedTeamLeadId;
          if (backendTLId) {
            await fetch('https://kt-backend-ttzj.onrender.com/api/teamLead/create-team', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                teamLead: backendTLId,
                employees: mergedTargetMembers
              })
            }).catch(() => {});
          }

          // Step G: Refresh local backendTeams
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

        const approvedName = approvingUser?.name || approvingUser?.fullName || (approvingUser?.email ? approvingUser.email.split('@')[0] : 'User');
        const successMsg = isApplicantTL
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
    const userId = getUserIdentifier(user, 0);
    const endpoint = 'https://kt-backend-ttzj.onrender.com/api/users/reject';

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
        if (eUserId && eUserId === String(userId).toLowerCase().trim()) return true;
        const eCode = String(e.employeeID || e.employeeCode || '').trim();
        const uCode = String(user?.employeeID || user?.employeeCode || '').trim();
        return Boolean(eCode && uCode && eCode === uCode);
      });
      const empRecordId = matchedEmp?.employeeId?._id ||
        matchedEmp?.employeeID?._id ||
        matchedEmp?._id;

      const allUserIdentifiers = [
        String(userId),
        user?._id ? String(user._id) : null,
        user?.id ? String(user.id) : null,
        user?.userId ? String(user.userId) : null,
        user?.userID ? String(user.userID) : null,
        empRecordId,
        user?.employeeID ? String(user.employeeID).trim() : null,
        user?.employeeCode ? String(user.employeeCode).trim() : null,
        user?.email ? String(user.email).trim().toLowerCase() : null
      ].filter(Boolean);

      const userIdentifierStrs = allUserIdentifiers.map(x => String(x).toLowerCase().trim());

      // 2. Fetch current backend teams: GET https://kt-backend-ttzj.onrender.com/api/teamLead/team
      let currentTeams = [];
      try {
        const teamRes = await api.get('/api/teamLead/team', { headers });
        currentTeams = teamRes.data?.data || teamRes.data?.teams || (Array.isArray(teamRes.data) ? teamRes.data : []);
      } catch {
        try {
          const fetchTeamsRes = await fetch('https://kt-backend-ttzj.onrender.com/api/teamLead/team', { headers });
          if (fetchTeamsRes.ok) {
            const tData = await fetchTeamsRes.json().catch(() => ({}));
            currentTeams = tData?.data || tData?.teams || (Array.isArray(tData) ? tData : []);
          }
        } catch {}
      }
      if (!Array.isArray(currentTeams)) currentTeams = [];

      // 3. REMOVE user from all teams via POST https://kt-backend-ttzj.onrender.com/api/teamLead/create-team
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
              const response = await api.post('/api/teamLead/create-team', teamPayload, { headers });
              if (response.data?.success === false) {
                throw new Error(response.data?.message || 'Failed to update Team Lead members.');
              }
            } catch (apiError) {
              const response = await fetch('https://kt-backend-ttzj.onrender.com/api/teamLead/create-team', {
                method: 'POST',
                headers,
                body: JSON.stringify(teamPayload)
              });
              const responseData = await response.json().catch(() => ({}));
              if (!response.ok || responseData?.success === false) {
                throw new Error(responseData?.message || apiError.response?.data?.message || 'Failed to update Team Lead members.');
              }
            }
          }
        }
      }

      // Revoke returns the request to pending; reject keeps the employee inactive.
      const isRevoking = action === 'revoke';
      const statusPayload = {
        id: userId,
        userId,
        _id: user?._id || userId,
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

      try {
        const response = await api.put('/api/users/reject', statusPayload);
        if (response.data?.success === false) {
          throw new Error(response.data?.message || 'Failed to update employee request.');
        }
      } catch (axiosErr) {
        console.warn('Axios reject error, trying direct fetch:', axiosErr?.message);
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers,
          body: JSON.stringify(statusPayload),
        });
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok || responseData?.success === false) {
          throw new Error(responseData?.message || axiosErr.response?.data?.message || 'Failed to update employee request.');
        }
      }

      // Also update employee list record if found
      if (empRecordId) {
        const employeeStatusPayload = {
          isActive: isRevoking,
          employeeStatus: isRevoking ? 'Active' : 'Inactive',
          status: isRevoking ? 'active' : 'inactive',
          teamLead: null,
          teamLeadId: null
        };
        try {
          const response = await api.put(`/api/employee/edit/${empRecordId}`, employeeStatusPayload);
          if (response.data?.success === false) {
            throw new Error(response.data?.message || 'Failed to update employee status.');
          }
        } catch (apiError) {
          const response = await fetch(`https://kt-backend-ttzj.onrender.com/api/employee/edit/${empRecordId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(employeeStatusPayload)
          });
          const responseData = await response.json().catch(() => ({}));
          if (!response.ok || responseData?.success === false) {
            throw new Error(responseData?.message || apiError.response?.data?.message || 'Failed to update employee status.');
          }
        }
      }

      // 5. Remove user from localStorage
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

      // 6. Broadcast real-time events & refresh backendTeams
      window.dispatchEvent(new Event('kt_team_assignment_updated'));
      window.dispatchEvent(new Event('storage'));
      await fetchBackendTeams();

      // 7. Update React state
      usersFetchSequenceRef.current += 1;
      setUsers((prevUsers) =>
        prevUsers.map((item, index) => {
          const itemId = getUserIdentifier(item, index);
          if (itemId !== userId) return item;

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

      const userName = user?.name || user?.fullName || 'user';
      setSuccessNotification(action === 'revoke'
        ? `Approval revoked and request returned to pending for ${userName}.`
        : `Rejected access and removed Team Lead data for ${userName}.`);
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setProcessingState(null);
    }
  };

  const toggleExpand = (userId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
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
    const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
    if (isApproved) {
      return {
        text: 'Approved',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle
      };
    }
    return {
      text: 'Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock
    };
  };

  // 1. Base users matching search & excluding non-eligible users
  const baseUsers = users.filter((user) => {
    if (isUnknownEmployeeOrUser(user)) return false;

    const term = searchTerm.trim().toLowerCase();
    const searchMatch = !term ||
      user?.name?.toLowerCase().includes(term) ||
      user?.email?.toLowerCase().includes(term) ||
      user?.department?.toLowerCase().includes(term);

    return searchMatch;
  });

  // 2. Consistent Stats computed across all eligible users (never disappears on tab click)
  const stats = {
    total: baseUsers.length,
    pending: baseUsers.filter((u) => {
      const isApproved = u?.isApproved === true || u?.approved === true || u?.status === 'approved';
      return !isApproved;
    }).length,
    approved: baseUsers.filter((u) => {
      const isApproved = u?.isApproved === true || u?.approved === true || u?.status === 'approved';
      return isApproved;
    }).length,
  };

  // 3. Filtered users according to active filter tab
  const filteredUsers = baseUsers
    .filter((user) => {
      const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
      if (filterStatus === 'approved') return isApproved;
      if (filterStatus === 'pending') return !isApproved;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Floating Success Toast */}
      {successNotification && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium bg-emerald-50 text-emerald-800 border-emerald-200 animate-in fade-in slide-in-from-top-4">
          <CheckCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center shrink-0">
            <UserCheck size={18} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Employee Requests
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Review, authorize, and assign company & branch details for new staff accounts
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 shadow-xs border border-slate-200/80">
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-xs sm:text-sm text-slate-500">Total:</span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              {stats.total}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 shadow-xs border border-slate-200/80">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-xs sm:text-sm text-slate-500">Pending:</span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              {stats.pending}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 shadow-xs border border-slate-200/80">
            <CheckCircle className="h-4 w-4 text-slate-400" />
            <span className="text-xs sm:text-sm text-slate-500">Approved:</span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              {stats.approved}
            </span>
          </div>
        </div>
      </div>

      {/* 3 METRIC CARDS (UI Standard Design, Clickable to Filter) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {[
          { key: 'all', label: 'TOTAL REQUESTS', value: stats.total },
          { key: 'pending', label: 'PENDING', value: stats.pending },
          { key: 'approved', label: 'APPROVED', value: stats.approved },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <div
              key={item.key}
              onClick={() => setFilterStatus(filterStatus === item.key && item.key !== 'all' ? 'all' : item.key)}
              title={`Click to filter by ${item.label}`}
              className={`bg-white rounded-xl shadow-xs border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#0088cc] ring-2 ring-[#0088cc]/20 shadow-xs'
                  : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-7 rounded-full ${isSelected ? 'bg-[#0088cc]' : 'bg-[#004b73]'}`} />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      {/* Search and Filter Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all text-slate-700"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all text-slate-700"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <button
              onClick={() => {
                fetchUsers();
                fetchApprovalMetadata();
              }}
              title="Refresh"
              className="h-10 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-16 sm:py-20">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
        </div>
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

      {/* Employee Cards Grid */}
      <div className="grid gap-3 sm:gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((user, index) => {
          const userId = getUserIdentifier(user, index);
          const name = user?.name || user?.fullName || 'No Name';
          const email = user?.email || 'No Email';
          const role = user?.role || null;
          const department = user?.department || null;
          const phone = user?.phone || user?.phoneNumber || null;
          const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
          const isProcessingReject = processingState?.userId === userId && (processingState?.action === 'reject' || processingState?.action === 'revoke');
          const isExpanded = expandedCards.has(userId);
          const StatusBadge = getStatusBadge(user).icon;

          const companyDisplay = getCompanyName(user?.companyId, user);
          const branchDisplay = getBranchName(user?.branchId, user);
          const fyDisplay = getFinancialYearName(user?.financialYearId, user);
          const assignedTL = getAssignedTeamLead(user);
          const userBank = getUserBankDetails(user);

          return (
            <div
              key={userId}
              className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs transition-all duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5"
            >
              {/* Animated Gradient Border */}
              <div className="absolute inset-x-0 top-0 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Card Header */}
              <div className="p-3 sm:p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`relative h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${getGradientColor(name)} flex items-center justify-center text-base sm:text-lg font-bold text-white shadow-lg shrink-0`}>
                      {getInitials(name)}
                      {!isApproved && (
                        <div className="absolute -right-0.5 -top-0.5 sm:-right-1 sm:-top-1 h-2.5 w-2.5 sm:h-3 sm:w-3 animate-pulse rounded-full bg-amber-400 ring-1 sm:ring-2 ring-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">{name}</h3>
                      <p className="text-[10px] sm:text-xs text-slate-500 truncate">{email}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium shrink-0 ${getStatusBadge(user).className}`}>
                    <StatusBadge className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span className="hidden xs:inline">{getStatusBadge(user).text}</span>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="rounded-lg bg-slate-50/50 px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                      <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span>Role</span>
                    </div>
                    <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-700 truncate capitalize">
                      {role || <span className="text-slate-400 font-normal italic">No data</span>}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50/50 px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                      <Building className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span>Department</span>
                    </div>
                    <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-700 truncate">
                      {department || <span className="text-slate-400 font-normal italic">No data</span>}
                    </p>
                  </div>
                </div>

                {/* Team Lead Badge */}
                {assignedTL?.name ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Crown size={14} className="text-amber-600 shrink-0" />
                      <span className="font-semibold text-[11px] text-amber-800">Team Lead:</span>
                      <span className="font-bold text-[11px] truncate text-slate-800">{assignedTL.name}</span>
                    </div>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                      Assigned TL
                    </span>
                  </div>
                ) : isTeamLeadUser(user) ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2 p-2 rounded-lg bg-purple-50/70 border border-purple-200/80 text-xs text-purple-900">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Crown size={14} className="text-purple-600 shrink-0" />
                      <span className="font-bold text-[11px] text-purple-800">Team Leader</span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 shrink-0">
                      Lead Role
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 font-medium">
                    <AlertCircle size={13} className="shrink-0 text-slate-400" />
                    <span>No Team Lead (No data)</span>
                  </div>
                )}

                {/* Bank Details Badge if available */}
                {userBank && (
                  <div className="mt-1.5 flex items-center justify-between px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-[11px] text-emerald-800">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Landmark size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-medium truncate">{userBank.bankName || 'No data'}</span>
                    </div>
                    {userBank.accountNumber && (
                      <span className="font-mono text-[10px] text-emerald-700 shrink-0">
                        •••• {String(userBank.accountNumber).slice(-4)}
                      </span>
                    )}
                  </div>
                )}

                {/* Company & Branch Chip if assigned */}
                {(companyDisplay || branchDisplay || fyDisplay) ? (
                  <div className="mt-2 p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[11px] flex flex-col gap-1">
                    {companyDisplay && (
                      <div className="flex items-center gap-1.5 text-indigo-900 font-medium truncate">
                        <Building2 size={12} className="text-indigo-600 shrink-0" />
                        <span className="truncate">{companyDisplay}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-indigo-700 text-[10px]">
                      {branchDisplay && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate">{branchDisplay}</span>
                        </span>
                      )}
                      {fyDisplay && (
                        <span className="flex items-center gap-1 shrink-0 font-mono text-[9px] px-1.5 py-0.5 bg-white rounded border border-indigo-200">
                          {fyDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Expandable Details */}
                <div className="mt-2 sm:mt-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(userId)}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-50/50 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    <span className="text-[10px] sm:text-xs font-medium text-slate-500">
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 rounded-lg bg-slate-50/50 p-2 sm:p-3">
                      {/* Team Lead in details */}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                        <Crown className={`h-3 w-3 sm:h-4 sm:w-4 ${isTeamLeadUser(user) ? 'text-purple-600' : 'text-amber-500'} shrink-0`} />
                        <span className="text-slate-700 font-medium truncate">
                          {isTeamLeadUser(user) ? (
                            <>Role: <span className="font-bold text-purple-800">Team Leader (Lead Role)</span></>
                          ) : (
                            <>Team Lead: <span className="font-bold text-slate-900">{assignedTL?.name || 'No data'}</span></>
                          )}
                        </span>
                      </div>

                      {/* Bank Details in details */}
                      {userBank && (
                        <div className="flex items-start gap-1.5 sm:gap-2 text-[11px] sm:text-sm p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                          <Landmark className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 text-slate-700 text-[11px]">
                            <p className="font-semibold text-slate-900 truncate">{userBank.bankName || 'No data'} {userBank.bankBranch ? `(${userBank.bankBranch})` : ''}</p>
                            <p className="font-mono text-slate-600">
                              {userBank.accountNumber ? `A/C: ${userBank.accountNumber}` : ''}
                              {userBank.ifscCode ? ` • IFSC: ${userBank.ifscCode}` : ''}
                            </p>
                            {userBank.accountHolderName && <p className="text-[10px] text-slate-500">Holder: {userBank.accountHolderName}</p>}
                            {userBank.upiId && <p className="text-[10px] text-indigo-600 font-mono">UPI: {userBank.upiId}</p>}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-600 truncate">{phone || 'No data'}</span>
                      </div>
                      {user?.address && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">{user.address}</span>
                        </div>
                      )}
                      {user?.dob && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">DOB: {user.dob}</span>
                        </div>
                      )}
                      {user?.bloodGroup && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Droplet className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">Blood: {user.bloodGroup}</span>
                        </div>
                      )}
                      {user?.gender && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">Gender: {user.gender}</span>
                        </div>
                      )}
                      {user?.designation && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">Designation: {typeof user.designation === 'object' ? (user.designation?.name || user.designation?.designationName || 'No data') : (user.designation || 'No data')}</span>
                        </div>
                      )}
                      {user?.uniqueID && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Hash className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">ID: {user.uniqueID}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="text-[11px] text-indigo-600 hover:underline font-medium cursor-pointer"
                        >
                          View Full Profile Modal &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3 sm:mt-4 flex flex-col xs:flex-row gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveClick(user);
                    }}
                    className={`flex-1 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-medium transition-all duration-200 cursor-pointer ${isApproved
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:scale-[1.02] active:scale-[0.98] border border-blue-200/80'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                  >
                    {isApproved ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                        Change TL / Edit
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Approve...
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(user, isApproved ? 'revoke' : 'reject');
                    }}
                    disabled={isProcessingReject}
                    className={`flex-1 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-medium transition-all duration-200 cursor-pointer ${isProcessingReject
                      ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                      : isApproved
                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-rose-100 text-rose-700 hover:bg-rose-200 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                  >
                    {isProcessingReject ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        Processing...
                      </span>
                    ) : isApproved ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                        Revoke
                      </span>
                    ) : (
                      'Reject'
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
                    Approve Employee & Assign Team Lead
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign Team Lead (TL) & Organization Details
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
                          <span>1. Assign Team Lead (TL)</span>
                          <span className="text-rose-500 font-bold">*</span>
                          <span className="text-rose-600 font-semibold text-[10px] lowercase bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">required</span>
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
                        -- {loadingTeamLeads ? 'Loading Team Leads...' : teamLeads.length === 0 ? 'No Team Leads available' : 'Select Team Leader (Required) *'} --
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
                      <span>Team Leader must be assigned before approval</span>
                    </p>
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
                {(!selectedTeamLeadId || !selectedCompanyId || !selectedBranchId || !selectedFinancialYearId) ? (
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
                      (!isTeamLeadUser(approvingUser) && !selectedTeamLeadId) ||
                      !selectedCompanyId ||
                      !selectedBranchId ||
                      !selectedFinancialYearId
                    }
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      (!isTeamLeadUser(approvingUser) && !selectedTeamLeadId) || !selectedCompanyId || !selectedBranchId || !selectedFinancialYearId
                        ? 'Please fill in all required details to approve'
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
                        <span>Confirm & Approve</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200/80 bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300 mx-1 sm:mx-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient Header */}
            <div className={`bg-gradient-to-r ${getGradientColor(selectedUser?.name)} p-4 sm:p-6 relative`}>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full bg-white/20 p-1.5 sm:p-2 text-white transition hover:bg-white/30 cursor-pointer"
              >
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-gradient-to-br ${getGradientColor(selectedUser?.name)} flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-xl ring-2 sm:ring-4 ring-white/30`}>
                  {getInitials(selectedUser?.name || selectedUser?.fullName)}
                </div>
                <h2 className="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-white">
                  {selectedUser?.name || selectedUser?.fullName}
                </h2>
                <p className="text-xs sm:text-sm text-white/80 break-all">{selectedUser?.email}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
              {/* Assigned Team Lead */}
              {(() => {
                const suTL = getAssignedTeamLead(selectedUser);
                return (
                  <div>
                    <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                      <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500" />
                      Assigned Team Lead (TL)
                    </h3>
                    <div className="mt-2 sm:mt-3">
                      {suTL ? (
                        <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-amber-50/80 px-2 sm:px-3 py-2 border border-amber-200">
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
                        <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-purple-50/80 px-2 sm:px-3 py-2 border border-purple-200">
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
                  <div className="border-t border-slate-200 pt-3 sm:pt-4">
                    <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                      <Landmark className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-600" />
                      Bank Account Details
                    </h3>
                    <div className="mt-2 sm:mt-3">
                      {suBank ? (
                        <div className="space-y-2 rounded-lg bg-emerald-50/50 p-2.5 sm:p-3 border border-emerald-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Bank Name</span>
                            <span className="font-semibold text-slate-900">{suBank.bankName || <span className="text-slate-400 italic font-normal">No data</span>}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Account Number</span>
                            <span className="font-mono font-bold text-slate-900">{suBank.accountNumber || <span className="text-slate-400 italic font-normal">No data</span>}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">IFSC Code</span>
                            <span className="font-mono font-semibold text-indigo-700 uppercase">{suBank.ifscCode || <span className="text-slate-400 italic font-normal">No data</span>}</span>
                          </div>
                          {suBank.accountHolderName && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Account Holder</span>
                              <span className="font-medium text-slate-800">{suBank.accountHolderName}</span>
                            </div>
                          )}
                          {suBank.bankBranch && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Branch</span>
                              <span className="text-slate-700">{suBank.bankBranch}</span>
                            </div>
                          )}
                          {suBank.upiId && (
                            <div className="flex items-center justify-between text-xs">
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
              <div className="border-t border-slate-200 pt-3 sm:pt-4">
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Organization Assignment
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-indigo-50/70 px-2 sm:px-3 py-1.5 sm:py-2 border border-indigo-100">
                    <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-slate-400">Company</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {getCompanyName(selectedUser?.companyId, selectedUser) || <span className="text-slate-400 italic font-normal">No data</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-indigo-50/70 px-2 sm:px-3 py-1.5 sm:py-2 border border-indigo-100">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-slate-400">Branch</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {getBranchName(selectedUser?.branchId, selectedUser) || <span className="text-slate-400 italic font-normal">No data</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-indigo-50/70 px-2 sm:px-3 py-1.5 sm:py-2 border border-indigo-100">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-slate-400">Financial Year</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate font-mono">
                        {getFinancialYearName(selectedUser?.financialYearId, selectedUser) || <span className="text-slate-400 italic font-normal">No data</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div className="border-t border-slate-200 pt-3 sm:pt-4">
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Personal Information
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {[
                    { icon: Phone, label: 'Phone', value: selectedUser?.phoneNumber || selectedUser?.phone },
                    { icon: Calendar, label: 'Date of Birth', value: selectedUser?.dob },
                    { icon: User, label: 'Gender', value: selectedUser?.gender },
                    { icon: Droplet, label: 'Blood Group', value: selectedUser?.bloodGroup }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 px-2 sm:px-3 py-1.5 sm:py-2">
                      <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs text-slate-400">{item.label}</p>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">
                          {item.value || <span className="text-slate-400 italic font-normal">No data</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Professional Info */}
              <div className="border-t border-slate-200 pt-3 sm:pt-4">
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Professional Details
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
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
                    <div key={idx} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 px-2 sm:px-3 py-1.5 sm:py-2">
                      <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs text-slate-400">{item.label}</p>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">
                          {item.value || <span className="text-slate-400 italic font-normal">No data</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="border-t border-slate-200 pt-3 sm:pt-4">
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Address
                </h3>
                <div className="mt-2 sm:mt-3 rounded-lg bg-slate-50 p-2 sm:p-3 border border-slate-100">
                  <p className="text-xs sm:text-sm text-slate-700 break-words">
                    {selectedUser?.address || <span className="text-slate-400 italic font-normal">No data</span>}
                  </p>
                </div>
              </div>

              {/* Status & Quick Action */}
              <div className="border-t border-slate-200 pt-3 sm:pt-4 space-y-2">
                <div className={`rounded-lg p-2 sm:p-3 ${selectedUser?.isApproved
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
                  }`}>
                  <p className="text-xs sm:text-sm font-medium text-center">
                    Status: {selectedUser?.isApproved ? '✅ Approved' : '⏳ Pending Review'}
                  </p>
                </div>

                {selectedUser?.isApproved ? (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleApproveClick(u);
                    }}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <UserCheck size={16} />
                    <span>Change Team Lead / Edit Assignment</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleApproveClick(u);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ShieldCheck size={16} />
                    <span>Approve Employee Request</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRequests;