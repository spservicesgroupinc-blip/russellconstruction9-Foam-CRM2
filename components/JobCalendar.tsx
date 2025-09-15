import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Job, EditingJob } from './types';
import { toDate, addDays, diffInDays, fmtInput, startOfDay } from './utils';
import Toolbar from './Toolbar';
import JobEditorModal from './JobEditorModal';
import { EstimateRecord } from '../lib/db';

const initialJobs: Job[] = [
  { id: '1', name: 'Foundation Prep', start: '2024-07-01', end: '2024-07-05', color: '#4A90E2', links: [] },
  { id: '2', name: 'Framing', start: '2024-07-06', end: '2024-07-12', color: '#D0021B', links: ['1'] },
  { id: '3', name: 'Roofing', start: '2024-07-13', end: '2024-07-18', color: '#F5A623', links: ['2'] },
  { id: '4', name: 'Electrical/Plumbing', start: '2024-07-13', end: '2024-07-20', color: '#F8E71C', links: ['2'] },
  { id: '5', name: 'Insulation Spraying', start: '2024-07-21', end: '2024-07-23', color: '#7ED321', links: ['4'] },
  { id: '6', name: 'Drywall & Interior', start: '2024-07-24', end: '2024-08-02', color: '#BD10E0', links: ['5'] },
  { id: '7', name: 'Client Walkthrough', start: '2024-08-05', end: '2024-08-05', color: '#50E3C2', links: ['6'] },
];

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
        typeof item.color === 'string' &&
        Array.isArray(item.links) &&
        item.links.every((l: any) => typeof l === 'string')
    )
  );
}

interface JobCalendarProps {
  jobToSchedule: EstimateRecord | null;
  onJobScheduled: () => void;
}

