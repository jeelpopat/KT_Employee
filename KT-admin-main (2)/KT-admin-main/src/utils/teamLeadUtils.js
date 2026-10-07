const TEAM_API_URL = 'https://kt-backend-yzr4.onrender.com/api/teamLead/team';

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
          'intern',
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
 * Fetches all teams from GET https://kt-backend-yzr4.onrender.com/api/teamLead/team
 */
export const fetchTeamsList = async () => {
  try {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token');

    if (!token) return [];

    const directRes = await fetch(TEAM_API_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await directRes.json().catch(() => ({}));
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
  const { ids, emails } = userIdent;

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

  // 4. Check nested teamLead object if present
  const rawTL = teamDoc.teamLead || teamDoc.lead;
  if (rawTL && typeof rawTL === 'object') {
    if (rawTL._id && ids.has(String(rawTL._id).toLowerCase().trim())) return true;
    if (rawTL.id && ids.has(String(rawTL.id).toLowerCase().trim())) return true;
    if (rawTL.userId && ids.has(String(rawTL.userId).toLowerCase().trim())) return true;
    if (rawTL.employeeId && ids.has(String(rawTL.employeeId).toLowerCase().trim())) return true;
    if (rawTL.email && emails.has(String(rawTL.email).toLowerCase().trim())) return true;
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
        const u = usersMap[s];
        if (u) {
          if (u.email) memberEmails.add(String(u.email).toLowerCase().trim());
          if (u.name) memberNames.add(String(u.name).toLowerCase().trim());
          if (u.fullName) memberNames.add(String(u.fullName).toLowerCase().trim());
          if (u.employeeId) memberIds.add(String(u.employeeId).toLowerCase().trim());
          memberRecords.push(u);
        }
      }
      return;
    }

    if (typeof item === 'object') {
      if (item._id) memberIds.add(String(item._id).toLowerCase().trim());
      if (item.id) memberIds.add(String(item.id).toLowerCase().trim());
      if (item.employeeId) memberIds.add(String(item.employeeId).toLowerCase().trim());
      if (item.empId) memberIds.add(String(item.empId).toLowerCase().trim());
      if (item.userId) memberIds.add(String(item.userId).toLowerCase().trim());

      if (item.email) memberEmails.add(String(item.email).toLowerCase().trim());

      const rawName =
        item.name ||
        item.fullName ||
        `${item.firstName || ''} ${item.lastName || ''}`.trim();
      if (rawName) memberNames.add(rawName.toLowerCase().trim());

      memberRecords.push(item);

      if (item.employee) addMemberItem(item.employee);
      if (item.user) addMemberItem(item.user);
    }
  };

  myTeams.forEach((team) => {
    const pool = [
      ...(Array.isArray(team.employees) ? team.employees : []),
      ...(Array.isArray(team.interns) ? team.interns : []),
      ...(Array.isArray(team.teamMembers) ? team.teamMembers : []),
      ...(Array.isArray(team.members) ? team.members : []),
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

  if (memberIds.size === 0 && memberEmails.size === 0 && memberNames.size === 0) {
    return false;
  }

  const rawEmp =
    leave.employeeId && typeof leave.employeeId === 'object'
      ? leave.employeeId
      : leave.employee || leave.user || leave.userId || {};

  const leaveIds = [
    typeof leave.employeeId === 'string' ? leave.employeeId : null,
    typeof leave.employee === 'string' ? leave.employee : null,
    typeof leave.user === 'string' ? leave.user : null,
    typeof leave.applicantId === 'string' ? leave.applicantId : null,
    typeof leave.applicantID === 'string' ? leave.applicantID : null,
    typeof leave.userId === 'string' ? leave.userId : null,
    typeof leave.appliedBy === 'string' ? leave.appliedBy : null,
    rawEmp?._id ? String(rawEmp._id) : null,
    rawEmp?.id ? String(rawEmp.id) : null,
    rawEmp?.employeeId ? String(rawEmp.employeeId) : null,
    rawEmp?.empId ? String(rawEmp.empId) : null,
    leave.id ? String(leave.id) : null,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  for (const id of leaveIds) {
    if (memberIds.has(id)) return true;
    const u = usersMap[id];
    if (u) {
      if (u._id && memberIds.has(String(u._id).toLowerCase().trim())) return true;
      if (u.id && memberIds.has(String(u.id).toLowerCase().trim())) return true;
      if (u.employeeId && memberIds.has(String(u.employeeId).toLowerCase().trim())) return true;
      if (u.email && memberEmails.has(String(u.email).toLowerCase().trim())) return true;
    }
  }

  const leaveEmails = [
    leave.email,
    leave.applicantEmail,
    leave.employeeEmail,
    rawEmp?.email,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  for (const email of leaveEmails) {
    if (memberEmails.has(email)) return true;
  }

  const leaveNames = [
    leave.name,
    leave.employeeName,
    leave.applicantName,
    rawEmp?.name,
    rawEmp?.fullName,
    rawEmp?.firstName ? `${rawEmp.firstName} ${rawEmp.lastName || ''}`.trim() : null,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim())
    .filter(
      (n) =>
        ![
          'employee',
          'unknown',
          'unknown employee',
          'user',
          'team member',
        ].includes(n)
    );

  for (const name of leaveNames) {
    if (memberNames.has(name)) return true;
  }

  return false;
};
