
import React, { useState, useEffect, useMemo } from 'react';
import { CustomerInfo } from './EstimatePDF.tsx';
import { EstimateRecord, JobStatus } from '../lib/db.ts';
import { getCustomers, getJobs } from '../lib/api.ts';
import GoogleDriveManager from './GoogleDriveManager.tsx';

interface CustomerDetailProps {
    customerId: number;
    onBack: () => void;
    onViewJob: (job: EstimateRecord) => void;
    onUpdateCustomer: (customer: CustomerInfo) => void;
}

const getStatusBadge = (status: JobStatus) => {
  switch (status) {
    case 'estimate':
      return <span className="text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2.5 py-1 rounded-full">Estimate</span>;
    case 'sold':
      return <span className="text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-2.5 py-1 rounded-full">Sold</span>;
    case 'invoiced':
      return <span className="text-xs font-semibold bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 px-2.5 py-1 rounded-full">Invoiced</span>;
    case 'paid':
      return <span className="text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 px-2.5 py-1 rounded-full">Paid</span>;
    default:
      return null;
  }
};

const fmtCurrency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

type ActiveTab = 'jobs' | 'documents' | 'notes' | 'files';

interface DocumentRecord {
    type: 'Estimate' | 'Material Order' | 'Invoice' | 'Quote Summary';
    jobId: number;
    jobEstimateNumber: string;
    date: string;
    blob: Blob;
}


const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, onBack, onViewJob, onUpdateCustomer }) => {
    const [customer, setCustomer] = useState<CustomerInfo | null>(null);
    const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('jobs');
    
    // State for notes editing
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const allCustomers = await getCustomers();
                const currentCustomer = allCustomers.find(c => c.id === customerId);
                if (currentCustomer) {
                    setCustomer(currentCustomer);
                    setEditedNotes(currentCustomer.notes || '');
                    const allJobs = await getJobs();
                    const customerEstimates = allJobs.filter(j => j.customerId === customerId);
                    setEstimates(customerEstimates.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                } else {
                    setCustomer(null);
                }
            } catch (error) {
                console.error("Failed to load customer details", error);
                setCustomer(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (customerId) {
            loadData();
        } else {
            setIsLoading(false);
        }
    }, [customerId]);

    const { metrics, documents } = useMemo(() => {
        const lifetimeValue = estimates
            .filter(e => e.status === 'paid')
            .reduce((sum, job) => sum + (job.costsData?.finalQuote || 0), 0);
        
        const outstandingBalance = estimates
            .filter(e => e.status === 'invoiced')
            .reduce((sum, job) => sum + (job.costsData?.finalQuote || 0), 0);

        const activeJobs = estimates.filter(e => e.status === 'sold').length;

        const allDocs: DocumentRecord[] = estimates.flatMap(job => {
            const jobDocs: DocumentRecord[] = [];
            
            // Check if it's a quote summary
            if (job.estimateNumber.startsWith('SUMM-')) {
                 jobDocs.push({
                    type: 'Quote Summary',
                    jobId: job.id!,
                    jobEstimateNumber: job.estimateNumber,
                    date: job.createdAt,
                    blob: job.estimatePdf,
                });
            } else if (job.status === 'invoiced' || job.status === 'paid') {
                jobDocs.push({
                    type: 'Invoice',
                    jobId: job.id!,
                    jobEstimateNumber: job.estimateNumber.replace('EST-', 'INV-'),
                    date: job.createdAt,
                    blob: job.invoicePdf || job.estimatePdf,
                });
            } else { // It's a standard estimate or sold job
                 jobDocs.push({
                    type: 'Estimate',
                    jobId: job.id!,
                    jobEstimateNumber: job.estimateNumber,
                    date: job.createdAt,
                    blob: job.estimatePdf,
                });
                 jobDocs.push({
                    type: 'Material Order',
                    jobId: job.id!,
                    jobEstimateNumber: job.estimateNumber,
                    date: job.createdAt,
                    blob: job.materialOrderPdf,
                });
            }
            return jobDocs;
        });

        allDocs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            metrics: {
                lifetimeValue,
                outstandingBalance,
                activeJobs,
                totalJobs: estimates.length
            },
            documents: allDocs
        };
    }, [estimates]);

    const handleViewPdf = (pdfBlob: Blob) => {
        try {
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
        } catch (error) {
            console.error("Error creating object URL", error);
            alert("Could not open PDF. It may be corrupted.");
        }
    };

    const handleSaveNotes = async () => {
        if (customer) {
            await onUpdateCustomer({ ...customer, notes: editedNotes });
            setIsEditingNotes(false);
            // Re-fetch customer to ensure UI is in sync
            const allCustomers = await getCustomers();
            const updatedCustomer = allCustomers.find(c => c.id === customerId);
            setCustomer(updatedCustomer || null);
        }
    };

    const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm";

    if (isLoading) {
        return <div className="p-6">Loading...</div>;
    }
    
    if (!customer) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold text-red-600">Customer Not Found</h1>
                <button onClick={onBack} className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">&larr; Back to List</button>
            </div>
        );
    }
    
    const MetricCard = ({ label, value, colorClass }: {label: string, value: string | number, colorClass: string}) => (
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
            <button onClick={onBack} className="mb-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                &larr; Back to Customer List
            </button>
            
            <div className={`${card} p-6`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h1 className="text-2xl font-bold dark:text-white">{customer.name}</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{customer.address}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{customer.phone}{customer.phone && customer.email && ' | '}{customer.email}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <MetricCard label="Lifetime Value" value={fmtCurrency(metrics.lifetimeValue)} colorClass="text-green-600 dark:text-green-400" />
                        <MetricCard label="Outstanding" value={fmtCurrency(metrics.outstandingBalance)} colorClass="text-amber-600 dark:text-amber-400" />
                        <MetricCard label="Active Jobs" value={metrics.activeJobs} colorClass="text-blue-600 dark:text-blue-400" />
                        <MetricCard label="Total Jobs" value={metrics.totalJobs} colorClass="text-slate-700 dark:text-slate-200" />
                    </div>
                </div>
            </div>

            <div>
                <div className="border-b border-slate-200 dark:border-slate-600">
                    <nav className="flex -mb-px space-x-6" aria-label="Tabs">
                        {(['jobs', 'documents', 'files', 'notes'] as ActiveTab[]).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab 
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>
                
                <div className={`${card} mt-4 p-4 min-h-[200px]`}>
                    {activeTab === 'jobs' && (
                        <div className="space-y-3">
                            {estimates.length === 0 ? <p className="text-sm text-center py-4 text-slate-500">No jobs found for this customer.</p> :
                            estimates.map(est => (
                                <div key={est.id} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{est.estimateNumber}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Created: {new Date(est.createdAt).toLocaleDateString()}</p>
                                        <p className="font-bold mt-1">{fmtCurrency(est.costsData.finalQuote)}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {getStatusBadge(est.status)}
                                        <button onClick={() => onViewJob(est)} className="rounded-lg bg-white dark:bg-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm border dark:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-500">View Details</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'documents' && (
                        <div className="space-y-2">
                             {documents.length === 0 ? <p className="text-sm text-center py-4 text-slate-500">No documents found.</p> :
                             documents.map((doc, index) => (
                                <div key={index} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{doc.type}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Job: {doc.jobEstimateNumber} | {new Date(doc.date).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => handleViewPdf(doc.blob)} className="rounded-md bg-slate-200 dark:bg-slate-600 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500">View PDF</button>
                                </div>
                             ))}
                        </div>
                    )}
                    {activeTab === 'files' && (
                        <GoogleDriveManager customerId={customerId} />
                    )}
                    {activeTab === 'notes' && (
                        <div>
                            {isEditingNotes ? (
                                <>
                                    <textarea
                                        value={editedNotes}
                                        onChange={(e) => setEditedNotes(e.target.value)}
                                        rows={8}
                                        className="w-full p-2 text-sm rounded-md border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <div className="mt-2 flex justify-end gap-2">
                                        <button onClick={() => { setIsEditingNotes(false); setEditedNotes(customer.notes || ''); }} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                                        <button onClick={handleSaveNotes} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700">Save Notes</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                        {customer.notes ? <p>{customer.notes}</p> : <p className="italic text-slate-500">No notes for this customer.</p>}
                                    </div>
                                    <button onClick={() => setIsEditingNotes(true)} className="mt-4 rounded-lg bg-slate-100 dark:bg-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-500">
                                        Edit Notes
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerDetail;