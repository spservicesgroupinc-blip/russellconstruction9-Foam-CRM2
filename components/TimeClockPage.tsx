import React, { useState, useEffect } from 'react';
import { Employee, TimeEntry } from './types.ts';
import { EstimateRecord, getActiveTimeEntry, saveTimeEntry } from '../lib/db.ts';

interface TimeClockPageProps {
    employees: Employee[];
    jobs: EstimateRecord[];
}

const TimeClockPage: React.FC<TimeClockPageProps> = ({ employees, jobs }) => {
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [pin, setPin] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const [activeModal, setActiveModal] = useState<'pin' | 'clockin' | 'switch' | null>(null);
    const [activeEntries, setActiveEntries] = useState<Record<number, TimeEntry>>({});
    const [jobToClockIn, setJobToClockIn] = useState<number | ''>('');

    // Filter jobs to only include those available for time tracking.
    // A job is available if it's 'sold' but not yet 'invoiced' or 'paid'.
    const availableJobs = jobs.filter(j => j.status === 'sold');

    // Fetch active time entries for all employees on mount
    useEffect(() => {
        const fetchAllActiveEntries = async () => {
            const entries: Record<number, TimeEntry> = {};
            for (const emp of employees) {
                if (emp.id) {
                    const activeEntry = await getActiveTimeEntry(emp.id);
                    if (activeEntry) {
                        entries[emp.id] = activeEntry;
                    }
                }
            }
            setActiveEntries(entries);
        };
        fetchAllActiveEntries();
    }, [employees]);
    
    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleEmployeeSelect = (employee: Employee) => {
        setSelectedEmployee(employee);
        setActiveModal('pin');
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || pin.length !== 4 || selectedEmployee.pin !== pin) {
            showMessage('error', 'Invalid PIN.');
            return;
        }

        // PIN is correct
        setPin(''); // clear pin
        if (activeEntries[selectedEmployee.id!]) {
             // Already clocked in, show status/clockout
            setActiveModal(null);
        } else {
            // Not clocked in, show job selection
            setActiveModal('clockin');
        }
    };
    
    const getCurrentPosition = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
    }

    const handleClockIn = async () => {
        if (!selectedEmployee || !jobToClockIn) {
            showMessage('error', 'You must select a job to clock into.');
            return;
        }

        let coords: GeolocationCoordinates | undefined;
        try {
            const position = await getCurrentPosition();
            coords = position.coords;
        } catch (error) {
            console.warn("Could not get geolocation", error);
            // Optionally, inform the user location could not be determined
        }

        const newEntry: TimeEntry = {
            employeeId: selectedEmployee.id!,
            jobId: jobToClockIn,
            startTime: new Date().toISOString(),
            startLat: coords?.latitude,
            startLng: coords?.longitude,
        };

        const newId = await saveTimeEntry(newEntry);
        setActiveEntries(prev => ({ ...prev, [selectedEmployee.id!]: { ...newEntry, id: newId } }));
        showMessage('success', `${selectedEmployee.name} successfully clocked in.`);
        closeAllModals();
    };

    const handleClockOut = async () => {
        if (!selectedEmployee) return;

        const entryToClose = activeEntries[selectedEmployee.id!];
        if (!entryToClose) {
            showMessage('error', `${selectedEmployee.name} is not currently clocked in.`);
            return;
        }
        
        let coords: GeolocationCoordinates | undefined;
        try {
            const position = await getCurrentPosition();
            coords = position.coords;
        } catch (error) {
            console.warn("Could not get geolocation", error);
        }

        const startTime = new Date(entryToClose.startTime);
        const endTime = new Date();
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        const updatedEntry: TimeEntry = {
            ...entryToClose,
            endTime: endTime.toISOString(),
            durationHours: parseFloat(durationHours.toFixed(2)),
            endLat: coords?.latitude,
            endLng: coords?.longitude,
        };

        await saveTimeEntry(updatedEntry);
        setActiveEntries(prev => {
            const newEntries = { ...prev };
            delete newEntries[selectedEmployee.id!];
            return newEntries;
        });
        showMessage('success', `${selectedEmployee.name} successfully clocked out.`);
        closeAllModals();
    };
    
    const handleSwitchJob = async () => {
        if (!selectedEmployee || !jobToClockIn) {
             showMessage('error', 'You must select a new job to switch to.');
             return;
        }
        
        // This is an atomic operation: clock out of old, clock in to new
        await handleClockOut();
        // Wait a moment for state to update, then clock in
        setTimeout(handleClockIn, 100);
    }
    
    const getJobInfo = (jobId: number) => {
        return jobs.find(j => j.id === jobId);
    }

    const closeAllModals = () => {
        setActiveModal(null);
        setSelectedEmployee(null);
        setPin('');
        setJobToClockIn('');
    };
    
    const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm p-6";
    const input = "mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
    const label = "text-sm font-medium text-slate-600 dark:text-slate-300";

    const renderModalContent = () => {
        if (!selectedEmployee) return null;
        
        switch (activeModal) {
            case 'pin':
                return (
                    <form onSubmit={handlePinSubmit}>
                        <h2 className="text-xl font-bold text-center">Enter PIN for {selectedEmployee.name}</h2>
                        <input 
                            type="password" 
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                            maxLength={4}
                            className={`${input} text-center text-2xl tracking-[1em] mt-4`}
                            autoFocus
                        />
                        <button type="submit" className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-blue-700">Submit</button>
                    </form>
                );
            case 'clockin':
            case 'switch':
                return (
                    <div>
                        <h2 className="text-xl font-bold">{activeModal === 'clockin' ? 'Clock In' : 'Switch Job'}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Select a job for {selectedEmployee.name}</p>
                         <label className="block mt-4"><span className={label}>Select Job</span>
                            <select value={jobToClockIn} onChange={e => setJobToClockIn(Number(e.target.value))} className={`${input} appearance-none`}>
                                <option value="">-- Select --</option>
                                {availableJobs.map(j => <option key={j.id} value={j.id}>{j.estimateNumber} - {j.calcData.customer?.name}</option>)}
                            </select>
                        </label>
                        <div className="mt-6 flex justify-end gap-2">
                             <button onClick={closeAllModals} className="rounded-lg px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                             <button onClick={activeModal === 'clockin' ? handleClockIn : handleSwitchJob} className="rounded-lg bg-green-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-green-700">{activeModal === 'clockin' ? 'Clock In' : 'Switch'}</button>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="mx-auto max-w-3xl p-4 space-y-4">
             {message && (
                <div className={`text-sm p-3 rounded-lg text-center ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : message.type === 'error' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'}`}>
                    {message.text}
                </div>
            )}
            <div className={`${card} grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4`}>
                {employees.map(employee => {
                    const activeEntry = activeEntries[employee.id!];
                    const job = activeEntry ? getJobInfo(activeEntry.jobId) : null;
                    return (
                        <div key={employee.id} className={`p-4 rounded-lg border-2 ${activeEntry ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                            <h3 className="font-bold text-lg">{employee.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{employee.role}</p>
                            
                            {activeEntry && job ? (
                                <div>
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">Clocked In</p>
                                    <p className="text-xs">Job: {job.estimateNumber}</p>
                                    <p className="text-xs">Since: {new Date(activeEntry.startTime).toLocaleTimeString()}</p>
                                    <div className="mt-3 flex flex-col gap-2">
                                        <button onClick={() => { setSelectedEmployee(employee); setActiveModal('switch'); }} className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">Switch Job</button>
                                        <button onClick={() => handleEmployeeSelect(employee)} className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700">Clock Out</button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Clocked Out</p>
                                    <button onClick={() => handleEmployeeSelect(employee)} className="mt-3 w-full rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700">Clock In</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeAllModals}>
                    <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                         <button onClick={closeAllModals} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close modal">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        {renderModalContent()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeClockPage;