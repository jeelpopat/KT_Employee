import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Briefcase,
  CalendarDays,
  Camera,
  CreditCard,
  Globe,
  Info,
  Loader2,
  Mail,
  Map,
  MapPin,
  Pencil,
  Phone,
  RotateCw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';
import companyLogo from '../../assets/Logo.png';

const EMPTY_COMPANY = {
  name: '',
  gstin: '',
  pan: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  country: '',
  email: '',
  phone: '',
  logoUrl: '',
  workingHoursStartTime: '',
  workingHoursEndTime: '',
  weeklyOff: '',
};

const COMPANY_FIELDS = [
  { name: 'name', label: 'Company Name', icon: Building2, required: true, autoComplete: 'organization' },
  { name: 'gstin', label: 'GSTIN', icon: ShieldCheck, autoCapitalize: 'characters' },
  { name: 'pan', label: 'PAN', icon: CreditCard, autoCapitalize: 'characters' },
  { name: 'email', label: 'Email', icon: Mail, type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Phone', icon: Phone, type: 'tel', autoComplete: 'tel' },
  { name: 'city', label: 'City', icon: MapPin, autoComplete: 'address-level2' },
  { name: 'state', label: 'State', icon: Map, autoComplete: 'address-level1' },
  { name: 'pincode', label: 'PIN Code', icon: MapPin, autoComplete: 'postal-code' },
  { name: 'country', label: 'Country', icon: Globe, autoComplete: 'country-name' },
  { name: 'workingHoursStartTime', label: 'Work Start Time', icon: Briefcase },
  { name: 'workingHoursEndTime', label: 'Work End Time', icon: Briefcase },
  { name: 'weeklyOff', label: 'Weekly Off (comma-separated)', icon: CalendarDays },
  { name: 'address', label: 'Address', icon: MapPin, multiline: true, fullWidth: true },
];

const getId = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  return String(value._id || value.id || value.companyId || '').trim();
};

const getUserCompanyId = (user) => {
  const activeAccess = user?.companyAccess?.find((access) => access?.isActive);
  return getId(user?.companyId) ||
    getId(user?.company?._id || user?.company) ||
    getId(activeAccess?.companyId);
};

const normalizeCompany = (company) => ({
  ...EMPTY_COMPANY,
  name: company?.name || company?.companyName || '',
  gstin: company?.gstin || company?.gstNumber || '',
  pan: company?.pan || company?.panNumber || '',
  address: company?.address || '',
  city: company?.city || '',
  state: company?.state || '',
  pincode: company?.pincode || '',
  country: company?.country || '',
  email: company?.email || '',
  phone: company?.phone || '',
  logoUrl: company?.logoUrl || company?.companyLogo || '',
  workingHoursStartTime: company?.workingHours?.startTime || '',
  workingHoursEndTime: company?.workingHours?.endTime || '',
  weeklyOff: Array.isArray(company?.weeklyOff) ? company.weeklyOff.join(', ') : '',
});

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message || error?.message || fallback
);

export const CompanyProfileView = () => {
  const { user } = useApp();
  const logoInputRef = useRef(null);
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(EMPTY_COMPANY);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingCompany, setIsLoadingCompany] = useState(Boolean(preferredCompanyId));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (preferredCompanyId) {
      return undefined;
    }

    let active = true;

    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load companies.');
        }

        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        const availableCompanies = records.filter((record) => getId(record?._id || record?.id));
        setCompanies(availableCompanies);

        if (availableCompanies.length === 1) {
          setIsLoadingCompany(true);
          setCompanyId(getId(availableCompanies[0]._id || availableCompanies[0].id));
        } else if (availableCompanies.length === 0) {
          setLoadError('No company profile is available for this account.');
        }
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(getErrorMessage(error, 'Could not load the company list.'));
      })
      .finally(() => {
        if (active) setIsLoadingCompanies(false);
      });

    return () => {
      active = false;
    };
  }, [preferredCompanyId, reloadKey]);

  useEffect(() => {
    if (!companyId) return undefined;

    let active = true;

    api.get(`/api/company/${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false || !response.data?.data) {
          throw new Error(response.data?.message || 'Company details were not returned.');
        }

        const loadedCompany = response.data.data;
        setCompany(loadedCompany);
        setForm(normalizeCompany(loadedCompany));
        setIsEditing(false);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(getErrorMessage(error, 'Could not load company details.'));
      })
      .finally(() => {
        if (active) setIsLoadingCompany(false);
      });

    return () => {
      active = false;
    };
  }, [companyId, reloadKey]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleLogoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const message = 'Choose an image file for the company logo.';
      setLoadError(message);
      showToast(message, 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const message = 'Company logo must be 5 MB or smaller.';
      setLoadError(message);
      showToast(message, 'error');
      return;
    }

    const logoData = new FormData();
    logoData.append('logo', file);
    setIsUploadingLogo(true);
    setLoadError('');
    try {
      const response = await api.post(
        `/api/company/${encodeURIComponent(companyId)}/logo`,
        logoData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const logoUrl = response.data?.data?.logoUrl;
      if (response.data?.success === false || !logoUrl) {
        throw new Error(response.data?.message || 'Company logo was not updated.');
      }

      setCompany((previous) => ({ ...previous, logoUrl, companyLogo: logoUrl }));
      setForm((previous) => ({ ...previous, logoUrl }));
      showToast('Company logo updated successfully.', 'success');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not update the company logo.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCancel = () => {
    setForm(normalizeCompany(company));
    setIsEditing(false);
    setLoadError('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId) {
      setLoadError('Select a company before saving.');
      return;
    }
    if (!form.name.trim()) {
      setLoadError('Company Name is required.');
      return;
    }

    const originalForm = normalizeCompany(company);
    const updates = {};
    const simpleFields = Object.keys(EMPTY_COMPANY).filter(
      (field) => !['logoUrl', 'workingHoursStartTime', 'workingHoursEndTime', 'weeklyOff'].includes(field)
    );
    simpleFields.forEach((field) => {
      if (form[field] !== originalForm[field]) {
        updates[field] = form[field];
      }
    });
    if (
      form.workingHoursStartTime !== originalForm.workingHoursStartTime ||
      form.workingHoursEndTime !== originalForm.workingHoursEndTime
    ) {
      updates.workingHours = {
        startTime: form.workingHoursStartTime,
        endTime: form.workingHoursEndTime,
      };
    }
    if (form.weeklyOff !== originalForm.weeklyOff) {
      updates.weeklyOff = form.weeklyOff
        .split(',')
        .map((day) => day.trim())
        .filter(Boolean);
    }
    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      showToast('No company changes to save.', 'info');
      return;
    }

    setIsSaving(true);
    setLoadError('');
    try {
      const response = await api.put(`/api/company/${encodeURIComponent(companyId)}`, updates);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Company details were not saved.');
      }

      const savedCompany = response.data.data;
      setCompany(savedCompany);
      setForm(normalizeCompany(savedCompany));
      setIsEditing(false);
      showToast('Company profile updated successfully.', 'success');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not update the company profile.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = isLoadingCompanies || isLoadingCompany;
  const renderFieldRow = (fieldName) => {
    const field = COMPANY_FIELDS.find((item) => item.name === fieldName);
    if (!field) return null;
    const FieldIcon = field.icon;

    return (
      <div
        key={field.name}
        className={`flex min-h-[52px] items-center gap-2.5 rounded-xl bg-[#f4f7fc] px-2.5 py-2 transition-colors duration-150 hover:bg-[#edf4ff] sm:gap-3 sm:px-3 ${
          field.fullWidth ? 'md:col-span-2' : ''
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6efff] text-[#1764d8]">
          <FieldIcon size={17} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 text-xs font-medium text-[#425471] sm:text-sm">{field.label}</span>
        {isEditing ? (
          <div className="w-[48%] shrink-0 sm:w-[55%]">
            {field.multiline ? (
              <textarea
                id={`company-${field.name}`}
                name={field.name}
                value={form[field.name]}
                onChange={handleFieldChange}
                rows={2}
                className="w-full resize-y rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-right text-xs text-[#15213a] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              />
            ) : (
              <Input
                id={`company-${field.name}`}
                name={field.name}
                type={field.type || 'text'}
                value={form[field.name]}
                onChange={handleFieldChange}
                required={field.required}
                autoComplete={field.autoComplete}
                autoCapitalize={field.autoCapitalize}
                className="border-blue-100 text-right font-semibold text-[#15213a] focus:border-blue-400 focus:ring-blue-100"
              />
            )}
          </div>
        ) : (
          <span className="max-w-[52%] break-words text-right text-xs font-bold text-[#17233d] sm:text-sm">
            {form[field.name] || '—'}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-br from-[#f8fbff] via-[#f3f7ff] to-[#e8f1ff] px-4 py-4 sm:px-7 sm:py-5">
        <div className="pointer-events-none absolute -right-32 -top-64 h-[440px] w-[440px] rounded-full border-[34px] border-blue-100/70" />
        <div className="pointer-events-none absolute -right-20 -top-52 h-[360px] w-[360px] rounded-full border-[2px] border-blue-200/70" />
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={!company || isUploadingLogo || isSaving}
            aria-label="Click to change company logo"
            title={company ? 'Click to change company logo' : 'Company logo'}
            className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-[0_8px_24px_rgba(54,105,185,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(54,105,185,0.18)] disabled:cursor-default sm:h-28 sm:w-28"
          >
            <img
              src={form.logoUrl || companyLogo}
              alt={`${form.name || 'Company'} logo`}
              className="h-full w-full object-contain"
            />
            {company && (
              <>
                <span className="absolute inset-0 flex items-center justify-center bg-[#0f5ddd]/75 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera size={22} />
                </span>
                {isUploadingLogo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-[#0f5ddd]/75 text-white">
                    <Loader2 size={22} className="animate-spin" />
                  </span>
                )}
              </>
            )}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoSelected}
            className="hidden"
          />
          <div className="hidden h-16 w-0.5 bg-[#1464eb] sm:block" />
          <div className="min-w-[220px] flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#101b36] sm:text-[30px]">
              Company Profile
            </h1>
            <p className="mt-1 text-sm font-medium text-[#526582] sm:text-base">
              Company details and registration information
            </p>
            {isUploadingLogo && (
              <p className="mt-1 text-xs font-medium text-blue-700">Uploading company logo...</p>
            )}
          </div>
          {company && !isEditing && (
            <Button
              type="button"
              leftIcon={Pencil}
              onClick={() => {
                setLoadError('');
                setIsEditing(true);
              }}
              className="bg-[#1464eb] text-white shadow-md hover:bg-[#0e55d3]"
            >
              Edit Profile
            </Button>
          )}
          {company && isEditing && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                leftIcon={X}
                onClick={handleCancel}
                isDisabled={isSaving || isUploadingLogo}
                className="border-blue-200 bg-white/80 text-[#304562] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="company-profile-form"
                leftIcon={Save}
                isLoading={isSaving}
                isDisabled={isSaving || isUploadingLogo}
                className="bg-[#1464eb] text-white shadow-md hover:bg-[#0e55d3]"
              >
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </header>

      {companies.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <label htmlFor="company-profile-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">
            Select Company
          </label>
          <select
            id="company-profile-company-select"
            value={companyId}
            disabled={isUploadingLogo || isSaving}
            onChange={(event) => {
              const nextCompanyId = event.target.value;
              setCompanyId(nextCompanyId);
              setIsLoadingCompany(Boolean(nextCompanyId));
              setCompany(null);
              setForm(EMPTY_COMPANY);
              setLoadError('');
              setIsEditing(false);
            }}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Choose a company</option>
            {companies.map((record) => {
              const id = getId(record._id || record.id);
              return (
                <option key={id} value={id}>
                  {record.name || record.companyName || 'Unnamed Company'}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError('');
              if (companyId) {
                setIsLoadingCompany(true);
              } else {
                setIsLoadingCompanies(true);
              }
              setReloadKey((previous) => previous + 1);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline"
          >
            <RotateCw size={14} />
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center rounded-3xl border border-blue-100 bg-white text-sm text-slate-500 shadow-[0_8px_28px_rgba(58,111,190,0.10)]">
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading company details...
        </div>
      ) : company ? (
        <form id="company-profile-form" onSubmit={handleSave} className="rounded-[26px] border border-blue-100 bg-white p-4 shadow-[0_10px_30px_rgba(58,111,190,0.12)] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1764eb] text-white shadow-md shadow-blue-200">
              <Building2 size={24} strokeWidth={2.2} />
            </span>
            <h2 className="shrink-0 text-lg font-bold tracking-tight text-[#122142] sm:text-xl">Company Information</h2>
            <span className="h-px flex-1 bg-gradient-to-r from-blue-100 to-transparent" />
          </div>

          <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
            <div className="space-y-2.5 md:space-y-3">
              {['name', 'gstin', 'pan', 'email', 'phone', 'city', 'state'].map(renderFieldRow)}
            </div>
            <div className="space-y-2.5 md:space-y-3">
              {['pincode', 'country', 'workingHoursStartTime', 'workingHoursEndTime', 'weeklyOff'].map(renderFieldRow)}
            </div>
            {renderFieldRow('address')}
          </div>

          <div className="relative mt-5 flex min-h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#edf4ff] via-[#f3f7ff] to-[#edf4ff] px-3.5 py-3 text-[#244b8d] sm:px-4">
            <Info size={19} className="relative z-10 shrink-0 text-[#1764eb]" />
            <p className="relative z-10 text-xs font-medium italic sm:text-sm">
              Keep your company information up to date for better business operations.
            </p>
            <svg
              viewBox="0 0 360 70"
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 hidden h-16 w-[34%] text-blue-300/50 sm:block"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 68h356M10 68V47h34v21M15 47l12-12 12 12M20 68V55h8v13M52 68V33h38v35M58 33l13-14 13 14M64 68V43h13v25M98 68V42h38v26M104 42l13-12 13 12M110 68V51h13v17M143 68V25h31v43M148 25l11-16 11 16M153 68V39h10v29M181 68V46h44v22M187 46l16-15 16 15M194 68V54h13v14M233 68V36h46v32M241 36l15-18 15 18M249 68V48h14v20M288 68V49h31v19M294 49l10-11 10 11M301 68V56h8v12M328 68V39h24v29M333 39l7-9 7 9" />
              <path d="M29 48h4M69 33h5M157 26h5M252 37h7M337 40h5" />
            </svg>
          </div>
        </form>
      ) : !isLoadingCompanies && companies.length > 1 && !companyId ? (
        <div className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-500 shadow-[0_8px_28px_rgba(58,111,190,0.10)]">
          Select a company above to view its profile.
        </div>
      ) : !loadError ? (
        <div className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-500 shadow-[0_8px_28px_rgba(58,111,190,0.10)]">
          No company profile is available.
        </div>
      ) : null}
    </section>
  );
};
