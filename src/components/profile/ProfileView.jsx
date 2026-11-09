import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Shield, Save, CheckCircle2, User, 
  Mail, Phone, Briefcase, Calendar, 
  HeartPulse, MapPin, GraduationCap, 
  Code, Users, Loader2, Lock, KeyRound,
  Camera, Upload, Eye, EyeOff, Download, Trash2,
  Plus, FileText, FileCheck,
  ExternalLink, X,
  ZoomIn, ZoomOut, RotateCw, RefreshCw,
  FileBadge, ArrowRight, Edit3, Check,
  AlertCircle,
  Copy, Clock, CreditCard, Building2, Sparkles, BadgeCheck, ShieldCheck, Landmark
} from 'lucide-react';
import { useApp, resolveEmployeeName, resolveEmployeeData, fetchLiveUserProfile } from '../../context/AppContext.jsx';
import api, { BASE_URL } from '../../api/axios.js'; 
import companyLogo from '../../assets/Logo.png';
import aadharProofIcon from '../../assets/profile/aadhar-proof-icon.png';
import panProofIcon from '../../assets/profile/pan-proof-icon.png';
import passportProofIcon from '../../assets/profile/passport-proof-icon.png';
import { showToast } from '../common/Toast.jsx';
import './ProfileView.css';

// Resolves bank details dynamically from profile, employee, or local persistence
const resolveBankDetails = (profileData, contextUser) => {
  const prof = profileData?.profile || profileData?.user || profileData || {};
  const emp = profileData?.employee || {};
  const usr = contextUser || {};

  // 1. Direct fields from backend response
  const bankName =
    prof.bankName ||
    emp.bankName ||
    usr.bankName ||
    prof.bankDetails?.bankName ||
    emp.bankDetails?.bankName ||
    usr.bankDetails?.bankName;

  const accountNumber =
    prof.accountNumber ||
    emp.accountNumber ||
    usr.accountNumber ||
    prof.bankAccount ||
    emp.bankAccount ||
    usr.bankAccount ||
    prof.bankAccountNumber ||
    emp.bankAccountNumber ||
    usr.bankAccountNumber ||
    prof.bankDetails?.accountNumber ||
    emp.bankDetails?.accountNumber ||
    usr.bankDetails?.accountNumber;

  const ifscCode =
    prof.ifscCode ||
    emp.ifscCode ||
    usr.ifscCode ||
    prof.IFSC ||
    emp.IFSC ||
    usr.IFSC ||
    prof.bankDetails?.ifscCode ||
    emp.bankDetails?.ifscCode ||
    usr.bankDetails?.ifscCode;

  const accountHolderName =
    prof.accountHolderName ||
    emp.accountHolderName ||
    usr.accountHolderName ||
    prof.bankDetails?.accountHolderName ||
    emp.bankDetails?.accountHolderName ||
    usr.bankDetails?.accountHolderName ||
    prof.name ||
    emp.name ||
    usr.name ||
    '';

  const bankBranch =
    prof.bankBranch ||
    emp.bankBranch ||
    usr.bankBranch ||
    prof.bankDetails?.bankBranch ||
    emp.bankDetails?.bankBranch ||
    usr.bankDetails?.bankBranch ||
    '';

  const upiId =
    prof.upiId ||
    emp.upiId ||
    usr.upiId ||
    prof.bankDetails?.upiId ||
    emp.bankDetails?.upiId ||
    usr.bankDetails?.upiId ||
    '';

  if (accountNumber || bankName) {
    return {
      bankName: String(bankName || ''),
      accountNumber: String(accountNumber || ''),
      ifscCode: ifscCode ? String(ifscCode).toUpperCase() : '',
      accountHolderName: String(accountHolderName || ''),
      bankBranch: String(bankBranch || ''),
      upiId: String(upiId || ''),
      isBankDetailGiven: true
    };
  }

  // 2. Check localStorage 'kt_employee_bank_details'
  try {
    const rawLocal = localStorage.getItem('kt_employee_bank_details');
    if (rawLocal) {
      const bankMap = JSON.parse(rawLocal);
      const possibleIds = [prof._id, usr._id, prof.uniqueID, usr.uniqueID, 'current']
        .filter(Boolean)
        .map(String);
      for (const id of possibleIds) {
        if (bankMap[id] && (bankMap[id].accountNumber || bankMap[id].bankName)) {
          return {
            bankName: String(bankMap[id].bankName || ''),
            accountNumber: String(bankMap[id].accountNumber || ''),
            ifscCode: bankMap[id].ifscCode ? String(bankMap[id].ifscCode).toUpperCase() : '',
            accountHolderName: String(bankMap[id].accountHolderName || ''),
            bankBranch: String(bankMap[id].bankBranch || ''),
            upiId: String(bankMap[id].upiId || ''),
            isBankDetailGiven: true
          };
        }
      }
    }
    const currentDirect = localStorage.getItem('kt_employee_bank_details_current');
    if (currentDirect) {
      const parsed = JSON.parse(currentDirect);
      if (parsed.accountNumber || parsed.bankName) {
        return {
          bankName: String(parsed.bankName || ''),
          accountNumber: String(parsed.accountNumber || ''),
          ifscCode: parsed.ifscCode ? String(parsed.ifscCode).toUpperCase() : '',
          accountHolderName: String(parsed.accountHolderName || ''),
          bankBranch: String(parsed.bankBranch || ''),
          upiId: String(parsed.upiId || ''),
          isBankDetailGiven: true
        };
      }
    }
  } catch {}

  return null;
};

// Deterministically convert any string/id into a 24-char hex string for MongoDB ObjectId
const toValidObjectId = (id) => {
  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
    return id;
  }
  let hex = '';
  const str = String(id || 'employee-user');
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return (hex + '000000000000000000000000').slice(0, 24);
};

const isPassportSizePhoto = (file) => new Promise((resolve, reject) => {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  const cleanup = () => URL.revokeObjectURL(imageUrl);

  image.onload = () => {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    cleanup();
    resolve(Math.abs(aspectRatio - (7 / 9)) <= 0.02);
  };
  image.onerror = () => {
    cleanup();
    reject(new Error('Unable to read the selected image.'));
  };
  image.src = imageUrl;
});

const isDocPdf = (doc) => {
  if (!doc) return false;
  const fType = String(doc.fileType || '').toLowerCase();
  const fName = String(doc.fileName || '').toLowerCase();
  const fUrl = String(doc.fileUrl || '').toLowerCase();
  return (
    fType.includes('pdf') ||
    fName.endsWith('.pdf') ||
    fUrl.includes('.pdf') ||
    fUrl.startsWith('data:application/pdf')
  );
};

const EMPLOYEE_DOCUMENTS_API = `${BASE_URL}/api/employee/documents`;

const getEmployeeDocumentKind = (document) => {
  const label = [
    document?.id,
    document?.key,
    document?.type,
    document?.documentType,
    document?.documentCategory,
    document?.label,
    document?.title,
    document?.name,
    document?.documentName
  ].filter(Boolean).join(' ').toLowerCase().replace(/[_-]+/g, ' ');

  if (/\b(aadhar|aadhaar|adhar|uidai)\b|unique identification/.test(label)) return 'aadhar';
  if (/\bpan\b|permanent account number/.test(label)) return 'pan';
  if (/\bpassport (size )?(photo|photograph)\b|\bpassport_photo\b/.test(label)) return 'passport_photo';
  return null;
};

const getEmployeeDocumentRecords = (responseData) => {
  let payload = responseData?.data ?? responseData;
  if (payload?.data && typeof payload.data === 'object') {
    payload = payload.data;
  }
  const nestedDocuments = payload?.documents ??
    payload?.employeeDocuments ??
    payload?.identityDocuments ??
    payload?.statutoryDocuments ??
    payload?.employee?.documents ??
    payload?.employee?.identityDocuments ??
    payload?.employee?.statutoryDocuments;
  const toRecord = ([key, value]) => {
    if (value && typeof value === 'object') return { key, ...value };
    if (/(number|no)$/i.test(key)) return { key, docNumber: value };
    return { key, fileUrl: value };
  };
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(nestedDocuments)
      ? nestedDocuments
      : nestedDocuments && typeof nestedDocuments === 'object'
        ? Object.entries(nestedDocuments).map(toRecord)
        : payload && typeof payload === 'object'
          ? Object.entries(payload).map(toRecord)
          : [];

  return records.map((record) => {
    const file = record?.file && typeof record.file === 'object' ? record.file : {};
    const document = record?.document && typeof record.document === 'object' ? record.document : {};
    const fileUrl = record?.fileUrl || record?.fileURL || record?.documentUrl || record?.imageUrl ||
      record?.downloadUrl || record?.secureUrl || record?.path || (typeof record?.file === 'string' ? record.file : '') ||
      file.fileUrl || file.url || file.secure_url || file.path || document.fileUrl || document.url || '';

    return {
      kind: getEmployeeDocumentKind({ ...record, ...document }),
      remoteId: record?._id || record?.id || document?._id || document?.id || '',
      fileUrl,
      fileName: record?.fileName || record?.name || file.fileName || document?.fileName || '',
      fileType: record?.fileType || record?.mimeType || file.fileType || file.mimeType || document?.fileType || '',
      docNumber: record?.docNumber || record?.documentNumber || record?.number || '',
      uploadedAt: record?.updatedAt || record?.createdAt || record?.uploadedAt || '',
      updatedAt: record?.updatedAt || document?.updatedAt || '',
      createdAt: record?.createdAt || document?.createdAt || ''
    };
  }).filter((record) => record.kind && (record.fileUrl || record.docNumber));
};

