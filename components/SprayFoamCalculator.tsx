import React, { useMemo, useState, useEffect, useRef } from "react";
import { CustomerInfo } from './EstimatePDF';
import { calculateResults } from '../lib/processing';

export type FoamType = 'open-cell' | 'closed-cell';

export interface CalculationResults {
  pitchValid: boolean;
  risePer12: number;
  slopeFactor: number;
  perimeter: number;
  wallRectArea: number;
  gableAdd: number;
  wallTotal: number;
  roofArea: number;
  totalSprayArea: number;
  totalBoardFeetBase: number;
  wallBoardFeetWithWaste: number;
  roofBoardFeetWithWaste: number;
  totalBoardFeetWithWaste: number;
  wallFoamType: FoamType;
  roofFoamType: FoamType;
  wallThicknessIn: number;
  roofThicknessIn: number;
  ocSets: number;
  ccSets: number;
  totalOpenCellBoardFeet: number;
  totalClosedCellBoardFeet: number;
  customer?: CustomerInfo;
}

// Interface for the props that control the calculator's state
export interface CalculatorInputs {
  length: number;
  width: number;
  wallHeight: number;
  pitchInput: string;
  includeGableTriangles: boolean;
  wallFoamType: FoamType;
  wallThicknessIn: number;
  wallWastePct: number;
  roofFoamType: FoamType;
  roofThicknessIn: number;
  roofWastePct: number;
  openCellYield: number;
  closedCellYield: number;
}

function fmt(n: number, digits = 2) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}


interface SprayFoamCalculatorProps {
  onProceedToCosting: (results: CalculationResults) => void;
  customers: CustomerInfo[];
  onAddCustomer: (customer: Omit<CustomerInfo, 'id'>) => void;
  selectedCustomerId: number | '';
  setSelectedCustomerId: (id: number | '') => void;
  calculatorInputs: CalculatorInputs;
  setCalculatorInputs: React.Dispatch<React.SetStateAction<CalculatorInputs>>;
}

const EMPTY_CUSTOMER_FORM: Omit<CustomerInfo, 'id'> = { name: '', address: '', email: '', phone: '', notes: '' };

