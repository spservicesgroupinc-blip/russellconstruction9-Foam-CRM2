import React from 'react';
import { EstimateRecord, JobStatus } from '../lib/db';
import { CustomerInfo } from './EstimatePDF';

interface JobsListProps {
  jobs: EstimateRecord[];
  customers: CustomerInfo[];
  onViewJob: (job: EstimateRecord) => void;
  onDeleteJob: (jobId: number) => void;
}

const getStatusBadge = (status: JobStatus) => {
  switch (status) {
    case 'estimate':
      return <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Estimate</span>;
    case 'sold':
      return <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Sold</span>;
    case 'invoiced':
      return <span className="text-xs font-semibold bg-slate-200 text-slate-800 px-2 py-1 rounded-full">Invoiced</span>;
    case 'paid':
      return <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">Paid</span>;
    default:
      return null;
  }
};

const JobsList: React.FC<JobsListProps> = ({ jobs, customers, onViewJob, onDeleteJob }) => {
  const findCustomer = (customerId: number) => customers.find(c => c.id === customerId);

  const card = "rounded-xl border border-slate-200 bg-white shadow-md";

  const handleDeleteClick = (e: React.MouseEvent, jobId: number) => {
    e.stopPropagation(); // Prevent navigation to job detail page
    onDeleteJob(jobId);
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className={`${card}`}>
        <div className="space-y-2 p-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No estimates or jobs have been created yet.</p>
          ) : (
            jobs.map(job => {
              const customer = findCustomer(job.customerId);
              return (
                <div key={job.id} className="group relative rounded-lg hover:bg-slate-50 transition-colors">
                    <button onClick={() => onViewJob(job)} className="w-full text-left p-3">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-grow">
                          <h3 className="font-semibold text-slate-800 group-hover:text-blue-600">{customer?.name || 'Unknown Customer'}</h3>
                          <p className="text-sm text-slate-500">{job.estimateNumber} &bull; {new Date(job.createdAt).toLocaleDateString()}</p>
                           <p className="text-base font-bold text-slate-800 sm:hidden mt-1">
                             {job.costsData?.finalQuote.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0.00'}
                           </p>
                        </div>
                        <div className="flex-shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
                           <span className="text-lg font-bold text-slate-800 hidden sm:block">
                             {job.costsData?.finalQuote.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0.00'}
                           </span>
                           {getStatusBadge(job.status)}
                        </div>
                      </div>
                    </button>
                    <button 
                        onClick={(e) => handleDeleteClick(e, job.id!)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 p-2 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 focus:opacity-100 transition-all"
                        aria-label={`Delete job ${job.estimateNumber}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default JobsList;