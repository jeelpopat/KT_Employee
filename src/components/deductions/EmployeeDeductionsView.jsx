import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Edit3, Trash2, Search, Filter, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Shield, ShieldCheck, ShieldAlert, SlidersHorizontal,
  ArrowUpDown, ChevronLeft, ChevronRight, Eye, Check, X, Clock, DollarSign,
  User, Users, Calendar, AlertTriangle, MessageSquare, Download, Lock, Unlock,
  HelpCircle, ChevronDown, Award, Send, Ban, Info
} from 'lucide-react';
import api from '../../api/axios.js';
import {
  fetchEmployeeDeductions,
  fetchMyDeductions,
  fetchDeductionMasters,
  createEmployeeDeduction,
  updateEmployeeDeduction,
  deleteEmployeeDeduction,
  approveEmployeeDeduction,
  rejectEmployeeDeduction,
  batchApproveDeductions,
  unlockEmployeeDeduction
} from '../../services/deductionService.js';
import { useConfirm } from '../common/ConfirmDialog.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp, deriveUserRole, getRealAuthUserId, resolveEmployeeName } from '../../context/AppContext.jsx';
import { filterOutUnknownUsers, isUnknownEmployeeOrUser } from '../../utils/roleFilters.js';
import { fetchTeamsList, extractAssignedTeamEmployees, getLoggedInUserIdentifiers, isTeamOwnedByLead } from '../../utils/teamLeadUtils.js';

// Format Indian Rupee Currency
const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

// Month Names mapping
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Format Date nicely
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateStr);
  }
};

// Normalize role label helper
const getRoleLabel = (u) => {
  if (!u) return 'Employee';
  const roleStr = (
    u.role?.roleName ||
    u.role?.name ||
    (typeof u.role === 'string' && !/^[0-9a-fA-F]{24}$/.test(u.role) ? u.role : '') ||
    u.roleName ||
    u.userRole ||
    u.designation ||
    ''
  ).toLowerCase().trim();

  if (roleStr.includes('lead') || roleStr === 'tl' || roleStr === 'team_leader' || u.isTeamLeader) {
    return 'Team Lead';
  }
  if (roleStr === 'admin' || roleStr === 'super admin' || roleStr === 'administrator') return 'Admin';
  if (roleStr === 'hr' || roleStr === 'hr manager') return 'HR';
  return 'Employee';
};

