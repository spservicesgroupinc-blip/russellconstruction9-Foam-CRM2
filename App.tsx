
import React, { useState, useEffect, useCallback } from 'react';
import SprayFoamCalculator, { CalculationResults, CalculatorInputs, InventoryLineItem } from './components/SprayFoamCalculator.tsx';
import JobCosting from './components/JobCosting.tsx';
import Settings from './components/Settings.tsx';
import Customers from './components/Customers.tsx';
import CustomerDetail from './components/CustomerDetail.tsx';
import Dashboard from './components/Dashboard.tsx';
import JobsList from './components/JobsList.tsx';
import JobDetail from './components/JobDetail.tsx';
import MaterialOrder, { OnHandInventory } from './components/MaterialOrder.tsx';
import Invoicing from './components/Invoicing.tsx';
import JobCalendar from './components/JobCalendar.tsx';
import MapView from './components/MapView.tsx';
import GeminiAgent from './components/GeminiAgent.tsx';
import GanttPage from './components/GanttPage.tsx';
import TeamPage from './components/TeamPage.tsx';
import MorePage from './components/MorePage.tsx';
import TimeClockPage from './components/TimeClockPage.tsx';
import InventoryPage from './components/InventoryPage.tsx';
import QuickAddFAB from './components/QuickAddFAB.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import Header from './components/Header.tsx';
import EmployeeDashboard from './components/EmployeeDashboard.tsx';
import { CompanyInfo, CustomerInfo } from './components/EstimatePDF.tsx';
import { db, EstimateRecord, JobStatus, InventoryItem } from './lib/db.ts';
import { CostSettings, DEFAULT_COST_SETTINGS } from './lib/processing.ts';
import { Job, Employee, Task } from './components/types.ts';

export type Page = 'dashboard' | 'calculator' | 'costing' | 'customers' | 'customerDetail' | 'jobsList' | 'jobDetail' | 'materialOrder' | 'invoicing' | 'schedule' | 'gantt' | 'map' | 'settings' | 'team' | 'more' | 'timeclock' | 'inventory' | 'employeeDashboard';

export type Theme = 'light' | 'dark' | 'system';

export type CurrentUser = { role: 'admin' } | { role: 'employee'; data: Employee } | null;

export interface AppSettings {
  theme: Theme;
  defaultYields: {
    openCellYield: number;
    closedCellYield: number;
  };
  defaultCosts: CostSettings;
}

const DEFAULT_CALCULATOR_INPUTS: CalculatorInputs = {
  length: 100, width: 50, wallHeight: 16, pitchInput: "6/12", includeGableTriangles: true,
  wallFoamType: 'open-cell', wallThicknessIn: 5.5, wallWastePct: 10,
  roofFoamType: 'open-cell', roofThicknessIn: 7.5, roofWastePct: 15,
  openCellYield: 16000, closedCellYield: 4000,
  additionalSections: [],
  inventoryLineItems: [],
};

const EMPTY_CUSTOMER_FORM: Omit<CustomerInfo, 'id'> = { name: '', address: '', email: '', phone: '', notes: '' };

const CALENDAR_STORAGE_KEY = 'jobCalendarJobs';

