import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, AlertCircle,
  FileText, Lock, CheckCircle2, User, Calendar
} from 'lucide-react';

const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

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

/**
 * Expandable Employee Deduction Breakdown Component
 * Displays itemized approved custom deductions with legal compliance flags,
 * approval references, and audit information.
 */
export const DeductionBreakdownSection = ({
  deductions = [],
  totalCustomDeductions = 0,
  isLocked = false,
  excludedDeductions = [],
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showExcluded, setShowExcluded] = useState(false);

  const validList = Array.isArray(deductions) ? deductions : [];
  const excludedList = Array.isArray(excludedDeductions) ? excludedDeductions : [];
  const totalAmount = totalCustomDeductions || validList.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden transition-all text-xs font-poppins ${className}`}>
      {/* Header bar with toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-200/80 select-none"
      >
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
            <FileText size={14} />
          </span>
          <div>
            <span className="font-bold text-slate-900 block text-xs">
              Employee Deduction Breakdown ({validList.length})
            </span>
            <span className="text-[11px] text-slate-500 block">
              Itemized, backend-approved, and legally compliant deductions applied to this payroll period
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-rose-600 text-xs sm:text-sm">
            -{formatINR(totalAmount)}
          </span>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            aria-label="Toggle Breakdown"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Table */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3">
          {validList.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200/80 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2 px-3">Record ID</th>
                    <th className="py-2 px-3">Deduction Title</th>
                    <th className="py-2 px-3">Incident Date</th>
                    <th className="py-2 px-3">Team Leader / Creator</th>
                    <th className="py-2 px-3">Approval Reference</th>
                    <th className="py-2 px-3">Legal Policy</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {validList.map((d, idx) => {
                    const title = d.deductionMasterId?.name || d.name || d.title || 'Deduction';
                    const recId = d.deductionRecordId || `DED-REC-${idx + 1}`;
                    const tl = d.teamLeadUser?.name || d.teamLeadName || d.teamLeadId || 'Direct / Head';
                    const approvalRef = d.approvedBy?.name
                      ? `Approved by ${d.approvedBy.name}`
                      : d.status === 'Approved'
                      ? 'Approved'
                      : 'Pending Approval';
                    const policy = d.deductionMasterId?.legalReference || d.legalReference || 'Payment of Wages Act Sec 7';

                    return (
                      <tr key={d._id || idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {recId}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {title}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(d.incidentDate || d.createdAt)}
                        </td>
                        <td className="py-2 px-3 text-slate-700 truncate max-w-[120px]">
                          {tl}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          <span className="truncate max-w-[130px] block" title={approvalRef}>
                            {approvalRef}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
                            title={policy}
                          >
                            <ShieldCheck size={11} />
                            <span className="truncate max-w-[100px]">{policy}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                          -{formatINR(d.amount)}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {isLocked || d.isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                              <Lock size={9} />
                              <span>Applied</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                              <CheckCircle2 size={9} />
                              <span>Ready</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/90 font-bold border-t border-slate-200 text-xs">
                    <td colSpan={6} className="py-2 px-3 text-right text-slate-700">
                      Total Additional Employee Deductions:
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-rose-600">
                      -{formatINR(totalAmount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400 bg-slate-50/50 rounded-lg border border-slate-100">
              No additional employee deductions logged for this payroll month.
            </div>
          )}

          {/* Excluded Deductions Banner (Unapproved or Legally Non-Permissible) */}
          {excludedList.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExcluded(!showExcluded)}
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <AlertCircle size={13} />
                <span>
                  {excludedList.length} deduction(s) excluded from payroll (Unapproved or Not Permissible)
                </span>
                {showExcluded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showExcluded && (
                <div className="mt-2 p-2.5 bg-amber-50/60 rounded-lg border border-amber-200 text-[11px] space-y-1">
                  {excludedList.map((ex, i) => (
                    <div key={ex._id || i} className="flex items-center justify-between text-amber-900">
                      <span>
                        <strong>{ex.deductionRecordId || `DED-${i}`}</strong>: {ex.deductionMasterId?.name || ex.name || 'Deduction'} ({formatINR(ex.amount)})
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold uppercase">
                        Reason: {ex.status !== 'Approved' ? `Status is ${ex.status}` : 'Statutory non-permissibility'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeductionBreakdownSection;