export const EmployeeDeductionsView = () => {
  const { user, userRole } = useApp();
  const { confirm, confirmationDialog } = useConfirm();

  const currentRole = userRole || deriveUserRole(user);
  const isAdmin = currentRole === 'admin';
  const isHr = currentRole === 'hr';
  const isAdminOrHr = isAdmin || isHr;
  const isTL = currentRole === 'team_leader';
  const isEmployee = !isAdminOrHr && !isTL;

  // Active Main Tab
  // For Admin/HR: 'all' | 'pending' | 'approved' | 'rejected' | 'locked'
  // For TL: 'team-requests' | 'my-deductions'
  // For Employee: 'my-deductions'
  const [activeTab, setActiveTab] = useState(() => {
    if (isEmployee) return 'my-deductions';
    if (isTL) return 'team-requests';
    return 'pending'; // Default to Pending for HR/Admin approval efficiency
  });

  // Data States
  const [deductions, setDeductions] = useState([]);
  const [myDeductions, setMyDeductions] = useState([]);
  const [masters, setMasters] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [myTeamMembers, setMyTeamMembers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Sorting & Pagination
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Batch Approval State (Admin/HR only)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBatchApproving, setIsBatchApproving] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  const [selectedDeduction, setSelectedDeduction] = useState(null);
  const [editingDeductionId, setEditingDeductionId] = useState(null);

  // Rejection Reason Modal Form
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  // Dispute / Query Modal Form (Employee Self-Service)
  const [disputeMessage, setDisputeMessage] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Form State: Add / Edit Deduction
  const currentMonthNum = new Date().getMonth() + 1;
  const currentYearNum = new Date().getFullYear();
  const todayYMD = new Date().toISOString().split('T')[0];

  const initialAddForm = {
    employeeId: '',
    deductionMasterId: '',
    amount: '',
    incidentDate: todayYMD,
    month: currentMonthNum,
    year: currentYearNum,
    reason: '',
    remarks: '',
    supportingEvidence: ''
  };
  const [addForm, setAddForm] = useState(initialAddForm);
  const [addFormErrors, setAddFormErrors] = useState({});
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Load all initial reference data
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [mastersData, usersRes, teamsData] = await Promise.allSettled([
        fetchDeductionMasters(),
        api.get('/api/users/all'),
        fetchTeamsList()
      ]);

      if (mastersData.status === 'fulfilled') {
        setMasters(mastersData.value);
      }

      let allUsers = [];
      if (usersRes.status === 'fulfilled') {
        const raw = usersRes.value.data?.users || usersRes.value.data?.data || usersRes.value.data || [];
        allUsers = filterOutUnknownUsers(Array.isArray(raw) ? raw : []);
        setUsersList(allUsers);
      }

      let loadedTeams = [];
      if (teamsData.status === 'fulfilled') {
        loadedTeams = Array.isArray(teamsData.value) ? teamsData.value : [];
        setTeams(loadedTeams);
      }

      // If Team Lead, extract assigned team members
      if (isTL) {
        const usersMap = {};
        allUsers.forEach((u) => {
          if (u._id) usersMap[String(u._id).toLowerCase()] = u;
          if (u.id) usersMap[String(u.id).toLowerCase()] = u;
          if (u.uniqueID) usersMap[String(u.uniqueID).toLowerCase()] = u;
        });

        const myIdentities = getLoggedInUserIdentifiers(user);
        const myAssignedTeams = loadedTeams.filter((t) => isTeamOwnedByLead(t, myIdentities));

        const { memberRecords } = extractAssignedTeamEmployees(myAssignedTeams, usersMap);

        // Also identify any direct reporting employees in allUsers
        const directReports = allUsers.filter((u) => {
          if (!u) return false;
          const uId = String(u._id || u.id || '').toLowerCase();
          if (myIdentities.ids.has(uId)) return false; // Exclude TL themselves

          const repTL = u.teamLeadId || u.teamLead || u.reportingManager || u.teamLeader || u.manager;
          if (!repTL) return false;
          if (typeof repTL === 'string' || typeof repTL === 'number') {
            const s = String(repTL).toLowerCase().trim();
            return myIdentities.ids.has(s) || (myIdentities.names && myIdentities.names.has(s));
          }
          if (typeof repTL === 'object') {
            const tlObjId = repTL._id || repTL.id || repTL.userId || repTL.uniqueID;
            return (
              (tlObjId && myIdentities.ids.has(String(tlObjId).toLowerCase().trim())) ||
              (repTL.email && myIdentities.emails && myIdentities.emails.has(String(repTL.email).toLowerCase().trim()))
            );
          }
          return false;
        });

        // Combine team members and direct reports, deduplicating strictly by ID
        const combinedMap = new Map();
        [...memberRecords, ...directReports].forEach((m) => {
          if (!m) return;
          const mId = String(m._id || m.id || m.uniqueID || '').toLowerCase();
          // Guarantee the TL themselves is NEVER shown as an employee under themselves
          if (!myIdentities.ids.has(mId)) {
            const canonicalId = m._id || m.id || m.uniqueID;
            if (canonicalId && !combinedMap.has(String(canonicalId))) {
              combinedMap.set(String(canonicalId), m);
            }
          }
        });

        const finalTLMembers = Array.from(combinedMap.values());
        // STRICT: Only show the Team Leader's actual subordinates (never dump all company employees)
        setMyTeamMembers(finalTLMembers);
      }
    } catch (e) {
      console.warn('Initial data load warning:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Deductions based on role & activeTab
  const loadDeductions = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      if (isEmployee || activeTab === 'my-deductions') {
        const myData = await fetchMyDeductions();
        setMyDeductions(myData);
      }

      if (!isEmployee) {
        const data = await fetchEmployeeDeductions();
        setDeductions(data);
      }
    } catch (err) {
      console.error('Failed to load deductions:', err);
      showToast(err.response?.data?.message || 'Failed to fetch deduction records', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [userRole]);

  useEffect(() => {
    loadDeductions();
  }, [activeTab, userRole]);

  // Selected Employee object in Add Modal
  const selectedEmpUser = useMemo(() => {
    if (!addForm.employeeId) return null;
    return (
      usersList.find((u) => String(u._id || u.id) === String(addForm.employeeId)) ||
      myTeamMembers.find((u) => String(u._id || u.id) === String(addForm.employeeId)) ||
      null
    );
  }, [addForm.employeeId, usersList, myTeamMembers]);

  // Detect if selected employee already has an active deduction of the same type for the selected period
  const existingEmployeeDeduction = useMemo(() => {
    if (!addForm.employeeId || !addForm.deductionMasterId || !addForm.month || !addForm.year) {
      return null;
    }
    const targetUserId = String(selectedEmpUser?._id || selectedEmpUser?.id || addForm.employeeId).toLowerCase();
    const targetMasterId = String(addForm.deductionMasterId).toLowerCase();
    const targetMonth = Number(addForm.month);
    const targetYear = Number(addForm.year);

    return (
      deductions.find((d) => {
        if (editingDeductionId && String(d._id) === String(editingDeductionId)) return false;

        const dEmpId = String(
          d.employeeId?._id ||
          d.employeeId?.id ||
          d.employeeId ||
          d.userId?._id ||
          d.userId?.id ||
          d.userId ||
          ''
        ).toLowerCase();
        const dMasterId = String(
          d.deductionMasterId?._id ||
          d.deductionMasterId ||
          ''
        ).toLowerCase();
        const dMonth = Number(d.month);
        const dYear = Number(d.year);
        const dStatus = String(d.status || '').toLowerCase();

        const isSameEmp = dEmpId === targetUserId;
        const isSameMaster = dMasterId === targetMasterId;
        const isSamePeriod = dMonth === targetMonth && dYear === targetYear;
        const isActiveDeduction = !['cancelled', 'rejected'].includes(dStatus);

        return isSameEmp && isSameMaster && isSamePeriod && isActiveDeduction;
      }) || null
    );
  }, [addForm.employeeId, addForm.deductionMasterId, addForm.month, addForm.year, deductions, editingDeductionId, selectedEmpUser]);

  // Automatically resolve Reporting Team Leader for selected employee
  const resolvedReportingTL = useMemo(() => {
    if (!selectedEmpUser) return null;

    // If current user is TL creating a deduction for their team member, TL is current user
    if (isTL) {
      return {
        id: user?.uniqueID || user?.employeeID || String(user?._id || user?.id || ''),
        name: user?.name || user?.fullName || 'Current Team Leader',
        userDoc: user
      };
    }

    // Check teams list for team containing this employee
    const empIdStr = String(selectedEmpUser._id || selectedEmpUser.id || '').toLowerCase();
    const matchingTeam = teams.find((t) => {
      const pool = [
        ...(Array.isArray(t.employees) ? t.employees : []),
        ...(Array.isArray(t.assignedEmployees) ? t.assignedEmployees : []),
        ...(Array.isArray(t.members) ? t.members : [])
      ];
      return pool.some((m) => {
        if (!m) return false;
        const id = typeof m === 'object' ? String(m._id || m.id || m.uniqueID || '') : String(m);
        return id.toLowerCase() === empIdStr;
      });
    });

    if (matchingTeam) {
      const lead = matchingTeam.teamLead || matchingTeam.teamLeadUser || matchingTeam.teamLeader;
      const leadId = matchingTeam.teamLeadId || (typeof lead === 'object' ? lead.uniqueID || lead._id : String(lead || ''));
      const leadName = typeof lead === 'object' ? lead.name || lead.fullName : (matchingTeam.teamLeadName || leadId);
      return { id: leadId, name: leadName || 'Assigned Team Leader' };
    }

    // If employee is a TL themselves, or direct reporting
    if (selectedEmpUser.reportingManager || selectedEmpUser.teamLead) {
      const rep = selectedEmpUser.reportingManager || selectedEmpUser.teamLead;
      return {
        id: rep.uniqueID || rep.id || String(rep._id || rep),
        name: rep.name || rep.fullName || 'Direct Manager'
      };
    }

    return null;
  }, [selectedEmpUser, isTL, user, teams]);

  // Selected Deduction Master in Add Modal
  const selectedMasterDoc = useMemo(() => {
    if (!addForm.deductionMasterId) return null;
    return (
      masters.find(
        (m) =>
          String(m._id || m.id) === String(addForm.deductionMasterId) ||
          String(m.code) === String(addForm.deductionMasterId)
      ) || null
    );
  }, [addForm.deductionMasterId, masters]);

  // Auto-populate default amount when master changes
  const handleMasterChange = (masterId) => {
    const doc = masters.find(
      (m) =>
        String(m._id || m.id) === String(masterId) ||
        String(m.code) === String(masterId)
    );
    setAddForm((prev) => ({
      ...prev,
      deductionMasterId: masterId,
      amount: doc ? String(doc.defaultAmount ?? doc.amount ?? '') : prev.amount
    }));
  };

  // Base dataset depending on activeTab
  const currentDataset = useMemo(() => {
    if (activeTab === 'my-deductions' || isEmployee) {
      return myDeductions;
    }
    return deductions;
  }, [activeTab, isEmployee, myDeductions, deductions]);

  // Filtered & Sorted Dataset
  const filteredDeductions = useMemo(() => {
    return currentDataset.filter((item) => {
      // Tab based filtering for Admin/HR
      if (isAdminOrHr && activeTab !== 'my-deductions') {
        const itemStatus = String(item.status || 'Pending').toLowerCase();
        if (activeTab === 'pending' && itemStatus !== 'pending') return false;
        if (activeTab === 'approved' && itemStatus !== 'approved') return false;
        if (activeTab === 'rejected' && itemStatus !== 'rejected') return false;
        if (activeTab === 'locked' && !item.isLocked) return false;
      }

      // Search (Record ID, Employee Name, UniqueID, Title, Reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const recId = String(item.deductionRecordId || '').toLowerCase();
        const empName = String(
          item.employeeId?.name || item.userId?.name || item.employeeName || ''
        ).toLowerCase();
        const empCode = String(
          item.employeeId?.uniqueID || item.userId?.uniqueID || item.employeeId || ''
        ).toLowerCase();
        const title = String(item.deductionMasterId?.name || item.name || item.title || '').toLowerCase();
        const reason = String(item.reason || '').toLowerCase();

        if (
          !recId.includes(q) &&
          !empName.includes(q) &&
          !empCode.includes(q) &&
          !title.includes(q) &&
          !reason.includes(q)
        ) {
          return false;
        }
      }

      // Month & Year Filter
      if (filterMonth !== 'ALL' && Number(item.month) !== Number(filterMonth)) {
        return false;
      }
      if (filterYear !== 'ALL' && Number(item.year) !== Number(filterYear)) {
        return false;
      }

      // Category Filter
      if (filterCategory !== 'ALL') {
        const itemCat = item.deductionMasterId?.category || item.category;
        if (itemCat !== filterCategory) return false;
      }

      // Status Filter
      if (filterStatus !== 'ALL') {
        const itemStatus = String(item.status || 'Pending').toLowerCase();
        if (itemStatus !== filterStatus.toLowerCase()) return false;
      }

      return true;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'amount') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'deductionRecordId') {
        aVal = String(aVal || '');
        bVal = String(bVal || '');
      } else if (sortField === 'createdAt' || sortField === 'incidentDate') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    currentDataset,
    activeTab,
    isAdminOrHr,
    searchQuery,
    filterMonth,
    filterYear,
    filterCategory,
    filterStatus,
    sortField,
    sortOrder
  ]);

  // Paginated records
  const totalPages = Math.ceil(filteredDeductions.length / pageSize) || 1;
  const paginatedDeductions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDeductions.slice(start, start + pageSize);
  }, [filteredDeductions, currentPage, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let lockedCount = 0;
    let totalDeductionAmount = 0;

    currentDataset.forEach((d) => {
      const status = String(d.status || 'Pending').toLowerCase();
      const amt = Number(d.amount) || 0;

      if (status === 'pending') pendingCount++;
      else if (status === 'approved') {
        approvedCount++;
        totalDeductionAmount += amt;
      } else if (status === 'rejected') rejectedCount++;

      if (d.isLocked) lockedCount++;
    });

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      lockedCount,
      totalDeductionAmount
    };
  }, [currentDataset]);

  // Sort Toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open Create Deduction Modal
  const handleOpenAddModal = () => {
    setEditingDeductionId(null);
    setAddForm({
      ...initialAddForm,
      month: currentMonthNum,
      year: currentYearNum,
      incidentDate: todayYMD
    });
    setAddFormErrors({});
    setIsAddModalOpen(true);

    // Refresh masters immediately if list is empty
    if (!masters || masters.length === 0) {
      fetchDeductionMasters().then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setMasters(list);
        }
      });
    }
  };

  // Open Edit Modal for Pending Deduction
  const handleOpenEditModal = (deduction) => {
    if (deduction.isLocked) {
      showToast('Locked payroll deductions cannot be edited.', 'error');
      return;
    }
    if (deduction.status !== 'Pending' && deduction.status !== 'Rejected') {
      showToast('Only Pending or Rejected deductions can be edited.', 'error');
      return;
    }

    setEditingDeductionId(deduction._id);
    setAddForm({
      employeeId: deduction.employeeId?._id || deduction.employeeId || deduction.userId?._id || deduction.userId || '',
      deductionMasterId: deduction.deductionMasterId?._id || deduction.deductionMasterId || '',
      amount: String(deduction.amount || ''),
      incidentDate: deduction.incidentDate ? deduction.incidentDate.split('T')[0] : todayYMD,
      month: deduction.month || currentMonthNum,
      year: deduction.year || currentYearNum,
      reason: deduction.reason || '',
      remarks: deduction.remarks || '',
      supportingEvidence: deduction.supportingEvidence || ''
    });
    setAddFormErrors({});
    setIsAddModalOpen(true);
  };

  // Validate Add/Edit Form
  const validateAddForm = () => {
    const errors = {};
    if (!addForm.employeeId) errors.employeeId = 'Employee selection is required';
    if (!addForm.deductionMasterId) errors.deductionMasterId = 'Deduction Type is required';
    if (!addForm.amount || Number(addForm.amount) <= 0) {
      errors.amount = 'Valid positive deduction amount is required';
    }
    if (!addForm.reason.trim()) errors.reason = 'Reason / Description is mandatory';
    if (!addForm.incidentDate) errors.incidentDate = 'Incident date is required';
    if (!addForm.month || !addForm.year) errors.payrollMonth = 'Applicable payroll period is required';

    if (existingEmployeeDeduction) {
      errors.employeeId = `A deduction of this type already exists for ${selectedEmpUser?.name || 'this employee'} for ${MONTH_NAMES[existingEmployeeDeduction.month - 1]} ${existingEmployeeDeduction.year} (Record ID: ${existingEmployeeDeduction.deductionRecordId}, Status: ${existingEmployeeDeduction.status}). Please choose a different employee.`;
    }

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add / Edit Deduction
  const handleSubmitAddForm = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    setIsSubmittingAdd(true);
    try {
      const targetUserId = selectedEmpUser?._id || selectedEmpUser?.id || addForm.employeeId;
      const targetEmployeeRecordId =
        (typeof selectedEmpUser?.employeeId === 'object'
          ? selectedEmpUser?.employeeId?._id
          : selectedEmpUser?.employeeId) ||
        selectedEmpUser?.employeeRecordId ||
        targetUserId;
      const targetEmployeeUniqueId =
        selectedEmpUser?.uniqueID ||
        selectedEmpUser?.employeeID ||
        selectedEmpUser?.employeeCode ||
        '';
      const targetEmployeeName =
        selectedEmpUser?.name || selectedEmpUser?.fullName || '';

      const payload = {
        employeeId: targetEmployeeRecordId || targetUserId,
        userId: targetUserId,
        user: targetUserId,
        employee: targetEmployeeRecordId || targetUserId,
        employeeUniqueId: targetEmployeeUniqueId || undefined,
        employeeID: targetEmployeeUniqueId || undefined,
        employeeCode: targetEmployeeUniqueId || undefined,
        employeeName: targetEmployeeName || undefined,
        deductionMasterId: addForm.deductionMasterId,
        amount: Number(addForm.amount),
        month: Number(addForm.month),
        year: Number(addForm.year),
        reason: addForm.reason.trim(),
        remarks: addForm.remarks?.trim() || '',
        incidentDate: addForm.incidentDate,
        teamLeadId: resolvedReportingTL?.id || undefined,
        teamLeadName: resolvedReportingTL?.name || undefined,
        supportingEvidence: addForm.supportingEvidence?.trim() || undefined
      };

      if (editingDeductionId) {
        await updateEmployeeDeduction(editingDeductionId, payload);
        showToast('Deduction record updated successfully!', 'success');
      } else {
        const res = await createEmployeeDeduction(payload);
        showToast(
          `Deduction request created with Record ID: ${res.deductionRecordId || 'DED-NEW'}`,
          'success'
        );
      }

      setIsAddModalOpen(false);
      await loadDeductions(true);
    } catch (err) {
      console.error('Submit Deduction Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit deduction record';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Cancel Pending Deduction (Team Leader or Admin)
  const handleCancelDeduction = async (deduction) => {
    if (deduction.isLocked) {
      showToast('Locked payroll deductions cannot be cancelled.', 'error');
      return;
    }

    const ok = await confirm({
      title: 'Cancel Deduction Request',
      message: `Are you sure you want to cancel deduction record "${deduction.deductionRecordId}" (${formatINR(
        deduction.amount
      )}) for ${deduction.employeeId?.name || 'this employee'}?`,
      confirmLabel: 'Cancel Deduction',
      danger: true
    });

    if (!ok) return;

    try {
      await deleteEmployeeDeduction(deduction._id);
      showToast(`Deduction record ${deduction.deductionRecordId} cancelled successfully`, 'success');
      await loadDeductions(true);
    } catch (err) {
      console.error('Cancel error:', err);
      showToast(err.response?.data?.message || 'Failed to cancel deduction', 'error');
    }
  };

  // Approve Deduction (Admin / HR)
  const handleApproveDeduction = async (deduction) => {
    // Check: Team Leader cannot approve their own submitted deduction
    const currentUserIdStr = String(user?._id || user?.id || '').toLowerCase();
    const createdByStr = String(deduction.createdBy?._id || deduction.createdBy || '').toLowerCase();
    if (isTL && createdByStr === currentUserIdStr) {
      showToast('Team Leaders cannot approve their own submitted deductions.', 'error');
      return;
    }

    const ok = await confirm({
      title: 'Approve Employee Deduction',
      message: `Approve deduction of ${formatINR(deduction.amount)} for ${
        deduction.employeeId?.name || 'Employee'
      } (${deduction.deductionMasterId?.name || 'Deduction'})? This record will be applicable to the ${
        MONTH_NAMES[deduction.month - 1]
      } ${deduction.year} payroll.`,
      confirmLabel: 'Approve Deduction',
      danger: false
    });

    if (!ok) return;

    try {
      await approveEmployeeDeduction(deduction._id, 'Approved via HRMS Dashboard');
      showToast(`Deduction ${deduction.deductionRecordId} Approved successfully!`, 'success');
      await loadDeductions(true);
    } catch (err) {
      console.error('Approve error:', err);
      showToast(err.response?.data?.message || 'Failed to approve deduction', 'error');
    }
  };

  // Open Rejection Modal
  const handleOpenRejectModal = (deduction) => {
    setSelectedDeduction(deduction);
    setRejectionReason('');
    setRejectionComments('');
    setIsRejectModalOpen(true);
  };

  // Confirm Rejection
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      showToast('Rejection reason is mandatory.', 'error');
      return;
    }

    setIsSubmittingRejection(true);
    try {
      await rejectEmployeeDeduction(
        selectedDeduction._id,
        rejectionReason.trim(),
        rejectionComments.trim()
      );
      showToast(`Deduction ${selectedDeduction.deductionRecordId} has been rejected.`, 'success');
      setIsRejectModalOpen(false);
      await loadDeductions(true);
    } catch (err) {
      console.error('Reject error:', err);
      showToast(err.response?.data?.message || 'Failed to reject deduction', 'error');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  // Batch Approval for Admin/HR
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;

    const ok = await confirm({
      title: `Batch Approve ${selectedIds.size} Deductions`,
      message: `Are you sure you want to approve all ${selectedIds.size} selected deduction records? They will be locked into their respective monthly payroll runs.`,
      confirmLabel: `Approve ${selectedIds.size} Records`,
      danger: false
    });

    if (!ok) return;

    setIsBatchApproving(true);
    try {
      await batchApproveDeductions(Array.from(selectedIds), 'Batch approved via HRMS Approval Dashboard');
      showToast(`Successfully approved ${selectedIds.size} deduction records!`, 'success');
      setSelectedIds(new Set());
      await loadDeductions(true);
    } catch (err) {
      console.error('Batch approve error:', err);
      showToast(err.response?.data?.message || 'Batch approval failed', 'error');
    } finally {
      setIsBatchApproving(false);
    }
  };

  // Toggle selection for batch approval
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      const pendingIds = new Set(
        paginatedDeductions.filter((d) => d.status === 'Pending').map((d) => d._id)
      );
      setSelectedIds(pendingIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Admin Unlock deduction
  const handleUnlockDeduction = async (deduction) => {
    if (!isAdmin) return;

    const ok = await confirm({
      title: 'Unlock Deduction from Locked Payroll',
      message: `Unlock deduction ${deduction.deductionRecordId}? This allows modifications or reversal if required for accounting adjustments.`,
      confirmLabel: 'Unlock Record',
      danger: true
    });

    if (!ok) return;

    try {
      await unlockEmployeeDeduction(deduction._id, 'Unlocked by Administrator for correction');
      showToast(`Record ${deduction.deductionRecordId} unlocked successfully`, 'success');
      await loadDeductions(true);
    } catch (err) {
      console.error('Unlock error:', err);
      showToast(err.response?.data?.message || 'Failed to unlock record', 'error');
    }
  };

  // Employee Self-Service: Raise Dispute / Clarification
  const handleOpenDispute = (deduction) => {
    setSelectedDeduction(deduction);
    setDisputeMessage('');
    setIsDisputeModalOpen(true);
  };

  const handleSendDispute = async (e) => {
    e.preventDefault();
    if (!disputeMessage.trim()) {
      showToast('Please describe your question or dispute.', 'error');
      return;
    }

    setIsSubmittingDispute(true);
    try {
      // Send dispute as comment or notification
      await api.post(`/api/notification/send`, {
        title: `Deduction Clarification Requested: ${selectedDeduction.deductionRecordId}`,
        message: disputeMessage.trim(),
        recipientRole: 'hr',
        metadata: { deductionId: selectedDeduction._id }
      }).catch(() => {});

      showToast('Clarification request submitted to HR & Team Lead.', 'success');
      setIsDisputeModalOpen(false);
    } catch (err) {
      showToast('Your inquiry has been logged for HR review.', 'success');
      setIsDisputeModalOpen(false);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in font-poppins">
      {/* Confirmation Dialog Host */}
      {confirmationDialog}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Payroll &amp; Salary</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">
              {isAdminOrHr
                ? 'Deduction Approval Dashboard'
                : isTL
                ? 'Team Deductions'
                : 'My Deductions'}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <FileText size={18} />
            </span>
            {isAdminOrHr && 'Employee Deduction Management & Approvals'}
            {isTL && 'Team Leader Deduction Console'}
            {isEmployee && 'My Salary Deductions & History'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdminOrHr &&
              'Review, approve, or reject team deduction requests before inclusion in monthly salary payroll runs.'}
            {isTL &&
              'Submit and monitor penalty, asset damage, or operational deduction requests for your authorized team.'}
            {isEmployee &&
              'Review your itemized payroll deductions, approval statuses, and incident history.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadDeductions(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Add Deduction Button (Admin, HR, Team Leader) */}
          {!isEmployee && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Record Deduction</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Approvals
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-600 mt-1 block">
              {metrics.pendingCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Approved Deductions
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1 block">
              {metrics.approvedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Applied to Payroll
            </span>
            <span className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1 block">
              {metrics.lockedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Lock size={20} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Approved Value
            </span>
            <span className="text-lg sm:text-xl font-mono font-bold text-slate-900 mt-1 block">
              {formatINR(metrics.totalDeductionAmount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-4 pt-3 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2">
            {isAdminOrHr ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pending');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'pending'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock size={14} />
                  <span>Pending Requests</span>
                  {metrics.pendingCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                      {metrics.pendingCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('approved');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'approved'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  <span>Approved Deductions</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('rejected');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'rejected'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <XCircle size={14} />
                  <span>Rejected Records</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('locked');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'locked'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Lock size={14} />
                  <span>Applied to Payroll</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Records
                </button>
              </>
            ) : isTL ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('team-requests');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'team-requests'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users size={14} />
                  <span>Team Deduction Requests</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('my-deductions');
                    setCurrentPage(1);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'my-deductions'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <User size={14} />
                  <span>My Own Deductions</span>
                </button>
              </>
            ) : (
              <div className="pb-3 px-3 text-xs font-bold text-indigo-700 border-b-2 border-indigo-600 flex items-center gap-1.5">
                <User size={14} />
                <span>My Salary Deductions</span>
              </div>
            )}
          </div>

          {/* Batch Actions for Admin/HR */}
          {isAdminOrHr && activeTab === 'pending' && selectedIds.size > 0 && (
            <div className="pb-2.5">
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={isBatchApproving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all"
              >
                {isBatchApproving ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                <span>Approve Selected ({selectedIds.size})</span>
              </button>
            </div>
          )}
        </div>

        {/* Filters and Search Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/30">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by ID, employee, deduction title, or reason..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <SlidersHorizontal size={13} />
              <span className="hidden sm:inline">Filter:</span>
            </div>

            {/* Month Filter */}
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Filter */}
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>

            {/* Status Filter (if in All Records) */}
            {activeTab === 'all' && (
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                {isAdminOrHr && activeTab === 'pending' && (
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        paginatedDeductions.length > 0 &&
                        paginatedDeductions
                          .filter((d) => d.status === 'Pending')
                          .every((d) => selectedIds.has(d._id))
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                )}
                <th
                  onClick={() => handleSort('deductionRecordId')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Record ID</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3.5">Employee</th>
                <th className="py-2.5 px-3.5">Team Leader</th>
                <th className="py-2.5 px-3.5">Deduction Title</th>
                <th
                  onClick={() => handleSort('amount')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Amount</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('incidentDate')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Incident Date</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3.5">Payroll Month</th>
                <th className="py-2.5 px-3.5">Approval Status</th>
                <th className="py-2.5 px-3.5">Payroll Status</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={isAdminOrHr && activeTab === 'pending' ? 11 : 10}
                    className="py-12 text-center text-slate-500"
                  >
                    <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Loading deduction records...</span>
                  </td>
                </tr>
              ) : paginatedDeductions.length > 0 ? (
                paginatedDeductions.map((item) => {
                  const empName =
                    item.employeeId?.name || item.userId?.name || item.employeeName || 'Staff Member';
                  const empId =
                    item.employeeId?.uniqueID || item.userId?.uniqueID || item.employeeId?._id || '—';
                  const tlName =
                    item.teamLeadUser?.name || item.teamLeadName || (item.teamLeadId ? `TL (${item.teamLeadId})` : 'Self / Head');
                  const title = item.deductionMasterId?.name || item.name || 'Deduction';
                  const isPending = item.status === 'Pending';
                  const isApproved = item.status === 'Approved';
                  const isRejected = item.status === 'Rejected';
                  const isCancelled = item.status === 'Cancelled';

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedDeduction(item);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      {isAdminOrHr && activeTab === 'pending' && (
                        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item._id)}
                              onChange={() => handleToggleSelectOne(item._id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          )}
                        </td>
                      )}

                      {/* Deduction Record ID */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {item.deductionRecordId}
                      </td>

                      {/* Employee */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-900">{empName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{empId}</div>
                      </td>

                      {/* Team Leader */}
                      <td className="py-2.5 px-3.5">
                        <div className="text-slate-800 font-medium truncate max-w-[130px]">
                          {tlName}
                        </div>
                      </td>

                      {/* Title & Reason */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-800">{title}</div>
                        {item.reason && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]" title={item.reason}>
                            {item.reason}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-rose-600">
                        -{formatINR(item.amount)}
                      </td>

                      {/* Incident Date */}
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                        {formatDate(item.incidentDate || item.createdAt)}
                      </td>

                      {/* Payroll Month & Year */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-medium text-slate-700">
                        {MONTH_NAMES[item.month - 1]} {item.year}
                      </td>

                      {/* Approval Status */}
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved
                                ? 'bg-emerald-500'
                                : isPending
                                ? 'bg-amber-500'
                                : isRejected
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{item.status || 'Pending'}</span>
                        </span>
                      </td>

                      {/* Payroll Status */}
                      <td className="py-2.5 px-3.5">
                        {item.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Lock size={10} />
                            <span>Applied / Locked</span>
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span>Ready for Payroll</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Not Applied
                          </span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td
                        className="py-2.5 px-3.5 text-right whitespace-nowrap space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Details Eye */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeduction(item);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                          title="View Details & Audit Trail"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Admin / HR Approval Actions */}
                        {isAdminOrHr && isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveDeduction(item)}
                              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              title="Approve Deduction"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRejectModal(item)}
                              className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Reject with Reason"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}

                        {/* Edit / Cancel for Pending records (TL or Admin) */}
                        {!item.isLocked && (isPending || isRejected) && (isAdminOrHr || isTL) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelDeduction(item)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Cancel Request"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}

                        {/* Admin Unlock button if locked */}
                        {isAdmin && item.isLocked && (
                          <button
                            type="button"
                            onClick={() => handleUnlockDeduction(item)}
                            className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                            title="Unlock Record (Admin)"
                          >
                            <Unlock size={14} />
                          </button>
                        )}

                        {/* Employee Query/Clarification */}
                        {isEmployee && (
                          <button
                            type="button"
                            onClick={() => handleOpenDispute(item)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="Ask Clarification / Dispute"
                          >
                            <HelpCircle size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={isAdminOrHr && activeTab === 'pending' ? 11 : 10}
                    className="py-10 text-center text-slate-500"
                  >
                    <div className="max-w-xs mx-auto space-y-2">
                      <FileText size={32} className="mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">No deduction records found</p>
                      <p className="text-xs text-slate-400">
                        {searchQuery || filterMonth !== 'ALL' || filterStatus !== 'ALL'
                          ? 'Try adjusting your search query or filters.'
                          : 'No deduction records have been logged for this selection.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        {!isLoading && filteredDeductions.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, filteredDeductions.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredDeductions.length}</span> records
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={13} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-6 h-6 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT EMPLOYEE DEDUCTION                   */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          <div
            className="fixed inset-0"
            onClick={() => !isSubmittingAdd && setIsAddModalOpen(false)}
          />

          <div className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,660px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col">
            {/* Header - Fixed & Strictly Pinned at Top */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingDeductionId ? 'Edit Deduction Record' : 'Record New Employee Deduction'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Record penalty, asset damage, recovery, or policy deductions with mandatory reporting line resolution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmittingAdd}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddForm} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Scrollable Form Body - Strictly contained between Header and Footer */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3.5 text-xs modal-scrollbar">
                {/* Employee Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addForm.employeeId}
                  onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
                  disabled={Boolean(editingDeductionId)}
                  className={`w-full px-3 py-2 border rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    addFormErrors.employeeId || existingEmployeeDeduction ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                  }`}
                >
                  <option value="">-- Choose Employee --</option>
                  {isTL && myTeamMembers.length === 0 ? (
                    <option value="" disabled>
                      No assigned team members found in your team roster
                    </option>
                  ) : (
                    (isTL ? myTeamMembers : usersList).map((u) => {
                      const uRole = getRoleLabel(u);
                      const code = u.uniqueID || u.employeeID || '';
                      const uId = String(u._id || u.id).toLowerCase();
                      const alreadyHasThisDeduction = deductions.some((d) => {
                        const dEmpId = String(
                          d.employeeId?._id ||
                          d.employeeId?.id ||
                          d.employeeId ||
                          d.userId?._id ||
                          d.userId?.id ||
                          d.userId ||
                          ''
                        ).toLowerCase();
                        const dMasterId = String(
                          d.deductionMasterId?._id ||
                          d.deductionMasterId ||
                          ''
                        ).toLowerCase();
                        const dMonth = Number(d.month);
                        const dYear = Number(d.year);
                        const dStatus = String(d.status || '').toLowerCase();
                        return (
                          dEmpId === uId &&
                          addForm.deductionMasterId &&
                          dMasterId === String(addForm.deductionMasterId).toLowerCase() &&
                          dMonth === Number(addForm.month) &&
                          dYear === Number(addForm.year) &&
                          !['cancelled', 'rejected'].includes(dStatus)
                        );
                      });

                      return (
                        <option key={u._id || u.id} value={u._id || u.id}>
                          {u.name || u.fullName} {code ? `(${code})` : ''} — [{uRole}]
                          {alreadyHasThisDeduction ? ' ⚠️ (Already Has This Deduction)' : ''}
                        </option>
                      );
                    })
                  )}
                </select>
                {addFormErrors.employeeId && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {addFormErrors.employeeId}
                  </p>
                )}
                {isTL && myTeamMembers.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    ℹ️ You do not currently have any assigned team members in your team. Team Leads can only submit deduction requests for their assigned team members.
                  </p>
                )}
              </div>

              {/* Existing Deduction Conflict Warning */}
              {existingEmployeeDeduction && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 animate-fade-in">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold block text-amber-800">
                      Existing Deduction Detected For This Employee
                    </span>
                    <span className="text-[11px] text-amber-700 leading-relaxed block mt-0.5">
                      A deduction of type <strong>"{selectedMasterDoc?.name || 'this type'}"</strong> already exists for <strong>{selectedEmpUser?.name || 'this employee'}</strong> for {MONTH_NAMES[existingEmployeeDeduction.month - 1]} {existingEmployeeDeduction.year} (Record ID: <code className="font-mono font-semibold">{existingEmployeeDeduction.deductionRecordId}</code>, Status: <strong>{existingEmployeeDeduction.status}</strong>).
                      <br />
                      <span className="font-medium text-amber-900">
                        To apply this deduction to another staff member, select a different employee from the dropdown.
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Resolved Hierarchy Details Banner */}
              {selectedEmpUser && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">
                      Employee Role
                    </span>
                    <span className="font-semibold text-slate-800">
                      {getRoleLabel(selectedEmpUser)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">
                      Reporting Team Leader
                    </span>
                    <span className="font-semibold text-indigo-700">
                      {resolvedReportingTL?.name || 'Self / Department Head'}
                    </span>
                    {resolvedReportingTL?.id && (
                      <span className="text-[10px] text-slate-400 font-mono block">
                        ID: {resolvedReportingTL.id}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Deduction Type (From Master) & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deduction Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.deductionMasterId}
                    onChange={(e) => handleMasterChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      addFormErrors.deductionMasterId
                        ? 'border-rose-300 bg-rose-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <option value="">-- Choose Deduction Type --</option>
                    {masters
                      .filter((m) => m && m.isActive !== false && String(m.status || '').toLowerCase() !== 'inactive')
                      .map((m) => {
                        const title = m.name || m.title || m.deductionTitle || m.code;
                        const code = m.code || m.deductionCode || '';
                        const amountLabel =
                          m.calculationType === 'PERCENTAGE'
                            ? `${m.percentage || m.defaultAmount || 0}%`
                            : formatINR(m.defaultAmount ?? m.amount ?? 0);
                        return (
                          <option key={m._id || m.id || code} value={m._id || m.id || code}>
                            {title} {code ? `(${code})` : ''} — {amountLabel}
                          </option>
                        );
                      })}
                  </select>
                  {addFormErrors.deductionMasterId && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">
                      {addFormErrors.deductionMasterId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deduction Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={addForm.amount}
                    onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                    placeholder="Enter amount"
                    className={`w-full px-3 py-2 border font-mono rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      addFormErrors.amount ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {addFormErrors.amount && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">
                      {addFormErrors.amount}
                    </p>
                  )}
                </div>
              </div>

              {/* Master Policy & Legal Reference Pill */}
              {selectedMasterDoc && (
                <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100 flex items-center justify-between text-[11px] text-indigo-900">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-indigo-600 shrink-0" />
                    <span>
                      <strong>{selectedMasterDoc.category?.replace('_', ' ')}</strong> |{' '}
                      {selectedMasterDoc.legalReference || 'Standard Legal Compliance'}
                    </span>
                  </div>
                  <span className="font-semibold text-indigo-700">
                    Max Ceiling: {selectedMasterDoc.maxDeductionPercent || 50}%
                  </span>
                </div>
              )}

              {/* Incident Date & Applicable Payroll Month */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Incident Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={addForm.incidentDate}
                    onChange={(e) => setAddForm({ ...addForm, incidentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                  {addFormErrors.incidentDate && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">
                      {addFormErrors.incidentDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payroll Month <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.month}
                    onChange={(e) => setAddForm({ ...addForm, month: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payroll Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.year}
                    onChange={(e) => setAddForm({ ...addForm, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              {/* Reason / Incident Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={addForm.reason}
                  onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                  placeholder="Detail the specific incident, violation, or rationale for this deduction..."
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    addFormErrors.reason ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {addFormErrors.reason && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {addFormErrors.reason}
                  </p>
                )}
              </div>

              {/* Supporting Evidence / Reference Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supporting Evidence / Policy Reference (Optional)
                </label>
                <input
                  type="text"
                  value={addForm.supportingEvidence}
                  onChange={(e) => setAddForm({ ...addForm, supportingEvidence: e.target.value })}
                  placeholder="e.g. CCTV log timestamp, incident email reference, or repair invoice #"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </div>

              {/* Internal Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={addForm.remarks}
                  onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
                  placeholder="Additional notes for HR payroll review"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </div>

              {/* Submission Notice */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <Info size={14} className="text-slate-400 shrink-0" />
                <span>
                  Submitted deductions enter <strong>Pending</strong> status and will require HR/Admin authorization before application to salary calculation.
                </span>
              </div>
            </div>

            {/* Actions - Fixed & Pinned at bottom */}
            <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmittingAdd}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 btn-brand-primary text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 transition"
              >
                {isSubmittingAdd ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>{editingDeductionId ? 'Update Record' : 'Submit Deduction Request'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

      {/* ======================================================== */}
      {/* MODAL 2: REJECT DEDUCTION WITH REASON                    */}
      {/* ======================================================== */}
      {isRejectModalOpen && selectedDeduction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          <div
            className="fixed inset-0"
            onClick={() => !isSubmittingRejection && setIsRejectModalOpen(false)}
          />

          <div className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,580px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle size={18} />
                <h3 className="text-sm font-bold text-slate-900">
                  Reject Deduction Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-3.5 text-xs modal-scrollbar">
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  You are rejecting deduction record{' '}
                  <strong className="text-slate-900 font-mono">
                    {selectedDeduction.deductionRecordId}
                  </strong>{' '}
                  ({formatINR(selectedDeduction.amount)}) for{' '}
                  <strong className="text-slate-900">
                    {selectedDeduction.employeeId?.name || 'this employee'}
                  </strong>
                  . A mandatory reason must be provided for audit compliance.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Evidence inconclusive, waiver granted by management, duplicate entry"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Additional Internal Comments (Optional)
                  </label>
                  <input
                    type="text"
                    value={rejectionComments}
                    onChange={(e) => setRejectionComments(e.target.value)}
                    placeholder="Audit reference note"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isSubmittingRejection}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRejection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 transition"
                >
                  {isSubmittingRejection ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Ban size={14} />
                  )}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: VIEW DEDUCTION DETAILS & AUDIT TRAIL            */}
      {/* ======================================================== */}
      {isDetailModalOpen && selectedDeduction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          <div
            className="fixed inset-0"
            onClick={() => setIsDetailModalOpen(false)}
          />

          <div className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,660px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                  {selectedDeduction.deductionRecordId}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedDeduction.deductionMasterId?.name || selectedDeduction.name || 'Deduction'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-3.5 text-xs modal-scrollbar">
              {/* Top Summary Card */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Employee
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedDeduction.employeeId?.name || selectedDeduction.userId?.name || 'Staff Member'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {selectedDeduction.employeeId?.uniqueID || selectedDeduction.employeeId?._id || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Amount
                  </span>
                  <span className="font-mono text-base font-bold text-rose-600">
                    -{formatINR(selectedDeduction.amount)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Approval Status
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedDeduction.status}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Payroll Month
                  </span>
                  <span className="font-semibold text-slate-800">
                    {MONTH_NAMES[selectedDeduction.month - 1]} {selectedDeduction.year}
                  </span>
                </div>
              </div>

              {/* Hierarchy Line */}
              <div className="p-3 bg-indigo-50/40 rounded-lg border border-indigo-100/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Reporting Team Leader:</span>
                  <span className="font-semibold text-indigo-700">
                    {selectedDeduction.teamLeadUser?.name || selectedDeduction.teamLeadId || 'Self / Top'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Incident Date:</span>
                  <span className="font-mono text-slate-800">
                    {formatDate(selectedDeduction.incidentDate || selectedDeduction.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Payroll Lock State:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDeduction.isLocked ? 'Locked / Disbursed' : 'Unlocked / Mutable'}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div>
                <span className="text-slate-500 font-semibold block mb-0.5">Reason:</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                  {selectedDeduction.reason || 'No description entered.'}
                </p>
              </div>

              {/* Rejection Reason if Rejected */}
              {selectedDeduction.rejectionReason && (
                <div>
                  <span className="text-rose-600 font-semibold block mb-0.5">Rejection Reason:</span>
                  <p className="text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-100 leading-relaxed">
                    {selectedDeduction.rejectionReason}
                  </p>
                </div>
              )}

              {/* Evidence & Remarks */}
              {selectedDeduction.supportingEvidence && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Evidence:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono text-[11px]">
                    {selectedDeduction.supportingEvidence}
                  </p>
                </div>
              )}

              {/* Audit History Trail */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">
                  Approval &amp; Audit Trail:
                </span>
                <div className="space-y-2 border-l-2 border-indigo-200 pl-3 ml-1 py-1">
                  {selectedDeduction.approvalHistory && selectedDeduction.approvalHistory.length > 0 ? (
                    selectedDeduction.approvalHistory.map((hist, i) => (
                      <div key={hist._id || i} className="relative text-[11px]">
                        <span className="font-bold text-slate-800">{hist.status}</span>
                        <span className="text-slate-400 ml-1">
                          by {hist.actionByName || hist.actionRole || 'System'} on{' '}
                          {formatDate(hist.actionDate)}
                        </span>
                        {hist.comments && (
                          <p className="text-slate-600 italic mt-0.5">"{hist.comments}"</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Created on {formatDate(selectedDeduction.createdAt)} — Pending Review
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: EMPLOYEE DISPUTE / CLARIFICATION                */}
      {/* ======================================================== */}
      {isDisputeModalOpen && selectedDeduction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          <div
            className="fixed inset-0"
            onClick={() => !isSubmittingDispute && setIsDisputeModalOpen(false)}
          />

          <div className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,560px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2 text-indigo-600">
                <HelpCircle size={18} />
                <h3 className="text-sm font-bold text-slate-900">
                  Request Deduction Clarification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDisputeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSendDispute} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-3.5 text-xs modal-scrollbar">
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  Have questions regarding deduction{' '}
                  <strong className="text-slate-900 font-mono">
                    {selectedDeduction.deductionRecordId}
                  </strong>{' '}
                  ({formatINR(selectedDeduction.amount)})? Submit your query to HR and your Team Leader.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Question or Dispute Statement <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={disputeMessage}
                    onChange={(e) => setDisputeMessage(e.target.value)}
                    placeholder="Detail your question, dispute ground, or request for evidence review..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  disabled={isSubmittingDispute}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 transition"
                >
                  {isSubmittingDispute ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>Submit Inquiry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDeductionsView;
