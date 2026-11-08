import api from '../api/axios.js';
import { BASE_URL } from '../api/config.js';
export { isHrRoleOrUser, isStrictEmployeeRole, filterOutHrUsers } from './roleFilters.js';

const TEAM_API_URL = `${BASE_URL}/api/teamLead/team`;

/**
 * Normalizes role string for comparison
 */
export const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, '');

/**
 * Normalizes status string (Approved, Rejected, Pending)
 */
export const normalizeStatus = (status) => {
  const value = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  if (value === 'approved' || value === 'approve' || value === 'accepted') {
    return 'Approved';
  }
  if (value === 'rejected' || value === 'reject' || value === 'denied') {
    return 'Rejected';
  }
  return 'Pending';
};

/**
 * Collects all identifiable keys (IDs, emails, names) for the currently logged-in user
 */
export const getLoggedInUserIdentifiers = (currentUser) => {
  let storedUser = null;
  try {
    const s =
      localStorage.getItem('auth_user') ||
      localStorage.getItem('user') ||
      localStorage.getItem('currentUser') ||
      localStorage.getItem('loggedInUser');
    if (s) storedUser = JSON.parse(s);
  } catch (e) {
    // Ignore JSON parse errors
  }

  let tokenPayload = null;
  try {
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token');
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        tokenPayload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
      }
    }
  } catch (e) {
    // Ignore token parse errors
  }

  const ids = new Set();
  const emails = new Set();
  const names = new Set();

  const addId = (id) => {
    if (!id) return;
    if (typeof id === 'object') {
      if (id._id) addId(id._id);
      if (id.id) addId(id.id);
      if (id.userId) addId(id.userId);
      if (id.employeeId) addId(id.employeeId);
      if (id.empId) addId(id.empId);
      return;
    }
    const s = String(id).trim().toLowerCase();
    if (s && s !== 'null' && s !== 'undefined') ids.add(s);
  };

  const addEmail = (email) => {
    if (typeof email === 'string' && email.trim() && email.includes('@')) {
      emails.add(email.trim().toLowerCase());
    }
  };

  const addName = (name) => {
    if (typeof name === 'string') {
      const cleaned = name.trim().toLowerCase();
      if (
        cleaned &&
        ![
          'employee',
          'team member',
          'user',
          'admin',
          'hr',
          'team lead',
          'team leader',
          'unknown',
          'unknown employee',
        ].includes(cleaned)
      ) {
        names.add(cleaned);
      }
    }
  };

  [currentUser, storedUser].forEach((u) => {
    if (!u) return;
    addId(u._id);
    addId(u.id);
    addId(u.userId);
    addId(u.employeeId);
    addId(u.empId);

    if (u.user) {
      addId(u.user._id);
      addId(u.user.id);
      addId(u.user.userId);
      addEmail(u.user.email);
      addName(u.user.name);
    }
    if (u.employee) {
      addId(u.employee._id);
      addId(u.employee.id);
      addId(u.employee.employeeId);
      addEmail(u.employee.email);
      addName(u.employee.name);
    }
    if (u.profile) {
      addId(u.profile._id);
      addId(u.profile.id);
      addId(u.profile.employeeId);
      addEmail(u.profile.email);
      addName(u.profile.name);
    }

    addEmail(u.email);
    addName(u.name);
    addName(u.fullName);
    if (u.firstName) {
      addName(`${u.firstName} ${u.lastName || ''}`);
    }
  });

  if (tokenPayload) {
    addId(tokenPayload._id);
    addId(tokenPayload.id);
    addId(tokenPayload.userId);
    addId(tokenPayload.employeeId);
    addId(tokenPayload.sub);
    addEmail(tokenPayload.email);
    addName(tokenPayload.name);
  }

  return { ids, emails, names };
};

/**
 * Fetches all teams from GET /api/teamLead/team
 */
export const fetchTeamsList = async () => {
  try {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token');

    let responseData = null;

    try {
      const res = await api.get('/api/teamLead/team');
      responseData = res.data;
    } catch (apiErr) {
      // Fallback direct fetch with authorization header
      if (token) {
        const directRes = await fetch(TEAM_API_URL, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        responseData = await directRes.json().catch(() => ({}));
      }
    }

    if (!responseData) return [];

    let teamsArray = [];
    if (Array.isArray(responseData)) {
      teamsArray = responseData;
    } else if (Array.isArray(responseData.data)) {
      teamsArray = responseData.data;
    } else if (Array.isArray(responseData.teamLeads)) {
      teamsArray = responseData.teamLeads;
    } else if (Array.isArray(responseData.teamLead)) {
      teamsArray = responseData.teamLead;
    } else if (Array.isArray(responseData.teams)) {
      teamsArray = responseData.teams;
    }

    return teamsArray;
  } catch (error) {
    console.warn('Error fetching teams from /api/teamLead/team:', error);
    return [];
  }
};

/**
 * Checks whether a given team document belongs to the currently logged in Team Lead
 * Matching against teamSchema:
 * - teamLeadId (String)
 * - teamLeadUser (ObjectId / Object ref User)
 * - teamLeadEmployee (ObjectId / Object ref Employee)
 */
export const isTeamOwnedByLead = (teamDoc, userIdent) => {
  if (!teamDoc || !userIdent) return false;
  const { ids, emails, names = new Set() } = userIdent;

  // 1. Check teamLeadId
  const tlId = teamDoc.teamLeadId || teamDoc.leadId;
  if (tlId && ids.has(String(tlId).toLowerCase().trim())) {
    return true;
  }

  // 2. Check teamLeadUser (ObjectId or populated User object)
  const tlUser = teamDoc.teamLeadUser || teamDoc.teamLead?.user;
  if (tlUser) {
    if (typeof tlUser === 'string' || typeof tlUser === 'number') {
      if (ids.has(String(tlUser).toLowerCase().trim())) return true;
    } else if (typeof tlUser === 'object') {
      if (tlUser._id && ids.has(String(tlUser._id).toLowerCase().trim())) return true;
      if (tlUser.id && ids.has(String(tlUser.id).toLowerCase().trim())) return true;
      if (tlUser.userId && ids.has(String(tlUser.userId).toLowerCase().trim())) return true;
      if (tlUser.email && emails.has(String(tlUser.email).toLowerCase().trim())) return true;
    }
  }

  // 3. Check teamLeadEmployee (ObjectId or populated Employee object)
  const tlEmployee = teamDoc.teamLeadEmployee || teamDoc.teamLead?.employee;
  if (tlEmployee) {
    if (typeof tlEmployee === 'string' || typeof tlEmployee === 'number') {
      if (ids.has(String(tlEmployee).toLowerCase().trim())) return true;
    } else if (typeof tlEmployee === 'object') {
      if (tlEmployee._id && ids.has(String(tlEmployee._id).toLowerCase().trim())) return true;
      if (tlEmployee.id && ids.has(String(tlEmployee.id).toLowerCase().trim())) return true;
      if (tlEmployee.employeeId && ids.has(String(tlEmployee.employeeId).toLowerCase().trim())) return true;
      if (tlEmployee.email && emails.has(String(tlEmployee.email).toLowerCase().trim())) return true;
    }
  }

  // 4. Check nested or string teamLead object (e.g. { teamLead: "6724..." } or { teamLead: { _id, email, ... } })
  const rawTL = teamDoc.teamLead || teamDoc.lead || teamDoc.leader || teamDoc.teamLeader || teamDoc.teamLeaderId;
  if (rawTL) {
    if (typeof rawTL === 'string' || typeof rawTL === 'number') {
      const s = String(rawTL).toLowerCase().trim();
      if (ids.has(s) || emails.has(s) || (names && names.has(s))) return true;
    } else if (typeof rawTL === 'object') {
      if (rawTL._id && ids.has(String(rawTL._id).toLowerCase().trim())) return true;
      if (rawTL.id && ids.has(String(rawTL.id).toLowerCase().trim())) return true;
      if (rawTL.userId && ids.has(String(rawTL.userId).toLowerCase().trim())) return true;
      if (rawTL.employeeId && ids.has(String(rawTL.employeeId).toLowerCase().trim())) return true;
      if (rawTL.email && emails.has(String(rawTL.email).toLowerCase().trim())) return true;
      const rawName = String(rawTL.name || rawTL.fullName || '').toLowerCase().trim();
      if (rawName && names && names.has(rawName)) return true;
    }
  }

  // 5. Check direct userId / employeeId / assignedTL / createdBy on teamDoc
  const directId = teamDoc.userId || teamDoc.employeeId || teamDoc.assignedTL || teamDoc.createdBy;
  if (directId && ids.has(String(directId).toLowerCase().trim())) {
    return true;
  }

  return false;
};

/**
 * Extracts assigned employee identifiers from team documents belonging to this Team Lead
 */
export const extractAssignedTeamEmployees = (myTeams, usersMap = {}) => {
  const memberIds = new Set();
  const memberEmails = new Set();
  const memberNames = new Set();
  const memberRecords = [];

  const addMemberItem = (item) => {
    if (!item) return;

    if (typeof item === 'string' || typeof item === 'number') {
      const s = String(item).toLowerCase().trim();
      if (s) {
        memberIds.add(s);
        // Enrich from usersMap if available
        const u = usersMap[s];
        if (u) {
          [
            u._id,
            u.id,
            u.userId,
            u.userID,
            u.employeeId,
            u.employeeID,
            u.empId,
            u.uniqueID,
            u.uniqueId,
            u.employeeCode,
            u.user?._id,
            u.user?.id,
            u.user?.userId,
            u.employee?._id,
            u.employee?.id,
            u.employee?.employeeId
          ].filter(Boolean).forEach((id) => memberIds.add(String(id).toLowerCase().trim()));

          [
            u.email,
            u.employeeEmail,
            u.user?.email,
            u.employee?.email
          ].filter(Boolean).forEach((email) => {
            memberEmails.add(String(email).toLowerCase().trim());
          });

          [
            u.name,
            u.fullName,
            u.displayName,
            `${u.firstName || ''} ${u.lastName || ''}`.trim(),
            u.user?.name,
            u.user?.fullName,
            u.employee?.name,
            u.employee?.fullName
          ].filter(Boolean).forEach((name) => {
            memberNames.add(String(name).toLowerCase().trim());
          });

          memberRecords.push(u);
        }
      }
      return;
    }

    if (typeof item === 'object') {
      [
        item._id,
        item.id,
        item.employeeId,
        item.employeeID,
        item.empId,
        item.userId,
        item.userID,
        item.uniqueID,
        item.uniqueId,
        item.employeeCode,
        item.user?._id,
        item.user?.id,
        item.employee?._id,
        item.employee?.id
      ].filter(Boolean).forEach((id) => memberIds.add(String(id).toLowerCase().trim()));

      [
        item.email,
        item.employeeEmail,
        item.user?.email,
        item.employee?.email
      ].filter(Boolean).forEach((email) => {
        memberEmails.add(String(email).toLowerCase().trim());
      });

      const rawName =
        item.name ||
        item.fullName ||
        item.displayName ||
        `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
        item.user?.name ||
        item.user?.fullName ||
        item.employee?.name ||
        item.employee?.fullName;
      if (rawName) memberNames.add(String(rawName).toLowerCase().trim());

      memberRecords.push(item);

      if (item.employee) addMemberItem(item.employee);
      if (item.user) addMemberItem(item.user);
    }
  };


  myTeams.forEach((team) => {
    const pool = [
      ...(Array.isArray(team.employees) ? team.employees : []),
      ...(Array.isArray(team.assignedEmployees) ? team.assignedEmployees : []),
      ...(Array.isArray(team.assignedMembers) ? team.assignedMembers : []),
      ...(Array.isArray(team.teamMembers) ? team.teamMembers : []),
      ...(Array.isArray(team.members) ? team.members : []),
      ...(Array.isArray(team.teamEmployees) ? team.teamEmployees : []),
      ...(Array.isArray(team.employeeIds) ? team.employeeIds : []),
      ...(Array.isArray(team.team?.employees) ? team.team.employees : []),
      ...(Array.isArray(team.team?.members) ? team.team.members : []),
      ...(Array.isArray(team.user?.employees) ? team.user.employees : []),
      ...(Array.isArray(team.teamLead?.employees) ? team.teamLead.employees : []),
    ];
    pool.forEach(addMemberItem);
  });

  return { memberIds, memberEmails, memberNames, memberRecords };
};

/**
 * Checks whether a leave request was submitted by an employee in this Team Lead's assigned team
 */
export const isLeaveOfAssignedTeam = (leave, teamScope, usersMap = {}) => {
  if (!leave || !teamScope) return false;
  const { memberIds, memberEmails, memberNames } = teamScope;

  // If team lead has no assigned team members, leave cannot match
  if (memberIds.size === 0 && memberEmails.size === 0 && memberNames.size === 0) {
    return false;
  }

  const leaveIds = new Set();
  const leaveEmails = new Set();
  const leaveNames = new Set();
  const identityKeys = [
    '_id', 'id', 'userId', 'userID', 'employeeId', 'employeeID',
    'empId', 'uniqueID', 'uniqueId', 'employeeCode',
  ];
  const entityKeys = [
    'employee', 'user', 'userId', 'employeeId', 'applicant', 'applicantId',
    'appliedBy', 'createdBy', 'profile',
  ];
  const ignoredNames = new Set([
    'employee', 'unknown', 'unknown employee', 'user', 'team member',
  ]);
  const addEntity = (entity, depth = 0) => {
    if (!entity) return;
    if (typeof entity !== 'object') {
      leaveIds.add(String(entity).toLowerCase().trim());
      return;
    }

    identityKeys.forEach((key) => {
      if (entity[key] && typeof entity[key] !== 'object') {
        leaveIds.add(String(entity[key]).toLowerCase().trim());
      }
    });
    [entity.email, entity.employeeEmail].filter(Boolean).forEach((email) => {
      leaveEmails.add(String(email).toLowerCase().trim());
    });

    const fullName = entity.name || entity.fullName || entity.displayName ||
      (entity.firstName ? `${entity.firstName} ${entity.lastName || ''}`.trim() : '');
    if (fullName) {
      const name = String(fullName).toLowerCase().trim();
      if (!ignoredNames.has(name)) leaveNames.add(name);
    }

    if (depth < 2) {
      entityKeys.forEach((key) => {
        if (entity[key] && entity[key] !== entity) addEntity(entity[key], depth + 1);
      });
    }
  };

  [
    leave.employeeId,
    leave.employeeID,
    leave.userID,
    leave.empId,
    leave.uniqueID,
    leave.uniqueId,
    leave.employeeCode,
    leave.employee,
    leave.user,
    leave.userId,
    leave.applicant,
    leave.applicantId,
    leave.applicantID,
    leave.appliedBy,
    leave.createdBy,
  ].forEach((entity) => addEntity(entity));
  [leave.email, leave.applicantEmail, leave.employeeEmail].filter(Boolean).forEach((email) => {
    leaveEmails.add(String(email).toLowerCase().trim());
  });
  [leave.name, leave.employeeName, leave.applicantName].filter(Boolean).forEach((name) => {
    const normalizedName = String(name).toLowerCase().trim();
    if (!ignoredNames.has(normalizedName)) leaveNames.add(normalizedName);
  });

  for (const id of leaveIds) {
    if (memberIds.has(id)) return true;
    const user = usersMap[id];
    if (user) {
      const userIds = identityKeys
        .map((key) => user[key])
        .filter((value) => value && typeof value !== 'object')
        .map((value) => String(value).toLowerCase().trim());
      if (userIds.some((userId) => memberIds.has(userId))) return true;

      const userEmails = [user.email, user.employeeEmail, user.user?.email, user.employee?.email]
        .filter(Boolean)
        .map((email) => String(email).toLowerCase().trim());
      if (userEmails.some((email) => memberEmails.has(email))) return true;
    }
  }

  for (const email of leaveEmails) {
    if (memberEmails.has(email)) return true;
  }

  for (const name of leaveNames) {
    if (memberNames.has(name)) return true;
  }

  return false;
};

/**
 * Checks whether a given project is assigned to the currently logged-in Team Lead
 */
export const isProjectAssignedToLead = (project, userIdent) => {
  if (!project || !userIdent) return false;
  const { ids, emails, names } = userIdent;

  const matchId = (val) => {
    if (!val) return false;
    const s = String(val).toLowerCase().trim();
    return s ? ids.has(s) : false;
  };
  const matchEmail = (val) => {
    if (!val) return false;
    const s = String(val).toLowerCase().trim();
    return s && s.includes('@') ? emails.has(s) : false;
  };
  const matchName = (val) => {
    if (!val) return false;
    const s = String(val).toLowerCase().trim();
    return s && !['not assigned', 'unknown', 'team lead', 'admin', 'user', 'employee'].includes(s)
      ? names.has(s)
      : false;
  };

  const matchEntity = (entity) => {
    if (!entity) return false;
    if (typeof entity === 'string' || typeof entity === 'number') {
      return matchId(entity);
    }
    if (typeof entity === 'object') {
      if (
        matchId(entity._id) ||
        matchId(entity.id) ||
        matchId(entity.userId) ||
        matchId(entity.userID) ||
        matchId(entity.employeeId) ||
        matchId(entity.employeeID) ||
        matchId(entity.empId)
      ) {
        return true;
      }
      if (matchEmail(entity.email)) return true;
      if (
        matchName(entity.name) ||
        matchName(entity.fullName) ||
        matchName(entity.employeeName) ||
        matchName(entity.userName)
      ) {
        return true;
      }
      if (entity.user && matchEntity(entity.user)) return true;
      if (entity.employee && matchEntity(entity.employee)) return true;
      if (entity.teamLead && matchEntity(entity.teamLead)) return true;
    }
    return false;
  };

  // 1. Check teamLeadUser or assignedTL
  if (matchEntity(project.teamLeadUser) || matchEntity(project.assignedTL)) return true;

  // 2. Check teamLeadEmployee
  if (matchEntity(project.teamLeadEmployee)) return true;

  // 3. Check direct teamLead or teamLeadId
  if (matchEntity(project.teamLead) || matchEntity(project.teamLeadId)) return true;

  // 4. Check project.teamLeadName
  if (project.teamLeadName && matchName(project.teamLeadName)) return true;

  // 5. Check project.members (if present)
  if (project.members && typeof project.members === 'object') {
    if (
      matchEntity(project.members.teamLeadUser) ||
      matchEntity(project.members.teamLeadEmployee) ||
        matchEntity(project.members.teamLead) ||
        matchEntity(project.members.assignedTL) ||
        matchEntity(project.members.lead) ||
        matchEntity(project.members.teamLeader)
      ) {
        return true;
      }
    }

    // 6. Check allAssigned if present (e.g. from ProjectView)
    if (Array.isArray(project.allAssigned)) {
    const leadMatch = project.allAssigned.some((m) => {
      if (!m || !m.isLead) return false;
      return matchId(m.id) || matchEmail(m.email) || matchName(m.name);
    });
    if (leadMatch) return true;
  }

  return false;
};

/**
 * Checks whether role or user corresponds to a Team Leader
 */
export const isTeamLeadRole = (role, user = null) => {
  const normalized = String(role || '').toLowerCase().trim();
  if (normalized === 'admin') return false;
  if (
    normalized === 'team_leader' ||
    normalized === 'team lead' ||
    normalized === 'team leader' ||
    normalized === 'tl' ||
    normalized === 'teamlead' ||
    normalized.includes('team lead') ||
    normalized.includes('team_leader')
  ) {
    return true;
  }
  if (user && (user.isTeamLead === true || user.isTeamLeader === true)) {
    return true;
  }
  return false;
};

/**
 * Checks whether role corresponds to Admin
 */
export const isAdminRole = (role, user = null) => {
  const normalized = String(role || '').toLowerCase().trim();
  return normalized === 'admin';
};

/**
 * Checks whether role corresponds to an Employee (requires an assigned TL)
 */
export const isEmployeeRole = (role, user = null) => {
  const normalized = String(role || '').toLowerCase().trim();
  if (normalized === 'admin' || normalized === 'hr') return false;
  if (isTeamLeadRole(role, user)) return false;
  return true;
};

/**
 * Fetches the assigned Team Lead for the currently authenticated employee
 * GET /api/auth/team-lead
 */
export const fetchEmployeeTeamLead = async () => {
  try {
    const res = await api.get('/api/auth/team-lead');
    const data = res.data?.data?.teamLead || res.data?.teamLead || (res.data?.success && res.data?.data) || null;
    if (data && typeof data === 'object') {
      const hasIdentity = Boolean(
        data.name ||
        data.userId ||
        data.employeeId ||
        data.email ||
        data._id ||
        data.id ||
        data.employeeID ||
        data.uniqueID
      );
      if (hasIdentity) return data;
    }
  } catch (err) {
    console.warn("Notice fetching employee team lead:", err.response?.data?.message || err.message);
  }

  // Fallback 1: Check localStorage kt_user_assigned_tl
  try {
    const userIdent = getLoggedInUserIdentifiers();
    const { ids, emails } = userIdent;
    const userTLMap = JSON.parse(localStorage.getItem('kt_user_assigned_tl') || '{}');
    for (const id of ids) {
      if (userTLMap[id] && userTLMap[id].name) return userTLMap[id];
    }
    for (const email of emails) {
      if (userTLMap[email] && userTLMap[email].name) return userTLMap[email];
    }
  } catch { }

  // Fallback 2: Check backend GET /api/teamLead/team
  try {
    const teams = await fetchTeamsList();
    const userIdent = getLoggedInUserIdentifiers();
    const { ids, emails } = userIdent;
    for (const team of teams) {
      const emps = Array.isArray(team.employees) ? team.employees : [];
      const matches = emps.some(e => {
        if (!e) return false;
        if (typeof e === 'string' || typeof e === 'number') {
          return ids.has(String(e).toLowerCase().trim());
        }
        if (typeof e === 'object') {
          const eId = String(e._id || e.id || e.userId || '').toLowerCase().trim();
          const eEmail = String(e.email || '').toLowerCase().trim();
          if (eId && ids.has(eId)) return true;
          if (eEmail && emails.has(eEmail)) return true;
        }
        return false;
      });
      if (matches) {
        const lead = team.teamLead || team.teamLeadUser || team.teamLeadEmployee || team.lead;
        if (lead && typeof lead === 'object') return lead;
        if (lead) return { _id: lead, name: team.teamLeadName || 'Team Lead' };
      }
    }
  } catch { }

  return null;
};