// Type guard for validating data from localStorage
function isJobArray(obj: any): obj is Job[] {
  return (
    Array.isArray(obj) &&
    obj.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.start === 'string' &&
        typeof item.end === 'string' &&
        typeof item.color === 'string'
    )
  );
}


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme: 'system',
    defaultYields: { openCellYield: 16000, closedCellYield: 4000 },
    defaultCosts: DEFAULT_COST_SETTINGS,
  });
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [customers, setCustomers] = useState<CustomerInfo[]>([]);
  const [jobs, setJobs] = useState<EstimateRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [calculatorInputs, setCalculatorInputs] = useState<CalculatorInputs>(DEFAULT_CALCULATOR_INPUTS);
  const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
  const [currentJob, setCurrentJob] = useState<EstimateRecord | null>(null);
  const [jobToSchedule, setJobToSchedule] = useState<EstimateRecord | null>(null);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER_FORM);

  // Material Order State
  const [soldJobData, setSoldJobData] = useState<EstimateRecord | null>(null);
  const [onHandInventory, setOnHandInventory] = useState<OnHandInventory>({ ocSets: 0, ccSets: 0 });

  // Calendar State - Centralized Source of Truth
  const [calendarJobs, setCalendarJobs] = useState<Job[]>([]);

  // Load calendar jobs from localStorage on initial mount
  useEffect(() => {
    try {
      const savedJobs = localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (savedJobs) {
        const parsedJobs = JSON.parse(savedJobs);
        if (isJobArray(parsedJobs)) {
          setCalendarJobs(parsedJobs);
        }
      }
    } catch (error) {
      console.error('Failed to load jobs from localStorage', error);
    }
  }, []);

  // Save calendar jobs to localStorage whenever they change
  useEffect(() => {
    try {
        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(calendarJobs));
    } catch (error) {
      console.error('Failed to save jobs to localStorage', error);
    }
  }, [calendarJobs]);


  const loadData = useCallback(async () => {
    const savedInfo = localStorage.getItem('companyInfo');
    const savedSettings = localStorage.getItem('appSettings');

    if (savedInfo && savedSettings) {
      const parsedInfo = JSON.parse(savedInfo);
      const parsedSettings = JSON.parse(savedSettings);
      setCompanyInfo(parsedInfo);
      setAppSettings(parsedSettings);
      // Apply defaults to calculator
      setCalculatorInputs(prev => ({
        ...prev,
        openCellYield: parsedSettings.defaultYields.openCellYield,
        closedCellYield: parsedSettings.defaultYields.closedCellYield,
      }));
    } else {
      setIsInitialSetup(true);
    }
    
    const allCustomers = await db.customers.toArray();
    setCustomers(allCustomers);
    const allJobs = await db.estimates.orderBy('createdAt').reverse().toArray();
    setJobs(allJobs);
    const allEmployees = await db.employees.toArray();
    setEmployees(allEmployees);
    const allItems = await db.inventory.toArray();
    setInventoryItems(allItems);
    const allTasks = await db.tasks.orderBy('createdAt').reverse().toArray();
    setTasks(allTasks);
  }, []);


  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (appSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (appSettings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [appSettings.theme]);
  
  const handleSaveSettings = (info: CompanyInfo, settings: AppSettings) => {
    localStorage.setItem('companyInfo', JSON.stringify(info));
    localStorage.setItem('appSettings', JSON.stringify(settings));
    setCompanyInfo(info);
    setAppSettings(settings);
    if (isInitialSetup) {
      setIsInitialSetup(false);
      // Don't auto-navigate, let the user click the login button
    }
  };

  const handleAddCustomer = async (customer: Omit<CustomerInfo, 'id'>) => {
    const newId = await db.customers.add(customer as CustomerInfo);
    const newCustomer = { ...customer, id: newId };
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  };

  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCustomer.name && newCustomer.address) {
      const addedCustomer = await handleAddCustomer(newCustomer);
      setIsAddCustomerModalOpen(false);
      setNewCustomer(EMPTY_CUSTOMER_FORM);
      setSelectedCustomerId(addedCustomer.id);
      setPage('calculator');
    }
  };

  const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCustomer(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAddEmployee = async (employee: Omit<Employee, 'id'>) => {
    const newId = await db.employees.add(employee as Employee);
    const newEmployee = { ...employee, id: newId! };
    setEmployees(prev => [...prev, newEmployee]);
    return newEmployee;
  };

  const handleUpdateCustomer = async (customer: CustomerInfo) => {
      await db.customers.put(customer);
      setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
  }

  const handleProceedToCosting = (results: CalculationResults) => {
    setCalculationResults(results);
    setCurrentJob(null); // Ensure we are in estimate mode, not invoice mode
    setPage('costing');
  };

  const handleEstimateCreated = (newJob: EstimateRecord) => {
      setJobs(prev => [newJob, ...prev]);
      setCurrentJob(newJob);
      setPage('jobDetail');
  }

  const handleViewJob = (job: EstimateRecord) => {
      setCurrentJob(job);
      setPage('jobDetail');
  }
  
  const handleViewCustomer = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setPage('customerDetail');
  };
  
  const handleDeleteJob = async (jobId: number) => {
      if (window.confirm("Are you sure you want to permanently delete this job record?")) {
        await db.estimates.delete(jobId);
        setJobs(prev => prev.filter(j => j.id !== jobId));
      }
  }

  const handleUpdateJob = async (jobId: number, updates: Partial<Omit<EstimateRecord, 'id'>>) => {
      await db.estimates.update(jobId, updates);
      const originalJob = jobs.find(j => j.id === jobId);
      if (!originalJob) return;

      const updatedJob = { ...originalJob, ...updates };

      setJobs(prev => prev.map(j => j.id === jobId ? updatedJob : j));

      if (currentJob?.id === jobId) {
          setCurrentJob(updatedJob);
      }
  };

  const handleJobSold = (estimate: EstimateRecord) => {
      setSoldJobData(estimate);
      setPage('materialOrder');
  }
  
  const handleFinalizeInvoice = async (finalJobData: EstimateRecord, invoicePdfBlob: Blob) => {
      await handleUpdateJob(finalJobData.id!, { 
        status: 'invoiced', 
        costsData: finalJobData.costsData,
        invoicePdf: invoicePdfBlob 
      });
      setPage('jobDetail');
  };

  const handleScheduleJob = (job: EstimateRecord) => {
      setJobToSchedule(job);
      setPage('schedule');
  }

  const handleAddInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    const newId = await db.inventory.add(item as InventoryItem);
    const newItem = { ...item, id: newId };
    setInventoryItems(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
  };

  const handleUpdateInventoryItem = async (item: InventoryItem) => {
    await db.inventory.put(item);
    setInventoryItems(prev => prev.map(i => i.id === item.id ? item : i));
  };

  const handleDeleteInventoryItem = async (itemId: number) => {
    await db.inventory.delete(itemId);
    setInventoryItems(prev => prev.filter(i => i.id !== itemId));
  };

  const resetCurrentJob = () => {
    setCurrentJob(null);
    setCalculationResults(null);
  };
  
  const addCalendarJob = (job: Omit<Job, 'id'>): Job => {
    const newJob: Job = { ...job, id: Date.now().toString() };
    setCalendarJobs(prev => [...prev, newJob]);
    return newJob;
  };
  
  const updateCalendarJob = (job: Job) => {
    setCalendarJobs(prev => prev.map(j => j.id === job.id ? job : j));
  };

  const deleteCalendarJob = (jobId: string) => {
    setCalendarJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleFabNewEstimate = () => {
    setSelectedCustomerId('');
    resetCurrentJob();
    setPage('calculator');
  };
  
  const handleFabNewCustomer = () => {
    setNewCustomer(EMPTY_CUSTOMER_FORM);
    setIsAddCustomerModalOpen(true);
  };

  const handleLogin = (user: CurrentUser) => {
    setCurrentUser(user);
    if (user?.role === 'employee') {
      setPage('employeeDashboard');
    } else {
      setPage('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPage('dashboard'); // Reset to default
  };

  // Task Handlers
    const handleAddTask = async (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'>) => {
        const newTask: Omit<Task, 'id'> = {
            ...task,
            completed: false,
            createdAt: new Date().toISOString(),
        };
        const newId = await db.tasks.add(newTask as Task);
        const addedTask = { ...newTask, id: newId };
        setTasks(prev => [addedTask, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    };

    const handleUpdateTask = async (task: Task) => {
        await db.tasks.put(task);
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    };

    const handleDeleteTask = async (taskId: number) => {
        await db.tasks.delete(taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
    };

    const handleToggleTaskCompletion = async (taskId: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            const updatedTask = {
                ...task,
                completed: !task.completed,
                completedAt: !task.completed ? new Date().toISOString() : undefined
            };
            await handleUpdateTask(updatedTask);
        }
    };

  const getActiveTab = (currentPage: Page): Page => {
    if (currentUser?.role === 'employee') {
      if (['employeeDashboard'].includes(currentPage)) return 'employeeDashboard';
      if (['schedule'].includes(currentPage)) return 'schedule';
      if (['timeclock'].includes(currentPage)) return 'timeclock';
      return 'employeeDashboard'; // fallback for employee
    }

    // Admin Tabs
    if (['dashboard'].includes(currentPage)) return 'dashboard';
    if (['customers', 'customerDetail'].includes(currentPage)) return 'customers';
    if (['calculator', 'costing'].includes(currentPage)) return 'calculator';
    if (['schedule'].includes(currentPage)) return 'schedule';
    if (['more', 'jobsList', 'jobDetail', 'invoicing', 'team', 'settings', 'materialOrder', 'gantt', 'inventory', 'timeclock'].includes(currentPage)) return 'more';
    return 'dashboard'; // fallback
  }
  const activeTab = getActiveTab(page);

  const NavButton: React.FC<{
    target: Page;
    label: string;
    icon: JSX.Element;
  }> = ({ target, label, icon }) => (
    <button
      onClick={() => setPage(target)}
      className={`w-full flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs font-semibold ${
        activeTab === target
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const renderPage = () => {
    if (currentUser?.role === 'employee') {
      switch (page) {
        case 'employeeDashboard': return <EmployeeDashboard user={currentUser.data} jobs={calendarJobs} employees={employees} onNavigate={setPage} tasks={tasks} onToggleTaskCompletion={handleToggleTaskCompletion} />;
        case 'schedule': return <JobCalendar jobToSchedule={null} onJobScheduled={() => {}} jobs={calendarJobs} setJobs={setCalendarJobs} employees={employees} currentUser={currentUser} />;
        case 'timeclock': return <TimeClockPage employees={employees} jobs={jobs} currentUser={currentUser.data} />;
        default:
          setPage('employeeDashboard'); // Redirect to a valid employee page
          return null;
      }
    }

    // Admin Pages
    switch (page) {
      case 'dashboard': return <Dashboard jobs={jobs} onViewJob={handleViewJob} onNavigateToFilteredJobs={(s) => { setFilter(s); setPage('jobsList'); }} onNavigate={setPage} tasks={tasks} employees={employees} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onToggleTaskCompletion={handleToggleTaskCompletion} />;
      case 'calculator': return <SprayFoamCalculator onProceedToCosting={handleProceedToCosting} customers={customers} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} calculatorInputs={calculatorInputs} setCalculatorInputs={setCalculatorInputs} defaultYields={appSettings.defaultYields} inventoryItems={inventoryItems} setIsAddCustomerModalOpen={setIsAddCustomerModalOpen} />;
      case 'costing': 
        if (currentJob) { // Invoice mode from an existing job
            return <JobCosting 
                        calculationResults={currentJob.calcData} 
                        onBack={() => setPage('jobDetail')}
                        companyInfo={companyInfo!}
                        isInvoiceMode={true}
                        initialJobData={currentJob}
                        onFinalizeInvoice={handleFinalizeInvoice}
                        defaultCosts={appSettings.defaultCosts} 
                        inventoryItems={inventoryItems}
                    />;
        } else if (calculationResults) { // Estimate mode from the calculator
            return <JobCosting 
                        calculationResults={calculationResults} 
                        onBack={() => { setCalculationResults(null); setPage('calculator'); }} 
                        companyInfo={companyInfo!} 
                        onEstimateCreated={handleEstimateCreated} 
                        defaultCosts={appSettings.defaultCosts}
                        inventoryItems={inventoryItems}
                    />;
        }
        setPage('dashboard'); // Fallback if state is inconsistent
        return null;
      case 'customers': return <Customers customers={customers} onAddCustomer={handleAddCustomer} onViewCustomer={handleViewCustomer} onUpdateCustomer={handleUpdateCustomer} />;
      case 'customerDetail': return <CustomerDetail customerId={selectedCustomerId as number} onBack={() => setPage('customers')} onViewJob={handleViewJob} onUpdateCustomer={handleUpdateCustomer}/>;
      case 'jobsList': return <JobsList jobs={jobs} customers={customers} onViewJob={handleViewJob} onDeleteJob={handleDeleteJob} filter={filter} setFilter={setFilter} />;
      case 'jobDetail': return currentJob && <JobDetail job={currentJob} customers={customers} employees={employees} onBack={() => { resetCurrentJob(); setPage('jobsList'); }} onUpdateJob={handleUpdateJob} onPrepareInvoice={(job) => { setCurrentJob(job); setPage('costing'); }} onScheduleJob={handleScheduleJob} onViewCustomer={handleViewCustomer} />;
      case 'materialOrder': return <MaterialOrder soldJobData={soldJobData} onHandInventory={onHandInventory} setOnHandInventory={setOnHandInventory} />;
      case 'invoicing': return <Invoicing soldJobs={jobs.filter(j => j.status === 'sold' || j.status === 'invoiced')} customers={customers} companyInfo={companyInfo!} onPrepareInvoice={(job) => { setCurrentJob(job); setPage('costing'); /* re-use for invoice editing */ }} />;
      case 'schedule': return <JobCalendar jobToSchedule={jobToSchedule} onJobScheduled={() => setJobToSchedule(null)} jobs={calendarJobs} setJobs={setCalendarJobs} employees={employees} currentUser={currentUser} />;
      // FIX: Pass employees prop to GanttPage
      case 'gantt': return <GanttPage jobs={calendarJobs} setJobs={setCalendarJobs} employees={employees} />;
      case 'map': return <MapView customers={customers} onUpdateCustomer={handleUpdateCustomer} />;
      case 'team': return <TeamPage employees={employees} onAddEmployee={handleAddEmployee} jobs={jobs.filter(j => j.status === 'sold')} />;
      case 'timeclock': return <TimeClockPage employees={employees} jobs={jobs} />;
      case 'inventory': return <InventoryPage items={inventoryItems} onAddItem={handleAddInventoryItem} onUpdateItem={handleUpdateInventoryItem} onDeleteItem={handleDeleteInventoryItem} />;
      case 'settings': return <Settings onSave={handleSaveSettings} currentInfo={companyInfo} appSettings={appSettings} />;
      case 'more': return <MorePage onNavigate={setPage} onLogout={handleLogout} />;
      default: return <div>Page not found</div>;
    }
  };

  if (isInitialSetup) {
    return <Settings onSave={handleSaveSettings} currentInfo={companyInfo} appSettings={appSettings} isInitialSetup />;
  }
  
  if (!currentUser) {
    return <LoginScreen employees={employees} onLogin={handleLogin} />;
  }

  return (
    <div className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 min-h-screen font-sans">
      <Header 
        user={{ name: currentUser.role === 'admin' ? 'Admin' : currentUser.data.name }}
        onLogout={handleLogout}
      />
      <div className="pb-24 pt-16">
        {renderPage()}
      </div>
      
      {currentUser.role === 'admin' && (
        <>
            <QuickAddFAB 
                onNewEstimate={handleFabNewEstimate}
                onNewCustomer={handleFabNewCustomer}
            />

            <GeminiAgent 
                setMainPage={setPage}
                customers={customers}
                handleAddCustomer={handleAddCustomer}
                handleUpdateCustomer={handleUpdateCustomer}
                setSelectedCustomerId={setSelectedCustomerId}
                calculatorInputs={calculatorInputs}
                setCalculatorInputs={setCalculatorInputs}
                onHandInventory={onHandInventory}
                setOnHandInventory={setOnHandInventory}
                handleJobSold={handleJobSold}
                companyInfo={companyInfo!}
                calendarJobs={calendarJobs}
                onAddCalendarJob={addCalendarJob}
                onUpdateCalendarJob={updateCalendarJob}
                onDeleteCalendarJob={deleteCalendarJob}
                appSettings={appSettings}
                jobs={jobs}
                handleUpdateJob={handleUpdateJob}
            />
        </>
      )}
      
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 p-2 z-[9998]">
        {currentUser.role === 'admin' ? (
            <div className="grid grid-cols-5 max-w-2xl mx-auto gap-1">
                <NavButton target="dashboard" label="Home" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
                <NavButton target="customers" label="Clients" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                <NavButton target="calculator" label="Estimate" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>} />
                <NavButton target="schedule" label="Schedule" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                <NavButton target="more" label="More" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>} />
            </div>
        ) : (
            <div className="grid grid-cols-3 max-w-sm mx-auto gap-1">
                 <NavButton target="employeeDashboard" label="Dashboard" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
                 <NavButton target="schedule" label="Schedule" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                 <NavButton target="timeclock" label="Time Clock" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            </div>
        )}
      </div>

      {isAddCustomerModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog">
              <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                  <button onClick={() => setIsAddCustomerModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close modal">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                  </button>
                  <form onSubmit={handleSaveNewCustomer}>
                      <h2 className="text-xl font-bold dark:text-white">Add New Customer</h2>
                      <div className="mt-4 space-y-3">
                          <label className="block">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Full Name</span>
                              <input type="text" name="name" value={newCustomer.name} onChange={handleNewCustomerChange} className="mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" required />
                          </label>
                          <label className="block">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Address</span>
                              <input type="text" name="address" value={newCustomer.address} onChange={handleNewCustomerChange} className="mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" required />
                          </label>
                          <label className="block">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Phone</span>
                              <input type="tel" name="phone" value={newCustomer.phone} onChange={handleNewCustomerChange} className="mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                          </label>
                          <label className="block">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
                              <input type="email" name="email" value={newCustomer.email} onChange={handleNewCustomerChange} className="mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                          </label>
                          <label className="block">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Notes</span>
                              <textarea name="notes" rows={3} value={newCustomer.notes || ''} onChange={handleNewCustomerChange} className="mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"></textarea>
                          </label>
                      </div>
                      <div className="mt-6 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsAddCustomerModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700">Save Customer</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
