import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Job, EditingJob } from './types.ts';
import { toDate, addDays, diffInDays, fmtInput, startOfDay } from './utils.ts';
import Toolbar from './Toolbar.tsx';
import JobEditorModal from './JobEditorModal.tsx';
import { EstimateRecord } from '../lib/db.ts';

interface JobCalendarProps {
  jobToSchedule: EstimateRecord | null;
  onJobScheduled: () => void;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

const JobCalendar: React.FC<JobCalendarProps> = ({ jobToSchedule, onJobScheduled, jobs, setJobs }) => {
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
  }, [jobToSchedule, onJobScheduled, setJobs]);


  const handleAddJob = useCallback((startDate?: Date) => {
    const newId = Date.now().toString();
    const start = startDate || new Date();
    const newJob: Job = {
      id: newId,
      name: 'New Job',
      start: fmtInput(start),
      end: fmtInput(addDays(start, 2)),
      color: '#4A90E2',
      links: [],
    };
    setJobs((prev) => [...prev, newJob]);
    setEditingJobId(newId);
  }, [setJobs]);
  
  // Simplified update handler for the calendar view
  const handleUpdateJob = useCallback((updatedJob: Job, originalStartStr?: string) => {
    setJobs(currentJobs => currentJobs.map(j => (j.id === updatedJob.id ? { ...updatedJob, links: updatedJob.links ?? [] } : j)));
  }, [setJobs]);

  const handleSaveJob = useCallback(
    (jobToSave: EditingJob) => {
      // normalize links to avoid .map on undefined later
      const normalized: Job = { ...(jobToSave as Job), links: (jobToSave as any).links ?? [] };
      setJobs(updatedJobs => updatedJobs.map((j) => (j.id === normalized.id ? normalized : j)));
      setEditingJobId(null);
    },
    [setJobs]
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
  }, [setJobs]);

  const handleMakeStandalone = useCallback((jobId: string) => {
    setJobs((prevJobs) => prevJobs.map((j) => (j.id === jobId ? { ...j, links: [] } : j)));
  }, [setJobs]);

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
    <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-l border-slate-200 dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-700 z-10">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="py-2 border-r border-slate-200 dark:border-slate-600">{day}</div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-800">
      <Toolbar
        onAddJob={() => handleAddJob()}
        currentMonth={currentMonth}
        onNextMonth={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        onPreviousMonth={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onGoToToday={() => setCurrentMonth(new Date())}
      />
      <div className="flex-grow overflow-auto p-4">
        <div className="bg-white dark:bg-slate-700 shadow-lg rounded-lg border border-slate-200 dark:border-slate-600 flex flex-col min-h-[600px]">
            <div className="overflow-x-auto">
                <div className="min-w-[840px]">
                    <DayOfWeekHeader />
                    <div className="grid grid-cols-7 grid-rows-6 border-l border-slate-200 dark:border-slate-600" style={{ minHeight: '600px' }}>
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
                                    className={`relative border-r border-b border-slate-200 dark:border-slate-600 p-2 min-h-[100px] ${isCurrentMonth ? 'bg-white dark:bg-slate-700 hover:bg-blue-50/70 dark:hover:bg-slate-600/50 cursor-pointer' : 'bg-slate-50 dark:bg-slate-700/50'} flex flex-col gap-1 transition-colors`}
                                    onDrop={(e) => handleDrop(e, day)}
                                    onDragOver={handleDragOver}
                                    onClick={() => handleAddJob(day)}
                                >
                                    <span className={`text-xs font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : isCurrentMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {day.getDate()}
                                    </span>
                                    <div className="space-y-1 overflow-y-auto text-xs">
                                        {jobsForDay.map(job => (
                                            <div
                                                key={job.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, job)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingJobId(job.id);
                                                }}
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