export default function SprayFoamCalculator({ 
  onProceedToCosting, 
  customers, 
  onAddCustomer,
  selectedCustomerId,
  setSelectedCustomerId,
  calculatorInputs,
  setCalculatorInputs
}: SprayFoamCalculatorProps) {

  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER_FORM);
  
  const {
    length, width, wallHeight, pitchInput
  } = calculatorInputs;

  const handleInputChange = (field: keyof CalculatorInputs, value: any) => {
    const numericFields: (keyof CalculatorInputs)[] = [
      'length', 'width', 'wallHeight', 'wallThicknessIn', 'wallWastePct',
      'roofThicknessIn', 'roofWastePct', 'openCellYield', 'closedCellYield'
    ];
    if (numericFields.includes(field)) {
      value = parseFloat(value) || 0;
    }
    setCalculatorInputs(prev => ({ ...prev, [field]: value }));
  };

  const calc = useMemo(() => {
    return calculateResults(calculatorInputs);
  }, [calculatorInputs]);

  const prevCustomersCount = useRef(customers.length);
  useEffect(() => {
    if (customers.length > prevCustomersCount.current) {
      const newestCustomer = customers.reduce((latest, current) => current.id > latest.id ? current : latest, customers[0]);
      if (newestCustomer) setSelectedCustomerId(newestCustomer.id);
    }
    prevCustomersCount.current = customers.length;
  }, [customers, setSelectedCustomerId]);

  function handleProceedToCosting() {
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    onProceedToCosting({ ...calc, customer: selectedCustomer });
  }

  const handleSaveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCustomer.name && newCustomer.address) {
      onAddCustomer(newCustomer);
      setIsAddCustomerModalOpen(false);
      setNewCustomer(EMPTY_CUSTOMER_FORM);
    }
  };

  const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCustomer(prev => ({ ...prev, [name]: value }));
  };

  function copyResults() {
    const { includeGableTriangles, wallFoamType, wallThicknessIn, wallWastePct, roofFoamType, roofThicknessIn, roofWastePct, openCellYield, closedCellYield } = calculatorInputs;
    const lines = [
      `Inputs`, `  Length: ${length} ft`, `  Width: ${width} ft`, `  Wall height (eave): ${wallHeight} ft`,
      `  Roof pitch: ${pitchInput} (${calc.pitchValid ? fmt(calc.risePer12 * 12, 2) + " in 12" : "invalid"})`,
      `  Include gable triangles: ${includeGableTriangles ? "Yes" : "No"}`, `  Wall Foam Type: ${wallFoamType}`,
      `  Wall Thickness: ${wallThicknessIn} in`, `  Wall Waste: ${wallWastePct}%`, `  Roof Foam Type: ${roofFoamType}`,
      `  Roof Thickness: ${roofThicknessIn} in`, `  Roof Waste: ${roofWastePct}%`, ``, `Results`,
      `  Perimeter: ${fmt(calc.perimeter, 2)} ft`, `  Wall area (rectangles): ${fmt(calc.wallRectArea, 2)} ft²`,
      includeGableTriangles ? `  Gable triangle add-on: ${fmt(calc.gableAdd, 2)} ft²` : undefined,
      `  Wall total: ${fmt(calc.wallTotal, 2)} ft²`, calc.pitchValid ? `  Roof slope factor: ${fmt(calc.slopeFactor, 4)}` : `  Roof slope factor: —`,
      calc.pitchValid ? `  Roof underside area: ${fmt(calc.roofArea, 2)} ft²` : `  Roof underside area: —`,
      calc.pitchValid ? `  TOTAL spray area: ${fmt(calc.totalSprayArea, 2)} ft²` : `  TOTAL spray area: —`, ``,
      calc.pitchValid ? `  Total Board Feet (no waste): ${fmt(calc.totalBoardFeetBase, 0)} bf` : `  Total Board Feet (no waste): —`,
      calc.pitchValid ? `  Wall Board Feet (+waste): ${fmt(calc.wallBoardFeetWithWaste, 0)} bf` : `  Wall Board Feet (+waste): —`,
      calc.pitchValid ? `  Roof Board Feet (+waste): ${fmt(calc.roofBoardFeetWithWaste, 0)} bf` : `  Roof Board Feet (+waste): —`,
      calc.pitchValid ? `  TOTAL Board Feet (+waste): ${fmt(calc.totalBoardFeetWithWaste, 0)} bf` : `  TOTAL Board Feet (+waste): —`, ``,
      `Material Sets Required`,
      calc.pitchValid && calc.ocSets > 0 ? `  Open-cell sets @ ${openCellYield} bf/set: ${fmt(calc.ocSets, 2)} sets` : undefined,
      calc.pitchValid && calc.ccSets > 0 ? `  Closed-cell sets @ ${closedCellYield} bf/set: ${fmt(calc.ccSets, 2)} sets` : undefined,
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"));
  }

  const card = "rounded-xl border border-slate-200 bg-white shadow-md";
  const h2 = "text-lg font-semibold tracking-tight text-slate-800";
  const label = "text-sm font-medium text-slate-600";
  const input = "mt-1 w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const small = "text-xs text-slate-500";
  const select = `${input} appearance-none`;

  return (
    <>
    <div className="mx-auto max-w-3xl p-4">
       <div className={`${card} p-4 mb-4`}>
          <label className="block">
            <span className={label}>Select Customer (Optional)</span>
            <select
              className={select}
              value={selectedCustomerId}
              onChange={(e) => {
                if (e.target.value === '__add_new__') setIsAddCustomerModalOpen(true);
                else setSelectedCustomerId(e.target.value ? Number(e.target.value) : '')
              }}
            >
              <option value="">-- New / Walk-in Customer --</option>
              {customers.map(customer => (<option key={customer.id} value={customer.id}>{customer.name}</option>))}
              <option value="__add_new__" className="font-bold text-blue-600 bg-blue-50">+ Add New Customer...</option>
            </select>
          </label>
        </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={card + " p-4"}>
          <h2 className={h2}>Building Dimensions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block"><span className={label}>Length (ft)</span><input type="number" min={0} step={2.5} className={input} value={calculatorInputs.length} onChange={(e) => handleInputChange('length', e.target.value)} /></label>
            <label className="block"><span className={label}>Width (ft)</span><input type="number" min={0} step={2.5} className={input} value={calculatorInputs.width} onChange={(e) => handleInputChange('width', e.target.value)} /></label>
            <label className="block"><span className={label}>Wall Height (ft)</span><input type="number" min={0} step={1} className={input} value={calculatorInputs.wallHeight} onChange={(e) => handleInputChange('wallHeight', e.target.value)} /></label>
            <label className="block"><span className={label}>Roof Pitch</span><input type="text" className={input} value={calculatorInputs.pitchInput} onChange={(e) => handleInputChange('pitchInput', e.target.value)} placeholder="e.g., 4/12 or 18°" /><span className={small}>e.g. 4/12, 18deg</span></label>
            <label className="col-span-2 mt-2 inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked={calculatorInputs.includeGableTriangles} onChange={(e) => handleInputChange('includeGableTriangles', e.target.checked)} /><span className="text-sm">Include gable-end triangles</span></label>
          </div>
        </div>

        <div className={card + " p-4"}>
          <h2 className={h2}>Production Settings</h2>
          <div className="mt-3 space-y-4">
            <div>
              <h3 className="font-medium text-slate-800">Walls</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                 <label className="block col-span-2"><span className={label}>Foam Type</span><select className={select} value={calculatorInputs.wallFoamType} onChange={(e) => handleInputChange('wallFoamType', e.target.value)}><option value="open-cell">Open-cell</option><option value="closed-cell">Closed-cell</option></select></label>
                <label className="block"><span className={label}>Thickness (in)</span><input type="number" min={0} step={0.5} className={input} value={calculatorInputs.wallThicknessIn} onChange={(e) => handleInputChange('wallThicknessIn', e.target.value)} /></label>
                <label className="block"><span className={label}>Waste (%)</span><input type="number" min={0} step={1} className={input} value={calculatorInputs.wallWastePct} onChange={(e) => handleInputChange('wallWastePct', e.target.value)} /></label>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-medium text-slate-800">Roof</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block col-span-2"><span className={label}>Foam Type</span><select className={select} value={calculatorInputs.roofFoamType} onChange={(e) => handleInputChange('roofFoamType', e.target.value)}><option value="open-cell">Open-cell</option><option value="closed-cell">Closed-cell</option></select></label>
                <label className="block"><span className={label}>Thickness (in)</span><input type="number" min={0} step={0.5} className={input} value={calculatorInputs.roofThicknessIn} onChange={(e) => handleInputChange('roofThicknessIn', e.target.value)} /></label>
                <label className="block"><span className={label}>Waste (%)</span><input type="number" min={0} step={1} className={input} value={calculatorInputs.roofWastePct} onChange={(e) => handleInputChange('roofWastePct', e.target.value)} /></label>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-medium text-slate-800">Material Yields</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block"><span className={label}>Open-cell yield</span><input type="number" min={1} step={1} className={input} value={calculatorInputs.openCellYield} onChange={(e) => handleInputChange('openCellYield', e.target.value)} /><span className={small}>bf/set</span></label>
                <label className="block"><span className={label}>Closed-cell yield</span><input type="number" min={1} step={1} className={input} value={calculatorInputs.closedCellYield} onChange={(e) => handleInputChange('closedCellYield', e.target.value)} /><span className={small}>bf/set</span></label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${card} mt-6 p-4`}>
        <h2 className="text-lg font-semibold tracking-tight text-center sm:text-left">Calculation Summary</h2>
        
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-2xl font-bold text-blue-800">{calc.pitchValid ? `${fmt(calc.totalSprayArea, 0)}` : "—"}</p>
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">Total Area (ft²)</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-2xl font-bold text-blue-800">{calc.pitchValid ? `${fmt(calc.totalBoardFeetWithWaste, 0)}` : "—"}</p>
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">Total Board Feet</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-2xl font-bold text-green-800">{calc.pitchValid ? `${fmt(calc.ocSets, 2)}` : "—"}</p>
            <p className="text-xs font-medium text-green-700 uppercase tracking-wider">Open-Cell Sets</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-2xl font-bold text-green-800">{calc.pitchValid ? `${fmt(calc.ccSets, 2)}` : "—"}</p>
            <p className="text-xs font-medium text-green-700 uppercase tracking-wider">Closed-Cell Sets</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2">
          <button onClick={copyResults} className="w-full rounded-lg bg-slate-200 px-4 py-2.5 text-slate-800 font-medium shadow-sm hover:bg-slate-300">Copy Details</button>
          <button onClick={handleProceedToCosting} disabled={!calc.pitchValid} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400">Proceed to Job Costing</button>
        </div>
        {!calc.pitchValid && (<div className="mt-2 w-full rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">Enter a valid roof pitch to proceed</div>)}

        <details className="mt-6 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-black list-none">
            <div className="flex items-center">
              <span>Show Calculation Breakdown</span>
              <svg className="w-4 h-4 ml-1 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 border-t pt-3 text-sm">
              <div className="space-y-1">
                  <h3 className="font-semibold mb-1">Areas</h3>
                  <div className="flex justify-between"><span>Perimeter</span><span className="font-mono">{fmt(calc.perimeter)} ft</span></div>
                  <div className="flex justify-between"><span>Wall area (rectangles)</span><span className="font-mono">{fmt(calc.wallRectArea)} ft²</span></div>
                  <div className="flex justify-between"><span>Gable triangle add-on</span><span className="font-mono">{calculatorInputs.includeGableTriangles ? `${fmt(calc.gableAdd)} ft²` : "—"}</span></div>
                  <div className="flex justify-between font-medium"><span>Wall total</span><span className="font-mono">{fmt(calc.wallTotal)} ft²</span></div>
                  <div className="flex justify-between"><span>Roof slope factor</span><span className="font-mono">{calc.pitchValid ? fmt(calc.slopeFactor, 4) : "—"}</span></div>
                  <div className="flex justify-between font-medium"><span>Roof underside area</span><span className="font-mono">{calc.pitchValid ? `${fmt(calc.roofArea)} ft²` : "—"}</span></div>
              </div>
              <div className="space-y-1">
                  <h3 className="font-semibold mb-1">Board Feet & Yields</h3>
                  <div className="flex justify-between"><span>Wall Board Feet (+waste)</span><span className="font-mono">{calc.pitchValid ? `${fmt(calc.wallBoardFeetWithWaste, 0)} bf` : "—"}</span></div>
                  <div className="flex justify-between"><span>Roof Board Feet (+waste)</span><span className="font-mono">{calc.pitchValid ? `${fmt(calc.roofBoardFeetWithWaste, 0)} bf` : "—"}</span></div>
                  <div className="flex justify-between"><span>Total Board Feet (no waste)</span><span className="font-mono">{calc.pitchValid ? `${fmt(calc.totalBoardFeetBase, 0)} bf` : "—"}</span></div>
                  <div className="flex justify-between mt-2 pt-2 border-t"><span>Open-cell yield used</span><span className="font-mono">{calculatorInputs.openCellYield}</span></div>
                  <div className="flex justify-between"><span>Closed-cell yield used</span><span className="font-mono">{calculatorInputs.closedCellYield}</span></div>
              </div>
              <div className="col-span-1 md:col-span-2 mt-3 border-t pt-3">
                <h3 className="font-semibold">Formula Notes</h3>
                <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                  <li>Wall rectangles: <code>Area = 2 × (L + W) × H</code></li>
                  <li>Gable add-on (2 ends): <code>Area = W × ((W/2) × (rise/run))</code></li>
                  <li>Roof slope factor: <code>sf = √(1 + (rise/run)^2)</code></li>
                  <li>Roof underside area: <code>Area = L × W × sf</code></li>
                </ul>
              </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Disclaimer: Board feet = ft² × inches. Yields are adjustable; consider job conditions. This tool is for quick estimating — verify measurements on site.</p>
        </details>
      </div>

    </div>
    
    {isAddCustomerModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog"><div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><button onClick={() => setIsAddCustomerModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600" aria-label="Close modal"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button><form onSubmit={handleSaveNewCustomer}><h2 className="text-xl font-bold">Add New Customer</h2><div className="mt-4 space-y-3"><label className="block"><span className={label}>Full Name</span><input type="text" name="name" value={newCustomer.name} onChange={handleNewCustomerChange} className={input} required /></label><label className="block"><span className={label}>Address</span><input type="text" name="address" value={newCustomer.address} onChange={handleNewCustomerChange} className={input} required /></label><label className="block"><span className={label}>Phone</span><input type="tel" name="phone" value={newCustomer.phone} onChange={handleNewCustomerChange} className={input} /></label><label className="block"><span className={label}>Email</span><input type="email" name="email" value={newCustomer.email} onChange={handleNewCustomerChange} className={input} /></label><label className="block"><span className={label}>Notes</span><textarea name="notes" rows={3} value={newCustomer.notes || ''} onChange={handleNewCustomerChange} className={input}></textarea></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsAddCustomerModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700">Save Customer</button></div></form></div></div>)}
    </>
  );
}