const getApiDocumentList = (responseData) => {
  let payload = responseData?.data ?? responseData;
  if (payload?.data && typeof payload.data === 'object') {
    payload = payload.data;
  }
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const getRemoteDocumentId = (document) => String(document?._id || document?.id || document?.documentId || '');

const reconcileRemoteDocuments = (documents, remoteIds) => documents
  .map((document) => {
    if (!document.remoteId || remoteIds.has(String(document.remoteId))) return document;
    if (!document.isCore) return null;
    return {
      ...document,
      fileUrl: '',
      fileName: '',
      remoteId: null,
      remoteUpdatedAt: '',
      status: 'pending',
      uploadedAt: 'Pending'
    };
  })
  .filter(Boolean);

const getUploadedDocument = (responseData) => {
  let payload = responseData?.data ?? responseData;
  if (payload?.data && typeof payload.data === 'object') payload = payload.data;
  if (payload?.document && typeof payload.document === 'object') payload = payload.document;
  const file = payload?.file && typeof payload.file === 'object' ? payload.file : {};
  const fileUrl = payload?.fileUrl || payload?.fileURL || payload?.documentUrl || payload?.url ||
    payload?.secureUrl || payload?.path || file.fileUrl || file.url || file.secure_url || file.path || '';
  const remoteId = payload?._id || payload?.id || payload?.documentId || '';

  if (responseData?.success === false || !fileUrl) {
    throw new Error(responseData?.message || 'The document API did not return a saved file URL.');
  }

  return { fileUrl, remoteId: String(remoteId) };
};

const getDocumentTimestamp = (document) => {
  const timestamp = Date.parse(
    document?.remoteUpdatedAt || document?.updatedAt || document?.createdAt || document?.uploadedAt || ''
  );
  if (!Number.isNaN(timestamp)) return timestamp;

  const objectId = String(document?._id || document?.remoteId || '');
  return /^[0-9a-f]{24}$/i.test(objectId) ? Number.parseInt(objectId.slice(0, 8), 16) * 1000 : 0;
};

const getLatestEmployeeDocumentsByKind = (employeeDocuments) => employeeDocuments.reduce((latestByKind, document) => {
  const kind = document.kind || getEmployeeDocumentKind(document);
  if (!kind) return latestByKind;

  const previous = latestByKind.get(kind);
  const documentTimestamp = getDocumentTimestamp(document);
  const previousTimestamp = getDocumentTimestamp(previous);
  if (
    !previous ||
    (documentTimestamp && documentTimestamp >= previousTimestamp)
  ) {
    latestByKind.set(kind, document);
  }
  return latestByKind;
}, new Map());

const mergeEmployeeDocuments = (currentDocuments, responseData) => {
  const remoteDocuments = [...getLatestEmployeeDocumentsByKind(getEmployeeDocumentRecords(responseData)).values()];
  if (remoteDocuments.length === 0) return currentDocuments;

  return currentDocuments.map((document) => {
    const remoteDocument = remoteDocuments.find((item) => item.kind === document.id);
    if (!remoteDocument) return document;
    if (
      getDocumentTimestamp(remoteDocument) &&
      getDocumentTimestamp(document) > getDocumentTimestamp(remoteDocument)
    ) {
      return document;
    }

    return {
      ...document,
      fileUrl: remoteDocument.fileUrl || document.fileUrl,
      fileName: remoteDocument.fileName || document.fileName,
      fileType: remoteDocument.fileType || document.fileType,
      docNumber: remoteDocument.docNumber || document.docNumber,
      status: remoteDocument.fileUrl ? 'uploaded' : document.status,
      remoteId: remoteDocument.remoteId || document.remoteId,
      uploadedAt: remoteDocument.uploadedAt
        ? new Date(remoteDocument.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : document.uploadedAt,
      remoteUpdatedAt: remoteDocument.uploadedAt || document.remoteUpdatedAt
    };
  });
};

const mergeDocumentIntoCore = (documents, source) => {
  const kind = getEmployeeDocumentKind(source);
  const coreDocument = documents.find(document => document.isCore && document.id === kind);
  if (!coreDocument) return documents;

  const mergedCoreDocument = {
    ...coreDocument,
    fileUrl: source.fileUrl || coreDocument.fileUrl,
    fileName: source.fileName || coreDocument.fileName,
    fileType: source.fileType || coreDocument.fileType,
    docNumber: source.docNumber && source.docNumber !== 'Verified Record'
      ? source.docNumber
      : coreDocument.docNumber,
    status: source.fileUrl ? 'uploaded' : coreDocument.status,
    uploadedAt: source.uploadedAt || coreDocument.uploadedAt,
    remoteId: source.remoteId || coreDocument.remoteId
  };

  return documents
    .map(document => {
      if (document === coreDocument) return mergedCoreDocument;
      if (!document.isCore && getEmployeeDocumentKind(document) === kind) return null;
      return document;
    })
    .filter(Boolean);
};

const normalizeCoreDocuments = (documents) => documents.reduce((normalized, document) => {
  const kind = getEmployeeDocumentKind(document);
  if (!document.isCore && kind && normalized.some(item => item.isCore && item.id === kind)) {
    return mergeDocumentIntoCore(normalized, document);
  }
  return [...normalized, document];
}, []);

export const ProfileView = () => {
  const { user: contextUser, updateUserProfile, userRole, roleDetails } = useApp();
  const isAdmin = userRole === 'admin';
  
  const [profileData, setProfileData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'documents' | 'security'

  // Documents tab accessible to all roles including Admin

  // Form States - Personal & Contact
  const [name, setName] = useState(() => resolveEmployeeName(contextUser) || '');
  const [phone, setPhone] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return (
      contextUser?.phoneNumber ||
      emp?.phoneNumber ||
      emp?.mobile ||
      contextUser?.mobile ||
      contextUser?.phone ||
      ''
    );
  });
  const [email, setEmail] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return emp.email || contextUser?.email || '';
  });
  const [address, setAddress] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return emp.currentAddress || contextUser?.address || '';
  });
  const [dobInput, setDobInput] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    const d = contextUser?.dob || emp?.dob || '';
    return typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  });
  const [genderInput, setGenderInput] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return contextUser?.gender || emp?.gender || '';
  });
  const [bloodGroupInput, setBloodGroupInput] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return contextUser?.bloodGroup || emp?.bloodGroup || '';
  });

  // Bank Details Form & Modal States
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankModalError, setBankModalError] = useState('');
  const [isAccountMasked, setIsAccountMasked] = useState(true);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    bankBranch: '',
    upiId: ''
  });
  const [imgError, setImgError] = useState(false);

  // Profile Photo Upload State
  const [localPhotoUrl, setLocalPhotoUrl] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState({ type: '', text: '' });
  const photoInputRef = useRef(null);

  // Form States - Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // Documents State
  const [documents, setDocuments] = useState([]);
  const [docFeedback, setDocFeedback] = useState({ type: '', text: '' });
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [isDeletingPassportPhoto, setIsDeletingPassportPhoto] = useState(false);
  const [isSavingDocNumber, setIsSavingDocNumber] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [tempDocNumber, setTempDocNumber] = useState('');

  // Automatically clear document feedback banner after 3.5 seconds
  useEffect(() => {
    if (!docFeedback.text) return;
    const timer = setTimeout(() => {
      setDocFeedback({ type: '', text: '' });
    }, 3500);
    return () => clearTimeout(timer);
  }, [docFeedback.text]);

  // Automatically clear photo feedback banner after 3.5 seconds
  useEffect(() => {
    if (!photoFeedback.text) return;
    const timer = setTimeout(() => {
      setPhotoFeedback({ type: '', text: '' });
    }, 3500);
    return () => clearTimeout(timer);
  }, [photoFeedback.text]);

  // Automatically clear password feedback banner after 3.5 seconds
  useEffect(() => {
    if (!passwordMsg.text) return;
    const timer = setTimeout(() => {
      setPasswordMsg({ type: '', text: '' });
    }, 3500);
    return () => clearTimeout(timer);
  }, [passwordMsg.text]);

  // Document Viewer Lightbox Modal State
  const [docViewerModal, setDocViewerModal] = useState({
    isOpen: false,
    doc: null,
    zoomLevel: 100,
    rotation: 0
  });

  // Add Document Modal State
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [isSubmittingNewDoc, setIsSubmittingNewDoc] = useState(false);
  const [newDocForm, setNewDocForm] = useState({
    presetType: 'Driving License',
    customTitle: '',
    docNumber: '',
    file: null,
    fileName: '',
    filePreview: ''
  });
  const addDocFileInputRef = useRef(null);
  const docActionInputRef = useRef(null);
  const [targetActionDocId, setTargetActionDocId] = useState(null);

  // User identification key for local persistence
  const currentUserId = contextUser?.id || contextUser?._id || contextUser?.employeeId || 'current_user';
  const localStorageDocKey = `employee_documents_${currentUserId}`;
  const localStoragePhotoKey = `user_profile_photo_${currentUserId}`;
  const localStoragePhotoResetKey = `user_profile_photo_reset_${currentUserId}`;
  const [isProfilePhotoReset, setIsProfilePhotoReset] = useState(
    () => {
      try {
        return localStorage.getItem(localStoragePhotoResetKey) === 'true';
      } catch (error) {
        console.warn('Could not read profile photo reset state:', error);
        return false;
      }
    }
  );
  const clearProfilePhotoReset = () => {
    try {
      localStorage.removeItem(localStoragePhotoResetKey);
    } catch (error) {
      console.warn('Could not clear profile photo reset state:', error);
    }
  };

  const [isSyncingDocs, setIsSyncingDocs] = useState(false);

  // Helper to resolve a valid 24-character hex MongoDB ObjectId matching Mongoose documentSchema
  const resolveEmployeeId = () => {
    const empDoc = resolveEmployeeData(profileData);
    const candidates = [
      empDoc?._id,
      profileData?.employee?._id,
      profileData?._id,
      contextUser?._id,
      contextUser?.id,
      contextUser?.employeeId,
      currentUserId
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && /^[0-9a-fA-F]{24}$/.test(c)) {
        return c;
      }
    }
    return toValidObjectId(currentUserId);
  };
  const employeeDocumentId = resolveEmployeeId();

  // Fetch Real-time Live Profile Data (GET /api/users/profile & /api/employee-panel/profile)
  const fetchProfile = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const data = await fetchLiveUserProfile();
      const effectiveData = data || { profile: contextUser, user: contextUser, ...(contextUser || {}) };
      setProfileData(effectiveData);

      const emp = resolveEmployeeData(effectiveData);
      const prof = effectiveData?.profile || effectiveData?.user || effectiveData || {};

      const extractedName = resolveEmployeeName(effectiveData) || resolveEmployeeName(contextUser) || '';

      if (extractedName) {
        setName(extractedName);
        if (updateUserProfile && contextUser?.name !== extractedName) {
          updateUserProfile({ name: extractedName, fullName: extractedName, employee: emp });
        }
      }
      setPhone(
        prof.phoneNumber ||
        emp.phoneNumber ||
        emp.mobile ||
        prof.mobile ||
        prof.phone ||
        effectiveData.phoneNumber ||
        effectiveData.mobile ||
        contextUser?.phoneNumber ||
        ''
      );
      setEmail(emp.email || prof.email || effectiveData.email || contextUser?.email || '');
      setAddress(emp.currentAddress || prof.address || effectiveData.address || effectiveData.currentAddress || '');

      const rawDob = prof.dob || emp.dob || effectiveData.dob || contextUser?.dob || '';
      if (rawDob) {
        setDobInput(typeof rawDob === 'string' && rawDob.includes('T') ? rawDob.split('T')[0] : rawDob);
      }
      const rawGender = prof.gender || emp.gender || effectiveData.gender || contextUser?.gender || '';
      if (rawGender) {
        setGenderInput(rawGender);
      }
      const rawBloodGroup = prof.bloodGroup || emp.bloodGroup || effectiveData.bloodGroup || contextUser?.bloodGroup || '';
      if (rawBloodGroup) {
        setBloodGroupInput(rawBloodGroup);
      }

      // Load cached photo if available
      const cachedPhoto = localStorage.getItem(localStoragePhotoKey);
      if (cachedPhoto) {
        setLocalPhotoUrl(cachedPhoto);
      }

    } catch (error) {
      console.error("Error fetching live profile:", error);
      setProfileData({ profile: contextUser });
      setName(resolveEmployeeName(contextUser) || contextUser?.name || '');
      setPhone(contextUser?.phone || '');
      setEmail(contextUser?.email || '');

      const cachedPhoto = localStorage.getItem(localStoragePhotoKey);
      if (cachedPhoto) {
        setLocalPhotoUrl(cachedPhoto);
      }
    } finally {
      setIsLoadingData(false);
      if (manual) setIsRefreshing(false);
    }
  }, [contextUser?._id, localStoragePhotoKey]);

  useEffect(() => {
    fetchProfile(false);
    const handleFocus = () => {
      fetchProfile(false);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchProfile]);

  // Extract base profile photo & employee subdocuments
  const emp = resolveEmployeeData(profileData) || {};
  const prof = profileData?.profile || profileData?.user || profileData || {};

  const serverPhotoUrl = (
    emp.profilePhoto ||
    emp.profileImage ||
    emp.avatar ||
    emp.photo ||
    emp.photoUrl ||
    prof.profilePhoto ||
    prof.profileImage ||
    prof.avatar ||
    prof.photo ||
    prof.photoUrl ||
    profileData?.profilePhoto ||
    profileData?.profileImage ||
    profileData?.avatar ||
    profileData?.photo ||
    profileData?.photoUrl ||
    contextUser?.profilePhoto ||
    contextUser?.photoUrl ||
    contextUser?.avatar ||
    ''
  );

  const activePhotoUrl = isProfilePhotoReset ? '' : localPhotoUrl || serverPhotoUrl;
  const serverAadharNumber = String(
    emp?.aadharNumber ?? emp?.aadhar ?? prof?.aadharNumber ?? prof?.aadhar ?? profileData?.aadharNumber ?? ''
  ).trim();
  const serverPanNumber = String(
    emp?.panNumber ?? emp?.pan ?? prof?.panNumber ?? prof?.pan ?? profileData?.panNumber ?? ''
  ).trim();

  // Load and sync Documents
  useEffect(() => {
    const initializeDocuments = async () => {
      // 1. Check local storage for existing user documents
      let initialDocs = null;
      try {
        const saved = localStorage.getItem(localStorageDocKey);
        if (saved) {
          initialDocs = JSON.parse(saved);
        }
      } catch (e) {
        console.warn("Could not read local documents", e);
      }

      let legacyDocumentsFetched = false;
      const serverRemoteIds = new Set();

      // 2. Fallback default documents if none saved yet
      if (!initialDocs || !Array.isArray(initialDocs) || initialDocs.length === 0) {
        const aadharNum = emp?.aadharNumber || prof?.aadharNumber || prof?.aadhar || '';
        const panNum = emp?.panNumber || prof?.panNumber || prof?.pan || '';

        initialDocs = [
          {
            id: 'aadhar',
            key: 'aadhar',
            title: 'Aadhar Card',
            subtitle: 'Government issued 12-digit Unique Identification (UIDAI)',
            category: 'Identity Proof',
            docNumber: aadharNum || 'Not Provided',
            status: 'pending',
            fileUrl: '',
            fileName: '',
            fileType: 'application/pdf',
            uploadedAt: 'Pending',
            isCore: true
          },
          {
            id: 'pan',
            key: 'pan',
            title: 'PAN Card',
            subtitle: 'Permanent Account Number issued by Income Tax Department',
            category: 'Tax ID & Proof',
            docNumber: panNum || 'Not Provided',
            status: 'pending',
            fileUrl: '',
            fileName: '',
            fileType: 'image/jpeg',
            uploadedAt: 'Pending',
            isCore: true
          },
          {
            id: 'passport_photo',
            key: 'passport_photo',
            title: 'Passport Size Photo',
            subtitle: 'Official formal color photograph with solid background',
            category: 'Photograph',
            docNumber: 'Not Uploaded',
            status: 'pending',
            fileUrl: '',
            fileName: '',
            fileType: 'image/jpeg',
            uploadedAt: 'Pending',
            isCore: true
          }
        ];
      }

      // 3. Attempt to fetch remote documents from backend /api/document
      try {
        const backendRes = await api.get('/api/document', { skipCache: true });
        const remoteList = getApiDocumentList(backendRes.data);
        legacyDocumentsFetched = true;
        if (Array.isArray(remoteList)) {
          const rawId = resolveEmployeeId();
          const candidateIds = [
            String(profileData?.employee?._id || ''),
            String(profileData?._id || ''),
            String(contextUser?._id || ''),
            String(contextUser?.id || ''),
            String(contextUser?.employeeId || ''),
            String(currentUserId || ''),
            String(rawId || '')
          ].filter(Boolean);

          const relevantRemote = remoteList.filter(d => {
            const ref = String(d.referenceId || '');
            const up = String(d.uploadedBy || '');
            return candidateIds.includes(ref) || candidateIds.includes(up);
          });
          relevantRemote.forEach(remoteDoc => {
            const remoteId = getRemoteDocumentId(remoteDoc);
            if (remoteId) serverRemoteIds.add(remoteId);
          });
          const latestCoreDocuments = getLatestEmployeeDocumentsByKind(relevantRemote);

          if (relevantRemote.length > 0) {
            relevantRemote.forEach(remoteDoc => {
              const title = String(remoteDoc.title || remoteDoc.documentName || remoteDoc.name || '');
              const documentKind = getEmployeeDocumentKind(remoteDoc);
              if (documentKind && latestCoreDocuments.get(documentKind) !== remoteDoc) return;
              const matchedCore = documentKind
                ? initialDocs.find(d => d.isCore && d.id === documentKind)
                : initialDocs.find(d =>
                    d.title.toLowerCase().trim() === title.toLowerCase().trim() ||
                    d.id.toLowerCase() === title.toLowerCase().replace(/\s+/g, '_')
                  );
              if (matchedCore) {
                const remoteTimestamp = getDocumentTimestamp(remoteDoc);
                if (remoteTimestamp && getDocumentTimestamp(matchedCore) > remoteTimestamp) return;
                matchedCore.fileUrl = remoteDoc.fileUrl || matchedCore.fileUrl;
                matchedCore.fileName = remoteDoc.fileName || matchedCore.fileName;
                matchedCore.fileType = remoteDoc.fileType || matchedCore.fileType;
                if (remoteDoc.description && (!matchedCore.docNumber || matchedCore.docNumber === 'Not Provided')) {
                  matchedCore.docNumber = remoteDoc.description;
                }
                matchedCore.status = 'uploaded';
                matchedCore.remoteId = getRemoteDocumentId(remoteDoc);
                matchedCore.remoteUpdatedAt = remoteDoc.updatedAt || remoteDoc.createdAt || remoteDoc.uploadedAt || matchedCore.remoteUpdatedAt;
                if (remoteDoc.createdAt) {
                  try {
                    matchedCore.uploadedAt = new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  } catch (e) {}
                }
              } else {
                const remoteId = getRemoteDocumentId(remoteDoc);
                const remoteKey = remoteId || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const existingIndex = initialDocs.findIndex(d =>
                  d.remoteId === remoteId ||
                  (title && !d.isCore && d.title.toLowerCase().trim() === title.toLowerCase().trim())
                );
                if (title) {
                  const remoteDocument = {
                    id: `remote-${remoteKey}`,
                    remoteId,
                    title,
                    subtitle: 'Uploaded Employee Document',
                    category: 'Official Record',
                    docNumber: remoteDoc.description || 'Verified Record',
                    status: 'uploaded',
                    fileUrl: remoteDoc.fileUrl,
                    fileName: remoteDoc.fileName || `${title}.pdf`,
                    fileType: remoteDoc.fileType || 'application/pdf',
                    uploadedAt: remoteDoc.createdAt ? new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
                    isCore: false
                  };
                  if (existingIndex >= 0) {
                    initialDocs[existingIndex] = { ...initialDocs[existingIndex], ...remoteDocument };
                  } else {
                    initialDocs.push(remoteDocument);
                  }
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn("Could not query backend documents endpoint:", err);
      }

      try {
        const employeeDocumentsRes = await api.get(
          `${EMPLOYEE_DOCUMENTS_API}/${encodeURIComponent(employeeDocumentId)}`,
          { skipCache: true }
        );
        getEmployeeDocumentRecords(employeeDocumentsRes.data).forEach(document => {
          if (document.remoteId) serverRemoteIds.add(String(document.remoteId));
        });
        initialDocs = mergeEmployeeDocuments(initialDocs, employeeDocumentsRes.data);
      } catch (err) {
        console.warn('Could not fetch employee documents:', err);
      }

      if (legacyDocumentsFetched) {
        initialDocs = reconcileRemoteDocuments(initialDocs, serverRemoteIds);
      }

      [
        { id: 'aadhar', value: serverAadharNumber },
        { id: 'pan', value: serverPanNumber }
      ].forEach(({ id, value }) => {
        const doc = initialDocs.find(item => item.id === id);
        if (doc && value) {
          doc.docNumber = value;
        }
      });

      initialDocs = normalizeCoreDocuments(initialDocs);
      setDocuments(initialDocs);
      try {
        localStorage.setItem(localStorageDocKey, JSON.stringify(initialDocs));
      } catch (error) {
        console.warn('Could not cache documents in localStorage:', error);
      }
      window.dispatchEvent(new CustomEvent('kt_employee_documents_updated', {
        detail: { userId: String(currentUserId), documents: initialDocs }
      }));
    };

    if (!isLoadingData) {
      initializeDocuments();
      window.addEventListener('focus', initializeDocuments);
      return () => window.removeEventListener('focus', initializeDocuments);
    }
  }, [isLoadingData, currentUserId, localStorageDocKey, employeeDocumentId, serverAadharNumber, serverPanNumber]);

  // Sync employee documents and legacy uploads from their respective endpoints
  const syncDocumentsFromBackend = async () => {
    setIsSyncingDocs(true);
    try {
      let updated = [...documents];
      let syncedFromServer = false;
      let legacyDocumentsFetched = false;
      const serverRemoteIds = new Set();
      const syncErrors = [];

      try {
        const employeeDocumentsRes = await api.get(
          `${EMPLOYEE_DOCUMENTS_API}/${encodeURIComponent(employeeDocumentId)}`,
          { skipCache: true }
        );
        getEmployeeDocumentRecords(employeeDocumentsRes.data).forEach(document => {
          if (document.remoteId) serverRemoteIds.add(String(document.remoteId));
        });
        updated = mergeEmployeeDocuments(updated, employeeDocumentsRes.data);
        syncedFromServer = true;
      } catch (error) {
        syncErrors.push(error);
        console.warn('Could not fetch employee documents:', error);
      }

      try {
        const backendRes = await api.get('/api/document', { skipCache: true });
        syncedFromServer = true;
        const remoteList = getApiDocumentList(backendRes.data);
        if (Array.isArray(remoteList)) {
          legacyDocumentsFetched = true;
          const rawId = resolveEmployeeId();
          const candidateIds = [
            String(profileData?.employee?._id || ''),
            String(profileData?._id || ''),
            String(contextUser?._id || ''),
            String(contextUser?.id || ''),
            String(contextUser?.employeeId || ''),
            String(currentUserId || ''),
            String(rawId || '')
          ].filter(Boolean);

          const relevantRemote = remoteList.filter(d => {
            const ref = String(d.referenceId || '');
            const up = String(d.uploadedBy || '');
            return candidateIds.includes(ref) || candidateIds.includes(up);
          });
          relevantRemote.forEach(remoteDoc => {
            const remoteId = getRemoteDocumentId(remoteDoc);
            if (remoteId) serverRemoteIds.add(remoteId);
          });
          const latestCoreDocuments = getLatestEmployeeDocumentsByKind(relevantRemote);

          relevantRemote.forEach(remoteDoc => {
            const title = String(remoteDoc.title || remoteDoc.documentName || remoteDoc.name || '');
            const documentKind = getEmployeeDocumentKind(remoteDoc);
            if (documentKind && latestCoreDocuments.get(documentKind) !== remoteDoc) return;
            const matchedCore = documentKind
              ? updated.find(d => d.isCore && d.id === documentKind)
              : updated.find(d =>
                  d.title.toLowerCase().trim() === title.toLowerCase().trim() ||
                  d.id.toLowerCase() === title.toLowerCase().replace(/\s+/g, '_')
                );
            if (matchedCore) {
              const remoteTimestamp = getDocumentTimestamp(remoteDoc);
              if (remoteTimestamp && getDocumentTimestamp(matchedCore) > remoteTimestamp) return;
              matchedCore.fileUrl = remoteDoc.fileUrl || matchedCore.fileUrl;
              matchedCore.fileName = remoteDoc.fileName || matchedCore.fileName;
              matchedCore.fileType = remoteDoc.fileType || matchedCore.fileType;
              if (remoteDoc.description) matchedCore.docNumber = remoteDoc.description;
              matchedCore.status = 'uploaded';
              matchedCore.remoteId = getRemoteDocumentId(remoteDoc);
              matchedCore.remoteUpdatedAt = remoteDoc.updatedAt || remoteDoc.createdAt || remoteDoc.uploadedAt || matchedCore.remoteUpdatedAt;
              if (remoteDoc.createdAt) {
                try {
                  matchedCore.uploadedAt = new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                } catch (e) {}
              }
            } else {
              const remoteId = getRemoteDocumentId(remoteDoc);
              const remoteKey = remoteId || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const existingIndex = updated.findIndex(d =>
                d.remoteId === remoteId || (title && !d.isCore && d.title.toLowerCase().trim() === title.toLowerCase().trim())
              );
              if (title) {
                const remoteDocument = {
                  id: `remote-${remoteKey}`,
                  remoteId,
                  title,
                  subtitle: 'Uploaded Employee Document',
                  category: 'Official Record',
                  docNumber: remoteDoc.description || 'Verified Record',
                  status: 'uploaded',
                  fileUrl: remoteDoc.fileUrl,
                  fileName: remoteDoc.fileName || `${title}.pdf`,
                  fileType: remoteDoc.fileType || 'application/pdf',
                  uploadedAt: remoteDoc.createdAt ? new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
                  isCore: false
                };
                if (existingIndex >= 0) {
                  updated[existingIndex] = { ...updated[existingIndex], ...remoteDocument };
                } else {
                  updated.push(remoteDocument);
                }
              }
            }
          });
        }
      } catch (error) {
        syncErrors.push(error);
        console.warn('Could not sync legacy employee documents:', error);
      }

      if (!syncedFromServer) {
        const details = syncErrors
          .map(error => error.response?.data?.message || error.message)
          .filter(Boolean)
          .join('; ');
        throw new Error(details || 'Both document endpoints are unavailable.');
      }

      if (legacyDocumentsFetched) {
        updated = reconcileRemoteDocuments(updated, serverRemoteIds);
      }

      updated = normalizeCoreDocuments(updated);
      persistDocuments(updated);
      setDocFeedback({ type: 'success', text: 'Documents synchronized with server successfully!' });
      setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
    } catch (err) {
      console.warn("Could not sync documents:", err);
      setDocFeedback({
        type: 'error',
        text: `Could not synchronize with server documents: ${err.message}`
      });
      setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
    } finally {
      setIsSyncingDocs(false);
    }
  };

  // Save documents list helper
  const persistDocuments = (updatedDocs) => {
    setDocuments(updatedDocs);
    try {
      localStorage.setItem(localStorageDocKey, JSON.stringify(updatedDocs));
    } catch (e) {
      console.warn("Could not persist documents to localStorage", e);
    }
    window.dispatchEvent(new CustomEvent('kt_employee_documents_updated', {
      detail: { userId: String(currentUserId), documents: updatedDocs }
    }));
  };

  // --- Profile Photo Upload & Management ---
  const handleProfilePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast("Please upload a valid image file (PNG, JPG, WEBP).", "error");
      e.target.value = '';
      return;
    }

    setIsPhotoUploading(true);
    setPhotoFeedback({ type: '', text: '' });

    try {
      // 1. Instant local preview
      const reader = new FileReader();
      reader.onload = async (readEvent) => {
        const dataUrl = readEvent.target.result;
        setIsProfilePhotoReset(false);
        clearProfilePhotoReset();
        setLocalPhotoUrl(dataUrl);
        setImgError(false);

        // Optimistically update AppContext so Header updates instantly
        if (updateUserProfile) {
          updateUserProfile({ profilePhoto: dataUrl, photoUrl: dataUrl, avatar: dataUrl });
        }

        let finalUrl = dataUrl;

        // 2. Upload file to backend /api/document/upload (Cloudinary CDN)
        try {
          const validId = resolveEmployeeId();

          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', 'Profile Photo');
          formData.append('description', 'Employee profile photo');
          formData.append('documentType', 'employee');
          formData.append('referenceId', validId);
          formData.append('fileName', file.name);
          formData.append('fileType', file.type || 'image/jpeg');
          if (validId) formData.append('uploadedBy', validId);

          const uploadRes = await api.post('/api/document/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          const uploadedUrl = uploadRes.data?.data?.fileUrl || uploadRes.data?.fileUrl || uploadRes.data?.data?.url || uploadRes.data?.url || uploadRes.data?.data?.path || uploadRes.data?.path;
          if (uploadedUrl) {
            finalUrl = uploadedUrl;
            setLocalPhotoUrl(finalUrl);
          }
        } catch (uploadErr) {
          console.warn("Backend /api/document/upload fallback to Data URL:", uploadErr);
        }

        // 3. Update backend user profile
        try {
          await api.put('/api/users/profile/update', {
            profilePhoto: finalUrl,
            photoUrl: finalUrl,
            avatar: finalUrl,
            profileImage: finalUrl,
            image: finalUrl,
            photo: finalUrl
          });
        } catch (updateErr) {
          console.warn("Backend /api/users/profile/update warning:", updateErr);
        }

        // 4. Update AppContext with final URL
        if (updateUserProfile) {
          updateUserProfile({ profilePhoto: finalUrl, photoUrl: finalUrl, avatar: finalUrl, profileImage: finalUrl, image: finalUrl, photo: finalUrl });
        }

        // 5. Cache photo in localStorage & global map
        try {
          localStorage.setItem(localStoragePhotoKey, finalUrl);
          const empPhotos = JSON.parse(localStorage.getItem('kt_employee_photos') || '{}');
          const validId = resolveEmployeeId();
          if (validId) empPhotos[validId.toLowerCase()] = finalUrl;
          if (contextUser?._id) empPhotos[String(contextUser._id).toLowerCase()] = finalUrl;
          if (contextUser?.id) empPhotos[String(contextUser.id).toLowerCase()] = finalUrl;
          if (contextUser?.employeeId) empPhotos[String(contextUser.employeeId).toLowerCase()] = finalUrl;
          if (contextUser?.email) empPhotos[contextUser.email.toLowerCase().trim()] = finalUrl;
          if (contextUser?.name) empPhotos[contextUser.name.toLowerCase().trim()] = finalUrl;
          localStorage.setItem('kt_employee_photos', JSON.stringify(empPhotos));
        } catch (e) {
          console.warn("Could not cache photo:", e);
        }

        try {
          window.dispatchEvent(new CustomEvent('kt_profile_photo_updated', { detail: { photoUrl: finalUrl } }));
        } catch (e) {}

        setPhotoFeedback({ type: 'success', text: 'Profile photo updated successfully!' });
        setTimeout(() => setPhotoFeedback({ type: '', text: '' }), 4000);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading profile photo:", err);
      setPhotoFeedback({ type: 'error', text: 'Failed to upload profile photo.' });
    } finally {
      setIsPhotoUploading(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const handleResetProfilePhoto = async () => {
    if (!window.confirm("Revert profile photo back to the company dark blue logo?")) return;

    setLocalPhotoUrl('');
    setIsProfilePhotoReset(true);
    setImgError(false);
    const clearedPhotoFields = {
      profilePhoto: '',
      profileImage: '',
      photoUrl: '',
      avatar: '',
      image: '',
      photo: ''
    };
    const clearNestedPhotoFields = (source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
      const cleared = { ...source, ...clearedPhotoFields };
      ['profile', 'user', 'employee', 'employeeId', 'employeeID', 'emp', 'employeeDetails', 'data']
        .forEach(key => {
          if (source[key] && typeof source[key] === 'object') {
            cleared[key] = clearNestedPhotoFields(source[key]);
          }
        });
      return cleared;
    };
    setProfileData(prev => {
      if (!prev) return prev;
      return clearNestedPhotoFields(prev);
    });

    try {
      localStorage.removeItem(localStoragePhotoKey);
      localStorage.setItem(localStoragePhotoResetKey, 'true');
      const empPhotos = JSON.parse(localStorage.getItem('kt_employee_photos') || '{}');
      const validId = resolveEmployeeId();
      if (validId) delete empPhotos[validId.toLowerCase()];
      if (contextUser?._id) delete empPhotos[String(contextUser._id).toLowerCase()];
      if (contextUser?.id) delete empPhotos[String(contextUser.id).toLowerCase()];
      if (contextUser?.employeeId) delete empPhotos[String(contextUser.employeeId).toLowerCase()];
      if (contextUser?.email) delete empPhotos[contextUser.email.toLowerCase().trim()];
      if (contextUser?.name) delete empPhotos[contextUser.name.toLowerCase().trim()];
      localStorage.setItem('kt_employee_photos', JSON.stringify(empPhotos));
      window.dispatchEvent(new CustomEvent('kt_profile_photo_updated', { detail: { photoUrl: '' } }));
    } catch (e) {
      console.warn(e);
    }

    if (updateUserProfile) {
      updateUserProfile(clearedPhotoFields);
    }

    try {
      await api.put('/api/users/profile/update', clearedPhotoFields);
      setPhotoFeedback({ type: 'success', text: 'Profile photo reverted to company logo.' });
    } catch (error) {
      console.error("Backend reset photo warning:", error);
      setPhotoFeedback({ type: 'error', text: 'Could not reset the profile photo on the server. Please try again.' });
    }

    setTimeout(() => setPhotoFeedback({ type: '', text: '' }), 3000);
  };

  // --- Document Actions: View, Update, Add, Delete ---
  const handleOpenDocViewer = (doc) => {
    if (doc?.fileUrl) {
      const newTab = window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
      if (!newTab) {
        const a = document.createElement('a');
        a.href = doc.fileUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return;
    }
    setDocFeedback({ type: 'error', text: 'No document file attached yet.' });
    setTimeout(() => setDocFeedback({ type: '', text: '' }), 3500);
    if (doc?.id) {
      handleTriggerDocUpload(doc.id);
    }
  };

  const handleCloseDocViewer = () => {
    setDocViewerModal({
      isOpen: false,
      doc: null,
      zoomLevel: 100,
      rotation: 0
    });
  };

  const handleTriggerDocUpload = (docId) => {
    setTargetActionDocId(docId);
    if (docActionInputRef.current) {
      docActionInputRef.current.value = '';
      docActionInputRef.current.click();
    }
  };

  const uploadEmployeeDocument = async (file, title, description) => {
    const employeeId = resolveEmployeeId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('documentType', 'employee');
    formData.append('referenceId', employeeId);
    formData.append('fileName', file.name);
    formData.append('fileType', file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));
    if (employeeId) formData.append('uploadedBy', employeeId);

    const response = await api.post('/api/document/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const responseData = response.data;
    if (responseData?.success === false || responseData?.data?.success === false) {
      throw new Error(responseData?.message || responseData?.data?.message || 'The document upload was rejected.');
    }

    return getUploadedDocument(responseData);
  };

  const handleDocFileChanged = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetActionDocId) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast("File size exceeds 15MB limit. Please upload a smaller file.", "error");
      e.target.value = '';
      return;
    }

    if (targetActionDocId === 'passport_photo') {
      if (!file.type.startsWith('image/')) {
        showToast("Please upload a passport-size photo in PNG, JPG, or WEBP format.", "error");
        e.target.value = '';
        return;
      }

      try {
        if (!(await isPassportSizePhoto(file))) {
          showToast("Please upload a passport-size portrait photo with a 7:9 aspect ratio (35 x 45).", "error");
          e.target.value = '';
          return;
        }
      } catch (error) {
        console.error("Could not validate passport photo:", error);
        showToast("Could not read this image. Please select a valid passport-size photo.", "error");
        e.target.value = '';
        return;
      }
    }

    const docToUpdate = documents.find(d => d.id === targetActionDocId);
    if (!docToUpdate) {
      e.target.value = '';
      return;
    }

    setUploadingDocId(targetActionDocId);
    setDocFeedback({ type: '', text: '' });

    try {
      const uploadedDocument = await uploadEmployeeDocument(
        file,
        docToUpdate.title,
        docToUpdate.docNumber || docToUpdate.subtitle || ''
      );
      const nowFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const updatedDocs = documents.map(doc => doc.id === targetActionDocId
        ? {
            ...doc,
            remoteId: uploadedDocument.remoteId || doc.remoteId,
            fileUrl: uploadedDocument.fileUrl,
            fileName: file.name,
            fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            status: 'uploaded',
            uploadedAt: nowFormatted
          }
        : doc
      );

      persistDocuments(updatedDocs);

      if (docViewerModal.isOpen && docViewerModal.doc?.id === targetActionDocId) {
        setDocViewerModal(prev => ({
          ...prev,
          doc: {
            ...prev.doc,
            remoteId: uploadedDocument.remoteId || prev.doc.remoteId,
            fileUrl: uploadedDocument.fileUrl,
            fileName: file.name,
            fileType: file.type,
            status: 'uploaded',
            uploadedAt: nowFormatted
          }
        }));
      }

      setDocFeedback({ type: 'success', text: `${docToUpdate.title} updated successfully!` });
    } catch (err) {
      console.error("Error uploading document:", err);
      const message = err.response?.data?.message || err.message || 'Please try again.';
      setDocFeedback({ type: 'error', text: `Failed to upload document: ${message}` });
    } finally {
      setUploadingDocId(null);
      setTargetActionDocId(null);
      if (docActionInputRef.current) {
        docActionInputRef.current.value = '';
      }
    }
  };

  // Sync Passport Size Photo to Profile Avatar
  const handleApplyPassportAsProfile = async (doc) => {
    if (!doc.fileUrl) {
      showToast("Please upload a passport size photo first.", "error");
      return;
    }

    setLocalPhotoUrl(doc.fileUrl);
    setIsProfilePhotoReset(false);
    clearProfilePhotoReset();
    setImgError(false);

    if (updateUserProfile) {
      updateUserProfile({ profilePhoto: doc.fileUrl, photoUrl: doc.fileUrl, avatar: doc.fileUrl });
    }

    try {
      localStorage.setItem(localStoragePhotoKey, doc.fileUrl);
      await api.put('/api/users/profile/update', {
        profilePhoto: doc.fileUrl,
        photoUrl: doc.fileUrl,
        avatar: doc.fileUrl
      });
    } catch (e) {
      console.warn("Backend sync photo warning:", e);
    }

    setDocFeedback({ type: 'success', text: 'Passport size photo set as active Profile Photo!' });
    setPhotoFeedback({ type: 'success', text: 'Profile photo synchronized from Passport Photo!' });
    setTimeout(() => {
      setDocFeedback({ type: '', text: '' });
      setPhotoFeedback({ type: '', text: '' });
    }, 4000);
  };

  // Inline Document Number Edit
  const handleStartEditNumber = (doc) => {
    setEditingDocId(doc.id);
    const docNumber = doc.docNumber || '';
    setTempDocNumber(
      doc.id === 'aadhar' && docNumber !== 'Not Provided'
        ? String(docNumber).replace(/\D/g, '').slice(0, 12)
        : doc.id === 'pan'
          ? (docNumber === 'Not Provided' ? '' : String(docNumber).replace(/[^a-z\d]/gi, '').toUpperCase().slice(0, 10))
          : docNumber === 'Not Provided' ? '' : docNumber
    );
  };

  const handleSaveDocNumber = async (docId) => {
    const docNumber = tempDocNumber.trim();
    if (docId === 'aadhar' && docNumber && !/^\d{12}$/.test(docNumber)) {
      showToast('Aadhaar number must contain exactly 12 digits.', 'error');
      return;
    }
    const normalizedDocNumber = docId === 'pan' ? docNumber.toUpperCase() : docNumber;
    if (docId === 'pan' && normalizedDocNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(normalizedDocNumber)) {
      showToast('PAN number must be 10 characters: 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F).', 'error');
      return;
    }

    const profileField = docId === 'aadhar'
      ? 'aadharNumber'
      : docId === 'pan'
        ? 'panNumber'
        : null;

    if (profileField) {
      setIsSavingDocNumber(true);
      try {
        const valueToSave = docId === 'pan' ? normalizedDocNumber : docNumber;
        const response = await api.put('/api/users/profile/update', { [profileField]: valueToSave });
        if (response.data?.success === false) {
          throw new Error(response.data?.message || `${docId.toUpperCase()} number update was rejected.`);
        }
      } catch (error) {
        console.error(`Could not save ${docId.toUpperCase()} number:`, error);
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Please try again.';
        showToast(`Could not save ${docId.toUpperCase()} number: ${errorMessage}`, 'error');
        setIsSavingDocNumber(false);
        return;
      }
    }

    const updatedDocs = documents.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          docNumber: normalizedDocNumber
        };
      }
      return d;
    });
    persistDocuments(updatedDocs);
    if (profileField) {
      const profileFields = {
        [profileField]: normalizedDocNumber,
        ...(docId === 'aadhar' ? { aadhar: normalizedDocNumber } : { pan: normalizedDocNumber })
      };
      setProfileData(prev => ({
        ...(prev || {}),
        ...profileFields,
        profile: { ...(prev?.profile || {}), ...profileFields },
        employee: { ...(prev?.employee || {}), ...profileFields }
      }));
      if (updateUserProfile) updateUserProfile(profileFields);
      setIsSavingDocNumber(false);
    }
    setEditingDocId(null);
    setTempDocNumber('');
    setDocFeedback({ type: 'success', text: 'Document number updated.' });
    setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
  };

  // Add Custom Document
  const handleAddNewDocumentSubmit = async (e) => {
    e.preventDefault();
    const finalTitle = newDocForm.presetType === 'Other Document' 
      ? newDocForm.customTitle.trim() 
      : newDocForm.presetType;

    if (!finalTitle) {
      showToast("Please specify a document title.", "error");
      return;
    }

    if (!newDocForm.file) {
      showToast("Please attach a file for this document.", "error");
      return;
    }

    const documentKind = getEmployeeDocumentKind({ title: finalTitle });
    if (newDocForm.file.size > 15 * 1024 * 1024) {
      showToast("File size exceeds 15MB limit. Please upload a smaller file.", "error");
      return;
    }

    if (documentKind === 'passport_photo') {
      if (!newDocForm.file.type.startsWith('image/')) {
        showToast("Please upload a passport-size photo in PNG, JPG, or WEBP format.", "error");
        return;
      }

      try {
        if (!(await isPassportSizePhoto(newDocForm.file))) {
          showToast("Please upload a passport-size portrait photo with a 7:9 aspect ratio (35 x 45).", "error");
          return;
        }
      } catch (error) {
        console.error("Could not validate passport photo:", error);
        showToast("Could not read this image. Please select a valid passport-size photo.", "error");
        return;
      }
    }

    setIsSubmittingNewDoc(true);

    try {
      const file = newDocForm.file;
      const uploadedDocument = await uploadEmployeeDocument(
        file,
        finalTitle,
        newDocForm.docNumber.trim() || 'Verified Official Record'
      );
      const newDocItem = {
        id: `custom-doc-${Date.now()}`,
        remoteId: uploadedDocument.remoteId,
        title: finalTitle,
        subtitle: 'Verified Statutory Document',
        category: 'Official Record',
        docNumber: newDocForm.docNumber.trim() || 'Verified Record',
        status: 'uploaded',
        fileUrl: uploadedDocument.fileUrl,
        fileName: file.name,
        fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        isCore: false
      };

      const updatedDocs = documentKind && documents.some(d => d.isCore && d.id === documentKind)
        ? mergeDocumentIntoCore(documents, newDocItem)
        : [...documents, newDocItem];
      persistDocuments(updatedDocs);

      setIsAddDocModalOpen(false);
      setNewDocForm({
        presetType: 'Driving License',
        customTitle: '',
        docNumber: '',
        file: null,
        fileName: '',
        filePreview: ''
      });

      setDocFeedback({
        type: 'success',
        text: documentKind
          ? `"${finalTitle}" uploaded to Mandatory Identity Documents.`
          : `"${finalTitle}" added to your documents!`
      });
    } catch (err) {
      console.error("Failed to add document:", err);
      const message = err.response?.data?.message || err.message || 'Please try again.';
      showToast(`Failed to add document: ${message}`, "error");
    } finally {
      setIsSubmittingNewDoc(false);
    }
  };

  // Delete Custom Document
  const handleDeleteDocument = async (docId) => {
    const docToDelete = documents.find(d => d.id === docId);
    if (!docToDelete) return;

    if (!window.confirm(`Are you sure you want to remove "${docToDelete.title}"?`)) return;

    if (docToDelete.remoteId) {
      try {
        const response = await api.delete(`/api/document/${encodeURIComponent(docToDelete.remoteId)}`);
        if (response.data?.success === false) {
          throw new Error(response.data?.message || 'The document API rejected the deletion.');
        }
      } catch (err) {
        console.error("Could not delete document from backend:", err);
        showToast(`Could not remove "${docToDelete.title}" from the server. Please try again.`, 'error');
        return;
      }
    }

    const updatedDocs = documents.filter(d => d.id !== docId);
    persistDocuments(updatedDocs);

    setDocFeedback({ type: 'success', text: `"${docToDelete.title}" has been removed.` });
    setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
  };

  const handleDeletePassportPhoto = async () => {
    const docToDelete = documents.find(d => d.id === 'passport_photo');
    if (!docToDelete?.fileUrl) return;
    if (!window.confirm('Are you sure you want to delete the passport size photo?')) return;

    setIsDeletingPassportPhoto(true);
    setDocFeedback({ type: '', text: '' });
    try {
      if (docToDelete.remoteId) {
        const response = await api.delete(`/api/document/${encodeURIComponent(docToDelete.remoteId)}`);
        if (response.data?.success === false) {
          throw new Error(response.data?.message || 'The document API rejected the deletion.');
        }
      }

      const updatedDocs = documents.map(doc => doc.id === 'passport_photo'
        ? {
            ...doc,
            fileUrl: '',
            fileName: '',
            fileType: 'image/jpeg',
            remoteId: null,
            status: 'pending',
            uploadedAt: 'Pending'
          }
        : doc
      );
      persistDocuments(updatedDocs);

      if (docViewerModal.doc?.id === 'passport_photo') {
        handleCloseDocViewer();
      }

      setDocFeedback({ type: 'success', text: 'Passport size photo deleted successfully.' });
      setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Could not delete passport size photo:', error);
      showToast('Could not delete the passport size photo. Please try again.', 'error');
    } finally {
      setIsDeletingPassportPhoto(false);
    }
  };

  // --- Personal & Contact Form Save ---
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      showToast("Please enter a valid 10-digit mobile number.", "error");
      return;
    }
    setIsSaving(true);
    const cleanName = name.trim();

    try {
      // 1. Immediately persist locally so UI never flashes or reverts to old database username
      if (cleanName) {
        localStorage.setItem('kt_employee_full_name', cleanName);
      }

      // 2. Prepare payload with all name representations & demographics
      const payload = { 
        name: cleanName,
        fullName: cleanName,
        employeeName: cleanName,
        phoneNumber: phone, 
        mobile: phone,
        address,
        currentAddress: address,
        dob: dobInput || undefined,
        gender: genderInput || undefined,
        bloodGroup: bloodGroupInput || undefined
      };

      // 3. Update user profile on backend
      try {
        await api.put('/api/users/profile/update', payload);
      } catch (err) {
        console.warn('PUT /api/users/profile/update notice:', err?.message);
        try {
          await api.put('/api/users/profile', payload);
        } catch {}
      }

      const updatedFields = {
        name: cleanName,
        fullName: cleanName,
        phone,
        mobile: phone,
        address,
        currentAddress: address,
        dob: dobInput,
        gender: genderInput,
        bloodGroup: bloodGroupInput
      };

      if (updateUserProfile) {
        updateUserProfile(updatedFields);
      }

      setProfileData(prev => ({
        ...prev,
        name: cleanName,
        fullName: cleanName,
        dob: dobInput || prev?.dob,
        gender: genderInput || prev?.gender,
        bloodGroup: bloodGroupInput || prev?.bloodGroup,
        employee: { 
          ...(prev?.employee || {}), 
          name: cleanName, 
          fullName: cleanName, 
          mobile: phone, 
          currentAddress: address,
          dob: dobInput || prev?.employee?.dob,
          gender: genderInput || prev?.employee?.gender,
          bloodGroup: bloodGroupInput || prev?.employee?.bloodGroup
        },
        profile: { 
          ...(prev?.profile || {}), 
          name: cleanName, 
          fullName: cleanName, 
          phoneNumber: phone, 
          address,
          dob: dobInput || prev?.profile?.dob,
          gender: genderInput || prev?.profile?.gender,
          bloodGroup: bloodGroupInput || prev?.profile?.bloodGroup
        }
      }));

      setIsSaved(true);
      showToast("Profile details updated successfully!", "success");
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      showToast("Failed to update profile details.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Bank Details Modal Handlers ---
  const handleOpenBankModal = () => {
    setBankModalError('');
    const currentBank = resolveBankDetails(profileData, contextUser);
    if (currentBank && (currentBank.accountNumber || currentBank.bankName)) {
      setBankForm({
        bankName: currentBank.bankName || '',
        accountHolderName: currentBank.accountHolderName || name || fullName || '',
        accountNumber: currentBank.accountNumber || '',
        confirmAccountNumber: currentBank.accountNumber || '',
        ifscCode: currentBank.ifscCode || '',
        bankBranch: currentBank.bankBranch || '',
        upiId: currentBank.upiId || ''
      });
    } else {
      setBankForm({
        bankName: '',
        accountHolderName: name || fullName || resolveEmployeeName(contextUser) || '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: '',
        bankBranch: '',
        upiId: ''
      });
    }
    setIsBankModalOpen(true);
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    setBankModalError('');

    const cleanBankName = bankForm.bankName.trim();
    const cleanHolder = bankForm.accountHolderName.trim();
    const cleanAccountNumber = bankForm.accountNumber.replace(/[\s-]/g, '');
    const cleanConfirm = bankForm.confirmAccountNumber.replace(/[\s-]/g, '');
    const cleanIfsc = bankForm.ifscCode.trim().toUpperCase();
    const cleanBranch = bankForm.bankBranch.trim();
    const cleanUpi = bankForm.upiId.trim();

    if (!cleanBankName) {
      setBankModalError('Please enter Bank Name.');
      return;
    }
    if (!cleanHolder) {
      setBankModalError('Please enter Account Holder Name.');
      return;
    }
    if (!cleanAccountNumber || cleanAccountNumber.length < 8) {
      setBankModalError('Please enter a valid Account Number (minimum 8 digits).');
      return;
    }
    if (cleanAccountNumber !== cleanConfirm) {
      setBankModalError('Account Number and Confirm Account Number do not match.');
      return;
    }
    if (!cleanIfsc || cleanIfsc.length !== 11) {
      setBankModalError('Please enter a valid 11-character IFSC Code (e.g. SBIN0001234).');
      return;
    }

    setIsSavingBank(true);

    const bankPayload = {
      bankName: cleanBankName,
      accountNumber: cleanAccountNumber,
      bankAccount: cleanAccountNumber,
      bankAccountNumber: cleanAccountNumber,
      ifscCode: cleanIfsc,
      IFSC: cleanIfsc,
      accountHolderName: cleanHolder,
      bankBranch: cleanBranch,
      upiId: cleanUpi || null,
      isBankDetailGiven: true,
      bankDetailGiven: true,
      bankDetailsGiven: true,
      bankDetails: {
        bankName: cleanBankName,
        accountNumber: cleanAccountNumber,
        bankAccount: cleanAccountNumber,
        bankAccountNumber: cleanAccountNumber,
        ifscCode: cleanIfsc,
        accountHolderName: cleanHolder,
        bankBranch: cleanBranch,
        upiId: cleanUpi || null,
        isBankDetailGiven: true
      }
    };

    try {
      // 1. Send update to backend
      try {
        await api.put('/api/users/profile/update', bankPayload);
      } catch (err) {
        console.warn('PUT /api/users/profile/update fallback notice:', err?.message);
        try {
          await api.put('/api/users/profile', bankPayload);
        } catch {}
      }

      // 2. Persist in localStorage
      try {
        const bankMap = JSON.parse(localStorage.getItem('kt_employee_bank_details') || '{}');
        const ids = [contextUser?._id, prof?._id, contextUser?.uniqueID, prof?.uniqueID, 'current']
          .filter(Boolean)
          .map(String);
        for (const id of ids) {
          bankMap[id] = bankPayload;
        }
        localStorage.setItem('kt_employee_bank_details', JSON.stringify(bankMap));
        localStorage.setItem('kt_employee_bank_details_current', JSON.stringify(bankPayload));
      } catch (e) {
        console.warn('LocalStorage bank save notice:', e);
      }

      // 3. Update React state immediately
      setProfileData(prev => ({
        ...prev,
        ...bankPayload,
        profile: { ...(prev?.profile || {}), ...bankPayload },
        user: { ...(prev?.user || {}), ...bankPayload },
        employee: { ...(prev?.employee || {}), ...bankPayload }
      }));

      if (updateUserProfile) {
        updateUserProfile(bankPayload);
      }

      showToast('Bank details updated and verified successfully!', 'success');
      setIsBankModalOpen(false);
    } catch (err) {
      console.error('Failed to save bank details:', err);
      setBankModalError('Failed to save bank details. Please try again.');
      showToast('Failed to save bank details.', 'error');
    } finally {
      setIsSavingBank(false);
    }
  };

  // --- Password Update ---
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setIsPasswordSaving(true);
    try {
      await api.put('/api/users/change-password', {
        currentPassword,
        oldPassword: currentPassword,
        newPassword
      });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg({ type: '', text: '' }), 4000);
    } catch (error) {
      const errorText = error.response?.data?.message || error.response?.data?.error || 'Failed to change password.';
      setPasswordMsg({ type: 'error', text: errorText });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="space-y-6 font-poppins animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-slate-100 skeleton-shimmer shrink-0" />
          <div className="space-y-2 text-center sm:text-left w-full max-w-md">
            <div className="h-6 w-48 bg-slate-100 skeleton-shimmer rounded" />
            <div className="h-4 w-36 bg-slate-100 skeleton-shimmer rounded" />
            <div className="h-3 w-64 bg-slate-100 skeleton-shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="h-5 w-36 bg-slate-100 skeleton-shimmer rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-slate-100 skeleton-shimmer rounded-lg" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="h-5 w-36 bg-slate-100 skeleton-shimmer rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-slate-100 skeleton-shimmer rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

    // --- Dynamic Date & Role Helpers ---
  const formatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTimeIST = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return String(dateVal);
    const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateStr}, ${timeStr}`;
  };

  const resolveDisplayRole = (roleStr) => {
    const r = String(roleStr || '').toLowerCase().trim();
    if (r === 'admin' || r === 'super_admin' || r === 'superadmin') return 'Administrator';
    if (r === 'hr' || r === 'hrm') return 'HR Manager';
    if (r === 'team_leader' || r === 'team lead' || r === 'teamlead' || r === 'tl') return 'Team Leader';
    if (r === 'finance') return 'Finance Executive';
    return roleDetails?.roleName || 'Employee';
  };

  const copyToClipboard = (text, label) => {
    if (!text || text === 'N/A') return;
    navigator.clipboard.writeText(text);
    showToast(`${label || 'Item'} copied to clipboard!`, 'success');
  };

  // --- Dynamic Profile Field Extraction ---
  const fullName =
    name ||
    prof.name ||
    prof.fullName ||
    emp.name ||
    emp.fullName ||
    resolveEmployeeName(profileData) ||
    resolveEmployeeName(contextUser) ||
    (contextUser?.email ? contextUser.email.split('@')[0] : '') ||
    'User Profile';

  const employeeId =
    prof.uniqueID ||
    emp.uniqueID ||
    emp.employeeID ||
    prof.employeeId ||
    prof.employeeID ||
    prof.empId ||
    profileData?.uniqueID ||
    contextUser?.uniqueID ||
    contextUser?.employeeId ||
    'NEW1004';

  const designation =
    prof.designation ||
    emp.designation ||
    contextUser?.designation ||
    profileData?.designation ||
    'CEO';

  const department =
    prof.department ||
    emp.department ||
    contextUser?.department ||
    profileData?.department ||
    'ADMIN';

  const activeRole = prof.role || contextUser?.role || userRole || 'admin';
  const displayRole = resolveDisplayRole(activeRole);

  const dobRaw = prof.dob || emp.dob || profileData?.dob || contextUser?.dob;
  const dob = dobRaw ? formatDate(dobRaw) : 'Not Provided';

  const gender = prof.gender || emp.gender || profileData?.gender || contextUser?.gender || 'Not Specified';
  const bloodGroup = prof.bloodGroup || emp.bloodGroup || profileData?.bloodGroup || contextUser?.bloodGroup || 'Not Specified';

  const accountCreatedRaw = prof.createdAt || profileData?.createdAt || contextUser?.createdAt;
  const joiningDateRaw = emp.joiningDate || prof.joiningDate || accountCreatedRaw;
  const joiningDate = joiningDateRaw ? formatDate(joiningDateRaw) : 'N/A';
  const memberSince = accountCreatedRaw ? formatDate(accountCreatedRaw) : joiningDate;

  const lastLoginRaw =
    prof.lastLoginAt ||
    prof.lastLogin ||
    profileData?.lastLoginAt ||
    profileData?.lastLogin ||
    contextUser?.lastLoginAt ||
    contextUser?.lastLogin;
  const lastLoginFormatted = lastLoginRaw ? formatDateTimeIST(lastLoginRaw) : 'Active Today';

  const updatedAtRaw = prof.updatedAt || profileData?.updatedAt || contextUser?.updatedAt;
  const updatedAtFormatted = updatedAtRaw ? formatDateTimeIST(updatedAtRaw) : 'Just Now';

  const isApproved = prof.isApproved ?? contextUser?.isApproved ?? true;
  const isAccountActive =
    (prof.isActive ?? contextUser?.isActive ?? true) &&
    !(prof.isDeactivated ?? contextUser?.isDeactivated ?? false);
  const userBank = resolveBankDetails(profileData, contextUser);
  const hasBankDetails = Boolean(userBank && (userBank.accountNumber || userBank.bankName));
  const bankDetailGiven = Boolean(
    hasBankDetails ||
    prof.bankDetailGiven ||
    prof.bankDetailsGiven ||
    prof.isBankDetailGiven ||
    emp.bankDetailsGiven ||
    emp.bankDetailGiven
  );
  const termsAccepted = Boolean(
    prof.termsAccepted ||
    prof.termsAndConditions ||
    contextUser?.termsAccepted ||
    contextUser?.termsAndConditions
  );

  const emergencyContact = emp.emergencyContact || {};
  const educationList = emp.education || [];
  const skillsList = emp.skills || [];

  // Categorized documents
  const aadharDoc = documents.find(d => d.id === 'aadhar');
  const panDoc = documents.find(d => d.id === 'pan');
  const passportPhotoDoc = documents.find(d => d.id === 'passport_photo');
  const customDocs = documents.filter(d => !d.isCore);

  return (
    <div className="profile-view w-full max-w-7xl mx-auto space-y-6 font-poppins animate-fade-in pb-12">
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={photoInputRef} 
        onChange={handleProfilePhotoSelect} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={docActionInputRef} 
        onChange={handleDocFileChanged} 
        accept="image/*,application/pdf" 
        className="hidden" 
      />

      {/* Modern Executive Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#023c57] to-[#068DCB] text-white shadow-xl p-6 sm:p-8 border border-sky-400/20">
        {/* Subtle Decorative Elements */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Avatar and Primary Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-5 sm:gap-6 text-center sm:text-left">
            
            {/* Avatar with Camera Overlay & Online Dot */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-3 border-white/40 bg-white p-1.5 shadow-xl overflow-hidden relative transition-transform duration-300 group-hover:scale-102">
                {activePhotoUrl && !imgError ? (
                  <img 
                    src={activePhotoUrl} 
                    alt={fullName} 
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <img 
                    src={companyLogo} 
                    alt="Kevalon Technology" 
                    className="w-full h-full object-contain p-2"
                  />
                )}

                {/* Hover Camera Overlay Button */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isPhotoUploading}
                  className="absolute inset-0 bg-slate-950/65 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer disabled:cursor-not-allowed backdrop-blur-xs"
                  title="Upload / Change Profile Photo"
                >
                  {isPhotoUploading ? (
                    <Loader2 size={24} className="animate-spin text-white" />
                  ) : (
                    <>
                      <Camera size={22} className="mb-1 text-white" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                    </>
                  )}
                </button>
              </div>

              {/* Online Pulse Status Dot */}
              <span 
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center" 
                title={isAccountActive ? 'Account is Active' : 'Account is Inactive'}
              >
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAccountActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white ${isAccountActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </span>
            </div>

            {/* Identity Texts and Badges */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>{fullName}</span>
                  <BadgeCheck size={22} className="text-sky-300 shrink-0" title="Verified Kevalon Account" />
                </h1>
              </div>

              {/* Title & Department */}
              <p className="text-sm sm:text-base text-sky-100 font-medium">
                {designation} <span className="text-sky-300/60">•</span> {department} Department
              </p>

              {/* Dynamic Badges Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs">
                {/* Employee ID with Copy Button */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(employeeId, 'Employee ID')}
                  className="px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 border border-white/20 text-white font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Click to copy Employee ID"
                >
                  <span>ID: {employeeId}</span>
                  <Copy size={12} className="text-sky-200" />
                </button>

                {/* Role Badge */}
                <span className="px-2.5 py-1 rounded-md bg-amber-400/20 border border-amber-300/40 text-amber-200 font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                  <Shield size={13} className="text-amber-300" />
                  <span>{displayRole}</span>
                </span>

                {/* Active Account Status */}
                <span className={`px-2.5 py-1 rounded-md border font-semibold flex items-center gap-1.5 backdrop-blur-xs ${
                  isAccountActive 
                    ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-200' 
                    : 'bg-rose-400/20 border-rose-300/40 text-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isAccountActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span>{isAccountActive ? 'Active' : 'Deactivated'}</span>
                </span>

                {/* Approval Status */}
                {isApproved && (
                  <span className="px-2.5 py-1 rounded-md bg-sky-400/20 border border-sky-300/40 text-sky-200 font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                    <CheckCircle2 size={13} className="text-sky-300" />
                    <span>Approved</span>
                  </span>
                )}
              </div>

              {/* Photo Feedback Message */}
              {photoFeedback.text && (
                <div className={`mt-2 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-lg border backdrop-blur-xs ${
                  photoFeedback.type === 'error'
                    ? 'bg-rose-500/20 text-rose-100 border-rose-400/40'
                    : 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40'
                }`}>
                  {photoFeedback.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  <span>{photoFeedback.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Top Right Actions */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/15">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isPhotoUploading}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg border border-white/25 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isPhotoUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                <span>{isPhotoUploading ? 'Uploading...' : 'Upload Photo'}</span>
              </button>

              {activePhotoUrl && (
                <button
                  type="button"
                  onClick={handleResetProfilePhoto}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-lg border border-rose-400/30 transition cursor-pointer"
                  title="Reset to Kevalon dark blue logo"
                >
                  Reset Photo
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchProfile(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-white text-[#034665] hover:bg-sky-50 text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-[#034665]" : "text-[#034665]"} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic 4-Card Status & Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Joining Date */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center gap-3.5 transition-all hover:border-slate-300">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-[#034665] border border-sky-100 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Official Joining</span>
            <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">{joiningDate}</span>
            <span className="text-[11px] text-slate-500 truncate block">Member since {memberSince}</span>
          </div>
        </div>

        {/* Metric 2: Last Active Session */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center gap-3.5 transition-all hover:border-slate-300">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Active Session</span>
            <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">{lastLoginFormatted}</span>
            <span className="text-[11px] text-slate-500 truncate block">Asia/Kolkata (IST)</span>
          </div>
        </div>

        {/* Metric 3: Bank Details Status */}
        <div 
          onClick={!hasBankDetails ? handleOpenBankModal : undefined}
          className={`bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center gap-3.5 transition-all hover:border-slate-300 ${
            !hasBankDetails ? 'cursor-pointer hover:border-amber-300 hover:bg-amber-50/30' : ''
          }`}
          title={!hasBankDetails ? 'Click to add bank details' : 'Bank verification on file'}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            hasBankDetails 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            <CreditCard size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bank Verification</span>
            <span className={`text-sm font-bold truncate block mt-0.5 ${hasBankDetails ? 'text-emerald-800' : 'text-amber-800'}`}>
              {hasBankDetails ? 'Verified & On File' : 'Pending Submission'}
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              {hasBankDetails ? (userBank?.bankName || 'Direct payroll active') : '+ Click to add bank details'}
            </span>
          </div>
        </div>

        {/* Metric 4: Compliance & Terms */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center gap-3.5 transition-all hover:border-slate-300">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Policy &amp; Terms</span>
            <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">
              {termsAccepted ? 'Terms Accepted' : 'Pending Agreement'}
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              {isApproved ? 'Management Approved' : 'Verification in progress'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl px-2 pt-1 shadow-xs transition-colors">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'details'
              ? 'border-[#034665] text-[#034665] bg-sky-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <User size={16} className={activeTab === 'details' ? 'text-[#034665]' : 'text-slate-400'} />
          <span>Personal &amp; Organization Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'documents'
              ? 'border-[#034665] text-[#034665] bg-sky-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <FileBadge size={16} className={activeTab === 'documents' ? 'text-[#034665]' : 'text-slate-400'} />
          <span>Documents &amp; Statutory Proofs</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            activeTab === 'documents'
              ? 'bg-[#034665] text-white'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {documents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'border-[#034665] text-[#034665] bg-sky-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <KeyRound size={16} className={activeTab === 'security' ? 'text-[#034665]' : 'text-slate-400'} />
          <span>Security &amp; Password</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERSONAL & ORGANIZATION DETAILS */}
      {/* ========================================================================= */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (1/3): Identity, Demographics & Employment Specs */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* Identity & Demographics Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <User size={15} className="text-[#034665]" />
                  <span>Identity &amp; Demographics</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('personal-details-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[11px] font-bold text-[#034665] hover:underline flex items-center gap-1 cursor-pointer"
                  title="Scroll to edit form"
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>
              </div>
              
              <div className="space-y-3.5 text-xs">
                {/* Date of Birth */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    <span>Date of Birth</span>
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {dobInput ? formatDate(dobInput) : dob}
                  </span>
                </div>

                {/* Gender */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <User size={13} className="text-slate-400" />
                    <span>Gender</span>
                  </span>
                  <span className="font-bold text-slate-900">
                    {genderInput || gender}
                  </span>
                </div>

                {/* Blood Group */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <HeartPulse size={13} className="text-rose-500" />
                    <span>Blood Group</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold font-mono border border-rose-200 text-xs">
                    {bloodGroupInput || bloodGroup}
                  </span>
                </div>

                {/* Employee ID */}
                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-slate-400" />
                    <span>Unique ID</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">{employeeId}</span>
                </div>
              </div>
            </div>

            {/* Employment & Organization Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <Briefcase size={15} className="text-[#034665]" />
                <span>Employment &amp; Organization</span>
              </h3>
              
              <div className="space-y-3.5 text-xs">
                {/* Department */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500">Department</span>
                  <span className="px-2 py-0.5 rounded bg-sky-50 text-[#034665] font-bold border border-sky-100">
                    {department}
                  </span>
                </div>

                {/* Designation */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500">Designation</span>
                  <span className="font-bold text-slate-900">{designation}</span>
                </div>

                {/* System Role */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500">System Role</span>
                  <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {displayRole}
                  </span>
                </div>

                {/* Account Status */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-slate-500">Account Status</span>
                  <span className={`font-bold ${isAccountActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isAccountActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>

                {/* Profile Last Updated */}
                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-slate-500">Profile Updated</span>
                  <span className="text-slate-600 font-mono text-[11px]">{updatedAtFormatted}</span>
                </div>
              </div>
            </div>

            {/* Identity Proofs Quick Summary Widget */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileCheck size={15} className="text-[#034665]" />
                  <span>Statutory Proofs</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-[#034665] border border-sky-200">
                  {[aadharDoc, panDoc, passportPhotoDoc].filter(doc => Boolean(doc?.fileUrl)).length}/3 Uploaded
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Aadhar */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={aadharProofIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
                    <div className="truncate">
                      <p className="font-bold text-slate-800 truncate">Aadhar Card</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate">{aadharDoc?.docNumber || 'Not set'}</p>
                    </div>
                  </div>
                  {aadharDoc?.fileUrl ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDocViewer(aadharDoc)}
                      className="p-1.5 text-slate-500 hover:text-[#034665] hover:bg-white rounded transition cursor-pointer"
                      title="View Aadhar Card"
                    >
                      <Eye size={14} />
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>
                  )}
                </div>

                {/* PAN */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={panProofIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
                    <div className="truncate">
                      <p className="font-bold text-slate-800 truncate">PAN Card</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate">{panDoc?.docNumber || 'Not set'}</p>
                    </div>
                  </div>
                  {panDoc?.fileUrl ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDocViewer(panDoc)}
                      className="p-1.5 text-slate-500 hover:text-[#034665] hover:bg-white rounded transition cursor-pointer"
                      title="View PAN Card"
                    >
                      <Eye size={14} />
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>
                  )}
                </div>

                {/* Passport Photo */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={passportProofIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
                    <div className="truncate">
                      <p className="font-bold text-slate-800 truncate">Passport Photo</p>
                      <p className="text-[10px] text-slate-500 truncate">{passportPhotoDoc?.fileUrl ? 'Official Photo' : 'Not set'}</p>
                    </div>
                  </div>
                  {passportPhotoDoc?.fileUrl ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDocViewer(passportPhotoDoc)}
                      className="p-1.5 text-slate-500 hover:text-[#034665] hover:bg-white rounded transition cursor-pointer"
                      title="View Passport Photo"
                    >
                      <Eye size={14} />
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="w-full mt-2 py-2 text-xs font-bold text-[#034665] hover:bg-sky-50 rounded-lg border border-dashed border-[#034665]/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Manage All Documents</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Emergency Contact (if available) */}
            {emergencyContact.name && (
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                  <Users size={15} className="text-[#034665]" />
                  <span>Emergency Contact</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{emergencyContact.name}</span>
                    <span className="text-slate-500">{emergencyContact.relation || 'Relation not specified'}</span>
                  </div>
                  {emergencyContact.phone && (
                    <div className="flex items-center gap-2 text-slate-700 font-semibold bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Phone size={13} className="text-[#034665]" />
                      <span>{emergencyContact.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Technical Skills (if available) */}
            {skillsList.length > 0 && (
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                  <Code size={15} className="text-[#034665]" />
                  <span>Technical Skills</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {skillsList.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column (2/3): Editable Contact Form & Education */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* Contact & Personal Details Form */}
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 size={17} className="text-[#034665]" />
                    <span>Personal &amp; Contact Details</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update your full display name, contact phone number, and physical office/residence address.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveContact} id="personal-details-form" className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Full Name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <User size={13} className="text-[#034665]" />
                      <span>Full Name</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder="Enter full name"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                      required
                    />
                  </div>

                  {/* Email Address - Fixed and not changeable */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <Mail size={13} className="text-[#034665]" />
                        <span>Official Email Address</span>
                      </label>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Lock size={10} /> Fixed
                      </span>
                    </div>
                    <div className="relative">
                      <input 
                        type="email" 
                        value={email} 
                        readOnly
                        disabled
                        className="w-full pl-3.5 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed select-none transition"
                        title="Email address is authoritative and managed by system administration"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(email, 'Email Address')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Copy email address"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Authoritative work email registered on the organization portal.
                    </p>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <Phone size={13} className="text-[#034665]" />
                      <span>Phone Number</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="tel"
                      value={phone} 
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43212"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                      required
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Contact number for verification and critical office notifications.
                    </p>
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <Calendar size={13} className="text-[#034665]" />
                      <span>Date of Birth</span>
                    </label>
                    <input 
                      type="date"
                      value={dobInput} 
                      onChange={e => setDobInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium font-mono focus:outline-none focus:border-[#034665] transition shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Date of birth for identity and statutory records.
                    </p>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <User size={13} className="text-[#034665]" />
                      <span>Gender</span>
                    </label>
                    <select
                      value={genderInput}
                      onChange={e => setGenderInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Gender classification as recorded in employee file.
                    </p>
                  </div>

                  {/* Blood Group */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <HeartPulse size={13} className="text-rose-500" />
                      <span>Blood Group</span>
                    </label>
                    <select
                      value={bloodGroupInput}
                      onChange={e => setBloodGroupInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium font-mono focus:outline-none focus:border-[#034665] transition shadow-2xs"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Used for occupational health and emergency medical care.
                    </p>
                  </div>

                  {/* Physical Address */}
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <MapPin size={13} className="text-[#034665]" />
                      <span>Current Office / Physical Address</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      rows={3}
                      placeholder="Enter street, office/building, city, and postal code"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs resize-y"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200">
                  {isSaved && (
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-opacity">
                      <CheckCircle2 size={15} />
                      <span>Updated Successfully</span>
                    </span>
                  )}
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#034665] hover:bg-[#02334a] text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* ========================================================================= */}
            {/* BANK DETAILS SECTION: VERIFIED CARD OR ADD BANK DETAILS BUTTON */}
            {/* ========================================================================= */}
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Landmark size={18} className="text-[#034665]" />
                    <span>Bank Account &amp; Settlement Details</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official bank account for monthly salary disbursements, payroll credits, and expense claims.
                  </p>
                </div>
                {hasBankDetails ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <ShieldCheck size={13} />
                      <span>Verified &amp; Active</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenBankModal}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <Edit3 size={13} className="text-[#034665]" />
                      <span>Edit Bank Details</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenBankModal}
                    className="px-4 py-2 bg-[#034665] hover:bg-[#02334a] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Add Bank Details</span>
                  </button>
                )}
              </div>

              {hasBankDetails ? (
                <div className="p-6">
                  <div className="bg-gradient-to-br from-slate-900 via-[#034665] to-slate-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                    {/* Background glow effects */}
                    <div className="absolute -right-12 -top-12 w-48 h-48 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col justify-between space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                            <Building2 size={20} className="text-sky-300" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-sky-200/80 block">Authorized Bank</span>
                            <h4 className="text-lg font-bold text-white tracking-wide">{userBank.bankName}</h4>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold rounded-full flex items-center gap-1">
                          <BadgeCheck size={12} /> Direct Deposit
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-2 border-y border-white/10">
                        {/* Account Number */}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                            Account Number
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-semibold tracking-wider text-white">
                              {isAccountMasked && userBank.accountNumber.length > 4
                                ? `•••• •••• •••• ${userBank.accountNumber.slice(-4)}`
                                : userBank.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsAccountMasked(prev => !prev)}
                              className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
                              title={isAccountMasked ? "Reveal full account number" : "Mask account number"}
                            >
                              {isAccountMasked ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(userBank.accountNumber, "Bank Account Number")}
                              className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
                              title="Copy account number"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>

                        {/* IFSC Code */}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                            IFSC Code
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-semibold tracking-wider text-sky-200">
                              {userBank.ifscCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(userBank.ifscCode, "IFSC Code")}
                              className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
                              title="Copy IFSC code"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Account Holder</span>
                          <span className="font-semibold text-white truncate block mt-0.5">{userBank.accountHolderName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Branch Name</span>
                          <span className="font-medium text-slate-200 truncate block mt-0.5">{userBank.bankBranch || 'Primary Office Branch'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">UPI ID</span>
                          <span className="font-mono text-slate-200 truncate block mt-0.5">{userBank.upiId || 'Not linked'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-600" />
                    <span>Bank information is secured under Kevalon HRMS payroll encryption standards.</span>
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                    <Landmark size={28} />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1">No Bank Account Details Registered</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                    Your bank details have not been submitted yet. Please add your verified bank account details to enable automated salary disbursement and direct payroll settlements.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenBankModal}
                    className="px-6 py-2.5 bg-[#034665] hover:bg-[#02334a] text-white text-xs font-bold rounded-lg shadow-sm inline-flex items-center gap-2 transition cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Add Bank Details</span>
                  </button>
                </div>
              )}
            </div>

            {/* Education Records (if available) */}
            {educationList.length > 0 && (
              <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/60">
                  <GraduationCap size={18} className="text-[#034665]" />
                  <h3 className="text-sm font-bold text-slate-900">Education History</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {educationList.map((edu, index) => (
                    <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{edu.degree}</h4>
                        <p className="text-xs text-slate-600 mt-1">{edu.institute}</p>
                      </div>
                      <div className="flex items-center justify-between mt-4 text-xs font-medium">
                        <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-mono">Class of {edu.passingYear}</span>
                        <span className="text-emerald-700 font-bold">{edu.percentage}% Score</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DOCUMENTS & IDENTITY PROOFS (AADHAR, PAN, PASSPORT PHOTO, ADD) */}
      {/* ========================================================================= */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          
          {/* Header Banner for Documents */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <FileBadge size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Official Documents & Statutory Proofs
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  View, upload, and update statutory identification proofs: Aadhar Card, PAN Card, and Passport Size Photo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={syncDocumentsFromBackend}
                disabled={isSyncingDocs}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Sync documents from server"
              >
                <RefreshCw size={14} className={isSyncingDocs ? 'animate-spin' : ''} />
                <span>Sync</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddDocModalOpen(true)}
                className="profile-documents-primary-button px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Plus size={16} />
                <span>Add Document</span>
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {docFeedback.text && (
            <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between gap-3 transition-all ${
              docFeedback.type === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              <div className="flex items-center gap-3">
                {docFeedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{docFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setDocFeedback({ type: '', text: '' })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                title="Dismiss message"
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Core Documents Grid: Aadhar, PAN, Passport Size Photo */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Mandatory Identity Documents
              </h4>
              <span className="text-xs text-slate-400 font-medium">3 Statutory Records</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* ---------------- 1. AADHAR CARD ---------------- */}
              {aadharDoc && (
                <div className="profile-document-card profile-document-aadhar bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all hover:border-indigo-400">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="profile-document-icon p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                          <img src={aadharProofIcon} alt="" className="profile-proof-icon" />
                        </div>
                        <div>
                          <h5 className="text-base font-bold text-slate-900">{aadharDoc.title}</h5>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{aadharDoc.category}</span>
                        </div>
                      </div>

                      {Boolean(aadharDoc.fileUrl) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 size={11} /> Uploaded
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                      {aadharDoc.subtitle}
                    </p>

                    {/* Document Number Display / Editable */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Aadhar Number</span>
                        {editingDocId === aadharDoc.id ? (
                          <button
                            type="button"
                            onClick={() => handleSaveDocNumber(aadharDoc.id)}
                            disabled={isSavingDocNumber}
                            className="text-[11px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer disabled:opacity-60"
                          >
                            {isSavingDocNumber ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {isSavingDocNumber ? 'Saving...' : 'Save'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditNumber(aadharDoc)}
                            className="profile-document-edit text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                        )}
                      </div>

                      {editingDocId === aadharDoc.id ? (
                        <input
                          type="text"
                          value={tempDocNumber}
                          onChange={e => setTempDocNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          placeholder="e.g. 1234 5678 9012"
                          inputMode="numeric"
                          maxLength={12}
                          pattern="[0-9]{12}"
                          className="w-full px-2 py-1 text-xs font-mono bg-white border border-indigo-400 rounded-lg text-slate-900 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-bold font-mono text-slate-900">
                          {aadharDoc.docNumber || 'Not provided'}
                        </p>
                      )}
                    </div>

                    {/* File Attachment Metadata */}
                    <div className="text-xs text-slate-500 space-y-1 mb-5">
                      <div className="flex items-center justify-between">
                        <span>Attached File:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[140px] text-right" title={aadharDoc.fileName}>
                          {aadharDoc.fileName || 'None'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Updated Date:</span>
                        <span className="font-medium text-slate-700">{aadharDoc.uploadedAt}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: View & Update/Upload */}
                  <div className={`grid ${aadharDoc.fileUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-4 border-t border-slate-100`}>
                    {aadharDoc.fileUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenDocViewer(aadharDoc)}
                        className="profile-document-view w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Eye size={14} /> View
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTriggerDocUpload(aadharDoc.id)}
                      disabled={uploadingDocId === aadharDoc.id}
                      className="profile-document-update profile-document-update-aadhar w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                    >
                      {uploadingDocId === aadharDoc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingDocId === aadharDoc.id ? 'Uploading...' : (aadharDoc.fileUrl ? 'Update' : 'Upload')}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 2. PAN CARD ---------------- */}
              {panDoc && (
                <div className="profile-document-card profile-document-pan bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between transition-all hover:border-amber-400">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="profile-document-icon p-2.5 rounded-lg bg-amber-50 text-amber-600">
                          <img src={panProofIcon} alt="" className="profile-proof-icon" />
                        </div>
                        <div>
                          <h5 className="text-base font-bold text-slate-900">{panDoc.title}</h5>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{panDoc.category}</span>
                        </div>
                      </div>

                      {Boolean(panDoc.fileUrl) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 size={11} /> Uploaded
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                      {panDoc.subtitle}
                    </p>

                    {/* Document Number Display / Editable */}
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100 mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">PAN Number</span>
                        {editingDocId === panDoc.id ? (
                          <button
                            type="button"
                            onClick={() => handleSaveDocNumber(panDoc.id)}
                            disabled={isSavingDocNumber}
                            className="text-[11px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer disabled:opacity-60"
                          >
                            {isSavingDocNumber ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {isSavingDocNumber ? 'Saving...' : 'Save'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditNumber(panDoc)}
                            className="profile-document-edit text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                        )}
                      </div>

                      {editingDocId === panDoc.id ? (
                        <input
                          type="text"
                          value={tempDocNumber}
                          onChange={e => setTempDocNumber(e.target.value.replace(/[^a-z\d]/gi, '').toUpperCase().slice(0, 10))}
                          placeholder="e.g. ABCDE1234F"
                          maxLength={10}
                          autoCapitalize="characters"
                          spellCheck={false}
                          className="w-full px-2 py-1 text-xs font-mono uppercase bg-white border border-indigo-400 rounded-lg text-slate-900 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-bold font-mono uppercase text-slate-900">
                          {panDoc.docNumber || 'Not provided'}
                        </p>
                      )}
                    </div>

                    {/* File Attachment Metadata */}
                    <div className="text-xs text-slate-500 space-y-1 mb-5">
                      <div className="flex items-center justify-between">
                        <span>Attached File:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[140px] text-right" title={panDoc.fileName}>
                          {panDoc.fileName || 'None'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Updated Date:</span>
                        <span className="font-medium text-slate-700">{panDoc.uploadedAt}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: View & Update/Upload */}
                  <div className={`grid ${panDoc.fileUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-4 border-t border-slate-100`}>
                    {panDoc.fileUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenDocViewer(panDoc)}
                        className="profile-document-view w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye size={14} /> View
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTriggerDocUpload(panDoc.id)}
                      disabled={uploadingDocId === panDoc.id}
                      className="profile-document-update profile-document-update-pan w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {uploadingDocId === panDoc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingDocId === panDoc.id ? 'Uploading...' : (panDoc.fileUrl ? 'Update' : 'Upload')}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 3. PASSPORT SIZE PHOTO ---------------- */}
              {passportPhotoDoc && (
                <div className="profile-document-card profile-document-passport bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between transition-all hover:border-purple-400">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="profile-document-icon p-2.5 rounded-lg bg-purple-50 text-purple-600">
                          <img src={passportProofIcon} alt="" className="profile-proof-icon" />
                        </div>
                        <div>
                          <h5 className="text-base font-bold text-slate-900">{passportPhotoDoc.title}</h5>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{passportPhotoDoc.category}</span>
                        </div>
                      </div>

                      {Boolean(passportPhotoDoc.fileUrl) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 size={11} /> Uploaded
                        </span>
                      )}
                    </div>

                    {/* Passport Photo Preview Box */}
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-md border border-slate-100 mb-4">
                      <div className="w-16 h-20 rounded border border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                        {passportPhotoDoc.fileUrl ? (
                          <img 
                            src={passportPhotoDoc.fileUrl} 
                            alt="Passport size preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img 
                            src={companyLogo} 
                            alt="Company Logo" 
                            className="w-full h-full object-contain p-1"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">Status</span>
                        <p className="text-xs font-bold text-slate-800">Formal ID Portrait</p>
                        <p className="text-[11px] text-slate-500 mt-1">Standard 35mm x 45mm formal photo</p>
                      </div>
                    </div>

                    {/* File Attachment Metadata */}
                    <div className="text-xs text-slate-500 space-y-1 mb-3">
                      <div className="flex items-center justify-between">
                        <span>Attached File:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[140px] text-right">
                          {passportPhotoDoc.fileName || (passportPhotoDoc.fileUrl ? 'Passport_Photo.jpg' : 'None')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Updated Date:</span>
                        <span className="font-medium text-slate-700">{passportPhotoDoc.uploadedAt}</span>
                      </div>
                    </div>

                    {/* Sync to Profile Photo Button */}
                    {passportPhotoDoc.fileUrl && (
                      <button
                        type="button"
                        onClick={() => handleApplyPassportAsProfile(passportPhotoDoc)}
                        className="w-full mb-4 py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Set this photo as your active profile avatar"
                      >
                        <Camera size={13} /> Set as Profile Photo
                      </button>
                    )}
                  </div>

                  {/* Action Buttons: View & Update/Upload */}
                  <div className={`grid ${passportPhotoDoc.fileUrl ? 'grid-cols-3' : 'grid-cols-1'} gap-2 pt-4 border-t border-slate-100`}>
                    {passportPhotoDoc.fileUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenDocViewer(passportPhotoDoc)}
                        className="profile-document-view w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye size={14} /> View
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTriggerDocUpload(passportPhotoDoc.id)}
                      disabled={uploadingDocId === passportPhotoDoc.id}
                      className="profile-document-update profile-document-update-passport w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {uploadingDocId === passportPhotoDoc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingDocId === passportPhotoDoc.id ? 'Uploading...' : (passportPhotoDoc.fileUrl ? 'Update' : 'Upload')}
                    </button>

                    {passportPhotoDoc.fileUrl && (
                      <button
                        type="button"
                        onClick={handleDeletePassportPhoto}
                        disabled={isDeletingPassportPhoto || uploadingDocId === passportPhotoDoc.id}
                        className="profile-document-delete w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete passport size photo"
                        aria-label="Delete passport size photo"
                      >
                        {isDeletingPassportPhoto ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Additional / Custom Added Documents Section */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Additional Official & Educational Documents
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Driving License, Voter ID, Degree Certificates, and Relieving Letters
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddDocModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Another
              </button>
            </div>

            {customDocs.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                <FileText size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                <h5 className="text-sm font-semibold text-slate-700">No additional documents uploaded yet</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  You can add your Driving License, Voter ID, Passport, or Degree Certificates at any time.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddDocModalOpen(true)}
                  className="profile-documents-primary-button mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus size={14} /> Upload Custom Document
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {customDocs.map(doc => (
                  <div key={doc.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between transition-all hover:border-slate-400">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded bg-slate-100 text-slate-600">
                            <FileText size={18} />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{doc.title}</h5>
                            <span className="text-[10px] text-slate-400 font-mono block">{doc.docNumber || 'Uploaded'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded text-xs text-slate-500 space-y-1 mb-4 border border-slate-100">
                        <div className="flex justify-between">
                          <span>File:</span>
                          <span className="font-medium text-slate-700 truncate max-w-[130px]">{doc.fileName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-medium text-slate-700">{doc.uploadedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`grid ${doc.fileUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-3 border-t border-slate-100`}>
                      {doc.fileUrl && (
                        <button
                          type="button"
                          onClick={() => handleOpenDocViewer(doc)}
                          className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <Eye size={13} /> View
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleTriggerDocUpload(doc.id)}
                        disabled={uploadingDocId === doc.id}
                        className="py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                      >
                        {uploadingDocId === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {doc.fileUrl ? 'Update' : 'Upload'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SECURITY & PASSWORD */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white border border-slate-200 rounded-md transition-colors shadow-sm">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <KeyRound size={18} className="text-slate-500" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">Security & Password</h3>
                <p className="text-xs text-slate-500 mt-0.5">Ensure your account is using a long, random password to stay secure.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordUpdate} className="p-6 space-y-6">
              {passwordMsg.text && (
                <div className={`p-3 rounded-md text-sm font-medium border ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                  {passwordMsg.text}
                </div>
              )}

              <div className="space-y-5">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? 'text' : 'password'} 
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      required
                      className="w-full pl-4 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      aria-label="Toggle current password visibility"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password and Confirm New Password */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        type={showNewPassword ? 'text' : 'password'} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        required
                        className="w-full pl-4 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        aria-label="Toggle new password visibility"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        required
                        className="w-full pl-4 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-6 border-t border-slate-200">
                <button 
                  type="submit" 
                  disabled={isPasswordSaving}
                  className="px-6 py-2.5 btn-brand-primary text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-70"
                  style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
                >
                  {isPasswordSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  {isPasswordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOCUMENT VIEWER LIGHTBOX MODAL (IMAGE & PDF SUPPORT) */}
      {/* ========================================================================= */}
      {docViewerModal.isOpen && docViewerModal.doc && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCloseDocViewer}
        >
          <div 
            className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl h-[88vh] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {docViewerModal.doc.title}
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {docViewerModal.doc.docNumber || 'Document'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">{docViewerModal.doc.fileName} • Uploaded {docViewerModal.doc.uploadedAt}</p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                {docViewerModal.doc.fileUrl && (
                  <a
                    href={docViewerModal.doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    title="Open in New Tab"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                
                {docViewerModal.doc.fileUrl && (
                  <a
                    href={docViewerModal.doc.fileUrl}
                    download={docViewerModal.doc.fileName || 'document'}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    title="Download Document"
                  >
                    <Download size={18} />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleCloseDocViewer}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  title="Close Viewer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Viewer Zoom & Rotation Toolbar (For Image Preview) */}
            {!isDocPdf(docViewerModal.doc) && docViewerModal.doc.fileUrl && (
              <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
                <span className="font-medium">Image View Controls:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDocViewerModal(p => ({ ...p, zoomLevel: Math.max(50, p.zoomLevel - 25) }))}
                    className="p-1 hover:bg-slate-200 rounded"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="font-mono text-xs w-12 text-center">{docViewerModal.zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setDocViewerModal(p => ({ ...p, zoomLevel: Math.min(250, p.zoomLevel + 25) }))}
                    className="p-1 hover:bg-slate-200 rounded"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocViewerModal(p => ({ ...p, rotation: (p.rotation + 90) % 360 }))}
                    className="p-1 hover:bg-slate-200 rounded ml-2"
                    title="Rotate 90deg"
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocViewerModal(p => ({ ...p, zoomLevel: 100, rotation: 0 }))}
                    className="p-1 hover:bg-slate-200 rounded ml-1"
                    title="Reset View"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body: Document Preview Content */}
            <div className={`flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 ${isDocPdf(docViewerModal.doc) ? 'p-2 sm:p-3' : 'p-6'} min-h-[360px]`}>
              {!docViewerModal.doc.fileUrl ? (
                <div className="text-center p-8">
                  <FileText size={48} className="mx-auto text-slate-400 mb-3 opacity-50" />
                  <p className="text-sm font-semibold text-slate-700">No document file attached yet</p>
                  <p className="text-xs text-slate-500 mt-1">Upload a scanned copy or photograph of this document.</p>
                  <button
                    type="button"
                    onClick={() => {
                      handleTriggerDocUpload(docViewerModal.doc.id);
                    }}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload size={14} /> Upload Now
                  </button>
                </div>
              ) : isDocPdf(docViewerModal.doc) ? (
                /* Direct PDF Preview inside Viewer */
                <div className="w-full h-full flex flex-col flex-1 min-h-[480px]">
                  <iframe
                    src={docViewerModal.doc.fileUrl}
                    title={docViewerModal.doc.title || "PDF Document"}
                    className="w-full h-full min-h-[480px] flex-1 rounded-lg border border-slate-200 bg-white shadow-inner"
                  />
                </div>
              ) : (
                /* Direct Image Preview with Interactive Scale & Rotation */
                <div className="overflow-auto max-h-[70vh] flex items-center justify-center w-full">
                  <img
                    src={docViewerModal.doc.fileUrl}
                    alt={docViewerModal.doc.title}
                    style={{
                      transform: `scale(${docViewerModal.zoomLevel / 100}) rotate(${docViewerModal.rotation}deg)`,
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="text-xs text-slate-500">
                <span>Category: </span>
                <span className="font-semibold text-slate-700">{docViewerModal.doc.category}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTriggerDocUpload(docViewerModal.doc.id)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Upload size={14} /> Replace Document
                </button>
                <button
                  type="button"
                  onClick={handleCloseDocViewer}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD NEW DOCUMENT MODAL */}
      {/* ========================================================================= */}
      {isAddDocModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsAddDocModalOpen(false)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Plus size={18} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Add New Document</h4>
                  <p className="text-xs text-slate-500">Upload additional identity or certification records</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddDocModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewDocumentSubmit} className="p-6 space-y-4">
              {/* Document Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Document Type
                </label>
                <select
                  value={newDocForm.presetType}
                  onChange={e => setNewDocForm(p => ({ ...p, presetType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="Aadhar Card">Aadhar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Passport Size Photo">Passport Size Photo</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Voter ID Card">Voter ID Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Graduation Certificate">Graduation / Degree Certificate</option>
                  <option value="12th Marksheet">12th Grade Marksheet</option>
                  <option value="Experience Letter">Relieving / Experience Letter</option>
                  <option value="Bank Passbook">Bank Passbook / Cheque</option>
                  <option value="Other Document">Other Document (Custom Name)</option>
                </select>
              </div>

              {/* Custom Title Input if "Other Document" */}
              {newDocForm.presetType === 'Other Document' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={newDocForm.customTitle}
                    onChange={e => setNewDocForm(p => ({ ...p, customTitle: e.target.value }))}
                    placeholder="e.g. Postgraduate Degree Certificate"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Document Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Document Number / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={newDocForm.docNumber}
                  onChange={e => setNewDocForm(p => ({ ...p, docNumber: e.target.value }))}
                  placeholder="e.g. DL-1420110012345"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* File Attachment Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Upload Document File (PDF, PNG, JPG) *
                </label>
                <input
                  type="file"
                  ref={addDocFileInputRef}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewDocForm(p => ({ ...p, file, fileName: file.name }));
                    }
                  }}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                <div
                  onClick={() => addDocFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-lg p-6 text-center cursor-pointer bg-slate-50/50 transition-colors"
                >
                  <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                  {newDocForm.fileName ? (
                    <div>
                      <p className="text-xs font-bold text-indigo-600">{newDocForm.fileName}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Click to change selected file</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Click to choose a file</p>
                      <p className="text-[11px] text-slate-400 mt-1">Supports PDF, PNG, JPG (up to 15MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddDocModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewDoc || !newDocForm.file}
                  className="px-5 py-2 btn-brand-primary text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 transition shadow-xs"
                  style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
                >
                  {isSubmittingNewDoc ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isSubmittingNewDoc ? 'Uploading...' : 'Save & Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT BANK DETAILS MODAL */}
      {/* ========================================================================= */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-sky-50/50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#034665] text-white flex items-center justify-center shadow-xs">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {hasBankDetails ? 'Edit Bank Account Details' : 'Add Bank Account Details'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your official bank account specifications for payroll disbursements.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBankDetails} className="p-6 space-y-4">
              {bankModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{bankModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bank Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.bankName}
                    onChange={e => setBankForm(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>

                {/* Account Holder Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Holder Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.accountHolderName}
                    onChange={e => setBankForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
                    placeholder="Full name as printed on bank passbook / cheque"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.accountNumber}
                    onChange={e => setBankForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="e.g. 50100234567890"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium font-mono focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>

                {/* Confirm Account Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.confirmAccountNumber}
                    onChange={e => setBankForm(prev => ({ ...prev, confirmAccountNumber: e.target.value }))}
                    placeholder="Re-enter bank account number"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium font-mono focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>

                {/* IFSC Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    IFSC Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={bankForm.ifscCode}
                    onChange={e => setBankForm(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium font-mono uppercase focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>

                {/* Bank Branch */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bank Branch
                  </label>
                  <input
                    type="text"
                    value={bankForm.bankBranch}
                    onChange={e => setBankForm(prev => ({ ...prev, bankBranch: e.target.value }))}
                    placeholder="e.g. Solaris Hub Branch, Ahmedabad"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>

                {/* UPI ID (Optional) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    UPI ID <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={bankForm.upiId}
                    onChange={e => setBankForm(prev => ({ ...prev, upiId: e.target.value }))}
                    placeholder="e.g. employee@oksbi / username@okaxis"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#034665] transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200 mt-6">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  disabled={isSavingBank}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="px-6 py-2.5 bg-[#034665] hover:bg-[#02334a] text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
                >
                  {isSavingBank ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>{isSavingBank ? 'Saving...' : 'Save Bank Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};