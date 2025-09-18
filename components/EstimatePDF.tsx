import React from 'react';
import type { CalculationResults } from './SprayFoamCalculator.tsx';

// Utility functions for formatting, kept local to this component
function fmt(n: number | undefined, digits = 2) {
  if (n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtCurrency(n: number | undefined) {
  const result = fmt(n, 2);
  return result === "—" ? "—" : `$${result}`;
}

// Interfaces for props
export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface CustomerInfo {
  id: number;
  name: string;
  address: string;
  email: string;
  phone: string;
  notes?: string;
  lat?: number;
  lng?: number;
}

interface LineItem {
  id: number;
  description: string;
  cost: number;
}
export interface Costs {
  ocSets: number;
  ocCostPerSet: number;
  ocMarkup: number;
  ocTotal: number;
  ccSets: number;
  ccCostPerSet: number;
  ccMarkup: number;
  ccTotal: number;
  totalMaterialCost: number;
  laborRate: number;
  laborHours: number;
  equipmentFee: number;
  laborAndEquipmentCost: number;
  lineItems: LineItem[];
  additionalCostsTotal: number;
  subtotal: number;
  overheadValue: number;
  preTaxTotal: number;
  taxValue: number;
  finalQuote: number;
}

interface EstimatePDFProps {
  calc: Omit<CalculationResults, 'customer'>;
  costs: Costs;
  companyInfo: CompanyInfo;
  customerInfo: CustomerInfo;
  scopeOfWork: string;
  estimateNumber?: string;
  pdfWidth: string;
  pdfHeight: string;
}

const EstimatePDF: React.FC<EstimatePDFProps> = ({ calc, costs, companyInfo, customerInfo, scopeOfWork, estimateNumber: propEstimateNumber, pdfWidth, pdfHeight }) => {
  const today = new Date().toLocaleDateString();
  const estimateNumber = propEstimateNumber || `EST-${new Date().getTime().toString().slice(-6)}`;

  // Simple markdown-to-HTML parser for the scope of work
  const renderScope = (text: string) => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map((line, index) => {
        if (line.startsWith('- ')) {
          return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <h4 key={index} className="font-semibold mt-2">{line.substring(2, line.length - 2)}</h4>;
        }
        return <p key={index}>{line}</p>;
      })
      .reduce((acc, el, index, arr) => {
        if (el.type === 'li' && (index === 0 || arr[index-1].type !== 'li')) {
          acc.push(<ul key={`ul-${index}`} className="space-y-1">{el}</ul>)
        } else if (el.type === 'li') {
          // Find the last ul and append to it
          const lastUl = acc[acc.length - 1];
          if (lastUl && lastUl.type === 'ul') {
             lastUl.props.children.push(el);
          }
        } else {
           acc.push(el);
        }
        return acc;
      }, [] as JSX.Element[]);
  };

  return (
    <div style={{ width: pdfWidth, height: pdfHeight }} className="bg-white text-slate-800 font-sans p-[0.75in] text-[10pt] flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-start pb-6 mb-6 border-b-2 border-blue-600">
        <div>
          <h1 className="text-3xl font-bold text-blue-800">{companyInfo.name || 'Your Company LLC'}</h1>
          <p className="text-sm">{companyInfo.address}</p>
          <p className="text-sm">P: {companyInfo.phone} | E: {companyInfo.email}</p>
        </div>
        <div className="text-right">
            <h2 className="text-4xl font-bold text-slate-700 tracking-tight">ESTIMATE</h2>
            <p className="mt-2 text-sm">
                <span className="font-semibold text-slate-600">Estimate #: </span>
                {estimateNumber}
            </p>
            <p className="text-sm">
                <span className="font-semibold text-slate-600">Date: </span>
                {today}
            </p>
        </div>
      </header>

      {/* Customer Info */}
      <section className="mb-8">
        <h3 className="font-semibold text-slate-500 text-sm tracking-wider uppercase mb-2">Prepared For</h3>
        <p className="font-bold text-lg text-slate-800">{customerInfo.name || 'Customer Name'}</p>
        <p>{customerInfo.address}</p>
        <p>{customerInfo.email}</p>
        <p>{customerInfo.phone}</p>
      </section>

      {/* Scope of Work */}
      <section className="flex-grow mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">Scope of Work</h3>
        <div className="text-slate-700 leading-relaxed text-sm">
          {scopeOfWork ? renderScope(scopeOfWork) : <p>Scope of work details will be generated here...</p>}
        </div>
      </section>
      
      {/* Total Amount */}
      <section className="mt-auto">
         <div className="w-full bg-blue-50 border-t-2 border-blue-600 rounded-lg p-6 text-right">
            <p className="text-lg font-semibold text-blue-800">Total Project Investment</p>
            <p className="text-5xl font-bold text-blue-900 tracking-tight">{fmtCurrency(costs.finalQuote)}</p>
         </div>
      </section>

      {/* Footer */}
      <footer className="pt-6 mt-6 text-xs text-slate-500 border-t border-slate-200">
        <h4 className="font-semibold mb-1 text-slate-600">Terms & Conditions</h4>
        <p>This estimate is valid for 30 days. Price is subject to change upon final on-site inspection. Payment is due upon completion of work unless otherwise specified. We appreciate the opportunity to earn your business!</p>
        <p className="mt-4 text-center font-semibold text-slate-700">Thank you for choosing {companyInfo.name || 'our company'}!</p>
      </footer>
    </div>
  );
};

export default EstimatePDF;