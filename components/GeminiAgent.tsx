import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { CompanyInfo, CustomerInfo, Costs } from './EstimatePDF';
import EstimatePDF from './EstimatePDF';
import MaterialOrderPDF from './MaterialOrderPDF';
import { CalculatorInputs, CalculationResults } from './SprayFoamCalculator';
import { OnHandInventory } from './MaterialOrder';
import { getEstimatesForCustomer, saveEstimate, EstimateRecord, SaveEstimateArgs } from '../lib/db';
import { calculateResults, calculateCosts, CostSettings, DEFAULT_COST_SETTINGS } from '../lib/processing';
import { DEFAULT_CALCULATOR_VALUES } from '../App';

// Add declarations for jspdf and html2canvas
declare var jspdf: any;
declare var html2canvas: any;

// Fix: Updated Page type to match App.tsx, removing deprecated pages and adding new ones.
type Page = 'dashboard' | 'calculator' | 'costing' | 'jobsList' | 'jobDetail' | 'materialOrder' | 'invoiceEditor' | 'settings' | 'schedule';

interface GeminiAgentProps {
  setMainPage: (page: Page) => void;
  customers: CustomerInfo[];
  handleAddCustomer: (customer: Omit<CustomerInfo, 'id'>) => CustomerInfo;
  handleUpdateCustomer: (customer: CustomerInfo) => void;
  setSelectedCustomerId: (id: number | '') => void;
  calculatorInputs: CalculatorInputs;
  setCalculatorInputs: React.Dispatch<React.SetStateAction<CalculatorInputs>>;
  onHandInventory: OnHandInventory;
  setOnHandInventory: React.Dispatch<React.SetStateAction<OnHandInventory>>;
  handleJobSold: (estimate: any) => void;
  companyInfo: CompanyInfo;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

// Data structure for the PDF generation task
interface PdfTask {
  calc: Omit<CalculationResults, 'customer'>;
  costs: Costs;
  customer: CustomerInfo;
  companyInfo: CompanyInfo;
  markAsSold: boolean;
  aiNotes: string;
}

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // remove "data:image/jpeg;base64," prefix
        resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
});


