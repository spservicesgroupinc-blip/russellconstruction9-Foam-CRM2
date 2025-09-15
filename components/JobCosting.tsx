import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { CalculationResults } from './SprayFoamCalculator';
import EstimatePDF, { CompanyInfo, CustomerInfo, Costs } from './EstimatePDF';
import MaterialOrderPDF from './MaterialOrderPDF';
import QuoteSummaryPDF from './QuoteSummaryPDF';
import InvoicePDF from './InvoicePDF';
import { GoogleGenAI } from '@google/genai';
import { saveEstimate, EstimateRecord, SaveEstimateArgs } from '../lib/db';
import { calculateCosts, CostSettings } from '../lib/processing';

// Add declarations for jspdf and html2canvas
declare var jspdf: any;
declare var html2canvas: any;

interface PdfOptions {
  paperSize: 'letter' | 'a4';
  orientation: 'p' | 'l'; // 'p' for portrait, 'l' for landscape
}

interface JobCostingProps {
  calculationResults: CalculationResults;
  onBack: () => void;
  companyInfo: CompanyInfo;
  isInvoiceMode?: boolean;
  initialJobData?: EstimateRecord;
  onFinalizeInvoice?: (finalJobData: EstimateRecord) => void;
  onEstimateCreated?: (newJob: EstimateRecord) => void;
}

function fmt(n: number, digits = 2) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtCurrency(n: number) {
  const result = fmt(n, 2);
  return result === "—" ? "—" : `$${result}`;
}

interface LineItem {
  id: number;
  description: string;
  cost: number;
}

const EMPTY_CUSTOMER: Omit<CustomerInfo, 'id'> = {
  name: "", address: "", email: "", phone: "",
};

// Simple markdown renderer for displaying the scope in the editor
const renderScopeForDisplay = (text: string = '') => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map((line, index) => {
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h4 key={index} className="font-semibold mt-2 text-base">{line.substring(2, line.length - 2)}</h4>;
      }
      return <p key={index}>{line}</p>;
    })
};

const getPdfDimensions = (options: PdfOptions): { width: string, height: string } => {
    const sizes = {
        letter: { w: 8.5, h: 11 },
        a4: { w: 8.27, h: 11.69 }
    };
    const { w, h } = sizes[options.paperSize];
    if (options.orientation === 'l') {
        return { width: `${h}in`, height: `${w}in` };
    }
    return { width: `${w}in`, height: `${h}in` };
}

