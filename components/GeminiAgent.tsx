import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { CompanyInfo, CustomerInfo } from './EstimatePDF.tsx';
import { CalculatorInputs, CalculationResults } from './SprayFoamCalculator.tsx';
import { OnHandInventory } from './MaterialOrder.tsx';
import { calculateResults } from '../lib/processing.ts';
import { Job } from './types.ts';
import { fmtInput, addDays } from './utils.ts';
import { AppSettings, Page } from '../App.tsx';


// Add declarations for jspdf and html2canvas
declare var jspdf: any;
declare var html2canvas: any;

interface GeminiAgentProps {
  setMainPage: (page: Page) => void;
  customers: CustomerInfo[];
  handleAddCustomer: (customer: Omit<CustomerInfo, 'id'>) => Promise<CustomerInfo>;
  handleUpdateCustomer: (customer: CustomerInfo) => void;
  setSelectedCustomerId: (id: number | '') => void;
  calculatorInputs: CalculatorInputs;
  setCalculatorInputs: React.Dispatch<React.SetStateAction<CalculatorInputs>>;
  onHandInventory: OnHandInventory;
  setOnHandInventory: React.Dispatch<React.SetStateAction<OnHandInventory>>;
  handleJobSold: (estimate: any) => void;
  companyInfo: CompanyInfo;
  // New props for full calendar control
  calendarJobs: Job[];
  onAddCalendarJob: (job: Omit<Job, 'id'>) => Job;
  onUpdateCalendarJob: (job: Job) => void;
  onDeleteCalendarJob: (jobId: string) => void;
  appSettings: AppSettings;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  sources?: { title: string; uri: string }[];
  imageUrl?: string; // For UI display
  imagePartsForApi?: { // For API history
    inlineData: {
      mimeType: string;
      data: string; // base64
    }
  };
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
  const chatWindowRef = useRef<HTMLDivElement>(null); 
  const fabRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // State and refs for Talk Mode
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  const { 
    customers, handleAddCustomer, setMainPage, setSelectedCustomerId, 
    setCalculatorInputs, setOnHandInventory, companyInfo, calendarJobs,
    onAddCalendarJob, onUpdateCalendarJob, onDeleteCalendarJob,
  } = props;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  // This effect handles clicking outside the chat window to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen && 
        chatWindowRef.current && !chatWindowRef.current.contains(event.target as Node) &&
        fabRef.current && !fabRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Speech Recognition Effect
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      speechRecognitionRef.current = new SpeechRecognition();
      speechRecognitionRef.current.continuous = false;
      speechRecognitionRef.current.interimResults = false;
      speechRecognitionRef.current.lang = 'en-US';

      speechRecognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        handleSend(transcript); // Automatically send after transcription
      };

      speechRecognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      speechRecognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.start();
        setIsListening(true);
      } else {
        alert("Speech recognition not supported in your browser.");
      }
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the file input
      }
  };


  const handleSend = async (text?: string) => {
    const query = text || inputText.trim();
    if ((query === '' && !imageFile) || isLoading) return;

    setInputText('');
    setIsLoading(true);

    const fileToSend = imageFile;
    const previewUrl = imagePreview;
    removeImage();

    let imagePartForApi: { inlineData: { mimeType: string, data: string } } | undefined = undefined;
    if (fileToSend) {
        const base64ImageData = await toBase64(fileToSend);
        imagePartForApi = {
            inlineData: {
                mimeType: fileToSend.type,
                data: base64ImageData,
            }
        };
    }

    const userMessage: Message = {
        role: 'user',
        text: query,
        imageUrl: previewUrl || undefined,
        imagePartsForApi: imagePartForApi
    };
    setMessages(prev => [...prev, userMessage]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
        const functionDeclarations = [
            {
              name: 'navigate',
              description: 'Navigate to a specific page within the application.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  page: {
                    type: Type.STRING,
                    description: "The page to navigate to. Must be one of: 'dashboard', 'calculator', 'customers', 'schedule', 'settings', 'team', 'jobsList', 'materialOrder', 'invoicing', 'gantt'."
                  }
                },
                required: ['page']
              }
            },
            {
              name: 'addCustomer',
              description: 'Add a new customer to the CRM.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Full name of the customer.' },
                  address: { type: Type.STRING, description: 'Full address of the customer.' },
                  phone: { type: Type.STRING, description: 'Phone number of the customer.' },
                  email: { type: Type.STRING, description: 'Email address of the customer.' },
                },
                required: ['name', 'address']
              }
            },
            {
              name: 'startEstimate',
              description: 'Start a new estimate, optionally for a specific customer. Navigates to the calculator page.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  customerId: { type: Type.NUMBER, description: 'The ID of the customer to start the estimate for. Omit if not specified.' }
                },
              }
            },
            {
                name: 'updateCalculator',
                description: 'Update one or more fields in the spray foam calculator.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        length: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        wallHeight: { type: Type.NUMBER },
                        wallThicknessIn: { type: Type.NUMBER },
                        roofThicknessIn: { type: Type.NUMBER },
                    }
                }
            },
            {
                name: 'getOnHandInventory',
                description: 'Retrieves the current on-hand inventory levels for open-cell and closed-cell foam sets.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
            },
            {
                name: 'updateOnHandInventory',
                description: 'Updates the on-hand inventory levels.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        ocSets: { type: Type.NUMBER, description: 'The new total quantity of open-cell sets.' },
                        ccSets: { type: Type.NUMBER, description: 'The new total quantity of closed-cell sets.' },
                    }
                }
            },
            {
                name: 'scheduleJob',
                description: 'Adds a new job to the calendar schedule.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'The name or title of the job.' },
                        startDate: { type: Type.STRING, description: 'The start date in YYYY-MM-DD format. If only a day is mentioned, assume the current month and year.' },
                        durationDays: { type: Type.NUMBER, description: 'The duration of the job in days.' },
                    },
                    required: ['name', 'startDate', 'durationDays']
                }
            },
            {
                name: 'findJob',
                description: 'Finds a scheduled job by name or keyword.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        keyword: { type: Type.STRING, description: 'The name or keyword to search for in the job schedule.' }
                    },
                    required: ['keyword']
                }
            }
        ];

        const systemInstruction = `You are a helpful AI assistant integrated into a CRM for a spray foam insulation company called "FOAM CRMAI".
Your primary role is to assist the user by executing functions to manage the application's state and navigate its pages.
If an image of handwritten notes is provided, analyze it to extract customer information (name, address, phone, email) and job specifications (like building dimensions and foam thickness). First, call the 'addCustomer' function with the extracted customer details. Then, call the 'updateCalculator' function with the job specifications. Finally, navigate to the 'calculator' page to show the results and inform the user you have done so.
The current date is ${new Date().toLocaleDateString()}.
Do not ask for confirmation before calling a function. Call it directly with the information you have.
If a customer name is mentioned, check if they exist in the provided customer list before deciding to add a new one.
When asked to start an estimate for a customer, use the 'startEstimate' function with their customer ID.
When asked to perform a calculation, first navigate to the 'calculator' page if not already there, then use the 'updateCalculator' function.
Be concise in your text responses. The user wants quick actions, not long conversations.

Available customers:
${customers.map(c => `- ID: ${c.id}, Name: ${c.name}`).join('\n') || 'No customers in the system yet.'}
`;

        const chatHistory = messages.map(msg => {
            const parts: any[] = [];
            if (msg.role === 'user' && msg.imagePartsForApi) {
                parts.push(msg.imagePartsForApi);
            }
            if (msg.text) {
                parts.push({ text: msg.text });
            }
            return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: parts,
            };
        });

        const currentUserParts: any[] = [];
        if (imagePartForApi) {
            currentUserParts.push(imagePartForApi);
        }
        if (query) {
            currentUserParts.push({ text: query });
        }

        const initialResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [...chatHistory, { role: 'user', parts: currentUserParts }],
            config: {
                systemInstruction: systemInstruction,
                tools: [{ functionDeclarations }]
            }
        });

        const functionCalls = initialResponse.candidates?.[0]?.content?.parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);

        if (functionCalls && functionCalls.length > 0) {
            const toolResponses = await Promise.all(functionCalls.map(async (call) => {
                let responseData;
                switch (call.name) {
                    case 'navigate':
                        const page = call.args?.page as Page;
                        if (page) {
                            setMainPage(page);
                            responseData = { success: true, message: `Navigated to ${page}.` };
                        } else {
                            responseData = { success: false, message: 'Page not specified.' };
                        }
                        break;
                    case 'addCustomer':
                        const newCustomer = await handleAddCustomer({
                            name: call.args.name as string,
                            address: call.args.address as string,
                            phone: call.args.phone as string || '',
                            email: call.args.email as string || ''
                        });
                        responseData = { success: true, customerId: newCustomer.id, message: `Added customer: ${newCustomer.name}.` };
                        break;
                    case 'startEstimate':
                        setMainPage('calculator');
                        setSelectedCustomerId(call.args.customerId as number || '');
                        responseData = { success: true, message: 'Starting estimate.' };
                        break;
                    case 'updateCalculator':
                        setCalculatorInputs(prev => ({ ...prev, ...(call.args as Partial<CalculatorInputs>) }));
                        setMainPage('calculator');
                        responseData = { success: true, message: 'Calculator updated.' };
                        break;
                    case 'getOnHandInventory':
                        responseData = props.onHandInventory;
                        break;
                    case 'updateOnHandInventory':
                        setOnHandInventory(prev => ({ ...prev, ...(call.args as Partial<OnHandInventory>) }));
                        setMainPage('materialOrder');
                        responseData = { success: true, message: 'Inventory updated.' };
                        break;
                    case 'scheduleJob':
                        const startDate = new Date((call.args.startDate as string).replace(/-/g, '/'));
                        const endDate = addDays(startDate, (call.args.durationDays as number) - 1);
                        onAddCalendarJob({
                            name: call.args.name as string,
                            start: fmtInput(startDate),
                            end: fmtInput(endDate),
                            color: '#3498DB',
                            links: [],
                        });
                        setMainPage('schedule');
                        responseData = { success: true, message: `Scheduled "${call.args.name as string}".` };
                        break;
                    case 'findJob':
                        const keyword = (call.args.keyword as string).toLowerCase();
                        const foundJobs = calendarJobs.filter(j => j.name.toLowerCase().includes(keyword));
                        if (foundJobs.length > 0) {
                            const jobList = foundJobs.map(j => `- "${j.name}" from ${j.start} to ${j.end}`).join('\n');
                            responseData = { success: true, jobs: jobList };
                        } else {
                            responseData = { success: false, message: `No jobs found with keyword "${keyword}".` };
                        }
                        break;
                    default:
                        responseData = { success: false, message: 'Unknown function.' };
                }
                return { functionResponse: { name: call.name, response: responseData } };
            }));

            const finalResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    ...chatHistory,
                    { role: 'user', parts: currentUserParts },
                    { role: 'model', parts: initialResponse.candidates![0].content.parts },
                    { role: 'tool', parts: toolResponses }
                ],
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations }]
                }
            });

            setMessages(prev => [...prev, { role: 'assistant', text: finalResponse.text }]);
        } else {
            setMessages(prev => [...prev, { role: 'assistant', text: initialResponse.text }]);
        }

    } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <>
      <div ref={fabRef} className="fixed bottom-20 right-4 z-[9999]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 rounded-full text-white shadow-lg transition-transform transform hover:scale-110 ${isOpen ? 'bg-red-500' : 'bg-blue-600'}`}
          aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
          )}
        </button>
      </div>

      {isOpen && (
        <div ref={chatWindowRef} className="fixed bottom-40 right-4 z-[9998] w-[90vw] max-w-sm h-[60vh] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50">FOAM CRMAI Assistant</h3>
            <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600"
                aria-label="Close Assistant"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-bl-none'}`}>
                  {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded content" className="max-w-full h-auto rounded-lg mb-2" />}
                  {msg.text && <div>{msg.text}</div>}
                </div>
              </div>
            ))}
             {isLoading && (
              <div className="flex justify-start">
                  <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl px-4 py-2 rounded-bl-none">
                      <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                      </div>
                  </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {imagePreview && (
            <div className="p-2 border-t border-slate-200 dark:border-slate-700">
                <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-h-24 rounded-lg" />
                    <button
                        onClick={removeImage}
                        className="absolute top-0 right-0 -m-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold"
                        aria-label="Remove image"
                    >
                        &times;
                    </button>
                </div>
            </div>
          )}
          <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
              />
              <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                  aria-label="Attach an image"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <button 
                onClick={toggleListen}
                className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                aria-label={isListening ? "Stop listening" : "Start listening"}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask or upload notes..."
                className="w-full bg-slate-100 dark:bg-slate-700 border-transparent rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full disabled:bg-slate-400"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GeminiAgent;