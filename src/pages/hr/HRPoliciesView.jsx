import React, { useMemo, useState } from 'react';
import {
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  FileText,
  GitBranch,
  Scale,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users
} from 'lucide-react';
import {
  EMPLOYEE_POLICIES,
  EMPLOYEE_POLICY_CATEGORIES,
  HR_POLICIES,
  HR_POLICY_CATEGORIES,
  TEAM_LEAD_POLICIES,
  TEAM_LEAD_POLICY_CATEGORIES
} from '../../data/hrPolicies.js';
import Modal from '../../components/common/Modal.jsx';

const CATEGORY_ICONS = {
  A: BookOpen,
  B: CalendarDays,
  C: CalendarDays,
  D: Banknote,
  E: UserRound,
  F: TrendingUp,
  G: ShieldCheck,
  H: GitBranch,
  I: Building2,
  J: Users,
  K: Scale,
  L: Users,
  M: UserRound
};

export default function HRPoliciesView({ audience = 'hr' }) {
  const isEmployeeView = audience === 'employee';
  const isTeamLeadView = audience === 'team-lead';
  const policyCategories = isEmployeeView
    ? EMPLOYEE_POLICY_CATEGORIES
    : isTeamLeadView
      ? TEAM_LEAD_POLICY_CATEGORIES
      : HR_POLICY_CATEGORIES;
  const policies = isEmployeeView
    ? EMPLOYEE_POLICIES
    : isTeamLeadView
      ? TEAM_LEAD_POLICIES
      : HR_POLICIES;
  const [activeCategoryId, setActiveCategoryId] = useState(policyCategories[0].id);
  const [searchText, setSearchText] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const normalizedSearch = searchText.trim().toLowerCase();
  const activeCategory = policyCategories.find(({ id }) => id === activeCategoryId);

  const visiblePolicies = useMemo(() => {
    if (normalizedSearch) {
      return policies.filter((policy) => (
        String(policy.number).includes(normalizedSearch) ||
        policy.name.toLowerCase().includes(normalizedSearch) ||
        policy.description.toLowerCase().includes(normalizedSearch) ||
        policy.categoryTitle.toLowerCase().includes(normalizedSearch)
      ));
    }

    return policies.filter((policy) => policy.categoryId === activeCategoryId);
  }, [activeCategoryId, normalizedSearch, policies]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              <ShieldCheck size={14} />
              {isEmployeeView
                ? 'Employee Resources'
                : isTeamLeadView
                  ? 'Team Lead Resources'
                  : 'Human Resources'}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isEmployeeView
                ? 'Employee Policy Library'
                : isTeamLeadView
                  ? 'Team Lead Policy Library'
                  : 'HR Policy Library'}
            </h1>
            
            <p className="mt-2 text-sm leading-6 text-cyan-50/90">
              {isEmployeeView
                ? 'Browse shared company and employee policies by topic or search by title, description, or policy number.'
                : isTeamLeadView
                  ? 'Browse shared company and team lead policies by topic or search by title, description, or policy number.'
                : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="min-w-32 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-cyan-100">
                <FileText size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Policies</span>
              </div>
              <div className="mt-1 text-2xl font-bold">{policies.length}</div>
            </div>
            <div className="min-w-32 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-cyan-100">
                <Building2 size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Categories</span>
              </div>
              <div className="mt-1 text-2xl font-bold">{policyCategories.length}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
          <div className="px-2 pb-2 pt-1">
            <h2 className="text-sm font-bold text-slate-900">Policy categories</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a category to browse.</p>
          </div>
          <nav
            className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1"
            aria-label={
              isEmployeeView
                ? 'Employee policy categories'
                : isTeamLeadView
                  ? 'Team Lead policy categories'
                  : 'HR policy categories'
            }
          >
            {policyCategories.map((category) => {
              const CategoryIcon = CATEGORY_ICONS[category.id];
              const isActive = !normalizedSearch && activeCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveCategoryId(category.id);
                    setSearchText('');
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-sky-50 text-[#034665] ring-1 ring-inset ring-sky-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? 'bg-white text-[#034665]' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <CategoryIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{category.id}. {category.title}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {category.policies.length} policies
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#068DCB]">
                {normalizedSearch ? 'Search results' : `Category ${activeCategory?.id}`}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {normalizedSearch ? 'Matching policies' : activeCategory?.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {visiblePolicies.length} {visiblePolicies.length === 1 ? 'policy' : 'policies'}
                {normalizedSearch ? ` matching “${searchText.trim()}”` : ' in this category'}
              </p>
            </div>

            <label className="relative block w-full sm:max-w-xs">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search policies..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                aria-label={
                  isEmployeeView
                    ? 'Search employee policies'
                    : isTeamLeadView
                      ? 'Search Team Lead policies'
                      : 'Search HR policies'
                }
              />
            </label>
          </div>

          {visiblePolicies.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {visiblePolicies.map((policy) => (
                <button
                  type="button"
                  key={policy.number}
                  aria-haspopup="dialog"
                  aria-label={`Read policy ${policy.number}: ${policy.name}`}
                  onClick={() => setSelectedPolicy(policy)}
                  className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 px-2 text-xs font-bold text-[#034665] ring-1 ring-inset ring-sky-100">
                      {String(policy.number).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      {normalizedSearch && (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {policy.categoryId}. {policy.categoryTitle}
                        </p>
                      )}
                      <h3 className="text-sm font-bold leading-5 text-slate-900 group-hover:text-[#034665]">
                        {policy.name}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{policy.description}</p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#068DCB]">
                        <BookOpen size={14} />
                        Read policy details
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <Search size={22} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No policies found</p>
              <p className="mt-1 text-xs text-slate-500">Try another title, description, or policy number.</p>
            </div>
          )}

          <p className="rounded-lg bg-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500">
            Each explanation is general, non-binding, and tailored to its policy topic. The current approved policy and applicable law take precedence.
          </p>
        </main>
      </div>

      <Modal
        isOpen={Boolean(selectedPolicy)}
        onClose={() => setSelectedPolicy(null)}
        title={selectedPolicy?.name || 'Policy details'}
        subtitle={selectedPolicy
          ? `Policy ${selectedPolicy.number} - Category ${selectedPolicy.categoryId}. ${selectedPolicy.categoryTitle}`
          : undefined}
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setSelectedPolicy(null)}
            className="rounded-lg bg-[#034665] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#045d86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Close
          </button>
        }
      >
        {selectedPolicy && (
          <div className="space-y-4">
            <section className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 sm:p-5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#034665]">Detailed policy description</h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{selectedPolicy.details}</p>
            </section>
            <p className="text-xs leading-5 text-slate-500">
              This policy-specific description is general guidance, not the official full policy text. Refer to the current approved policy or contact HR for exact requirements.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
