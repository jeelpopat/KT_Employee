import React from 'react';
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
  if (pathname === '/finance/tax-master') {
    return <TaxMasterManagementView />;
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
