import React from 'react';
import type { CalculationResults } from './SprayFoamCalculator';
import type { Costs, CompanyInfo, CustomerInfo } from './EstimatePDF';

// Utility functions for formatting
function fmt(n: number | undefined, digits = 2) {
  if (n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtCurrency(n: number | undefined) {
  const result = fmt(n, 2);
  return result === "—" ? "—" : `$${result}`;
}

interface MaterialOrderPDFProps {
  calc: Omit<CalculationResults, 'customer'>;
  costs: Costs;
  companyInfo: CompanyInfo;
  customerInfo: CustomerInfo;
  orderNumber?: string;
}

const MaterialOrderPDF: React.FC<MaterialOrderPDFProps> = ({ calc, costs, companyInfo, customerInfo, orderNumber: propOrderNumber }) => {
  const today = new Date().toLocaleDateString();
  const orderNumber = propOrderNumber || `ORD-${new Date().getTime().toString().slice(-6)}`;
  const totalMaterialCostUnmarked = (calc.ocSets * costs.ocCostPerSet) + (calc.ccSets * costs.ccCostPerSet);

  return (
    <div className="bg-white text-slate-800 font-sans w-[8.5in] h-[11in] p-[0.75in] text-[10pt] flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-start pb-6 mb-6 border-b-2 border-red-600">
        <div>
          <h1 className="text-3xl font-bold text-red-800">{companyInfo.name || 'Your Company LLC'}</h1>
          <p className="text-sm">Internal Use Only</p>
        </div>
        <div className="text-right">
            <h2 className="text-4xl font-bold text-slate-700 tracking-tight">MATERIAL ORDER</h2>
            <p className="mt-2 text-sm">
                <span className="font-semibold text-slate-600">Order #: </span>
                {orderNumber}
            </p>
            <p className="text-sm">
                <span className="font-semibold text-slate-600">Date: </span>
                {today}
            </p>
        </div>
      </header>

      {/* Job Info */}
      <section className="mb-8">
        <h3 className="font-semibold text-slate-500 text-sm tracking-wider uppercase mb-2">Job Reference</h3>
        <p className="font-bold text-lg text-slate-800">{customerInfo.name || 'N/A'}</p>
        <p>{customerInfo.address || 'N/A'}</p>
      </section>

      {/* Material Details */}
      <section className="flex-grow">
        <h3 className="text-xl font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">Material Requirements</h3>
        
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                    <th className="px-4 py-2">Material Type</th>
                    <th className="px-4 py-2 text-right">Board Feet (w/ waste)</th>
                    <th className="px-4 py-2 text-right">Sets Required</th>
                    <th className="px-4 py-2 text-right">Cost per Set</th>
                    <th className="px-4 py-2 text-right">Total Cost</th>
                </tr>
            </thead>
            <tbody>
                {calc.ocSets > 0 && (
                    <tr className="border-b">
                        <td className="px-4 py-2 font-medium">Open-Cell Spray Foam</td>
                        <td className="px-4 py-2 text-right">{fmt(calc.totalOpenCellBoardFeet, 0)} bf</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmt(calc.ocSets)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(costs.ocCostPerSet)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmtCurrency(calc.ocSets * costs.ocCostPerSet)}</td>
                    </tr>
                )}
                 {calc.ccSets > 0 && (
                    <tr className="border-b">
                        <td className="px-4 py-2 font-medium">Closed-Cell Spray Foam</td>
                        <td className="px-4 py-2 text-right">{fmt(calc.totalClosedCellBoardFeet, 0)} bf</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmt(calc.ccSets)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(costs.ccCostPerSet)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmtCurrency(calc.ccSets * costs.ccCostPerSet)}</td>
                    </tr>
                )}
            </tbody>
        </table>
      </section>
      
      {/* Total Amount */}
      <section className="mt-auto">
         <div className="w-full bg-red-50 border-t-2 border-red-600 rounded-lg p-6 text-right">
            <p className="text-lg font-semibold text-red-800">Total Estimated Material Cost</p>
            <p className="text-5xl font-bold text-red-900 tracking-tight">{fmtCurrency(totalMaterialCostUnmarked)}</p>
         </div>
      </section>

      {/* Footer */}
      <footer className="pt-6 mt-6 text-xs text-slate-500 border-t border-slate-200">
        <p>This document is for internal planning and ordering purposes only. Do not share with the customer. Costs shown are direct material costs and do not include markup, labor, or overhead.</p>
      </footer>
    </div>
  );
};

export default MaterialOrderPDF;