import React, { useState, useEffect } from 'react';
import SprayFoamCalculator, { CalculationResults, FoamType } from './components/SprayFoamCalculator';
import JobCosting from './components/JobCosting';
import Settings from './components/Settings';
import JobsList from './components/JobsList';
import JobDetail from './components/JobDetail';
import MaterialOrder, { OnHandInventory } from './components/MaterialOrder';
import Dashboard from './components/Dashboard';
import GeminiAgent from './components/GeminiAgent';
import { CompanyInfo, CustomerInfo } from './components/EstimatePDF';
import { EstimateRecord, getAllEstimates, updateEstimateStatus, deleteEstimate } from './lib/db';
import JobCalendar from './components/JobCalendar';


type Page = 'dashboard' | 'calculator' | 'costing' | 'jobsList' | 'jobDetail' | 'materialOrder' | 'invoiceEditor' | 'settings' | 'schedule';

const pageTitles: Record<Page, string> = {
    dashboard: 'Dashboard',
    jobsList: 'All Jobs',
    calculator: 'New Estimate',
    materialOrder: 'Material Inventory',
    settings: 'Company Settings',
    jobDetail: 'Job Details',
    costing: 'Job Costing & Quote',
    invoiceEditor: 'Invoice Preparation',
    schedule: 'Job Calendar',
};


// Type guards to validate data from localStorage
function isCompanyInfo(obj: any): obj is CompanyInfo {
    return obj && typeof obj.name === 'string' && typeof obj.address === 'string' && typeof obj.phone === 'string' && typeof obj.email === 'string';
}

function isCustomerInfoArray(obj: any): obj is CustomerInfo[] {
    if (!Array.isArray(obj)) return false;
    return obj.every(item => 
        item && 
        typeof item.id === 'number' && 
        typeof item.name === 'string' && 
        typeof item.address === 'string' &&
        (typeof item.notes === 'string' || typeof item.notes === 'undefined')
    );
}

// Default values for calculator, to be used by AI if not specified
export const DEFAULT_CALCULATOR_VALUES = {
  length: 60,
  width: 40,
  wallHeight: 14,
  pitchInput: "4/12",
  includeGableTriangles: false,
  wallFoamType: 'open-cell' as FoamType,
  wallThicknessIn: 3,
  wallWastePct: 10,
  roofFoamType: 'closed-cell' as FoamType,
  roofThicknessIn: 5.5,
  roofWastePct: 15,
  openCellYield: 16000,
  closedCellYield: 4000,
};

function App() {
  const [mainPage, setMainPage] = useState<Page>('dashboard');
  const [costingData, setCostingData] = useState<CalculationResults | null>(null);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [customers, setCustomers] = useState<CustomerInfo[]>([]);
  const [isAppReady, setIsAppReady] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [soldJobData, setSoldJobData] = useState<EstimateRecord | null>(null);
  const [allJobs, setAllJobs] = useState<EstimateRecord[]>([]); // New single source of truth for all jobs
  const [selectedJob, setSelectedJob] = useState<EstimateRecord | null>(null); // For job detail view
  const [invoiceJobData, setInvoiceJobData] = useState<EstimateRecord | null>(null); // For invoice editing
  const [jobToSchedule, setJobToSchedule] = useState<EstimateRecord | null>(null); // For sending a job to the calendar

  // State lifted from SprayFoamCalculator for AI control
  const [calculatorInputs, setCalculatorInputs] = useState(DEFAULT_CALCULATOR_VALUES);

  // State lifted from MaterialOrder for AI control
  const [onHandInventory, setOnHandInventory] = useState<OnHandInventory>({ ocSets: 0, ccSets: 0 });
    
  const refreshAllJobs = async () => {
      try {
          const jobs = await getAllEstimates();
          setAllJobs(jobs);
      } catch (error) {
          console.error("Failed to fetch all jobs:", error);
      }
  };


  useEffect(() => {
    try {
      let companyData: CompanyInfo | null = null;
      const savedCompany = localStorage.getItem('companyInfo');
      if (savedCompany) {
        const parsedCompany = JSON.parse(savedCompany);
        if (isCompanyInfo(parsedCompany)) companyData = parsedCompany;
      }
      setCompanyInfo(companyData);
      
      let customerData: CustomerInfo[] = [];
      const savedCustomers = localStorage.getItem('customers');
      if (savedCustomers) {
        const parsedCustomers = JSON.parse(savedCustomers);
        if (isCustomerInfoArray(parsedCustomers)) customerData = parsedCustomers;
      }
      if (customerData.length === 0) {
        customerData = [
          { id: 1625152800000, name: "John Doe's Pole Barn", address: "456 Project Rd, Builderstown, 54321", phone: "555-987-6543", email: "johndoe@example.com", notes: "Gate code is #1234. Prefers calls in the afternoon." },
          { id: 1625152800001, name: "Jane Smith's Workshop", address: "789 Craft Ave, Maker Village, 67890", phone: "555-555-5555", email: "janesmith@example.com", notes: "Has two large dogs, but they are friendly." }
        ];
        localStorage.setItem('customers', JSON.stringify(customerData));
      }
      setCustomers(customerData);
      
      refreshAllJobs(); // Initial load of all jobs
      setIsAppReady(true);
    } catch (error) {
      console.error("Failed to parse or seed data from localStorage", error);
    }
  }, []);
    
  useEffect(() => {
    if (companyInfo && isAppReady) {
      localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
    }
  }, [companyInfo, isAppReady]);

  useEffect(() => {
     if (isAppReady) {
      localStorage.setItem('customers', JSON.stringify(customers));
    }
  }, [customers, isAppReady]);

  const handleProceedToCosting = (calcData: CalculationResults) => {
    setCostingData(calcData);
    setMainPage('costing');
  };

  const handleBackToCalculator = () => {
    setMainPage('calculator');
  };
  
  const handleAddCustomer = (newCustomer: Omit<CustomerInfo, 'id'>) => {
    const customerWithId = { ...newCustomer, id: Date.now() };
    setCustomers(prev => [...prev, customerWithId]);

    // Fire-and-forget webhook to notify an external service of a new customer.
    // Errors are logged to the console without interrupting the user flow.
    const webhookUrl = 'https://hooks.zapier.com/hooks/catch/22080087/um4sg3f/';
    fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(customerWithId)
    }).catch(error => {
        console.error('Webhook trigger failed for new customer:', error);
    });

    return customerWithId; // Return the new customer with ID
  };
  
  const handleUpdateCustomer = (updatedCustomer: CustomerInfo) => {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
  };


  const handleSaveSettings = (info: CompanyInfo) => {
    setCompanyInfo(info);
    setMainPage('dashboard');
  };
  
  const handleViewJob = (job: EstimateRecord) => {
      setSelectedJob(job);
      setMainPage('jobDetail');
  };

  const handleBackToJobsList = () => {
      setSelectedJob(null);
      setMainPage('jobsList');
      refreshAllJobs(); // Refresh list when going back to it
  }

  const handleJobSold = (estimate: EstimateRecord) => {
      setSoldJobData(estimate);
      // No longer navigate away, user stays on JobDetail page to allow for scheduling.
  };

  const handleUpdateJobStatus = async (jobId: number, status: 'sold' | 'invoiced' | 'paid') => {
    await updateEstimateStatus(jobId, status);
    const updatedJobs = allJobs.map(job => 
        job.id === jobId ? { ...job, status } : job
    );
    setAllJobs(updatedJobs);
    if(selectedJob && selectedJob.id === jobId) {
        setSelectedJob(prev => prev ? {...prev, status} : null);
    }
    if (status === 'sold') {
        const soldJob = updatedJobs.find(j => j.id === jobId);
        if (soldJob) handleJobSold(soldJob);
    }
  };
  
  const handleDeleteJob = async (jobId: number) => {
    if (window.confirm('Are you sure you want to permanently delete this job? This action cannot be undone.')) {
        try {
            await deleteEstimate(jobId);
            await refreshAllJobs();
        } catch (error) {
            console.error("Failed to delete job:", error);
            alert("There was an error deleting the job. Please try again.");
        }
    }
  };

  const handlePrepareInvoice = (job: EstimateRecord) => {
    setInvoiceJobData(job);
    setMainPage('invoiceEditor');
  };

  const handleFinalizeInvoice = (updatedJob: EstimateRecord) => {
      if (updatedJob.id) {
          handleUpdateJobStatus(updatedJob.id, 'invoiced');
      }
      setInvoiceJobData(null); 
      setSelectedJob(updatedJob); // show the updated job detail
      setMainPage('jobDetail');
  };

  const handleScheduleJob = (job: EstimateRecord) => {
      setJobToSchedule(job);
      setMainPage('schedule');
  };

  const handleJobScheduled = () => {
      setJobToSchedule(null);
  };
  
  if (!isAppReady) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  if (!companyInfo) {
    return <Settings onSave={handleSaveSettings} isInitialSetup={true}/>;
  }
  
  const handleNavClick = (page: Page) => {
    if (page === 'dashboard' || page === 'jobsList') {
        refreshAllJobs();
    }
    setMainPage(page);
  };
    
  const agentProps = {
    setMainPage,
    customers,
    handleAddCustomer,
    handleUpdateCustomer,
    setSelectedCustomerId,
    calculatorInputs,
    setCalculatorInputs,
    onHandInventory,
    setOnHandInventory,
    handleJobSold,
    companyInfo
  };
  
  const renderContent = () => {
    switch (mainPage) {
        case 'dashboard': return <Dashboard jobs={allJobs} onViewJob={handleViewJob} />;
        case 'jobsList': return <JobsList jobs={allJobs} customers={customers} onViewJob={handleViewJob} onDeleteJob={handleDeleteJob} />;
        case 'calculator': return <SprayFoamCalculator 
            onProceedToCosting={handleProceedToCosting} 
            customers={customers} 
            onAddCustomer={handleAddCustomer} 
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            calculatorInputs={calculatorInputs}
            setCalculatorInputs={setCalculatorInputs}
        />;
        case 'costing': return costingData && <JobCosting 
            calculationResults={costingData} 
            onBack={handleBackToCalculator} 
            companyInfo={companyInfo}
            onEstimateCreated={(newJob) => {
                refreshAllJobs();
                handleViewJob(newJob);
            }}
        />;
        case 'jobDetail': return selectedJob && <JobDetail
            job={selectedJob}
            customers={customers}
            onBack={handleBackToJobsList}
            onUpdateStatus={handleUpdateJobStatus}
            onPrepareInvoice={handlePrepareInvoice}
            onScheduleJob={handleScheduleJob}
        />;
        case 'materialOrder': return <MaterialOrder 
            soldJobData={soldJobData} 
            onHandInventory={onHandInventory}
            setOnHandInventory={setOnHandInventory}
        />;
        case 'invoiceEditor': return invoiceJobData && <JobCosting
            calculationResults={invoiceJobData.calcData!}
            onBack={() => handleViewJob(invoiceJobData)} // Go back to the job detail page
            companyInfo={companyInfo}
            isInvoiceMode={true}
            initialJobData={invoiceJobData}
            onFinalizeInvoice={handleFinalizeInvoice}
        />;
        case 'settings': return <Settings onSave={handleSaveSettings} currentInfo={companyInfo} />;
        case 'schedule': return <JobCalendar jobToSchedule={jobToSchedule} onJobScheduled={handleJobScheduled} />;
        default: return <Dashboard jobs={allJobs} onViewJob={handleViewJob}/>;
    }
  }

  const NavItem = ({ page, label, iconPath }: { page: Page, label: string, iconPath: string }) => (
    <button onClick={() => handleNavClick(page)} className="flex flex-col items-center justify-center gap-1 w-full h-full text-xs transition-colors">
        <svg className={`w-6 h-6 ${mainPage === page ? 'text-blue-600' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
        <span className={`${mainPage === page ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>{label}</span>
    </button>
  );

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
       <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">{pageTitles[mainPage]}</h1>
            {(mainPage === 'dashboard' || mainPage === 'settings') && (
                <button 
                    onClick={() => setMainPage('settings')} 
                    className="text-slate-500 hover:text-blue-600 p-1 rounded-full"
                    aria-label="Open Settings"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            )}
        </div>
      </header>
      
      <main className="flex-grow overflow-y-auto">
        {renderContent()}
      </main>
      
      <GeminiAgent {...agentProps} />
      
      <nav className="h-20 bg-white/90 backdrop-blur-sm border-t border-slate-200 z-20 flex items-center justify-around shrink-0">
        <div className="w-1/5 h-full"><NavItem page="dashboard" label="Dashboard" iconPath="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></div>
        <div className="w-1/fiv h-full"><NavItem page="jobsList" label="Jobs" iconPath="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></div>
        <div className="w-1/5 h-full flex items-center justify-center">
            <button onClick={() => handleNavClick('calculator')} className="w-16 h-16 bg-blue-600 rounded-full text-white shadow-lg -mt-8 flex items-center justify-center hover:bg-blue-700 transition-transform transform hover:scale-105" aria-label="New Estimate">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
        </div>
        <div className="w-1/5 h-full"><NavItem page="schedule" label="Schedule" iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></div>
        <div className="w-1/5 h-full"><NavItem page="materialOrder" label="Materials" iconPath="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></div>
      </nav>
    </div>
  );
}

export default App;