import React from 'react';
import { CustomerInfo } from './EstimatePDF';
import { EstimateRecord, JobStatus } from '../lib/db';
import { getGCSDownloadUrl } from '../lib/gcs';

interface JobDetailProps {
    job: EstimateRecord;
    customers: CustomerInfo[];
    onBack: () => void;
    onUpdateStatus: (jobId: number, status: 'sold' | 'invoiced' | 'paid') => void;
    onPrepareInvoice: (job: EstimateRecord) => void;
    onScheduleJob: (job: EstimateRecord) => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, customers, onBack, onUpdateStatus, onPrepareInvoice, onScheduleJob }) => {
    
    const customer = customers.find(c => c.id === job.customerId);

    const handleViewPdf = async (filePath: string) => {
        if (!filePath) {
            alert("File path is missing.");
            return;
        }
        try {
            const url = await getGCSDownloadUrl(filePath);
            window.open(url, '_blank');
        } catch (error) {
            console.error("Error getting GCS download URL", error);
            alert("Could not open PDF. Please check the console for details.");
        }
    };
    
    const getStatusDisplay = (status: JobStatus) => {
        switch (status) {
            case 'estimate':
              return <div className="text-blue-700 font-semibold">Status: Estimate</div>;
            case 'sold':
              return <div className="text-amber-700 font-semibold">Status: Sold</div>;
            case 'invoiced':
              return <div className="text-slate-700 font-semibold">Status: Invoiced</div>;
            case 'paid':
              return (
                  <div className="text-green-700 font-semibold flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Status: Paid in Full
                  </div>
              );
            default:
              return null;
        }
    };

    const card = "rounded-xl border border-slate-200 bg-white shadow-md";

    if (!customer || !job) {
        return (
            <div className="mx-auto max-w-3xl p-4">
                <h1 className="text-xl font-bold text-red-600">Job or Customer Not Found</h1>
                <button onClick={onBack} className="mt-4 text-sm font-medium text-blue-600 hover:underline">
                    &larr; Back to Jobs List
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl p-4">
            <button onClick={onBack} className="mb-4 text-sm font-medium text-blue-600 hover:underline">
                &larr; Back to Jobs List
            </button>
            
            <div className={`${card} p-4 mb-4`}>
                <div className="flex flex-col gap-2">
                    <div>
                        <h1 className="text-2xl font-bold">{customer.name}</h1>
                        <p className="text-sm text-slate-600">{job.estimateNumber}</p>
                        <p className="text-sm text-slate-600">{customer.address}</p>
                    </div>
                    <div className="text-left pt-2 border-t mt-2">
                        <p className="text-3xl font-bold text-slate-800">
                             {job.costsData?.finalQuote.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </p>
                        {getStatusDisplay(job.status)}
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                    {(job.status === 'estimate' || job.status === 'sold') && (
                         <button onClick={() => onScheduleJob(job)} className="w-full rounded-lg bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 flex items-center justify-center gap-2">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             Schedule Job
                         </button>
                    )}
                    {job.status === 'estimate' && (
                        <button onClick={() => job.id && onUpdateStatus(job.id, 'sold')} className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600">
                            Mark Job as Sold
                        </button>
                    )}
                     {job.status === 'sold' && (
                        <button onClick={() => onPrepareInvoice(job)} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                            Prepare Invoice
                        </button>
                    )}
                     {job.status === 'invoiced' && (
                        <button onClick={() => job.id && onUpdateStatus(job.id, 'paid')} className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700">
                            Mark as Paid
                        </button>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${card} p-4`}>
                    <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
                    <div className="mt-2 space-y-2">
                         {job.estimateNumber.startsWith('SUMM-') ? (
                            <button onClick={() => handleViewPdf(job.estimatePdfPath)} className="w-full text-left rounded-md bg-slate-100 p-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">View Quote Summary</button>
                        ) : (
                            <>
                                <button onClick={() => handleViewPdf(job.estimatePdfPath)} className="w-full text-left rounded-md bg-slate-100 p-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">View Estimate PDF</button>
                                <button onClick={() => handleViewPdf(job.materialOrderPdfPath)} className="w-full text-left rounded-md bg-slate-100 p-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">View Materials PDF</button>
                            </>
                        )}
                    </div>
                </div>
                <div className={`${card} p-4`}>
                    <h2 className="text-lg font-semibold tracking-tight">Contact Info & Notes</h2>
                    <div className="mt-2 space-y-1 text-sm">
                        <p><span className="font-semibold">Phone:</span> {customer.phone || 'N/A'}</p>
                        <p><span className="font-semibold">Email:</span> {customer.email || 'N/A'}</p>
                        {customer.notes && (
                            <div className="mt-2 pt-2 border-t">
                                <p className="font-semibold">Notes:</p>
                                <p className="text-slate-700 whitespace-pre-wrap">{customer.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobDetail;
