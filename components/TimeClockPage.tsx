import React, { useState, useEffect, useRef } from 'react';
import { Employee, TimeEntry } from './types.ts';
import { EstimateRecord, getActiveTimeEntry, saveTimeEntry } from '../lib/db.ts';

// Declare google for TypeScript
declare global {
  interface Window {
    google: any;
  }
}

interface TimeClockPageProps {
    employees: Employee[];
    jobs: EstimateRecord[];
}

const TimeClockPage: React.FC<TimeClockPageProps> = ({ employees, jobs }) => {
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [pin, setPin] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const [activeModal, setActiveModal] = useState<'pin' | 'clockin' | 'options' | 'switch' | null>(null);
    const [activeEntries, setActiveEntries] = useState<Record<number, TimeEntry>>({});
    const [jobToClockIn, setJobToClockIn] = useState<number | ''>('');

    // Map State
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any | null>(null);
    const [infoWindow, setInfoWindow] = useState<any | null>(null);
    const markersRef = useRef<Map<number, any>>(new Map());

    const availableJobs = jobs.filter(j => j.status === 'sold');

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

    // Initialize Map
    useEffect(() => {
        const initMap = async () => {
            if (!mapRef.current) return;
            try {
                const { Map } = await window.google.maps.importLibrary("maps");
                const mapInstance = new Map(mapRef.current as HTMLDivElement, {
                    center: { lat: 39.8283, lng: -98.5795 },
                    zoom: 4,
                    mapId: 'TIME_CLOCK_MAP',
                });
                setMap(mapInstance);
                const infoWindowInstance = new window.google.maps.InfoWindow();
                setInfoWindow(infoWindowInstance);
            } catch (e) {
                console.error("Error loading Google Maps for Time Clock", e);
            }
        };
        if (window.google) {
            initMap();
        }
    }, []);

    // Update Map Markers
    useEffect(() => {
        if (!map || !infoWindow) return;

        const updateMarkers = async () => {
            const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");
            const bounds = new window.google.maps.LatLngBounds();
            let locationsFound = 0;

            const activeEmployeeIds = new Set(Object.keys(activeEntries).map(Number));

            // Remove markers for employees who clocked out
            markersRef.current.forEach((marker, employeeId) => {
                if (!activeEmployeeIds.has(employeeId)) {
                    marker.map = null;
                    markersRef.current.delete(employeeId);
                }
            });

            for (const empIdStr in activeEntries) {
                const employeeId = Number(empIdStr);
                const entry = activeEntries[employeeId];
                const employee = employees.find(e => e.id === employeeId);

                if (entry.startLat && entry.startLng && employee) {
                    const position = { lat: entry.startLat, lng: entry.startLng };
                    locationsFound++;
                    bounds.extend(position);

                    if (markersRef.current.has(employeeId)) {
                        markersRef.current.get(employeeId)!.position = position;
                    } else {
                        const marker = new AdvancedMarkerElement({
                            map,
                            position,
                            title: employee.name,
                        });

                        marker.addListener('click', () => {
                            const job = getJobInfo(entry.jobId);
                            const content = `
                                <div class="font-sans p-1">
                                  <h3 class="font-bold text-base text-slate-800">${employee.name}</h3>
                                  <p class="text-sm text-slate-600">Job: ${job?.estimateNumber || 'N/A'}</p>
                                  <p class="text-xs text-slate-500">Clocked In: ${new Date(entry.startTime).toLocaleTimeString()}</p>
                                </div>
                            `;
                            infoWindow.setContent(content);
                            infoWindow.open(map, marker);
                        });
                        markersRef.current.set(employeeId, marker);
                    }
                }
            }

            if (locationsFound > 0) {
                map.fitBounds(bounds);
                if(map.getZoom() > 15) map.setZoom(15);
            } else {
                map.setCenter({ lat: 39.8283, lng: -98.5795 });
                map.setZoom(4);
            }
        };
        updateMarkers();
    }, [activeEntries, map, infoWindow, employees]);

    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleEmployeeSelect = (employee: Employee) => {
        setSelectedEmployee(employee);
        setActiveModal('pin');
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || pin.length !== 4 || selectedEmployee.pin !== pin) {
            showMessage('error', 'Invalid PIN.');
            return;
        }
        setPin('');
        if (activeEntries[selectedEmployee.id!]) {
            setActiveModal('options');
        } else {
            setActiveModal('clockin');
        }
    };

    const getCurrentPosition = (): Promise<GeolocationPosition | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
    };

    const handleClockIn = async () => {
        if (!selectedEmployee || !jobToClockIn) {
            showMessage('error', 'You must select a job to clock into.');
            return;
        }

        const position = await getCurrentPosition();
        const coords = position?.coords;

        const newEntry: TimeEntry = {
            employeeId: selectedEmployee.id!,
            jobId: jobToClockIn as number,
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

        const position = await getCurrentPosition();
        const coords = position?.coords;

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
        const entryToClose = activeEntries[selectedEmployee.id!];
        if (!entryToClose) {
            showMessage('error', `${selectedEmployee.name} is not currently clocked in.`);
            return;
        }
    
        const position = await getCurrentPosition();
        const coords = position?.coords;
    
        // 1. Clock out of the old job
        const startTime = new Date(entryToClose.startTime);
        const switchTime = new Date(); // Use the same timestamp for both actions
        const durationHours = (switchTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        const updatedEntry: TimeEntry = {
            ...entryToClose,
            endTime: switchTime.toISOString(),
            durationHours: parseFloat(durationHours.toFixed(2)),
            endLat: coords?.latitude,
            endLng: coords?.longitude,
        };
        await saveTimeEntry(updatedEntry);
    
        // 2. Clock into the new job
        const newEntry: TimeEntry = {
            employeeId: selectedEmployee.id!,
            jobId: jobToClockIn as number,
            startTime: switchTime.toISOString(), // Start time is the end time of the previous entry
            startLat: coords?.latitude,
            startLng: coords?.longitude,
        };
        const newId = await saveTimeEntry(newEntry);
    
        // 3. Update state
        setActiveEntries(prev => ({
            ...prev,
            [selectedEmployee.id!]: { ...newEntry, id: newId }
        }));
    
        showMessage('success', `${selectedEmployee.name} successfully switched jobs.`);
        closeAllModals();
    };
    
    const getJobInfo = (jobId: number) => {
        return jobs.find(j => j.id === jobId);
    }

    const closeAllModals = () => {
        setActiveModal(null);
        setSelectedEmployee(null);
        setPin('');
        setJobToClockIn('');
    };

    const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm p-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors";
    const input = "mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
    const label = "text-sm font-medium text-slate-600 dark:text-slate-300";

    const renderModalContent = () => {
        if (!selectedEmployee) return null;
        switch (activeModal) {
            case 'pin':
                return (
                    <form onSubmit={handlePinSubmit}>
                        <h2 className="text-xl font-bold text-center">Enter PIN for {selectedEmployee.name}</h2>
                        <input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4} className={`${input} text-center text-2xl tracking-[1em] mt-4`} autoFocus />
                        <button type="submit" className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-blue-700">Submit</button>
                    </form>
                );
            case 'clockin':
                return (
                    <div>
                        <h2 className="text-xl font-bold">Clock In</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Select a job for {selectedEmployee.name}</p>
                        <label className="block mt-4"><span className={label}>Select Job</span>
                            <select value={jobToClockIn} onChange={e => setJobToClockIn(Number(e.target.value))} className={`${input} appearance-none`}>
                                <option value="">-- Select --</option>
                                {availableJobs.map(j => <option key={j.id} value={j.id}>{j.estimateNumber} - {j.calcData.customer?.name}</option>)}
                            </select>
                        </label>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={closeAllModals} className="rounded-lg px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                            <button onClick={handleClockIn} className="rounded-lg bg-green-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-green-700">Clock In</button>
                        </div>
                    </div>
                );
            case 'options': {
                const activeJob = getJobInfo(activeEntries[selectedEmployee.id!]?.jobId);
                return (
                    <div>
                        <h2 className="text-xl font-bold text-center">What would you like to do?</h2>
                        {activeJob && <p className="text-sm text-center text-slate-500 dark:text-slate-400 mt-1">Currently on job: {activeJob.estimateNumber}</p>}
                        <div className="mt-6 flex flex-col gap-3">
                            <button onClick={() => setActiveModal('switch')} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-blue-700">Switch Job</button>
                            <button onClick={handleClockOut} className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-red-700">Clock Out</button>
                        </div>
                    </div>
                );
            }
            case 'switch': {
                const currentJobId = activeEntries[selectedEmployee.id!]?.jobId;
                const jobsForSwitching = availableJobs.filter(j => j.id !== currentJobId);
                return (
                    <div>
                        <h2 className="text-xl font-bold">Switch Job</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Select a new job for {selectedEmployee.name}</p>
                        <label className="block mt-4"><span className={label}>Select New Job</span>
                            <select value={jobToClockIn} onChange={e => setJobToClockIn(Number(e.target.value))} className={`${input} appearance-none`}>
                                <option value="">-- Select --</option>
                                {jobsForSwitching.map(j => <option key={j.id} value={j.id}>{j.estimateNumber} - {j.calcData.customer?.name}</option>)}
                            </select>
                        </label>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setActiveModal('options')} className="rounded-lg px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Back</button>
                            <button onClick={handleSwitchJob} className="rounded-lg bg-green-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-green-700">Confirm Switch</button>
                        </div>
                    </div>
                );
            }
            default: return null;
        }
    };

    return (
        <div className="h-full flex flex-col">
            {message && (
                <div className={`p-2 text-sm text-center ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'}`}>
                    {message.text}
                </div>
            )}
            <div className="flex-grow p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 h-0">
                <div className="lg:col-span-1 overflow-y-auto space-y-3 p-1">
                    <h2 className="text-xl font-bold dark:text-white px-2 mb-2">Team Status</h2>
                    {employees.map(employee => {
                        const activeEntry = activeEntries[employee.id!];
                        const job = activeEntry ? getJobInfo(activeEntry.jobId) : null;
                        return (
                            <div key={employee.id} onClick={() => handleEmployeeSelect(employee)} className={`${card} ${activeEntry ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/30' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg">{employee.name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{employee.role}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-semibold px-2 py-0.5 rounded-full ${activeEntry ? 'bg-green-200 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                                        <div className={`w-2 h-2 rounded-full ${activeEntry ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                                        {activeEntry ? 'ON THE CLOCK' : 'CLOCKED OUT'}
                                    </div>
                                </div>
                                {activeEntry && job && (
                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                                        <p className="text-sm"><strong>Job:</strong> {job.estimateNumber}</p>
                                        <p className="text-xs"><strong>Client:</strong> {job.calcData.customer?.name}</p>
                                        <p className="text-xs"><strong>Since:</strong> {new Date(activeEntry.startTime).toLocaleTimeString()}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="lg:col-span-2 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-600 h-full">
                    <div ref={mapRef} className="w-full h-full" />
                </div>
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