const GeminiAgent: React.FC<GeminiAgentProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null); // Ref for chat window
  const fabRef = useRef<HTMLDivElement>(null); // Ref for floating action button
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input
  
  // State and refs for programmatic PDF generation
  const [pdfTask, setPdfTask] = useState<PdfTask | null>(null);
  const [pdfTaskScope, setPdfTaskScope] = useState('');
  const estimatePdfRef = useRef<HTMLDivElement>(null);
  const materialOrderPdfRef = useRef<HTMLDivElement>(null);

  const { customers, handleAddCustomer, handleUpdateCustomer, setMainPage, setSelectedCustomerId, setCalculatorInputs, setOnHandInventory, handleJobSold, companyInfo } = props;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Effect to handle clicks outside the chat window to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the chat is open and the click is outside the chat window and the FAB, close the chat.
      if (
        chatWindowRef.current && !chatWindowRef.current.contains(event.target as Node) &&
        fabRef.current && !fabRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]); // Re-attach listener if isOpen changes

  const systemInstruction = `You are the AI Agent Assistant inside a spray foam quoting app. Your job is to understand natural language and respond with a JSON object that the application can execute.

  AGENT BEHAVIOR RULES:
  1.  **Workflows over Commands**: Prioritize using the powerful 'PROCESS_JOB' action for any requests involving creating estimates, saving documents, or marking jobs as sold. This single action can handle the entire workflow.
  2.  **Screen Navigation**: Use 'NAVIGATE' for simple requests like "show me the dashboard".
  3.  **Customer Management**: Use 'CREATE_CUSTOMER' or 'UPDATE_CUSTOMER' for simple contact management. When a command involves creating an estimate for a new person, 'PROCESS_JOB' will handle customer creation automatically.
  4.  **Defaults are Key**: If details for a job are missing (e.g., foam thickness), use the app's default values. The user can always adjust later.
  5.  **Confirmation is Critical**: Your response JSON must always include a concise, professional confirmation message starting with "✅".

  CURRENT APP STATE:
  - Customers: ${JSON.stringify(customers.map(c => ({ id: c.id, name: c.name })), null, 2)}
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, description: 'The action to perform.', enum: ['NAVIGATE', 'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'PROCESS_JOB', 'UPDATE_INVENTORY', 'MARK_JOB_SOLD', 'NO_ACTION'] },
      payload: { type: Type.OBJECT, description: 'Data for the action.', properties: {
        page: { type: Type.STRING, description: 'The page to navigate to.', nullable: true },
        customerData: { type: Type.OBJECT, description: 'Customer details for finding or creating.', nullable: true, properties: { name: {type: Type.STRING}, phone: {type: Type.STRING, nullable: true}, email: {type: Type.STRING, nullable: true}, address: {type: Type.STRING, nullable: true}, notes: { type: Type.STRING, nullable: true } } },
        updateField: { type: Type.STRING, description: 'The customer field to update.', nullable: true },
        updateValue: { type: Type.STRING, description: 'The new value for the customer field.', nullable: true },
        calculatorInputs: { type: Type.OBJECT, description: 'Values for the spray foam calculator.', nullable: true, properties: {
            length: { type: Type.NUMBER, nullable: true }, width: { type: Type.NUMBER, nullable: true }, wallHeight: { type: Type.NUMBER, nullable: true }, pitchInput: { type: Type.STRING, nullable: true },
            wallFoamType: { type: Type.STRING, nullable: true, enum: ['open-cell', 'closed-cell'] }, wallThicknessIn: { type: Type.NUMBER, nullable: true },
            roofFoamType: { type: Type.STRING, nullable: true, enum: ['open-cell', 'closed-cell'] }, roofThicknessIn: { type: Type.NUMBER, nullable: true },
        }},
        inventory: { type: Type.OBJECT, description: 'On-hand inventory levels.', nullable: true, properties: { ocSets: {type: Type.NUMBER, nullable: true}, ccSets: {type: Type.NUMBER, nullable: true} } },
        markAsSold: { type: Type.BOOLEAN, description: 'Flag to mark the job as sold after processing.', nullable: true},
        aiNotes: { type: Type.STRING, description: 'Optional notes for the scope of work.', nullable: true },
      }},
      confirmation: { type: Type.STRING, description: 'A confirmation message for the user.' },
    },
    required: ['action', 'confirmation'],
  };

  const findCustomer = (name: string): CustomerInfo | null => {
    if (!name) return null;
    const lowerCaseName = name.toLowerCase();
    const matchingCustomers = customers.filter(c => c.name.toLowerCase().includes(lowerCaseName));
    if (matchingCustomers.length === 0) return null;
    return matchingCustomers.sort((a, b) => b.id - a.id)[0];
  };

  const handleSendMessage = async () => {
    const userMessage = inputText.trim();
    if (!userMessage || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInputText('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const aiResponseJson = JSON.parse(response.text);
      const { action, payload, confirmation } = aiResponseJson;
      
      setMessages(prev => [...prev, { role: 'assistant', text: confirmation }]);
      
      // Execute the action
      switch (action) {
        case 'NAVIGATE':
          if (payload.page) setMainPage(payload.page);
          break;
        case 'CREATE_CUSTOMER': {
          if (payload.customerData?.name) {
            const { name, phone = '', email = '', address = 'N/A', notes = '' } = payload.customerData;
            handleAddCustomer({ name, phone, email, address, notes });
            // Fix: Navigate to 'jobsList' as 'customers' page is deprecated.
            setMainPage('jobsList');
          }
          break;
        }
        case 'UPDATE_CUSTOMER': {
          if (payload.customerData?.name && payload.updateField && payload.updateValue) {
            const customer = findCustomer(payload.customerData.name);
            if (customer) {
              const updatedCustomer = { ...customer, [payload.updateField]: payload.updateValue };
              handleUpdateCustomer(updatedCustomer);
              // Fix: Navigate to 'jobsList' as 'customers' page is deprecated.
              setMainPage('jobsList');
            } else {
              setMessages(prev => [...prev, { role: 'system', text: `Error: Could not find a customer matching "${payload.customerData.name}" to update.` }]);
            }
          }
          break;
        }
        case 'PROCESS_JOB': {
            if (!payload.customerData?.name) {
                 setMessages(prev => [...prev, { role: 'system', text: `Error: A customer name is required to process a job.` }]);
                 break;
            }
            let customer = findCustomer(payload.customerData.name);
            if (!customer) {
                const { name, phone = '', email = '', address = 'N/A' } = payload.customerData;
                customer = handleAddCustomer({ name, phone, email, address });
                 setMessages(prev => [...prev, { role: 'system', text: `New customer "${customer.name}" created.` }]);
            }

            const fullCalculatorInputs = { ...DEFAULT_CALCULATOR_VALUES, ...payload.calculatorInputs };
            const calcData = calculateResults(fullCalculatorInputs);
            const costsData = calculateCosts(calcData, DEFAULT_COST_SETTINGS);
            
            // Trigger the PDF generation workflow
            setPdfTask({
                calc: calcData,
                costs: costsData,
                customer: customer,
                companyInfo: companyInfo,
                markAsSold: payload.markAsSold || false,
                aiNotes: payload.aiNotes || '',
            });
            break;
        }
        case 'UPDATE_INVENTORY':
          if (payload.inventory) {
            setOnHandInventory(prev => ({ ...prev, ...payload.inventory }));
            setMainPage('materialOrder');
          }
          break;
        case 'MARK_JOB_SOLD': {
          if (!payload.customerData?.name) {
            setMessages(prev => [...prev, { role: 'system', text: `Error: Please specify which customer's job to mark as sold.` }]);
            break;
          }
          
          const customer = findCustomer(payload.customerData.name);
          if (!customer) {
            setMessages(prev => [...prev, { role: 'system', text: `Error: Could not find a customer matching "${payload.customerData.name}".` }]);
            break;
          }
          
          const estimates = await getEstimatesForCustomer(customer.id);
          const latestEstimate = estimates.find(e => e.estimateNumber.startsWith('EST-'));
          
          if (latestEstimate) {
            handleJobSold(latestEstimate);
          } else {
            setMessages(prev => [...prev, { role: 'system', text: `Error: Customer "${customer.name}" has no formal estimate (EST-XXXX) to mark as sold.` }]);
          }
          break;
        }
        default:
          break;
      }

    } catch (error) {
      console.error("Gemini Agent Error:", error);
      setMessages(prev => [...prev, { role: 'system', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'system', text: 'Analyzing image of notes...' }]);

    try {
        const base64Data = await toBase64(file);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

        const prompt = `You are an expert at optical character recognition (OCR) specializing in handwritten notes. Your task is to analyze the provided image and extract customer contact information. Identify the customer's full name, their complete mailing address, and their phone number. If a specific piece of information (name, address, or phone) is not present or legible in the note, return an empty string for that field. Your response must be a JSON object that strictly adheres to the provided schema.`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "The full name of the customer." },
                address: { type: Type.STRING, description: "The full mailing address of the customer." },
                phone: { type: Type.STRING, description: "The phone number of the customer." },
            },
            required: ['name', 'address', 'phone'],
        };
        
        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, imagePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const extractedData = JSON.parse(response.text);
        const { name, address, phone } = extractedData;

        if (!name && !address && !phone) {
            setMessages(prev => [...prev, { role: 'system', text: 'Could not find any customer details in the image. Please try a clearer photo.' }]);
        } else {
            const newCustomer = handleAddCustomer({ name, address, phone, email: '' });
            setMessages(prev => [...prev, { role: 'assistant', text: `✅ Extracted customer "${newCustomer.name}" from your notes and created a new record.` }]);
            setSelectedCustomerId(newCustomer.id);
            setMainPage('calculator');
        }

    } catch (error) {
        console.error("Image Scan Error:", error);
        setMessages(prev => [...prev, { role: 'system', text: 'Sorry, I had trouble reading that image. Please try again.' }]);
    } finally {
        setIsLoading(false);
        // Reset the file input so the same file can be captured again
        if (e.target) e.target.value = '';
    }
  };

  // Effect to run the PDF generation task when `pdfTask` is set
  useEffect(() => {
    if (!pdfTask) return;

    const run = async () => {
        try {
            const { calc, costs, customer, companyInfo, markAsSold, aiNotes } = pdfTask;

            // 1. Generate Scope of Work with Gemini
            setMessages(prev => [...prev, { role: 'system', text: `Generating AI Scope of Work...` }]);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            let prompt = `You are an assistant for a spray foam insulation company generating a "Scope of Work". Be professional and concise. Do not include pricing. Use markdown for lists and bolding.
**Job Details:**`;
            if (calc.wallBoardFeetWithWaste > 0) prompt += `\n- **Walls Application:** Approximately ${calc.wallTotal.toFixed(0)} sq ft of walls will be insulated with ${calc.wallThicknessIn} inches of ${calc.wallFoamType} foam.`;
            if (calc.roofBoardFeetWithWaste > 0) prompt += `\n- **Roof Deck Application:** Approximately ${calc.roofArea.toFixed(0)} sq ft of the roof deck underside will be insulated with ${calc.roofThicknessIn} inches of ${calc.roofFoamType} foam.`;
            if (aiNotes) prompt += `\n**Additional Notes:**\n- ${aiNotes}`;
            
            const scopeResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const scopeOfWork = scopeResponse.text;
            setPdfTaskScope(scopeOfWork);
            
            await new Promise(resolve => setTimeout(resolve, 100)); // Allow state to update

            // 2. Generate Estimate PDF
            setMessages(prev => [...prev, { role: 'system', text: `Creating Estimate PDF...` }]);
            const estimateElement = estimatePdfRef.current;
            if (!estimateElement) throw new Error("Estimate PDF template element not found.");
            const estimateCanvas = await html2canvas(estimateElement, { scale: 2 });
            const estimatePdf = new jspdf.jsPDF({ orientation: 'p', unit: 'in', format: 'letter' });
            estimatePdf.addImage(estimateCanvas.toDataURL('image/png'), 'PNG', 0, 0, estimatePdf.internal.pageSize.getWidth(), estimatePdf.internal.pageSize.getHeight());
            const estimatePdfBlob = estimatePdf.output('blob');

            // 3. Generate Material Order PDF
            setMessages(prev => [...prev, { role: 'system', text: `Creating Material Order PDF...` }]);
            const materialOrderElement = materialOrderPdfRef.current;
            if (!materialOrderElement) throw new Error("Material Order PDF template not found.");
            const materialCanvas = await html2canvas(materialOrderElement, { scale: 2 });
            const materialPdf = new jspdf.jsPDF({ orientation: 'p', unit: 'in', format: 'letter' });
            materialPdf.addImage(materialCanvas.toDataURL('image/png'), 'PNG', 0, 0, materialPdf.internal.pageSize.getWidth(), materialPdf.internal.pageSize.getHeight());
            const materialPdfBlob = materialPdf.output('blob');
            
            // 4. Save to DB
            setMessages(prev => [...prev, { role: 'system', text: `Saving documents to ${customer.name}'s record...` }]);
            const estimateNumber = `EST-${new Date().getTime().toString().slice(-6)}`;
            
            const estimateToSave: SaveEstimateArgs = {
                customerId: customer.id,
                estimatePdf: estimatePdfBlob,
                materialOrderPdf: materialPdfBlob,
                estimateNumber,
                calcData: { ...calc, customer },
                costsData: costs,
                scopeOfWork: scopeOfWork,
                status: markAsSold ? 'sold' : 'estimate',
            };
            
            const savedRecord = await saveEstimate(estimateToSave);
            
            // 5. Optionally Mark as Sold
            if (markAsSold) {
                setMessages(prev => [...prev, { role: 'system', text: `Job marked as sold...` }]);
                handleJobSold(savedRecord);
            }
        } catch (e) {
            console.error("PDF Task Error:", e);
            setMessages(prev => [...prev, { role: 'system', text: `An error occurred during job processing: ${e instanceof Error ? e.message : 'Unknown error'}` }]);
        } finally {
            setPdfTask(null); // Clear the task
            setPdfTaskScope('');
        }
    };
    run();
  }, [pdfTask, companyInfo, handleJobSold]);

  return (
    <>
      <div 
        ref={fabRef}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-3xl cursor-pointer shadow-lg z-[9999] transition-all duration-200 ease-in-out hover:scale-110 hover:bg-blue-700"
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : '✨'}
      </div>
      
      <div 
        ref={chatWindowRef}
        className={`fixed bottom-20 left-4 right-4 h-[70vh] max-h-[550px] sm:left-auto sm:right-6 sm:bottom-[110px] sm:w-[360px] sm:h-[520px] sm:max-h-none bg-white rounded-xl shadow-2xl flex-col overflow-hidden z-[10000] transition-all duration-300 ease-in-out ${isOpen ? 'flex opacity-100 translate-y-0' : 'hidden opacity-0 translate-y-4'}`}>
        <div className="relative flex items-center justify-center bg-blue-600 text-white p-3 font-bold text-center">
          <span>Gemini Assistant</span>
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close Assistant"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 p-3 overflow-y-auto text-sm leading-relaxed bg-slate-50">
          {messages.map((msg, index) => (
            <div key={index} className={`mb-3 p-2 rounded-lg max-w-[90%] w-fit ${msg.role === 'user' ? 'bg-blue-500 text-white ml-auto' : msg.role === 'assistant' ? 'bg-slate-200 text-slate-800' : 'bg-amber-100 text-amber-800 text-xs text-center w-full max-w-full'}`}>
              {msg.text}
            </div>
          ))}
          {isLoading && <div className="p-2 bg-slate-200 text-slate-500 rounded-lg animate-pulse">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex border-t">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a command..." 
            className="flex-1 border-none p-3 text-sm outline-none"
            disabled={isLoading}
          />
           <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isLoading} 
            className="border-none px-3 cursor-pointer text-slate-500 hover:text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
            aria-label="Scan handwritten notes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
           </button>
          <button onClick={handleSendMessage} disabled={isLoading} className="bg-blue-600 text-white border-none px-4 cursor-pointer disabled:bg-slate-400">
            Send
          </button>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageCapture} 
            style={{ display: 'none' }} 
            accept="image/*" 
            capture="environment"
        />
      </div>

      {/* Hidden renderer for programmatic PDF generation */}
      {pdfTask && (
          <div style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
              <div ref={estimatePdfRef}>
                  <EstimatePDF 
                      calc={pdfTask.calc} 
                      costs={pdfTask.costs} 
                      companyInfo={pdfTask.companyInfo} 
                      customerInfo={pdfTask.customer} 
                      scopeOfWork={pdfTaskScope || "Generating..."}
                      pdfWidth="8.5in"
                      pdfHeight="11in"
                  />
              </div>
              <div ref={materialOrderPdfRef}>
                  <MaterialOrderPDF
                      calc={pdfTask.calc}
                      costs={pdfTask.costs}
                      companyInfo={pdfTask.companyInfo}
                      customerInfo={pdfTask.customer}
                  />
              </div>
          </div>
      )}
    </>
  );
};

export default GeminiAgent;