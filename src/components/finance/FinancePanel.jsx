import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { CompanyProfileView } from './CompanyProfileView.jsx';
import { BranchManagementView } from './BranchManagementView.jsx';
import { FinancialYearManagementView } from './FinancialYearManagementView.jsx';
import { CustomersManagementView } from './CustomersManagementView.jsx';
import { SuppliersManagementView } from './SuppliersManagementView.jsx';
import { ProductsServicesManagementView } from './ProductsServicesManagementView.jsx';
import { BankCashAccountsManagementView } from './BankCashAccountsManagementView.jsx';
import { AccountTransferManagementView } from './AccountTransferManagementView.jsx';
import { ChartOfAccountsManagementView } from './ChartOfAccountsManagementView.jsx';
import { PurchaseOrdersManagementView } from './PurchaseOrdersManagementView.jsx';
import { TaxMasterManagementView } from './TaxMasterManagementView.jsx';
import { PurchaseBillsManagementView } from './PurchaseBillsManagementView.jsx';
import { SalesInvoicesManagementView } from './SalesInvoicesManagementView.jsx';
import { JournalEntriesManagementView } from './JournalEntriesManagementView.jsx';
import { DebitNotesManagementView } from './DebitNotesManagementView.jsx';
import { FinanceOverviewView } from './FinanceOverviewView.jsx';

const AuditLogsView = lazy(() => import('../../pages/AuditLogs.jsx'));
const FinanceNotificationsView = lazy(() => import('./FinanceNotificationsView.jsx'));
const IncomeManagementView = lazy(() => import('./IncomeManagementView.jsx')
  .then((module) => ({ default: module.IncomeManagementView })));
const LendingManagementView = lazy(() => import('./LendingManagementView.jsx')
  .then((module) => ({ default: module.LendingManagementView })));
const CreditNotesManagementView = lazy(() => import('./CreditNotesManagementView.jsx')
  .then((module) => ({ default: module.CreditNotesManagementView })));
const FixedAssetsManagementView = lazy(() => import('./FixedAssetsManagementView.jsx')
  .then((module) => ({ default: module.FixedAssetsManagementView })));
const LoansManagementView = lazy(() => import('./LoansManagementView.jsx')
  .then((module) => ({ default: module.LoansManagementView })));
const CustomerPaymentsManagementView = lazy(() => import('./CustomerPaymentsManagementView.jsx')
  .then((module) => ({ default: module.CustomerPaymentsManagementView })));
const ExpensesManagementView = lazy(() => import('./ExpensesManagementView.jsx')
  .then((module) => ({ default: module.ExpensesManagementView })));
const GSTReturnsManagementView = lazy(() => import('./GSTReturnsManagementView.jsx')
  .then((module) => ({ default: module.GSTReturnsManagementView })));
const FinanceSalariesManagementView = lazy(() => import('./FinanceSalariesManagementView.jsx')
  .then((module) => ({ default: module.FinanceSalariesManagementView })));

const formatModuleTitle = (pathname) => {
  const moduleSlug = pathname.split('/').filter(Boolean).pop();
  if (!moduleSlug || moduleSlug === 'finance') return 'Finance Overview';
  if (moduleSlug === 'coa') return 'Charts Of Account (COA)';
  if (moduleSlug === 'products-services') return 'Product & Service';

  return moduleSlug
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};

export const FinancePanel = () => {
  const { pathname } = useLocation();

  if (pathname === '/finance') {
    return <FinanceOverviewView />;
  }
  if (pathname === '/finance/company-profile') {
    return <CompanyProfileView />;
  }
  if (pathname === '/finance/branch-management') {
    return <BranchManagementView />;
  }
  if (pathname === '/finance/financial-year') {
    return <FinancialYearManagementView />;
  }
  if (pathname === '/finance/customers') {
    return <CustomersManagementView />;
  }
  if (pathname === '/finance/suppliers') {
    return <SuppliersManagementView />;
  }
  if (pathname === '/finance/products-services') {
    return <ProductsServicesManagementView />;
  }
  if (pathname === '/finance/bank-cash-accounts') {
    return <BankCashAccountsManagementView />;
  }
  if (pathname === '/finance/account-transfer') {
    return <AccountTransferManagementView />;
  }
  if (pathname === '/finance/coa') {
    return <ChartOfAccountsManagementView />;
  }
  if (pathname === '/finance/purchase-orders') {
    return <PurchaseOrdersManagementView />;
  }
  if (pathname === '/finance/purchase-bills') {
    return <PurchaseBillsManagementView />;
  }
  if (pathname === '/finance/sales-invoices') {
    return <SalesInvoicesManagementView />;
  }
  if (pathname === '/finance/tax-master') {
    return <TaxMasterManagementView />;
  }
  if (pathname === '/finance/journal-entries') {
    return <JournalEntriesManagementView />;
  }
  if (pathname === '/finance/debit-notes') {
    return <DebitNotesManagementView />;
  }
  if (pathname === '/finance/income') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Income…</p>}><IncomeManagementView /></Suspense>;
  }
  if (pathname === '/finance/lending') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Lending…</p>}><LendingManagementView /></Suspense>;
  }
  if (pathname === '/finance/credit-notes') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Credit Notes…</p>}><CreditNotesManagementView /></Suspense>;
  }
  if (pathname === '/finance/fixed-assets') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Fixed Assets…</p>}><FixedAssetsManagementView /></Suspense>;
  }
  if (pathname === '/finance/loans') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Loans…</p>}><LoansManagementView /></Suspense>;
  }
  if (pathname === '/finance/customer-payments') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Customer Payments…</p>}><CustomerPaymentsManagementView /></Suspense>;
  }
  if (pathname === '/finance/expenses') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Expenses…</p>}><ExpensesManagementView /></Suspense>;
  }
  if (pathname === '/finance/salaries') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Salaries…</p>}><FinanceSalariesManagementView /></Suspense>;
  }
  if (pathname === '/finance/gst-returns') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading GST Returns…</p>}><GSTReturnsManagementView /></Suspense>;
  }
  if (pathname === '/finance/notifications') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Notifications…</p>}><FinanceNotificationsView /></Suspense>;
  }
  if (pathname === '/finance/audit-logs') {
    return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading Audit Logs…</p>}><AuditLogsView /></Suspense>;
  }

  return (
    <section className="mx-auto max-w-6xl">
      <p className="text-xs font-medium text-slate-500">Finance</p>
      <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-lg font-semibold text-slate-900">{formatModuleTitle(pathname)}</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Select a module from the Finance sidebar to get started.
        </p>
      </div>
    </section>
  );
};
