import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { CalculationResults } from './SprayFoamCalculator.tsx';
import EstimatePDF, { CompanyInfo, CustomerInfo, Costs } from './EstimatePDF.tsx';
import MaterialOrderPDF from './MaterialOrderPDF.tsx';
import QuoteSummaryPDF from './QuoteSummaryPDF.tsx';
import InvoicePDF from './InvoicePDF.tsx';
import { GoogleGenAI } from '@google/genai';
import { saveEstimate, EstimateRecord, getTimeEntriesForJob, InventoryItem } from '../lib/db.ts';
import { calculateCosts, CostSettings } from '../lib/processing.ts';

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
  defaultCosts: CostSettings;
  inventoryItems: InventoryItem[];
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

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            // remove "data:application/pdf;base64," prefix
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
};


export default function JobCosting({
  calculationResults: calc,
  onBack,
  companyInfo,
  isInvoiceMode = false,
  initialJobData,
  onFinalizeInvoice,
  onEstimateCreated,
  defaultCosts,
  inventoryItems
}: JobCostingProps) {
  // Cost settings state, initialized with defaults from props
  const [costSettings, setCostSettings] = useState<CostSettings>(defaultCosts);

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
  
  // Email state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Estimate Details - Initialized from props
  const [modalCustomerInfo, setModalCustomerInfo] = useState(calc.customer || { ...EMPTY_CUSTOMER, id: 0 });

  useEffect(() => {
    if (isInvoiceMode && initialJobData) {
        const { costsData } = initialJobData;
        if (costsData) {
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

        // Fetch actual tracked hours for the invoice
        if (initialJobData.id) {
            getTimeEntriesForJob(initialJobData.id).then(entries => {
                const totalTrackedHours = entries.reduce((sum, entry) => sum + (entry.durationHours || 0), 0);
                if (totalTrackedHours > 0) {
                    // If tracked hours exist, use them. Otherwise, stick with the estimated hours.
                    setCostSettings(prev => ({ ...prev, laborHours: parseFloat(totalTrackedHours.toFixed(2)) }));
                }
            });
        }
    } else {
        setCostSettings(defaultCosts);
    }
  }, [isInvoiceMode, initialJobData, defaultCosts]);


  const costs: Costs = useMemo(() => {
    return calculateCosts(calc, costSettings, lineItems, inventoryItems);
  }, [calc, costSettings, lineItems, inventoryItems]);

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

        await saveEstimate({
            customerId: calc.customer.id,
            estimatePdf: summaryPdfBlob,
            materialOrderPdf: placeholderBlob,
            estimateNumber: summaryNumber,
            calcData: calc,
            costsData: costs,
            scopeOfWork: 'N/A for Quote Summary',
            status: 'estimate',
        });

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
        setEmailStatus('idle'); // Reset email status on close
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
      const newJobRecord = await saveEstimate({
          customerId: modalCustomerInfo.id,
          estimatePdf: estimatePdfBlob,
          materialOrderPdf: materialPdfBlob,
          estimateNumber: estimateNumber,
          calcData: { ...calc, customer: modalCustomerInfo },
          costsData: costs,
          scopeOfWork: scopeText,
          status: 'estimate',
      });
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

  const handleEmailEstimate = async () => {
    if (!createdJob || !createdJob.calcData?.customer?.email) {
      alert("This job record is missing or the customer does not have a valid email address.");
      setEmailStatus('error');
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus('idle');

    try {
        const customer = createdJob.calcData.customer;
        const estimatePdfBlob = createdJob.estimatePdf;
        
        // 1. Convert PDF blob to Base64
        const pdfBase64 = await blobToBase64(estimatePdfBlob);

        // 2. Use AI to generate email body
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const emailPrompt = `You are an assistant for a spray foam insulation company. Your task is to generate a professional, friendly, and concise email body to send with a PDF estimate.
        Use the following details:
        - Customer Name: ${customer.name}
        - Company Name: ${companyInfo.name}
        - Estimate Total: ${fmtCurrency(createdJob.costsData?.finalQuote || 0)}
        - Estimate Number: ${createdJob.estimateNumber}
        The email should:
        1. Greet the customer by name.
        2. State that their estimate is attached.
        3. Briefly mention the total amount.
        4. Encourage them to review it and ask questions.
        5. End with a professional closing from the company.
        Do not include a subject line. Respond with only the email body text.`;

        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: emailPrompt });
        const emailBody = response.text;

        // 3. Send to webhook
        const webhookUrl = 'https://hooks.zapier.com/hooks/catch/22080087/bw0q9co/'; // A new, dedicated webhook for sending emails
        const payload = {
            to_email: customer.email,
            to_name: customer.name,
            from_name: companyInfo.name,
            subject: `Your Insulation Estimate from ${companyInfo.name} (${createdJob.estimateNumber})`,
            body: emailBody,
            pdf_base64: pdfBase64,
            filename: `Estimate-${createdJob.estimateNumber}.pdf`
        };

        const fetchResponse = await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!fetchResponse.ok) {
            throw new Error(`Webhook failed with status: ${fetchResponse.status}`);
        }

        setEmailStatus('success');

    } catch (error) {
        console.error("Failed to email estimate:", error);
        setEmailStatus('error');
    } finally {
        setIsSendingEmail(false);
    }
  };

  const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm";
  const h2 = "text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100";
  const label = "text-sm font-medium text-slate-600 dark:text-slate-300";
  const input = "mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
  
  const pdfDims = getPdfDimensions(pdfOptions);

  const emailButtonText = () => {
    if (isSendingEmail) return 'Sending...';
    if (emailStatus === 'success') return '✓ Emailed';
    if (emailStatus === 'error') return 'Error - Retry';
    return 'Email Estimate';
  };

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
        <button onClick={onBack} className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          &larr; Back to {isInvoiceMode ? 'Job Details' : 'Calculator'}
        </button>

        {isInvoiceMode && initialJobData?.scopeOfWork && (
            <div className={`${card} mb-4 p-6`}>
                <h2 className={h2}>Original Scope of Work</h2>
                <div className="mt-2 text-sm text-slate-800 dark:text-slate-200 space-y-2">
                    {renderScopeForDisplay(initialJobData.scopeOfWork)}
                </div>
            </div>
        )}

        <div className={`${card} mb-4 p-6`}>
          <h2 className={h2}>Summary for <span className="text-blue-600 dark:text-blue-400">{calc.customer?.name || 'Walk-in Customer'}</span></h2>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="font-medium">Total Area:</span> {fmt(calc.totalSprayArea)} ft²</div>
            <div><span className="font-medium">Board Feet:</span> {fmt(calc.totalBoardFeetWithWaste, 0)} bf</div>
            <div className="font-semibold"><span className="font-medium">OC Sets:</span> {fmt(calc.ocSets)}</div>
            <div className="font-semibold"><span className="font-medium">CC Sets:</span> {fmt(calc.ccSets)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className={`${card} p-6`}>
              <h2 className={h2}>1. Material Costs</h2>
              <div className="mt-4 space-y-4">
                {calc.ocSets > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <span className="sm:col-span-3 font-semibold text-slate-800 dark:text-slate-200">Open-Cell ({fmt(calc.ocSets)} sets)</span>
                    <label className="block"><span className={label}>Cost per Set ($)</span><input type="number" min={0} className={input} value={costSettings.ocCostPerSet} onChange={e => handleCostSettingChange('ocCostPerSet', parseFloat(e.target.value))} /></label>
                    <label className="block"><span className={label}>Markup (%)</span><input type="number" min={0} className={input} value={costSettings.ocMarkup} onChange={e => handleCostSettingChange('ocMarkup', parseFloat(e.target.value))} /></label>
                    <div className="flex items-end"><div className="w-full rounded-md bg-slate-100 dark:bg-slate-600 px-3 py-2 text-right"><span className="font-semibold">{fmtCurrency(costs.ocTotal)}</span></div></div>
                  </div>
                )}
                {calc.ccSets > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <span className="sm:col-span-3 font-semibold text-slate-800 dark:text-slate-200">Closed-Cell ({fmt(calc.ccSets)} sets)</span>
                    <label className="block"><span className={label}>Cost per Set ($)</span><input type="number" min={0} className={input} value={costSettings.ccCostPerSet} onChange={e => handleCostSettingChange('ccCostPerSet', parseFloat(e.target.value))} /></label>
                    <label className="block"><span className={label}>Markup (%)</span><input type="number" min={0} className={input} value={costSettings.ccMarkup} onChange={e => handleCostSettingChange('ccMarkup', parseFloat(e.target.value))} /></label>
                    <div className="flex items-end"><div className="w-full rounded-md bg-slate-100 dark:bg-slate-600 px-3 py-2 text-right"><span className="font-semibold">{fmtCurrency(costs.ccTotal)}</span></div></div>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3 flex justify-between text-base font-bold"><span>Total Foam Cost</span><span>{fmtCurrency(costs.totalMaterialCost)}</span></div>
              </div>
            </div>

            {costs.inventoryCostBreakdown.length > 0 && (
              <div className={`${card} p-6`}>
                <h2 className={h2}>2. Inventory Materials</h2>
                <div className="mt-4 space-y-2">
                  {costs.inventoryCostBreakdown.map(item => (
                    <div key={item.itemId} className="flex justify-between items-center text-sm p-2 rounded-md bg-slate-50 dark:bg-slate-600/50">
                      <div>
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-2">({item.quantity} @ {fmtCurrency(item.unitCost)})</span>
                      </div>
                      <span className="font-semibold">{fmtCurrency(item.lineTotal)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3 flex justify-between text-base font-bold">
                    <span>Total Inventory Cost</span>
                    <span>{fmtCurrency(costs.totalInventoryCost)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className={`${card} p-6`}><h2 className={h2}>3. Labor & Equipment</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3"><label className="block"><span className={label}>Labor Rate ($/hr)</span><input type="number" min={0} className={input} value={costSettings.laborRate} onChange={e => handleCostSettingChange('laborRate', parseFloat(e.target.value))} /></label><label className="block"><span className={label}>Total Hours</span><input type="number" min={0} className={input} value={costSettings.laborHours} onChange={e => handleCostSettingChange('laborHours', parseFloat(e.target.value))} /></label><label className="block"><span className={label}>Equipment Fee ($)</span><input type="number" min={0} className={input} value={costSettings.equipmentFee} onChange={e => handleCostSettingChange('equipmentFee', parseFloat(e.target.value))} /></label></div></div>

            <div className={`${card} p-6`}>
              <h2 className={h2}>4. Additional Line Items</h2>
              <div className="mt-4 space-y-3">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder={`Item ${index + 1} Description`} value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} className={`${input} w-full`} />
                    <input type="number" placeholder="Cost" min={0} value={item.cost || ''} onChange={e => updateLineItem(item.id, 'cost', parseFloat(e.target.value))} className={`${input} w-full sm:w-28`} />
                    <button onClick={() => removeLineItem(item.id)} className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 px-3 py-2 font-mono font-bold text-lg">-</button>
                  </div>))}
                <button onClick={addLineItem} className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors">+ Add Line Item</button>
              </div>
            </div>
          </div>

          <div className={`${card} p-6 flex flex-col bg-slate-50 dark:bg-slate-700/50 lg:col-span-1`}>
            <h2 className={h2}>5. {isInvoiceMode ? 'Invoice' : 'Quote'} Summary</h2>
            <div className="mt-4 flex-grow space-y-2 text-sm">
              <div className="flex justify-between"><span>Foam Materials</span><span className="font-medium">{fmtCurrency(costs.totalMaterialCost)}</span></div>
              <div className="flex justify-between"><span>Inventory Materials</span><span className="font-medium">{fmtCurrency(costs.totalInventoryCost)}</span></div>
              <div className="flex justify-between"><span>Labor & Equipment</span><span className="font-medium">{fmtCurrency(costs.laborAndEquipmentCost)}</span></div>
              <div className="flex justify-between"><span>Additional Costs</span><span className="font-medium">{fmtCurrency(costs.additionalCostsTotal)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-500 mt-2 pt-2 font-semibold text-base"><span>Subtotal</span><span>{fmtCurrency(costs.subtotal)}</span></div>
              <div className="border-t border-slate-200 dark:border-slate-500 my-2"></div>
              <label className="block"><span className={label}>Overhead / Contingency (%)</span><input type="number" min={0} className={input} value={costSettings.overheadPercentage} onChange={e => handleCostSettingChange('overheadPercentage', parseFloat(e.target.value))} /></label>
              <div className="flex justify-between"><span>Overhead Amount</span><span className="font-medium">{fmtCurrency(costs.overheadValue)}</span></div>
              <label className="block mt-2"><span className={label}>Sales Tax (%)</span><input type="number" min={0} className={input} value={costSettings.salesTax} onChange={e => handleCostSettingChange('salesTax', parseFloat(e.target.value))} /></label>
              <div className="flex justify-between"><span>Tax Amount</span><span className="font-medium">{fmtCurrency(costs.taxValue)}</span></div>
            </div>
            <div className="mt-4 rounded-xl bg-blue-100 dark:bg-blue-900/50 p-4 text-center border border-blue-200 dark:border-blue-800"><span className="text-base font-medium text-blue-800 dark:text-blue-200">{isInvoiceMode ? 'Total Invoice Amount' : 'Total Quote Price'}</span><p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{fmtCurrency(costs.finalQuote)}</p></div>
            <div className="mt-4 space-y-2">
              {isInvoiceMode ? (
                  <button onClick={handleOpenFinalizeModal} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm text-white shadow hover:bg-green-700 transition-colors">Finalize & Generate Invoice</button>
              ) : (
                <>
                  <button onClick={() => setIsModalOpen(true)} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700 transition-colors">Generate PDF Estimate</button>
                  <button onClick={handleSaveQuoteSummary} disabled={isSavingSummary || !calc.customer?.id} className="w-full rounded-lg bg-slate-800 dark:bg-slate-600 px-4 py-2 text-sm text-white shadow hover:bg-slate-900 dark:hover:bg-slate-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
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
          <div className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
             <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 z-10" aria-label="Close modal">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl font-bold">{generationComplete ? (isInvoiceMode ? 'Invoice Generated' : 'Generation Successful') : (isInvoiceMode ? 'Finalize Invoice' : 'Generate PDF Estimate')}</h2>
            
            {!generationComplete ? (
              isInvoiceMode ? (
                  <>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">The invoice will be generated for the amount of <strong>{fmtCurrency(costs.finalQuote)}</strong>. The PDF will open in a new tab and the job will be marked as invoiced.</p>
                     <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold text-base">PDF Export Options</h3>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="font-medium text-slate-700 dark:text-slate-200">Paper Size</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="letter" checked={pdfOptions.paperSize === 'letter'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> Letter</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="a4" checked={pdfOptions.paperSize === 'a4'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> A4</label>
                                </div>
                            </div>
                            <div>
                                <label className="font-medium text-slate-700 dark:text-slate-200">Orientation</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="p" checked={pdfOptions.orientation === 'p'} onChange={e => setPdfOptions(p => ({...p, orientation: e.target.value as any}))} /> Portrait</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="l" checked={pdfOptions.orientation === 'l'} onChange={e => setPdfOptions(p => ({...p, orientation: e.target.value as any}))} /> Landscape</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={handleCloseModal} className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                        <button onClick={handleGenerateInvoicePdf} disabled={isGenerating} className="w-full sm:w-auto rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400">
                            {isGenerating ? 'Generating...' : 'Confirm & Generate'}
                        </button>
                    </div>
                  </>
              ) : (
                <>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Confirm the details below. This information will appear on the final PDF.</p>
                    <div className="mt-4 space-y-4">
                      <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                        <h3 className="font-semibold text-base">Your Company Info</h3>
                        <div className="mt-2 text-sm">
                          <p><strong>Name:</strong> {companyInfo.name}</p>
                          <p><strong>Address:</strong> {companyInfo.address}</p>
                          <p><strong>Contact:</strong> {companyInfo.phone} | {companyInfo.email}</p>
                        </div>
                      </div>

                      <div className="p-3 border rounded-lg dark:border-slate-700">
                        <h3 className="font-semibold text-base">Customer Info</h3>
                        {!modalCustomerInfo.id && <p className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/40 dark:text-orange-300 p-2 rounded-md mb-2">Note: A customer must be selected to save an estimate. Go back to the calculator to select one.</p>}
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
                      
                       <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold text-base">PDF Export Options</h3>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="font-medium text-slate-700 dark:text-slate-200">Paper Size</label>
                                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap">
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="letter" checked={pdfOptions.paperSize === 'letter'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> Letter</label>
                                    <label className="inline-flex items-center gap-1"><input type="radio" value="a4" checked={pdfOptions.paperSize === 'a4'} onChange={e => setPdfOptions(p => ({...p, paperSize: e.target.value as any}))} /> A4</label>
                                </div>
                            </div>
                            <div>
                                <label className="font-medium text-slate-700 dark:text-slate-200">Orientation</label>
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
                            <button onClick={handleCloseModal} className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
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
                    <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                        <h3 className="font-semibold">✅ {isInvoiceMode ? 'Invoice Finalized!' : 'Estimate Saved!'}</h3>
                        <p className="text-sm mt-1">{isInvoiceMode ? 'The invoice PDF has opened in a new tab. This job is now marked as complete.' : 'The customer estimate and internal material order have been saved. You can now email the estimate or close this window.'}</p>
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                        <button onClick={handleCloseModal} className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                            {isInvoiceMode ? 'Done' : 'View Job Details'}
                        </button>
                        {!isInvoiceMode && createdJob && createdJob.calcData?.customer?.email && (
                             <button 
                                onClick={handleEmailEstimate} 
                                disabled={isSendingEmail || emailStatus === 'success'}
                                className={`w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors ${
                                    emailStatus === 'success' 
                                        ? 'bg-green-600' 
                                        : 'bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400'
                                }`}
                            >
                                {emailButtonText()}
                            </button>
                        )}
                    </div>
                    {emailStatus === 'error' && <p className="mt-2 text-xs text-red-600 dark:text-red-300 text-right">Failed to send email. Please try again or check the webhook.</p>}
                </>
            )}

             {isGenerating && generationStatus && <p className="mt-3 text-sm text-center text-slate-600 dark:text-slate-300">{generationStatus}</p>}
             {error && <p className="mt-3 rounded-md bg-red-50 dark:bg-red-900/40 p-3 text-sm text-red-700 dark:text-red-200">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