export default function JobCosting({
  calculationResults: calc,
  onBack,
  companyInfo,
  isInvoiceMode = false,
  initialJobData,
  onFinalizeInvoice,
  onEstimateCreated
}: JobCostingProps) {
  // Cost settings state
  const [costSettings, setCostSettings] = useState<CostSettings>({
    ocCostPerSet: 1000,
    ocMarkup: 20,
    ccCostPerSet: 1100,
    ccMarkup: 25,
    laborRate: 50,
    laborHours: 24,
    equipmentFee: 150,
    overheadPercentage: 10,
    salesTax: 0,
  });

  // Additional Line Items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // PDF Generation State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [generatedScope, setGeneratedScope] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationComplete, setGenerationComplete] = useState(false);
  const [error, setError] = useState('');
  const estimatePdfRef = useRef<HTMLDivElement>(null);
  const materialOrderPdfRef = useRef<HTMLDivElement>(null);
  const quoteSummaryPdfRef = useRef<HTMLDivElement>(null);
  const invoicePdfRef = useRef<HTMLDivElement>(null);
  const [pdfEstimateNumber, setPdfEstimateNumber] = useState('');
  const [pdfOrderNumber, setPdfOrderNumber] = useState('');
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [summarySaveStatus, setSummarySaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [createdJob, setCreatedJob] = useState<EstimateRecord | null>(null);
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>({ paperSize: 'letter', orientation: 'p' });
  
  // Estimate Details - Initialized from props
  const [modalCustomerInfo, setModalCustomerInfo] = useState(calc.customer || { ...EMPTY_CUSTOMER, id: 0 });

  useEffect(() => {
    if (isInvoiceMode && initialJobData?.costsData) {
      const { costsData } = initialJobData;
      setCostSettings({
        ocCostPerSet: costsData.ocCostPerSet,
        ocMarkup: costsData.ocMarkup,
        ccCostPerSet: costsData.ccCostPerSet,
        ccMarkup: costsData.ccMarkup,
        laborRate: costsData.laborRate,
        laborHours: costsData.laborHours,
        equipmentFee: costsData.equipmentFee,
        overheadPercentage: initialJobData.costsData.subtotal > 0 ? (initialJobData.costsData.overheadValue / initialJobData.costsData.subtotal) * 100 : 0,
        salesTax: initialJobData.costsData.preTaxTotal > 0 ? (initialJobData.costsData.taxValue / initialJobData.costsData.preTaxTotal) * 100 : 0,
      });
      setLineItems(costsData.lineItems || []);
    }
  }, [isInvoiceMode, initialJobData]);

  const costs: Costs = useMemo(() => {
    return calculateCosts(calc, costSettings, lineItems);
  }, [calc, costSettings, lineItems]);

  const handleCostSettingChange = (field: keyof CostSettings, value: number) => {
    setCostSettings(prev => ({ ...prev, [field]: value }));
  };

  const addLineItem = () => setLineItems(prev => [...prev, { id: Date.now(), description: '', cost: 0 }]);
  const removeLineItem = (id: number) => setLineItems(prev => prev.filter(item => item.id !== id));
  const updateLineItem = (id: number, field: 'description' | 'cost', value: string | number) => {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSaveQuoteSummary = async () => {
    if (!calc.customer?.id) {
        alert("A customer must be selected to save a quote summary. Please go back to the calculator and select a customer.");
        return;
    }

    setIsSavingSummary(true);
    setSummarySaveStatus('idle');

    try {
        const summaryNumber = `SUMM-${new Date().getTime().toString().slice(-6)}`;

        await new Promise(resolve => setTimeout(resolve, 100));
      
        const summaryElement = quoteSummaryPdfRef.current;
        if (!summaryElement) throw new Error("Quote Summary PDF template element not found.");
      
        const summaryCanvas = await html2canvas(summaryElement, { scale: 2 });
        const summaryImgData = summaryCanvas.toDataURL('image/png');
        const summaryPdf = new jspdf.jsPDF({ orientation: 'p', unit: 'in', format: 'letter' });
        const pdfWidth = summaryPdf.internal.pageSize.getWidth();
        const pdfHeight = summaryPdf.internal.pageSize.getHeight();
        summaryPdf.addImage(summaryImgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        const summaryPdfBlob = summaryPdf.output('blob');

        const placeholderBlob = new Blob(['This document is not applicable for a quote summary.'], { type: 'text/plain' });

        const estimateToSave: SaveEstimateArgs = {
            customerId: calc.customer.id,
            estimatePdf: summaryPdfBlob,
            materialOrderPdf: placeholderBlob,
            estimateNumber: summaryNumber,
            calcData: calc,
            costsData: costs,
            scopeOfWork: 'N/A for Quote Summary',
            status: 'estimate',
        };

        await saveEstimate(estimateToSave);

        setSummarySaveStatus('success');
        setTimeout(() => setSummarySaveStatus('idle'), 3000);

    } catch (e) {
        console.error(e);
        setSummarySaveStatus('error');
        alert(`Failed to save quote summary. ${e instanceof Error ? e.message : 'An unknown error occurred.'}`);
        setTimeout(() => setSummarySaveStatus('idle'), 5000);
    } finally {
        setIsSavingSummary(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (generationComplete && !isInvoiceMode && createdJob && onEstimateCreated) {
        onEstimateCreated(createdJob);
    }
    setTimeout(() => {
        setGenerationComplete(false);
        setAiNotes('');
        setGeneratedScope('');
        setError('');
        setCreatedJob(null);
    }, 300);
  };
  
  const handleOpenFinalizeModal = () => {
    if (initialJobData?.calcData?.customer) {
        setModalCustomerInfo(initialJobData.calcData.customer);
    }
    setIsModalOpen(true);
  };

  const handleGenerateInvoicePdf = async () => {
    if (!onFinalizeInvoice || !initialJobData) return;

    setIsGenerating(true);
    setError('');
    setGenerationComplete(false);
    setGenerationStatus('Generating Final Invoice PDF...');
    
    const invoiceNumber = initialJobData.estimateNumber.replace('EST-', 'INV-');
    setGeneratedInvoiceNumber(invoiceNumber);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Render delay

        const invoiceElement = invoicePdfRef.current;
        if (!invoiceElement) throw new Error("Invoice PDF template element not found.");

        const canvas = await html2canvas(invoiceElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({ 
            orientation: pdfOptions.orientation, 
            unit: 'in', 
            format: pdfOptions.paperSize 
        });
        pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());

        const url = pdf.output('bloburl', { filename: `Invoice-${invoiceNumber}.pdf`});
        window.open(url, '_blank');

        setGenerationStatus('Finalizing...');
        const updatedRecord: EstimateRecord = {
            ...initialJobData,
            costsData: costs, // Use the latest, potentially edited costs
        };
        onFinalizeInvoice(updatedRecord);
        
        setGenerationComplete(true);
    } catch(e) {
        console.error("Failed to generate invoice PDF", e);
        setError(`Failed to generate invoice. ${e instanceof Error ? e.message : 'An unknown error occurred.'}`);
    } finally {
        setIsGenerating(false);
        setGenerationStatus('');
    }
  };


  const handleGeneratePdf = async () => {
    if (!modalCustomerInfo.id) {
        setError("A customer must be selected to save an estimate.");
        return;
    }

    setIsGenerating(true);
    setError('');
    setGenerationComplete(false);
    setGenerationStatus('Generating Scope of Work with AI...');

    const estimateNumber = `EST-${new Date().getTime().toString().slice(-6)}`;
    const orderNumber = `ORD-${new Date().getTime().toString().slice(-6)}`;
    setPdfEstimateNumber(estimateNumber);
    setPdfOrderNumber(orderNumber);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      let prompt = `You are an assistant for a spray foam insulation company. Your task is to generate a professional, customer-facing "Scope of Work" section for an estimate based on the following job details. Format the output clearly with line items using markdown for bolding and lists. Do not include any pricing, costs, or quantities of material sets. Focus only on the work to be performed. Be concise and professional.

**Job Details:**`;

      if (calc.wallBoardFeetWithWaste > 0) {
        prompt += `
- **Walls Application:**
  - Area: Approximately ${fmt(calc.wallTotal, 0)} sq ft of exterior walls${calc.gableAdd > 0 ? ' (including gable ends)' : ''}.
  - Foam Type: ${calc.wallFoamType === 'open-cell' ? 'Open-Cell' : 'Closed-Cell'} Spray Foam.
  - Thickness: Apply foam to an approximate depth of ${calc.wallThicknessIn} inches.
  - Goal: To create a continuous air seal and thermal barrier.`;
      }
      if (calc.roofBoardFeetWithWaste > 0) {
        prompt += `
- **Roof Deck Application:**
  - Area: Approximately ${fmt(calc.roofArea, 0)} sq ft of the roof deck underside.
  - Foam Type: ${calc.roofFoamType === 'open-cell' ? 'Open-Cell' : 'Closed-Cell'} Spray Foam.
  - Thickness: Apply foam to an approximate depth of ${calc.roofThicknessIn} inches.
  - Goal: To insulate and seal the roofline, preventing heat loss and improving building comfort.`;
      }
      if (aiNotes) {
        prompt += `
**Additional Notes & Special Instructions:**
- ${aiNotes}`;
      }
      
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      const scopeText = response.text;
      setGeneratedScope(scopeText); 

      await new Promise(resolve => setTimeout(resolve, 100));
      
      setGenerationStatus('Creating Customer Estimate PDF...');
      const estimateElement = estimatePdfRef.current;
      if (!estimateElement) throw new Error("Estimate PDF template element not found.");
      
      const estimateCanvas = await html2canvas(estimateElement, { scale: 2 });
      const estimateImgData = estimateCanvas.toDataURL('image/png');
      const estimatePdf = new jspdf.jsPDF({ 
        orientation: pdfOptions.orientation, 
        unit: 'in', 
        format: pdfOptions.paperSize 
      });
      const pdfWidth = estimatePdf.internal.pageSize.getWidth();
      const pdfHeight = estimatePdf.internal.pageSize.getHeight();
      estimatePdf.addImage(estimateImgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const estimatePdfBlob = estimatePdf.output('blob');

      setGenerationStatus('Creating Internal Material Order PDF...');
      const materialOrderElement = materialOrderPdfRef.current;
      if (!materialOrderElement) throw new Error("Material Order PDF template element not found.");
      
      const materialCanvas = await html2canvas(materialOrderElement, { scale: 2 });
      const materialImgData = materialCanvas.toDataURL('image/png');
      const materialPdf = new jspdf.jsPDF({ orientation: 'p', unit: 'in', format: 'letter' });
      materialPdf.addImage(materialImgData, 'PNG', 0, 0, materialPdf.internal.pageSize.getWidth(), materialPdf.internal.pageSize.getHeight());
      const materialPdfBlob = materialPdf.output('blob');

      setGenerationStatus('Saving PDFs to customer record...');
      const estimateToSave: SaveEstimateArgs = {
          customerId: modalCustomerInfo.id,
          estimatePdf: estimatePdfBlob,
          materialOrderPdf: materialPdfBlob,
          estimateNumber: estimateNumber,
          calcData: { ...calc, customer: modalCustomerInfo },
          costsData: costs,
          scopeOfWork: scopeText,
          status: 'estimate',
      };
      const newJobRecord = await saveEstimate(estimateToSave);
      setCreatedJob(newJobRecord);
      setGenerationComplete(true);

    } catch (e) {
      console.error(e);
      setError(`Failed to generate PDFs. ${e instanceof Error ? e.message : 'An unknown error occurred.'}`);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const card = "rounded-xl border border-slate-200 bg-white shadow-md";
  const h2 = "text-lg font-semibold tracking-tight text-slate-800";
  const label = "text-sm font-medium text-slate-600";
  const input = "mt-1 w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  
  const pdfDims = getPdfDimensions(pdfOptions);

  return (
    <>
      {/* Hidden PDF renderer */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={estimatePdfRef}>
           <EstimatePDF 
             calc={calc} 
             costs={costs} 
             companyInfo={companyInfo} 
             customerInfo={modalCustomerInfo} 
             scopeOfWork={generatedScope}
             estimateNumber={pdfEstimateNumber}
             pdfWidth={pdfDims.width}
             pdfHeight={pdfDims.height}
           />
        </div>
        <div ref={materialOrderPdfRef}>
            <MaterialOrderPDF
                calc={calc}
                costs={costs}
                companyInfo={companyInfo}
                customerInfo={modalCustomerInfo}
                orderNumber={pdfOrderNumber}
            />
        </div>
        <div ref={quoteSummaryPdfRef}>
            <QuoteSummaryPDF
                calc={calc}
                costs={costs}
                companyInfo={companyInfo}
                customerInfo={calc.customer || { ...EMPTY_CUSTOMER, id: 0 }}
            />
        </div>
        {isInvoiceMode && initialJobData && (
            <div ref={invoicePdfRef}>
                <InvoicePDF
                    calc={initialJobData.calcData!}
                    costs={costs} 
                    companyInfo={companyInfo}
                    customerInfo={initialJobData.calcData!.customer!}
                    invoiceNumber={generatedInvoiceNumber}
                    scopeOfWork={initialJobData.scopeOfWork || ''}
                    pdfWidth={pdfDims.width}
                    pdfHeight={pdfDims.height}
                />
            </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl p-4">
        <button onClick={onBack} className="mb-4 text-sm font-medium text-blue-600 hover:underline">
          &larr; Back to {isInvoiceMode ? 'Job Details' : 'Calculator'}
        </button>

        {isInvoiceMode && initialJobData?.scopeOfWork && (
            <div className={`${card} mb-4 p-4`}>
                <h2 className={h2}>Original Scope of Work</h2>
                <div className="mt-2 text-sm text-slate-800 space-y-2">
                    {renderScopeForDisplay(initialJobData.scopeOfWork)}
                </div>
            </div>
        )}

        <div className={`${card} mb-4 p-4`}>
          <h2 className={h2}>Summary for <span className="text-blue-600">{calc.customer?.name || 'Walk-in Customer'}</span></h2>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="font-medium">Total Area:</span> {fmt(calc.totalSprayArea)} ft²</div>
            <div><span className="font-medium">Board Feet:</span> {fmt(calc.totalBoardFeetWithWaste, 0)} bf</div>
            <div className="font-semibold"><span className="font-medium">OC Sets:</span> {fmt(calc.ocSets)}</div>
            <div className="font-semibold"><span className="font-medium">CC Sets:</span> {fmt(calc.ccSets)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className={`${card} p-4`}>
              <h2 className={h2}>1. Material Costs</h2>
              <div className="mt-3 space-y-4">
                {calc.ocSets > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <span className="sm:col-span-3 font-semibold text-slate-800">Open-Cell ({fmt(calc.ocSets)} sets)</span>
                    <label className="block"><span className={label}>Cost per Set ($)</span><input type="number" min={0} className={input} value={costSettings.ocCostPerSet} onChange={e => handleCostSettingChange('ocCostPerSet', parseFloat(e.target.value))} /></label>
                    <label className="block"><span className={label}>Markup (%)</span><input type="number" min={0} className={input} value={costSettings.ocMarkup} onChange={e => handleCostSettingChange('ocMarkup', parseFloat(e.target.value))} /></label>
                    <div className="flex items-end"><div className="w-full rounded-md bg-slate-50 px-3 py-2 text-right"><span className="font-semibold">{fmtCurrency(costs.ocTotal)}</span></div></div>
                  </div>
                )}
                {calc.ccSets > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <span className="sm:col-span-3 font-semibold text-slate-800">Closed-Cell ({fmt(calc.ccSets)} sets)</span>
                    <label className="block"><span className={label}>Cost per Set ($)</span><input type="number" min={0} className={input} value={costSettings.ccCostPerSet} onChange={e => handleCostSettingChange('ccCostPerSet', parseFloat(e.target.value))} /></label>
                    <label className="block"><span className={label}>Markup (%)</span><input type="number" min={0} className={input} value={costSettings.ccMarkup} onChange={e => handleCostSettingChange('ccMarkup', parseFloat(e.target.value))} /></label>
                    <div className="flex items-end"><div className="w-full rounded-md bg-slate-50 px-3 py-2 text-right"><span className="font-semibold">{fmtCurrency(costs.ccTotal)}</span></div></div>
                  </div>
                )}
                <div className="border-t pt-3 mt-3 flex justify-between text-base font-bold"><span>Total Material Cost</span><span>{fmtCurrency(costs.totalMaterialCost)}</span></div>
              </div>
            </div>
            
            <div className={`${card} p-4`}><h2 className={h2}>2. Labor & Equipment</h2><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="block"><span className={label}>Labor Rate ($/hr)</span><input type="number" min={0} className={input} value={costSettings.laborRate} onChange={e => handleCostSettingChange('laborRate', parseFloat(e.target.value))} /></label><label className="block"><span className={label}>Total Hours</span><input type="number" min={0} className={input} value={costSettings.laborHours} onChange={e => handleCostSettingChange('laborHours', parseFloat(e.target.value))} /></label><label className="block"><span className={label}>Equipment Fee ($)</span><input type="number" min={0} className={input} value={costSettings.equipmentFee} onChange={e => handleCostSettingChange('equipmentFee', parseFloat(e.target.value))} /></label></div></div>

            <div className={`${card} p-4`}>
              <h2 className={h2}>3. Additional Line Items</h2>
              <div className="mt-3 space-y-3">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder={`Item ${index + 1} Description`} value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} className={`${input} w-full`} />
                    <input type="number" placeholder="Cost" min={0} value={item.cost || ''} onChange={e => updateLineItem(item.id, 'cost', parseFloat(e.target.value))} className={`${input} w-full sm:w-28`} />
                    <button onClick={() => removeLineItem(item.id)} className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200 px-3 py-2 font-mono font-bold text-lg">-</button>
                  </div>))}
                <button onClick={addLineItem} className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200">+ Add Line Item</button>
              </div>
            </div>
          </div>

          <div className={`${card} p-4 flex flex-col bg-slate-50/50 lg:col-span-1`}>
            <h2 className={h2}>4. {isInvoiceMode ? 'Invoice' : 'Quote'} Summary</h2>
            <div className="mt-3 flex-grow space-y-2 text-sm">
              <div className="flex justify-between"><span>Material Cost</span><span className="font-medium">{fmtCurrency(costs.totalMaterialCost)}</span></div>
              <div className="flex justify-between"><span>Labor & Equipment</span><span className="font-medium">{fmtCurrency(costs.laborAndEquipmentCost)}</span></div>
              <div className="flex justify-between"><span>Additional Costs</span><span className="font-medium">{fmtCurrency(costs.additionalCostsTotal)}</span></div>
              <div className="flex justify-between border-t mt-2 pt-2 font-semibold text-base"><span>Subtotal</span><span>{fmtCurrency(costs.subtotal)}</span></div>
              <div className="border-t my-2"></div>
              <label className="block"><span className={label}>Overhead / Contingency (%)</span><input type="number" min={0} className={input} value={costSettings.overheadPercentage} onChange={e => handleCostSettingChange('overheadPercentage', parseFloat(e.target.value))} /></label>
              <div className="flex justify-between"><span>Overhead Amount</span><span className="font-medium">{fmtCurrency(costs.overheadValue)}</span></div>
              <label className="block mt-2"><span className={label}>Sales Tax (%)</span><input type="number" min={0} className={input} value={costSettings.salesTax} onChange={e => handleCostSettingChange('salesTax', parseFloat(e.target.value))} /></label>
              <div className="flex justify-between"><span>Tax Amount</span><span className="font-medium">{fmtCurrency(costs.taxValue)}</span></div>
            </div>
            <div className="mt-4 rounded-xl bg-blue-100 p-4 text-center"><span className="text-base font-medium text-blue-800">{isInvoiceMode ? 'Total Invoice Amount' : 'Total Quote Price'}</span><p className="text-3xl font-bold text-blue-900">{fmtCurrency(costs.finalQuote)}</p></div>
            <div className="mt-4 space-y-2">
              {isInvoiceMode ? (
                  <button onClick={handleOpenFinalizeModal} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm text-white shadow hover:bg-green-700">Finalize & Generate Invoice</button>
              ) : (
                <>
                  <button onClick={() => setIsModalOpen(true)} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700">Generate PDF Estimate</button>
                  <button onClick={handleSaveQuoteSummary} disabled={isSavingSummary || !calc.customer?.id} className="w-full rounded-lg bg-black px-4 py-2 text-sm text-white shadow hover:bg-black/90 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                    {isSavingSummary ? 'Saving...' : (summarySaveStatus === 'success' ? '✓ Saved!' : 'Save Quote Summary')}
                  </button>
                  {summarySaveStatus === 'error' && <p className="text-xs text-red-600 text-center">Failed to save. Please try again.</p>}
                  {!calc.customer?.id && !isSavingSummary && <p className="text-xs text-slate-500 text-center">Select a customer to save summary.</p>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog">
          <div className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
             <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10" aria-label="Close modal">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl font-bold">{generationComplete ? (isInvoiceMode ? 'Invoice Generated' : 'Generation Successful') : (isInvoiceMode ? 'Finalize Invoice' : 'Generate PDF Estimate')}</h2>
            
            {!generationComplete ? (
              isInvoiceMode ? (
                  <>
                    <p className="mt-1 text-sm text-slate-600">The invoice will be generated for the amount of <strong>{fmtCurrency(costs.finalQuote)}</strong>. The PDF will open in a new tab and the job will be marked as invoiced.</p>
                     <div className="mt-4 pt-4 border-t">
                        <h3 className="font-semibold text-base">PDF Export Options</h3>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="font-medium text-slate-700">Paper Size</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="letter" checked={pdfOptions.paperSize === 'letter'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> Letter</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="a4" checked={pdfOptions.paperSize === 'a4'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> A4</label>
                                </div>
                            </div>
                            <div>
                                <label className="font-medium text-slate-700">Orientation</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="p" checked={pdfOptions.orientation === 'p'} onChange={e => setPdfOptions(p => ({...p, orientation: e.target.value as any}))} /> Portrait</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="l" checked={pdfOptions.orientation === 'l'} onChange={e => setPdfOptions(p => ({...p, orientation: e.target.value as any}))} /> Landscape</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={handleCloseModal} className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
                        <button onClick={handleGenerateInvoicePdf} disabled={isGenerating} className="w-full sm:w-auto rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400">
                            {isGenerating ? 'Generating...' : 'Confirm & Generate'}
                        </button>
                    </div>
                  </>
              ) : (
                <>
                    <p className="mt-1 text-sm text-slate-600">Confirm the details below. This information will appear on the final PDF.</p>
                    <div className="mt-4 space-y-4">
                      <div className="p-3 border rounded-lg bg-slate-50">
                        <h3 className="font-semibold text-base">Your Company Info</h3>
                        <div className="mt-2 text-sm">
                          <p><strong>Name:</strong> {companyInfo.name}</p>
                          <p><strong>Address:</strong> {companyInfo.address}</p>
                          <p><strong>Contact:</strong> {companyInfo.phone} | {companyInfo.email}</p>
                        </div>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <h3 className="font-semibold text-base">Customer Info</h3>
                        {!modalCustomerInfo.id && <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md mb-2">Note: A customer must be selected to save an estimate. Go back to the calculator to select one.</p>}
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block"><span className={label}>Customer Name</span><input type="text" value={modalCustomerInfo.name} onChange={e => setModalCustomerInfo(p => ({...p, name: e.target.value}))} className={input} readOnly={!!modalCustomerInfo.id} /></label>
                          <label className="block"><span className={label}>Phone</span><input type="text" value={modalCustomerInfo.phone} onChange={e => setModalCustomerInfo(p => ({...p, phone: e.target.value}))} className={input} readOnly={!!modalCustomerInfo.id} /></label>
                          <label className="block col-span-1 sm:col-span-2"><span className={label}>Address</span><input type="text" value={modalCustomerInfo.address} onChange={e => setModalCustomerInfo(p => ({...p, address: e.target.value}))} className={input} readOnly={!!modalCustomerInfo.id} /></label>
                          <label className="block col-span-1 sm:col-span-2"><span className={label}>Email</span><input type="email" value={modalCustomerInfo.email} onChange={e => setModalCustomerInfo(p => ({...p, email: e.target.value}))} className={input} readOnly={!!modalCustomerInfo.id} /></label>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="ai-notes" className={label}>Estimator Notes for AI (Optional)</label>
                        <textarea id="ai-notes" rows={2} className={`${input} text-sm`} value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} placeholder="e.g., Pay special attention to sealing around skylights." />
                      </div>
                      
                       <div className="pt-4 border-t">
                        <h3 className="font-semibold text-base">PDF Export Options</h3>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="font-medium text-slate-700">Paper Size</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="letter" checked={pdfOptions.paperSize === 'letter'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> Letter</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="a4" checked={pdfOptions.paperSize === 'a4'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> A4</label>
                                </div>
                            </div>
                            <div>
                                <label className="font-medium text-slate-700">Orientation</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="p" checked={pdfOptions.orientation === 'p'} onChange={e => setPdfOptions(p => ({...p, orientation: e.target.value as any}))} /> Portrait</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="l" checked={pdfOptions.orientation === 'l'} onChange={e => setPdfOptions(p => ({...p, orientation: e.target.value as any}))} /> Landscape</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                    <div className="mt-6">
                        <div className="flex flex-col sm:flex-row-reverse items-center justify-start gap-3">
                            <button onClick={handleGeneratePdf} disabled={isGenerating || !modalCustomerInfo.id} className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400">
                                {isGenerating ? 'Generating...' : 'Generate & Save Estimate'}
                            </button>
                            <button onClick={handleCloseModal} className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
                        </div>
                        {!modalCustomerInfo.id && !isGenerating && (
                            <p className="mt-3 text-xs text-center text-red-600 sm:text-left">
                                A customer must be selected to save a PDF estimate.
                            </p>
                        )}
                    </div>
                </>
              )
            ) : (
                <>
                    <div className="mt-4 p-4 rounded-lg bg-green-50 text-green-800">
                        <h3 className="font-semibold">✅ {isInvoiceMode ? 'Invoice Finalized!' : 'Estimate Saved!'}</h3>
                        <p className="text-sm mt-1">{isInvoiceMode ? 'The invoice PDF has opened in a new tab. This job is now marked as complete.' : 'The customer estimate and internal material order have been saved. You will now be taken to the job detail page.'}</p>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={handleCloseModal} className="w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                            {isInvoiceMode ? 'Done' : 'View Job Details'}
                        </button>
                    </div>
                </>
            )}

             {isGenerating && generationStatus && <p className="mt-3 text-sm text-center text-slate-600">{generationStatus}</p>}
             {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}