const JobCalendar: React.FC<JobCalendarProps> = ({ jobToSchedule, onJobScheduled }) => {
  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const savedJobs = typeof localStorage !== 'undefined' ? localStorage.getItem(CALENDAR_STORAGE_KEY) : null;
      if (savedJobs) {
        const parsedJobs = JSON.parse(savedJobs);
        if (isJobArray(parsedJobs)) {
          return parsedJobs;
        }
      }
    } catch (error) {
      console.error('Failed to load jobs from localStorage', error);
    }
    return initialJobs;
  });

  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(jobs));
      }
    } catch (error) {
      console.error('Failed to save jobs to localStorage', error);
    }
  }, [jobs]);

  // Auto-add job coming from external estimate
  useEffect(() => {
    if (jobToSchedule && jobToSchedule.calcData?.customer) {
      const customerName = jobToSchedule.calcData.customer.name;
      const uniqueJobId = `job-${jobToSchedule.id}`;

      setJobs((prevJobs) => {
        if (prevJobs.some((j) => j.id === uniqueJobId)) {
          return prevJobs;
        }
        const start = new Date();
        const end = addDays(start, 2);
        const newJob: Job = {
          id: uniqueJobId,
          name: `${customerName} (${jobToSchedule.estimateNumber})`,
          start: fmtInput(start),
          end: fmtInput(end),
          color: '#4A90E2',
          links: [],
        };
        return [...prevJobs, newJob];
      });

      // set editing regardless (existing or newly added)
      setEditingJobId(uniqueJobId);
      onJobScheduled();
    }
  }, [jobToSchedule, onJobScheduled]);


  const handleAddJob = useCallback(() => {
    const newId = Date.now().toString();
    const today = new Date();
    const newJob: Job = {
      id: newId,
      name: 'New Job',
      start: fmtInput(today),
      end: fmtInput(addDays(today, 2)), // Default to a 3-day job
      color: '#4A90E2',
      links: [],
    };
    setJobs((prev) => [...prev, newJob]);
    setEditingJobId(newId);
  }, []);
  
  // Simplified update handler for the calendar view
  const handleUpdateJob = useCallback((updatedJob: Job, originalStartStr?: string) => {
    setJobs(currentJobs => currentJobs.map(j => (j.id === updatedJob.id ? { ...updatedJob, links: updatedJob.links ?? [] } : j)));
  }, []);

  const handleSaveJob = useCallback(
    (jobToSave: EditingJob) => {
      // normalize links to avoid .map on undefined later
      const normalized: Job = { ...(jobToSave as Job), links: (jobToSave as any).links ?? [] };
      setJobs(updatedJobs => updatedJobs.map((j) => (j.id === normalized.id ? normalized : j)));
      setEditingJobId(null);
    },
    []
  );

  const handleDeleteJob = useCallback((jobId: string) => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this job?')) {
        setJobs(currentJobs => 
            currentJobs
                .filter(job => job.id !== jobId) // First, remove the job itself
                .map(job => ({ // Then, for all remaining jobs...
                    ...job,
                    // ...remove any links that pointed to the deleted job.
                    links: (job.links ?? []).filter(linkId => linkId !== jobId) 
                }))
        );
        setEditingJobId(null); // Close the editor modal
    }
  }, []);

  const handleMakeStandalone = useCallback((jobId: string) => {
    setJobs((prevJobs) => prevJobs.map((j) => (j.id === jobId ? { ...j, links: [] } : j)));
  }, []);

  const editingJob = useMemo(() => jobs.find((j) => j.id === editingJobId), [jobs, editingJobId]);

  // Calendar Grid Generation
  const { calendarDays, firstDayOfMonth } = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 for Sunday
    const startDate = addDays(firstDay, -startingDayOfWeek);
    
    const days = Array.from({ length: 42 }).map((_, i) => addDays(startDate, i));
    return { calendarDays: days, firstDayOfMonth: firstDay };
  }, [currentMonth]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, job: Job) => {
    e.dataTransfer.setData('jobId', job.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('jobId');
    const droppedJob = jobs.find(j => j.id === jobId);

    if (droppedJob) {
        const duration = diffInDays(droppedJob.start, droppedJob.end);
        const newStart = targetDate;
        const newEnd = addDays(newStart, duration);

        const updatedJob = {
            ...droppedJob,
            start: fmtInput(newStart),
            end: fmtInput(newEnd),
        };
        handleUpdateJob(updatedJob, droppedJob.start);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const DayOfWeekHeader = () => (
    <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 border-b border-l">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="py-2 border-r">{day}</div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <Toolbar
        onAddJob={handleAddJob}
        currentMonth={currentMonth}
        onNextMonth={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        onPreviousMonth={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onGoToToday={() => setCurrentMonth(new Date())}
      />
      <div className="flex-grow overflow-auto p-4">
        <div className="bg-white shadow-lg rounded-lg border border-slate-200 flex flex-col min-h-[600px]">
            <DayOfWeekHeader />
            <div className="grid grid-cols-7 grid-rows-6 flex-grow border-l">
                {calendarDays.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === firstDayOfMonth.getMonth();
                    const isToday = startOfDay(day).getTime() === startOfDay(new Date()).getTime();
                    
                    const jobsForDay = jobs.filter(job => {
                        const start = startOfDay(job.start);
                        const end = startOfDay(job.end);
                        const current = startOfDay(day);
                        return current >= start && current <= end;
                    }).sort((a,b) => toDate(a.start).getTime() - toDate(b.start).getTime());

                    return (
                        <div 
                            key={index}
                            className={`relative border-r border-b p-1 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'} flex flex-col gap-1`}
                            onDrop={(e) => handleDrop(e, day)}
                            onDragOver={handleDragOver}
                        >
                            <span className={`text-xs font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                                {day.getDate()}
                            </span>
                            <div className="space-y-1 overflow-y-auto text-xs">
                                {jobsForDay.map(job => (
                                    <div
                                        key={job.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, job)}
                                        onClick={() => setEditingJobId(job.id)}
                                        className="p-1 rounded text-white font-semibold truncate cursor-pointer hover:opacity-80"
                                        style={{ backgroundColor: job.color }}
                                    >
                                        {job.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
      </div>
      {editingJob && (
        <JobEditorModal
          job={editingJob}
          allJobs={jobs}
          onSave={handleSaveJob}
          onCancel={() => setEditingJobId(null)}
          onDelete={handleDeleteJob}
          onMakeStandalone={handleMakeStandalone}
        />
      )}
    </div>
  );
};

export default JobCalendar;
