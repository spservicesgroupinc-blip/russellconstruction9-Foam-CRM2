import React, { useMemo } from 'react';
import { Employee, Job } from './types.ts';
import { toDate, startOfDay, addDays } from './utils.ts';
import { Page } from '../App.tsx';

interface EmployeeDashboardProps {
    user: Employee;
    jobs: Job[];
    employees: Employee[];
    onNavigate: (page: Page) => void;
}

const getInitials = (name: string = '') => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ user, jobs, employees, onNavigate }) => {
    const { nextJob, upcomingJobs } = useMemo(() => {
        const today = startOfDay(new Date());
        const oneWeekFromNow = addDays(today, 7);

        const myJobs = jobs
            .filter(job => (job.assignedTeam || []).includes(user.id!))
            .sort((a, b) => toDate(a.start).getTime() - toDate(b.start).getTime());
        
        const futureJobs = myJobs.filter(job => toDate(job.end) >= today);
        
        const nextJob = futureJobs[0] || null;

        const upcomingJobs = futureJobs.filter(job => {
            const jobStart = toDate(job.start);
            return jobStart > today && jobStart < oneWeekFromNow;
        });

        return { nextJob, upcomingJobs };
    }, [user, jobs]);

    const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm p-6";

    return (
        <div className="mx-auto max-w-3xl p-4 space-y-6">
            <div>
                <h1 className="text-2xl font-bold dark:text-white">Your Dashboard</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Welcome, {user.name}. Here's what's on your schedule.</p>
            </div>

            <div className={`${card} bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700`}>
                <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                    {startOfDay(nextJob?.start || '') === startOfDay(new Date()) ? "Today's Assignment" : "Your Next Assignment"}
                </h2>
                {nextJob ? (
                    <div className="mt-3">
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{nextJob.name}</p>
                        <p className="font-semibold text-slate-600 dark:text-slate-300">
                            {new Date(nextJob.start.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-600">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Your Team</h3>
                            <div className="flex items-center gap-2">
                                {(nextJob.assignedTeam || []).map(id => {
                                    const teamMember = employees.find(e => e.id === id);
                                    if (!teamMember) return null;
                                    return (
                                        <div key={id} className="flex flex-col items-center" title={teamMember.name}>
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                                                {getInitials(teamMember.name)}
                                            </div>
                                            <span className="text-xs mt-1 text-slate-600 dark:text-slate-400">{teamMember.name.split(' ')[0]}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="mt-3 text-slate-600 dark:text-slate-300">You have no upcoming jobs assigned.</p>
                )}
            </div>

            <div className={card}>
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold dark:text-white">Upcoming Week</h2>
                    <button onClick={() => onNavigate('schedule')} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        View Full Calendar
                    </button>
                </div>
                <div className="mt-3 space-y-3">
                    {upcomingJobs.length > 0 ? (
                        upcomingJobs.map(job => (
                             <div key={job.id} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600">
                                <p className="font-semibold">{job.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {new Date(job.start.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                             </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No other jobs scheduled this week.</p>
                    )}
                </div>
            </div>
        </div>
    )
};

export default EmployeeDashboard;