import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Shield, Save, CheckCircle2, User, 
  Mail, Phone, Briefcase, Calendar, 
  HeartPulse, MapPin, GraduationCap, 
  Code, Users, Loader2, Lock, KeyRound,
  Camera, Upload, Eye, EyeOff, Download, Trash2,
  Plus, FileText, FileCheck, CreditCard,
  Image as ImageIcon, ExternalLink, X,
  ZoomIn, ZoomOut, RotateCw, RefreshCw,
  FileBadge, ArrowRight, Edit3, Check,
  AlertCircle
} from 'lucide-react';
import { useApp, resolveEmployeeName, resolveEmployeeData, fetchLiveUserProfile } from '../../context/AppContext.jsx';
import api from '../../api/axios.js'; 
import companyLogo from '../../assets/Logo.png';

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

export const ProfileView = () => {
  const { user: contextUser, updateUserProfile, userRole, roleDetails } = useApp();
  
  const [profileData, setProfileData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'documents' | 'security'

  // Form States - Personal & Contact
  const [name, setName] = useState(() => resolveEmployeeName(contextUser) || '');
  const [phone, setPhone] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return emp.mobile || contextUser?.mobile || contextUser?.phone || '';
  });
  const [email, setEmail] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return emp.email || contextUser?.email || '';
  });
  const [address, setAddress] = useState(() => {
    const emp = resolveEmployeeData(contextUser);
    return emp.currentAddress || contextUser?.address || '';
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
  const [editingDocId, setEditingDocId] = useState(null);
  const [tempDocNumber, setTempDocNumber] = useState('');

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
      setPhone(emp.mobile || prof.phoneNumber || effectiveData.mobile || effectiveData.phoneNumber || '');
      setEmail(emp.email || prof.email || effectiveData.email || contextUser?.email || '');
      setAddress(emp.currentAddress || prof.address || effectiveData.address || effectiveData.currentAddress || '');

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

  const activePhotoUrl = localPhotoUrl || serverPhotoUrl;

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
            status: aadharNum ? 'uploaded' : 'pending',
            fileUrl: '',
            fileName: aadharNum ? 'Aadhar_Card.pdf' : '',
            fileType: 'application/pdf',
            uploadedAt: aadharNum ? 'Recorded' : 'Pending',
            isCore: true
          },
          {
            id: 'pan',
            key: 'pan',
            title: 'PAN Card',
            subtitle: 'Permanent Account Number issued by Income Tax Department',
            category: 'Tax ID & Proof',
            docNumber: panNum || 'Not Provided',
            status: panNum ? 'uploaded' : 'pending',
            fileUrl: '',
            fileName: panNum ? 'PAN_Card.jpg' : '',
            fileType: 'image/jpeg',
            uploadedAt: panNum ? 'Recorded' : 'Pending',
            isCore: true
          },
          {
            id: 'passport_photo',
            key: 'passport_photo',
            title: 'Passport Size Photo',
            subtitle: 'Official formal color photograph with solid background',
            category: 'Photograph',
            docNumber: activePhotoUrl ? 'Active Employee Photo' : 'Not Uploaded',
            status: activePhotoUrl ? 'uploaded' : 'pending',
            fileUrl: activePhotoUrl || '',
            fileName: activePhotoUrl ? 'Passport_Size_Photo.jpg' : '',
            fileType: 'image/jpeg',
            uploadedAt: activePhotoUrl ? 'Uploaded' : 'Pending',
            isCore: true
          }
        ];
      }

      // 3. Attempt to fetch remote documents from backend /api/document
      try {
        const backendRes = await api.get('/api/document');
        const remoteList = backendRes.data?.data || backendRes.data;
        if (Array.isArray(remoteList) && remoteList.length > 0) {
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

          if (relevantRemote.length > 0) {
            relevantRemote.forEach(remoteDoc => {
              const matchedCore = initialDocs.find(d => 
                d.title.toLowerCase().trim() === remoteDoc.title.toLowerCase().trim() ||
                d.id.toLowerCase() === remoteDoc.title.toLowerCase().replace(/\s+/g, '_')
              );
              if (matchedCore) {
                matchedCore.fileUrl = remoteDoc.fileUrl || matchedCore.fileUrl;
                matchedCore.fileName = remoteDoc.fileName || matchedCore.fileName;
                matchedCore.fileType = remoteDoc.fileType || matchedCore.fileType;
                if (remoteDoc.description) matchedCore.docNumber = remoteDoc.description;
                matchedCore.status = 'uploaded';
                matchedCore.remoteId = remoteDoc._id;
                if (remoteDoc.createdAt) {
                  try {
                    matchedCore.uploadedAt = new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  } catch (e) {}
                }
              } else {
                // Add as custom document if not already in list
                const exists = initialDocs.some(d => d.remoteId === remoteDoc._id || d.title.toLowerCase().trim() === remoteDoc.title.toLowerCase().trim());
                if (!exists) {
                  initialDocs.push({
                    id: `remote-${remoteDoc._id}`,
                    remoteId: remoteDoc._id,
                    title: remoteDoc.title,
                    subtitle: 'Uploaded Employee Document',
                    category: 'Official Record',
                    docNumber: remoteDoc.description || 'Verified Record',
                    status: 'uploaded',
                    fileUrl: remoteDoc.fileUrl,
                    fileName: remoteDoc.fileName || `${remoteDoc.title}.pdf`,
                    fileType: remoteDoc.fileType || 'application/pdf',
                    uploadedAt: remoteDoc.createdAt ? new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
                    isCore: false
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn("Could not query backend documents endpoint:", err);
      }

      setDocuments(initialDocs);
      try {
        localStorage.setItem(localStorageDocKey, JSON.stringify(initialDocs));
      } catch (e) {
        console.warn("Could not cache documents in localStorage", e);
      }
    };

    if (!isLoadingData) {
      initializeDocuments();
    }
  }, [isLoadingData, currentUserId, localStorageDocKey, activePhotoUrl]);

  // Sync documents on-demand from GET /api/document
  const syncDocumentsFromBackend = async () => {
    setIsSyncingDocs(true);
    try {
      const backendRes = await api.get('/api/document');
      const remoteList = backendRes.data?.data || backendRes.data;
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

        if (relevantRemote.length > 0) {
          const updated = [...documents];
          relevantRemote.forEach(remoteDoc => {
            const matchedCore = updated.find(d => 
              d.title.toLowerCase().trim() === remoteDoc.title.toLowerCase().trim() ||
              d.id.toLowerCase() === remoteDoc.title.toLowerCase().replace(/\s+/g, '_')
            );
            if (matchedCore) {
              matchedCore.fileUrl = remoteDoc.fileUrl || matchedCore.fileUrl;
              matchedCore.fileName = remoteDoc.fileName || matchedCore.fileName;
              matchedCore.fileType = remoteDoc.fileType || matchedCore.fileType;
              if (remoteDoc.description) matchedCore.docNumber = remoteDoc.description;
              matchedCore.status = 'uploaded';
              matchedCore.remoteId = remoteDoc._id;
              if (remoteDoc.createdAt) {
                try {
                  matchedCore.uploadedAt = new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                } catch (e) {}
              }
            } else {
              const exists = updated.some(d => d.remoteId === remoteDoc._id || d.title.toLowerCase().trim() === remoteDoc.title.toLowerCase().trim());
              if (!exists) {
                updated.push({
                  id: `remote-${remoteDoc._id}`,
                  remoteId: remoteDoc._id,
                  title: remoteDoc.title,
                  subtitle: 'Uploaded Employee Document',
                  category: 'Official Record',
                  docNumber: remoteDoc.description || 'Verified Record',
                  status: 'uploaded',
                  fileUrl: remoteDoc.fileUrl,
                  fileName: remoteDoc.fileName || `${remoteDoc.title}.pdf`,
                  fileType: remoteDoc.fileType || 'application/pdf',
                  uploadedAt: remoteDoc.createdAt ? new Date(remoteDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
                  isCore: false
                });
              }
            }
          });
          persistDocuments(updated);
          setDocFeedback({ type: 'success', text: 'Documents synchronized with server successfully!' });
          setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
        } else {
          setDocFeedback({ type: 'success', text: 'Documents are up to date!' });
          setTimeout(() => setDocFeedback({ type: '', text: '' }), 2500);
        }
      }
    } catch (err) {
      console.warn("Could not sync documents:", err);
      setDocFeedback({ type: 'error', text: 'Could not synchronize with server documents.' });
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
  };

  // --- Profile Photo Upload & Management ---
  const handleProfilePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please upload a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit. Please choose a smaller image.");
      return;
    }

    setIsPhotoUploading(true);
    setPhotoFeedback({ type: '', text: '' });

    try {
      // 1. Instant local preview
      const reader = new FileReader();
      reader.onload = async (readEvent) => {
        const dataUrl = readEvent.target.result;
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

        try {
          await api.put('/api/employee-panel/profile', {
            profilePhoto: finalUrl,
            photoUrl: finalUrl,
            avatar: finalUrl,
            image: finalUrl
          });
        } catch (e) {}

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

        // 6. Also sync Passport Size Photo document if present
        setDocuments(prevDocs => {
          const updated = prevDocs.map(doc => {
            if (doc.id === 'passport_photo') {
              return {
                ...doc,
                fileUrl: finalUrl,
                fileName: file.name || 'Passport_Size_Photo.jpg',
                status: 'uploaded',
                uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              };
            }
            return doc;
          });
          try {
            localStorage.setItem(localStorageDocKey, JSON.stringify(updated));
          } catch (e) {
            console.warn(e);
          }
          return updated;
        });

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
    setImgError(false);

    try {
      localStorage.removeItem(localStoragePhotoKey);
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
      updateUserProfile({ profilePhoto: '', photoUrl: '', avatar: '' });
    }

    try {
      await api.put('/api/users/profile/update', {
        profilePhoto: '',
        photoUrl: '',
        avatar: ''
      });
    } catch (e) {
      console.warn("Backend reset photo warning:", e);
    }

    setPhotoFeedback({ type: 'success', text: 'Profile photo reverted to company logo.' });
    setTimeout(() => setPhotoFeedback({ type: '', text: '' }), 3000);
  };

  // --- Document Actions: View, Update, Add, Delete ---
  const handleOpenDocViewer = (doc) => {
    setDocViewerModal({
      isOpen: true,
      doc,
      zoomLevel: 100,
      rotation: 0
    });
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

  const handleDocFileChanged = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetActionDocId) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit. Please upload a smaller file.");
      return;
    }

    const docToUpdate = documents.find(d => d.id === targetActionDocId);
    if (!docToUpdate) return;

    setUploadingDocId(targetActionDocId);
    setDocFeedback({ type: '', text: '' });

    try {
      const reader = new FileReader();
      reader.onload = async (readEvent) => {
        const dataUrl = readEvent.target.result;
        let finalFileUrl = dataUrl;

        // Try backend upload to /api/document/upload with Mongoose documentSchema
        let uploadedRemoteId = null;
        try {
          const validId = resolveEmployeeId();
          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', docToUpdate.title);
          formData.append('description', docToUpdate.docNumber || docToUpdate.subtitle || '');
          formData.append('documentType', 'employee');
          formData.append('referenceId', validId);
          formData.append('fileName', file.name);
          formData.append('fileType', file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));
          if (validId) formData.append('uploadedBy', validId);

          const uploadRes = await api.post('/api/document/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (uploadRes.data?.data?.fileUrl) {
            finalFileUrl = uploadRes.data.data.fileUrl;
          }
          if (uploadRes.data?.data?._id) {
            uploadedRemoteId = uploadRes.data.data._id;
          }
        } catch (uploadErr) {
          console.warn("Upload endpoint fallback to Data URL:", uploadErr);
        }

        const nowFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const updatedDocs = documents.map(d => {
          if (d.id === targetActionDocId) {
            return {
              ...d,
              remoteId: uploadedRemoteId || d.remoteId,
              fileUrl: finalFileUrl,
              fileName: file.name,
              fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
              status: 'uploaded',
              uploadedAt: nowFormatted
            };
          }
          return d;
        });

        persistDocuments(updatedDocs);

        // If updated document was passport photo, sync with profile photo!
        if (targetActionDocId === 'passport_photo') {
          setLocalPhotoUrl(finalFileUrl);
          setImgError(false);
          if (updateUserProfile) {
            updateUserProfile({ profilePhoto: finalFileUrl, photoUrl: finalFileUrl, avatar: finalFileUrl });
          }
          try {
            localStorage.setItem(localStoragePhotoKey, finalFileUrl);
            await api.put('/api/users/profile/update', {
              profilePhoto: finalFileUrl,
              photoUrl: finalFileUrl,
              avatar: finalFileUrl
            });
          } catch (e) {
            console.warn(e);
          }
        }

        // If doc viewer is open with this doc, update viewer state too
        if (docViewerModal.isOpen && docViewerModal.doc?.id === targetActionDocId) {
          setDocViewerModal(prev => ({
            ...prev,
            doc: {
              ...prev.doc,
              fileUrl: finalFileUrl,
              fileName: file.name,
              fileType: file.type,
              status: 'uploaded',
              uploadedAt: nowFormatted
            }
          }));
        }

        setDocFeedback({ type: 'success', text: `${docToUpdate.title} updated successfully!` });
        setTimeout(() => setDocFeedback({ type: '', text: '' }), 4000);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading document:", err);
      setDocFeedback({ type: 'error', text: 'Failed to upload document.' });
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
      alert("Please upload a passport size photo first.");
      return;
    }

    setLocalPhotoUrl(doc.fileUrl);
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
    setTempDocNumber(doc.docNumber || '');
  };

  const handleSaveDocNumber = (docId) => {
    const updatedDocs = documents.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          docNumber: tempDocNumber.trim()
        };
      }
      return d;
    });
    persistDocuments(updatedDocs);
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
      alert("Please specify a document title.");
      return;
    }

    if (!newDocForm.file) {
      alert("Please attach a file for this document.");
      return;
    }

    setIsSubmittingNewDoc(true);

    try {
      const reader = new FileReader();
      reader.onload = async (readEvent) => {
        const dataUrl = readEvent.target.result;
        let finalFileUrl = dataUrl;

        let newRemoteId = null;
        try {
          const validId = resolveEmployeeId();
          const formData = new FormData();
          formData.append('file', newDocForm.file);
          formData.append('title', finalTitle);
          formData.append('description', newDocForm.docNumber.trim() || 'Verified Official Record');
          formData.append('documentType', 'employee');
          formData.append('referenceId', validId);
          formData.append('fileName', newDocForm.file.name);
          formData.append('fileType', newDocForm.file.type || (newDocForm.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));
          if (validId) formData.append('uploadedBy', validId);

          const uploadRes = await api.post('/api/document/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (uploadRes.data?.data?.fileUrl) {
            finalFileUrl = uploadRes.data.data.fileUrl;
          }
          if (uploadRes.data?.data?._id) {
            newRemoteId = uploadRes.data.data._id;
          }
        } catch (uploadErr) {
          console.warn("Add document upload warning:", uploadErr);
        }

        const newDocItem = {
          id: `custom-doc-${Date.now()}`,
          remoteId: newRemoteId,
          title: finalTitle,
          subtitle: 'Verified Statutory Document',
          category: 'Official Record',
          docNumber: newDocForm.docNumber.trim() || 'Verified Record',
          status: 'uploaded',
          fileUrl: finalFileUrl,
          fileName: newDocForm.file.name,
          fileType: newDocForm.file.type || (newDocForm.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          isCore: false
        };

        const updatedDocs = [...documents, newDocItem];
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

        setDocFeedback({ type: 'success', text: `"${finalTitle}" added to your documents!` });
        setTimeout(() => setDocFeedback({ type: '', text: '' }), 4000);
      };

      reader.readAsDataURL(newDocForm.file);
    } catch (err) {
      console.error("Failed to add document:", err);
      alert("Failed to add document. Please try again.");
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
        await api.delete(`/api/document/${docToDelete.remoteId}`);
      } catch (err) {
        console.warn("Backend delete document warning:", err);
      }
    }

    const updatedDocs = documents.filter(d => d.id !== docId);
    persistDocuments(updatedDocs);

    setDocFeedback({ type: 'success', text: `"${docToDelete.title}" has been removed.` });
    setTimeout(() => setDocFeedback({ type: '', text: '' }), 3000);
  };

  // --- Personal & Contact Form Save ---
  const handleSaveContact = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const cleanName = name.trim();

    try {
      // 1. Immediately persist locally so UI never flashes or reverts to old database username
      if (cleanName) {
        localStorage.setItem('kt_employee_full_name', cleanName);
      }

      // 2. Prepare payload with all name representations
      const payload = { 
        name: cleanName,
        fullName: cleanName,
        employeeName: cleanName,
        phoneNumber: phone, 
        mobile: phone,
        address,
        currentAddress: address
      };

      // 3. Update user profile on backend
      try {
        await api.put('/api/users/profile/update', payload);
      } catch (err) {
        console.warn('PUT /api/users/profile/update notice:', err?.message);
      }

      const updatedFields = {
        name: cleanName,
        fullName: cleanName,
        phone,
        mobile: phone,
        address,
        currentAddress: address
      };

      if (updateUserProfile) {
        updateUserProfile(updatedFields);
      }

      await fetchProfile(false);

      setProfileData(prev => ({
        ...prev,
        name: cleanName,
        fullName: cleanName,
        employee: { ...(prev?.employee || {}), name: cleanName, fullName: cleanName, mobile: phone, currentAddress: address },
        profile: { ...(prev?.profile || {}), name: cleanName, fullName: cleanName, phoneNumber: phone, address }
      }));

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile details.");
    } finally {
      setIsSaving(false);
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">Loading your profile & documents...</p>
      </div>
    );
  }

  const fullName = name || resolveEmployeeName(profileData) || resolveEmployeeName(contextUser) || 'Employee';
  const employeeId = emp.employeeID || prof.uniqueID || profileData?.employeeID || 'N/A';
  const designation = emp.designation || prof.designation || contextUser?.designation || profileData?.designation || 'N/A';
  const department = emp.department || prof.department || contextUser?.department || profileData?.department || 'N/A';
  const joiningDateRaw = emp.joiningDate || prof.dob || profileData?.joiningDate;
  const joiningDate = joiningDateRaw ? joiningDateRaw.split('T')[0] : 'N/A';
  const displayRole = (
    userRole === 'team_leader' 
      ? 'Team Leader' 
      : (roleDetails?.roleName || (emp.role && typeof emp.role === 'string' && !/^[0-9a-fA-F]{24}$/.test(emp.role) ? emp.role : 'Employee'))
  );
  
  const dobRaw = emp.dob || prof.dob || profileData?.dob;
  const dob = dobRaw ? dobRaw.split('T')[0] : 'N/A';
  const bloodGroup = emp.bloodGroup || prof.bloodGroup || profileData?.bloodGroup || 'N/A';
  const gender = emp.gender || profileData?.gender || 'N/A';

  const emergencyContact = emp.emergencyContact || {};
  const educationList = emp.education || [];
  const skillsList = emp.skills || [];

  // Categorized documents
  const aadharDoc = documents.find(d => d.id === 'aadhar');
  const panDoc = documents.find(d => d.id === 'pan');
  const passportPhotoDoc = documents.find(d => d.id === 'passport_photo');
  const customDocs = documents.filter(d => !d.isCore);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      
      {/* Hidden File Inputs for Document & Photo Upload */}
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

      {/* Profile Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs relative overflow-hidden">
        
        {/* Subtle background brand accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full md:w-auto text-center md:text-left">
            
            {/* Profile Photo Avatar with Interactive Camera Overlay */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 rounded-2xl border-2 border-slate-200 bg-white p-1 flex items-center justify-center overflow-hidden shadow-md relative">
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
                    alt="Kevalon Technology Logo" 
                    className="w-full h-full object-contain p-1"
                    title="Company Logo Fallback"
                  />
                )}

                {/* Hover Camera Overlay Button */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isPhotoUploading}
                  className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer disabled:cursor-not-allowed"
                  title="Update Profile Photo"
                >
                  {isPhotoUploading ? (
                    <Loader2 size={24} className="animate-spin text-white" />
                  ) : (
                    <>
                      <Camera size={22} className="mb-1 text-white" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Change</span>
                    </>
                  )}
                </button>
              </div>

              {/* Online status indicator */}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-xs" title="Online" />

              {/* Mobile / Direct Camera Icon Badge */}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isPhotoUploading}
                className="md:hidden absolute -bottom-1 -left-1 p-1.5 rounded-full bg-indigo-600 text-white shadow-md border-2 border-white"
                title="Update Photo"
              >
                <Camera size={12} />
              </button>
            </div>

            {/* Profile Details & Photo Actions */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{fullName}</h2>
                <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-xs font-bold uppercase tracking-wider">
                  {employeeId}
                </span>
              </div>
              
              <p className="text-sm text-slate-600 font-medium mt-1">{designation}</p>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-indigo-500" /> {department}</span>
                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> Joined {joiningDate}</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Shield size={14} className={userRole === 'team_leader' ? 'text-indigo-500' : 'text-amber-500'} /> 
                    Role: <strong className="text-indigo-600 font-bold">{displayRole}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Action Buttons for Photo */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isPhotoUploading}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isPhotoUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {isPhotoUploading ? 'Uploading...' : 'Update Photo'}
                </button>

                {activePhotoUrl && (
                  <button
                    type="button"
                    onClick={handleResetProfilePhoto}
                    className="px-3 py-1.5 bg-transparent hover:bg-red-50 text-slate-500 hover:text-red-600 border border-transparent hover:border-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title="Reset back to company dark blue logo"
                  >
                    Reset to Logo
                  </button>
                )}
              </div>

              {photoFeedback.text && (
                <div className={`mt-3 inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-md border ${
                  photoFeedback.type === 'error'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {photoFeedback.type === 'error' ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                  {photoFeedback.text}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats / Navigation Switch */}
          <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto justify-center md:items-end">
            <button
              type="button"
              onClick={() => fetchProfile(true)}
              disabled={isRefreshing}
              title="Fetch real-time profile details from server (GET /api/users/profile)"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : "text-slate-500"} />
              <span>{isRefreshing ? 'Fetching...' : 'Sync Live Details'}</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <FileCheck size={16} />
              <span>My Documents</span>
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {documents.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex border-b border-slate-200/80 bg-white rounded-xl px-3 pt-1 shadow-xs transition-colors">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'details'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User size={15} />
          <span>Personal Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileBadge size={15} />
          <span>Documents & Identity</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            activeTab === 'documents'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {documents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound size={15} />
          <span>Security & Password</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERSONAL DETAILS & PROFILE INFO */}
      {/* ========================================================================= */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Read-Only Identity & Skills */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* Identity Info */}
            <div className="bg-white border border-slate-200 rounded-md transition-colors shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <User size={16} className="text-slate-400" /> Identity Info
              </h3>
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</span>
                  <span className="text-sm font-medium text-slate-900 font-mono">{dob}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Gender</span>
                  <span className="text-sm font-medium text-slate-900">{gender}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Blood Group</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-bold font-mono border border-red-100">
                    <HeartPulse size={12} /> {bloodGroup}
                  </span>
                </div>
              </div>
            </div>

            {/* Documents Quick Widget */}
            <div className="bg-white border border-slate-200 rounded-md transition-colors shadow-sm p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <FileCheck size={16} className="text-indigo-500" /> Identity Proofs
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {documents.filter(d => d.status === 'uploaded').length}/{documents.length} Done
                </span>
              </div>

              <div className="space-y-3">
                {/* Aadhar summary */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded bg-indigo-50 text-indigo-600 shrink-0">
                      <CreditCard size={14} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">Aadhar Card</p>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{aadharDoc?.docNumber || 'Not set'}</p>
                    </div>
                  </div>
                  {aadharDoc?.fileUrl && (
                    <button
                      onClick={() => handleOpenDocViewer(aadharDoc)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                      title="View Aadhar Card"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>

                {/* PAN summary */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded bg-amber-100 text-amber-600 shrink-0">
                      <FileText size={14} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">PAN Card</p>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{panDoc?.docNumber || 'Not set'}</p>
                    </div>
                  </div>
                  {panDoc?.fileUrl && (
                    <button
                      onClick={() => handleOpenDocViewer(panDoc)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                      title="View PAN Card"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>

                {/* Passport Photo summary */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded bg-purple-100 text-purple-600 shrink-0">
                      <ImageIcon size={14} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">Passport Photo</p>
                      <p className="text-[11px] text-slate-500 truncate">Official Photo</p>
                    </div>
                  </div>
                  {passportPhotoDoc?.fileUrl && (
                    <button
                      onClick={() => handleOpenDocViewer(passportPhotoDoc)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                      title="View Passport Photo"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setActiveTab('documents')}
                  className="w-full mt-2 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  Manage All Documents <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* Emergency Contact */}
            {emergencyContact.name && (
              <div className="bg-white border border-slate-200 rounded-md transition-colors shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                  <Users size={16} className="text-slate-400" /> Emergency Contact
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">{emergencyContact.name}</span>
                    <span className="text-xs font-medium text-slate-500">{emergencyContact.relation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <Phone size={14} className="text-indigo-600" /> {emergencyContact.phone}
                  </div>
                </div>
              </div>
            )}

            {/* Technical Skills */}
            {skillsList.length > 0 && (
              <div className="bg-white border border-slate-200/80 rounded-xl transition-colors shadow-xs p-5">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                  <Code size={16} className="text-slate-400" /> Technical Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skillsList.map((skill, i) => (
                    <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Editable Contact Form & Education */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* Contact & Personal Details Form */}
            <div className="bg-white border border-slate-200/80 rounded-xl transition-colors shadow-xs">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-base font-semibold text-slate-900">Personal & Contact Details</h3>
                <p className="text-xs text-slate-500 mt-1">Update your display name, phone number, and physical address.</p>
              </div>

              <form onSubmit={handleSaveContact} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Full Name */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <User size={14} className="text-slate-400" /> Full Name
                    </label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder="Enter your full name"
                      className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Email Address - Fixed and not changeable */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <Mail size={14} className="text-slate-400" /> Email Address
                      </label>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Lock size={10} /> Fixed
                      </span>
                    </div>
                    <input 
                      type="email" 
                      value={email} 
                      readOnly
                      disabled
                      className="w-full px-4 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed select-none transition-colors"
                      title="Email address is fixed and cannot be changed"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Email is fixed and managed by the administrator.
                    </p>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <Phone size={14} className="text-slate-400" /> Phone Number
                    </label>
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                  
                  {/* Current Address */}
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      <MapPin size={14} className="text-slate-400" /> Current Address
                    </label>
                    <textarea 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      rows={2}
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-500 transition-colors resize-y"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
                  {isSaved && (
                    <span className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium flex items-center gap-2 transition-opacity">
                      <CheckCircle2 size={16} /> Updated Successfully
                    </span>
                  )}
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-70"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Education Records */}
            {educationList.length > 0 && (
              <div className="bg-white border border-slate-200/80 rounded-xl transition-colors shadow-xs">
                <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
                  <GraduationCap size={18} className="text-slate-500" />
                  <h3 className="text-base font-semibold text-slate-900">Education History</h3>
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
                        <span className="text-green-600 font-bold">{edu.percentage}% Score</span>
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Plus size={16} />
                <span>Add Document</span>
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {docFeedback.text && (
            <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-3 transition-all ${
              docFeedback.type === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {docFeedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{docFeedback.text}</span>
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
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all hover:border-indigo-400">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                          <CreditCard size={22} />
                        </div>
                        <div>
                          <h5 className="text-base font-bold text-slate-900">{aadharDoc.title}</h5>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{aadharDoc.category}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        aadharDoc.status === 'uploaded' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {aadharDoc.status === 'uploaded' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {aadharDoc.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                      </span>
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
                            className="text-[11px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} /> Save
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditNumber(aadharDoc)}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                        )}
                      </div>

                      {editingDocId === aadharDoc.id ? (
                        <input
                          type="text"
                          value={tempDocNumber}
                          onChange={e => setTempDocNumber(e.target.value)}
                          placeholder="e.g. 1234 5678 9012"
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
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenDocViewer(aadharDoc)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Eye size={14} /> View
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerDocUpload(aadharDoc.id)}
                      disabled={uploadingDocId === aadharDoc.id}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                    >
                      {uploadingDocId === aadharDoc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingDocId === aadharDoc.id ? 'Uploading...' : 'Update'}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 2. PAN CARD ---------------- */}
              {panDoc && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between transition-all hover:border-amber-400">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
                          <FileText size={22} />
                        </div>
                        <div>
                          <h5 className="text-base font-bold text-slate-900">{panDoc.title}</h5>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{panDoc.category}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        panDoc.status === 'uploaded' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {panDoc.status === 'uploaded' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {panDoc.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                      </span>
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
                            className="text-[11px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} /> Save
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditNumber(panDoc)}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                        )}
                      </div>

                      {editingDocId === panDoc.id ? (
                        <input
                          type="text"
                          value={tempDocNumber}
                          onChange={e => setTempDocNumber(e.target.value)}
                          placeholder="e.g. ABCDE1234F"
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
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenDocViewer(panDoc)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye size={14} /> View
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerDocUpload(panDoc.id)}
                      disabled={uploadingDocId === panDoc.id}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {uploadingDocId === panDoc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingDocId === panDoc.id ? 'Uploading...' : 'Update'}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 3. PASSPORT SIZE PHOTO ---------------- */}
              {passportPhotoDoc && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between transition-all hover:border-purple-400">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                          <ImageIcon size={22} />
                        </div>
                        <div>
                          <h5 className="text-base font-bold text-slate-900">{passportPhotoDoc.title}</h5>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{passportPhotoDoc.category}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        passportPhotoDoc.status === 'uploaded' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {passportPhotoDoc.status === 'uploaded' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {passportPhotoDoc.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                      </span>
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
                          {passportPhotoDoc.fileName || 'Passport_Photo.jpg'}
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
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenDocViewer(passportPhotoDoc)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye size={14} /> View
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerDocUpload(passportPhotoDoc.id)}
                      disabled={uploadingDocId === passportPhotoDoc.id}
                      className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {uploadingDocId === passportPhotoDoc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingDocId === passportPhotoDoc.id ? 'Uploading...' : 'Update'}
                    </button>
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
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
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

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenDocViewer(doc)}
                        className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <Eye size={13} /> View
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerDocUpload(doc.id)}
                        disabled={uploadingDocId === doc.id}
                        className="py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                      >
                        {uploadingDocId === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        Update
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
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-70"
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
            className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
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
            {(!docViewerModal.doc.fileType?.includes('pdf') && !docViewerModal.doc.fileName?.endsWith('.pdf')) && (
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
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-900/5 min-h-[360px]">
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
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Upload size={14} /> Upload Now
                  </button>
                </div>
              ) : (docViewerModal.doc.fileType?.includes('pdf') || docViewerModal.doc.fileName?.endsWith('.pdf')) ? (
                /* PDF Document Preview Card */
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center max-w-md bg-white rounded-xl border border-slate-200 shadow-md">
                  <div className="p-4 rounded-2xl bg-red-50 text-red-600 mb-4">
                    <FileText size={48} />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">{docViewerModal.doc.title}</h4>
                  <p className="text-xs font-mono text-slate-500 mt-1">{docViewerModal.doc.fileName}</p>
                  <p className="text-xs text-slate-400 mt-2">PDF Document Ready to View & Print</p>
                  
                  <div className="flex items-center gap-3 mt-6">
                    <a
                      href={docViewerModal.doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <ExternalLink size={14} /> Open Full PDF
                    </a>
                    <a
                      href={docViewerModal.doc.fileUrl}
                      download={docViewerModal.doc.fileName}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                      <Download size={14} /> Download
                    </a>
                  </div>
                </div>
              ) : (
                /* Image Preview with Interactive Scale & Rotation */
                <div className="overflow-auto max-h-[60vh] flex items-center justify-center w-full">
                  <img
                    src={docViewerModal.doc.fileUrl}
                    alt={docViewerModal.doc.title}
                    style={{
                      transform: `scale(${docViewerModal.zoomLevel / 100}) rotate(${docViewerModal.rotation}deg)`,
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-200"
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 transition-colors shadow-xs"
                >
                  {isSubmittingNewDoc ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isSubmittingNewDoc ? 'Uploading...' : 'Save & Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};