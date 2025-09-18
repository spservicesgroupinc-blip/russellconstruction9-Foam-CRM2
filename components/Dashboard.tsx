import React, { useState, useEffect, useMemo } from 'react';
import { EstimateRecord, JobStatus } from '../lib/db.ts';
import Logo from './Logo.tsx';

interface DashboardProps {
    jobs: EstimateRecord[];
    onViewJob: (job: EstimateRecord) => void;
    onNavigateToFilteredJobs: (status: JobStatus) => void;
    onNavigate: (page: 'materialOrder') => void;
}

interface OnHandInventory {
    ocSets: number;
    ccSets: number;
}

const ON_HAND_STORAGE_KEY = 'materialInventoryOnHand';

function fmtCurrency(n: number, options: Intl.NumberFormatOptions = {}) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return "$0.00";
    return n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        ...options
    });
}

const Dashboard: React.FC<DashboardProps> = ({ jobs, onViewJob, onNavigateToFilteredJobs, onNavigate }) => {
    const [onHand, setOnHand] = useState<OnHandInventory>({ ocSets: 0, ccSets: 0 });

    useEffect(() => {
        const loadData = () => {
            try {
                const savedOnHand = localStorage.getItem(ON_HAND_STORAGE_KEY);
                if (savedOnHand) {
                    const parsed = JSON.parse(savedOnHand);
                    setOnHand({
                        ocSets: parsed.ocSets || 0,
                        ccSets: parsed.ccSets || 0,
                    });
                } else {
                    setOnHand({ ocSets: 0, ccSets: 0 });
                }
            } catch (error) {
                console.error("Failed to load dashboard data from localStorage", error);
            }
        };

        loadData();
        window.addEventListener('storage', loadData);
        return () => window.removeEventListener('storage', loadData);
    }, []);

    const { metrics, recentJobs } = useMemo(() => {
        const accountsReceivable = jobs
            .filter(j => j.status === 'invoiced')
            .reduce((sum, j) => sum + (j.costsData?.finalQuote || 0), 0);

        const totalRevenuePaid = jobs
            .filter(j => j.status === 'paid')
            .reduce((sum, j) => sum + (j.costsData?.finalQuote || 0), 0);
        
        const pipelineValueSold = jobs
             .filter(j => j.status === 'sold')
             .reduce((sum, j) => sum + (j.costsData?.finalQuote || 0), 0);
        
        const committedJobs = jobs.filter(j => j.status === 'sold' || j.status === 'invoiced' || j.status === 'paid');
        const totalCommittedOcSets = committedJobs.reduce((sum, j) => sum + (j.calcData?.ocSets || 0), 0);
        const totalCommittedCcSets = committedJobs.reduce((sum, j) => sum + (j.calcData?.ccSets || 0), 0);

        const neededOcSets = Math.max(0, totalCommittedOcSets - onHand.ocSets);
        const neededCcSets = Math.max(0, totalCommittedCcSets - onHand.ccSets);
        
        const recentJobs = [...jobs].slice(0, 5);

        return {
            metrics: {
                accountsReceivable,
                totalRevenuePaid,
                pipelineValueSold,
                neededOcSets,
                neededCcSets,
            },
            recentJobs
        };
    }, [jobs, onHand]);

    const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm p-4";
    const metricValue = "font-bold tracking-tight";
    const metricLabel = "text-sm font-medium text-slate-600 dark:text-slate-300";

    const MetricCard = ({ label, value, icon, colorClass, onClick }: { label: string, value: string, icon: JSX.Element, colorClass: string, onClick?: () => void }) => (
        <button onClick={onClick} disabled={!onClick} className={`${card} w-full transition-all duration-200 text-left ${onClick ? 'hover:scale-105 hover:shadow-lg hover:bg-slate-50 dark:hover:bg-slate-600/50' : 'cursor-default'}`}>
            <div className={`p-2 rounded-full inline-block ${colorClass.replace('text-', 'bg-').replace('600', '100')} dark:bg-opacity-20`}>
                {icon}
            </div>
            <p className={`${metricValue} ${colorClass} mt-2 text-2xl sm:text-3xl`}>{value}</p>
            <h2 className={metricLabel}>{label}</h2>
        </button>
    );

    return (
        <div className="mx-auto max-w-3xl p-4 font-sans">
            <Logo />
            <div className="grid grid-cols-2 gap-4">
                <MetricCard 
                    label="Total Revenue (Paid)" 
                    value={fmtCurrency(metrics.totalRevenuePaid, { minimumFractionDigits: 0 })} 
                    colorClass="text-green-600" 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>}
                    onClick={() => onNavigateToFilteredJobs('paid')} 
                />
                <MetricCard 
                    label="A/R (Invoiced)" 
                    value={fmtCurrency(metrics.accountsReceivable)} 
                    colorClass="text-amber-600" 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                    onClick={() => onNavigateToFilteredJobs('invoiced')} 
                />
                <MetricCard 
                    label="Pipeline (Sold)" 
                    value={fmtCurrency(metrics.pipelineValueSold)} 
                    colorClass="text-blue-600" 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    onClick={() => onNavigateToFilteredJobs('sold')} 
                />
                
                <button onClick={() => onNavigate('materialOrder')} className={`${card} w-full text-left transition-all duration-200 group hover:scale-105 hover:shadow-lg hover:bg-slate-50 dark:hover:bg-slate-600/50`}>
                    <div className="p-2 rounded-full inline-block bg-slate-100 dark:bg-slate-600 group-hover:bg-white">
                         <svg className="w-6 h-6 text-slate-600 dark:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    </div>
                    <div className="mt-2 flex justify-around text-center">
                        <div>
                            <p className={`${metricValue} text-slate-700 dark:text-slate-100 text-2xl sm:text-3xl`}>{metrics.neededOcSets.toFixed(1)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">OC Sets</p>
                        </div>
                         <div>
                            <p className={`${metricValue} text-slate-700 dark:text-slate-100 text-2xl sm:text-3xl`}>{metrics.neededCcSets.toFixed(1)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">CC Sets</p>
                        </div>
                    </div>
                     <h2 className={`${metricLabel} text-center mt-2`}>Materials to Order</h2>
                </button>
            </div>

             <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 px-1 mb-2">Recent Jobs</h2>
                <div className={`${card} p-2`}>
                    {recentJobs.length > 0 ? (
                        <div className="space-y-1">
                            {recentJobs.map(job => (
                                <button key={job.id} onClick={() => onViewJob(job)} className="w-full text-left p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">{job.calcData?.customer?.name || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{job.estimateNumber}</p>
                                    </div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-50">{fmtCurrency(job.costsData?.finalQuote || 0)}</p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">No jobs created yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;