import React, { useEffect, useMemo, useState } from 'react';
import {
  CircleAlert,
  MailPlus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';
const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  role: 'Accountant',
  branchId: '',
  isActive: true,
  sendTemporaryPassword: false,
};
const ROLE_OPTIONS = ['Admin', 'Accountant', 'CA', 'HR', 'Team Lead', 'Employee'];
const PAGE_SIZE = 50;

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

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message || error?.message || fallback
);

const normalizeRole = (role) => String(role || '').toLowerCase().replace(/[_-]+/g, ' ');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const FinanceUserManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(preferredCompanyId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (preferredCompanyId) return undefined;
    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load companies.');
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setCompanies(records);
        if (records.length === 1) setCompanyId(getId(records[0]));
        if (!records.length) setError('No company is available for user management.');
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load companies.')); });
    return () => { active = false; };
  }, [preferredCompanyId]);

  useEffect(() => {
    if (!companyId) {
      setBranches([]);
      setUsers([]);
      setIsLoading(false);
      return undefined;
    }
    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load branches.');
        setBranches(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load branches.')); });
    return () => { active = false; };
  }, [companyId, reloadKey]);

  useEffect(() => {
    if (!companyId) return undefined;
    let active = true;
    setIsLoading(true);
    setError('');
    const params = new URLSearchParams({
      companyId,
      page: String(page),
      limit: String(PAGE_SIZE),
      includeInactive: 'true',
    });
    if (search.trim()) params.set('search', escapeRegex(search.trim()));
    api.get(`/api/user?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load company users.');
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setUsers(records);
        setTotalPages(Math.max(1, Number(response.data?.pagination?.totalPages) || 1));
      })
      .catch((requestError) => {
        if (active) {
          setUsers([]);
          setError(getErrorMessage(requestError, 'Could not load company users.'));
        }
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [companyId, page, search, reloadKey]);

  const activeCount = useMemo(() => users.filter((item) => item.isActive !== false).length, [users]);

  const openInviteForm = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditingUser(item);
    setForm({
      ...EMPTY_FORM,
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || item.phoneNumber || '',
      role: item.role || 'Accountant',
      branchId: getId(item.branchId),
      isActive: item.isActive !== false,
    });
    setError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingUser(null);
    setError('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    if (!companyId) {
      setError('Select a company before saving a user.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingUser) {
        const userId = getId(editingUser.userId || editingUser._id);
        const response = await api.put(`/api/user/${encodeURIComponent(userId)}`, {
          companyId,
          name: form.name.trim(),
          phoneNumber: form.phone.trim(),
          role: form.role,
          isActive: form.isActive,
          ...(form.branchId
            ? { branchId: form.branchId, allBranches: false }
            : { branchId: null, allBranches: true }),
        });
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not update user.');
        showToast('User access updated.', 'success');
      } else {
        const response = await api.post('/api/user', {
          companyId,
          branchId: form.branchId || null,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          sendTemporaryPassword: form.sendTemporaryPassword,
        });
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not invite user.');
        showToast(response.data?.message || 'User invited successfully.', 'success');
      }
      setIsFormOpen(false);
      setEditingUser(null);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Could not save user access.');
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setPage(1);
    setUsers([]);
    setError('');
  };

  return (
    <section className="mx-auto max-w-[1480px] space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Users className="h-6 w-6" /></div>
          <div><p className="text-xs font-medium text-slate-500">Finance / Organization &amp; Setup</p><h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">User Management</h1><p className="mt-1 text-sm text-slate-500">Invite users and manage their company access, roles, and branches.</p></div>
        </div>
        <Button leftIcon={MailPlus} onClick={openInviteForm} isDisabled={!companyId}>Invite user</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: 'Users on this page', value: users.length }, { label: 'Active on this page', value: activeCount }, { label: 'Current page', value: `${page} of ${totalPages}` }].map((card) => <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{card.label}</p><p className="mt-2 text-xl font-bold text-slate-900">{card.value}</p></article>)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1"><span className="sr-only">Search users</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${CONTROL_CLASS} h-10 pl-9`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name or email..." /></label>
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${CONTROL_CLASS} h-10 min-w-[220px] w-auto`} value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select>}
          <Button variant="outline" leftIcon={RefreshCw} onClick={() => setReloadKey((value) => value + 1)} isDisabled={isLoading}>Refresh</Button>
        </div>
        {error && !isFormOpen && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading users…</td></tr>
                : users.length === 0 ? <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-500"><UserRound className="mx-auto mb-2 h-6 w-6 text-slate-300" />No users found for this company.</td></tr>
                  : users.map((item) => <tr key={getId(item.userId || item._id)} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3"><p className="font-semibold text-slate-800">{item.name || 'Unnamed user'}</p><p className="mt-0.5 text-xs text-slate-500">{item.email || '—'}{(item.phone || item.phoneNumber) ? ` · ${item.phone || item.phoneNumber}` : ''}</p></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700"><ShieldCheck className="h-3.5 w-3.5" />{normalizeRole(item.role) || 'unassigned'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{item.branchName || 'All branches'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span></td>
                    <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" leftIcon={Pencil} onClick={() => openEditForm(item)}>Manage</Button></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>{PAGE_SIZE} users per page</span>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} isDisabled={page <= 1 || isLoading}>Previous</Button><span>Page {page} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} isDisabled={page >= totalPages || isLoading}>Next</Button></div>
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingUser ? 'Manage company user' : 'Invite a user'}
        subtitle={editingUser ? 'Update role, branch access, or status.' : 'Send a company invitation to a new or existing user.'}
        size="lg"
        closeOnBackdrop={!isSaving}
        footer={<><Button variant="outline" onClick={closeForm} isDisabled={isSaving}>Cancel</Button><Button type="submit" form="finance-user-form" isLoading={isSaving}>{editingUser ? 'Save changes' : 'Send invitation'}</Button></>}
      >
        <form id="finance-user-form" onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={LABEL_CLASS}>Full name <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} autoComplete="name" required disabled={isSaving} /></label>
          <label><span className={LABEL_CLASS}>Email <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} autoComplete="email" required disabled={isSaving || Boolean(editingUser)} /></label>
          <label><span className={LABEL_CLASS}>Phone</span><input className={CONTROL_CLASS} type="tel" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} autoComplete="tel" disabled={isSaving} /></label>
          <label><span className={LABEL_CLASS}>Role <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))} required disabled={isSaving}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label><span className={LABEL_CLASS}>Branch access</span><select className={CONTROL_CLASS} value={form.branchId} onChange={(event) => setForm((previous) => ({ ...previous, branchId: event.target.value }))} disabled={isSaving}><option value="">All branches</option>{branches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}</select></label>
          {editingUser
            ? <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.checked }))} disabled={isSaving} /><span className="text-sm text-slate-700">User has active access to this company</span></label>
            : <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="checkbox" checked={form.sendTemporaryPassword} onChange={(event) => setForm((previous) => ({ ...previous, sendTemporaryPassword: event.target.checked }))} disabled={isSaving} /><span className="text-sm text-slate-700">Send a temporary password instead of an invitation link</span></label>}
          {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </form>
      </Modal>
    </section>
  );
};
