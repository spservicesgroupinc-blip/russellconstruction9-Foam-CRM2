import React, { useState, useEffect, useMemo } from 'react';
import { EstimateRecord } from '../lib/db';
import Logo from './Logo';

interface DashboardProps {
    jobs: EstimateRecord[];
    onViewJob: (job: EstimateRecord) => void;
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

const Dashboard: React.FC<DashboardProps> = ({ jobs, onViewJob }) => {
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

    const card = "rounded-xl border border-slate-200 bg-white shadow-md p-4";
    const metricValue = "text-3xl font-bold tracking-tight";
    const metricLabel = "text-sm font-medium text-slate-600";

    const MetricCard = ({ label, value, subtext, colorClass }: { label: string, value: string, subtext?: string, colorClass: string }) => (
        <div className={`${card} text-center`}>
            <h2 className={metricLabel}>{label}</h2>
            <p className={`${metricValue} ${colorClass} mt-1`}>{value}</p>
            {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
    );

    return (
        <div className="mx-auto max-w-3xl p-4 font-sans">
            <Logo />
            <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Total Revenue (Paid)" value={fmtCurrency(metrics.totalRevenuePaid, { minimumFractionDigits: 0 })} colorClass="text-green-600" />
                <MetricCard label="A/R (Invoiced)" value={fmtCurrency(metrics.accountsReceivable)} colorClass="text-amber-600" />
                <MetricCard label="Pipeline (Sold)" value={fmtCurrency(metrics.pipelineValueSold)} colorClass="text-blue-600" />
                
                <div className={`${card}`}>
                    <h2 className={`${metricLabel} text-center mb-2`}>Materials to Order</h2>
                    <div className="flex justify-around text-center">
                        <div>
                            <p className={`${metricValue} text-slate-700`}>{metrics.neededOcSets.toFixed(1)}</p>
                            <p className="text-xs text-slate-500">OC Sets</p>
                        </div>
                         <div>
                            <p className={`${metricValue} text-slate-700`}>{metrics.neededCcSets.toFixed(1)}</p>
                            <p className="text-xs text-slate-500">CC Sets</p>
                        </div>
                    </div>
                </div>
            </div>

             <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-800 px-1 mb-2">Recent Jobs</h2>
                <div className={`${card} p-2`}>
                    {recentJobs.length > 0 ? (
                        <div className="space-y-1">
                            {recentJobs.map(job => (
                                <button key={job.id} onClick={() => onViewJob(job)} className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-slate-700">{job.calcData?.customer?.name || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500">{job.estimateNumber}</p>
                                    </div>
                                    <p className="font-bold text-sm text-slate-800">{fmtCurrency(job.costsData?.finalQuote || 0)}</p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-slate-500 py-4">No jobs created yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
