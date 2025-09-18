import React, { useState, useEffect } from 'react';
import { EditingJob, Job } from './types.ts';
import { fmtInput, toDate, addDays } from './utils.ts';

interface JobEditorModalProps {
  job: EditingJob;
  allJobs: Job[];
  onSave: (job: EditingJob) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onMakeStandalone: (id: string) => void;
}

const JobEditorModal: React.FC<JobEditorModalProps> = ({ job, allJobs, onSave, onCancel, onDelete, onMakeStandalone }) => {
  // Ensure the job being edited always has a links array to prevent uncontrolled->controlled input errors.
  const [editedJob, setEditedJob] = useState<EditingJob>({ ...job, links: job.links ?? [] });

  useEffect(() => {
    // Sync with prop changes, also ensuring links is always an array.
    setEditedJob({ ...job, links: job.links ?? [] });
  }, [job]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'links') {
       const selectedOptions = Array.from((e.target as HTMLSelectElement).selectedOptions).map(option => option.value);
       setEditedJob(prev => ({ ...prev, links: selectedOptions }));
    } else {
       setEditedJob(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = toDate(e.target.value);
    const oldStart = toDate(editedJob.start);
    const oldEnd = toDate(editedJob.end);
    const duration = Math.max(0, (oldEnd.getTime() - oldStart.getTime()));
    const newEnd = new Date(newStart.getTime() + duration);
    setEditedJob(prev => ({
        ...prev,
        start: fmtInput(newStart),
        end: fmtInput(newEnd)
    }));
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation to ensure end date is not before start date
    if (toDate(editedJob.end) < toDate(editedJob.start)) {
        alert("End date cannot be before the start date.");
        return;
    }
    onSave(editedJob);
  };
  
  const otherJobs = allJobs.filter(j => j.id !== job.id);
  const card = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4";
  const label = "text-sm font-medium text-slate-600 dark:text-slate-300";
  const input = "mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600 px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
  const button = "rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const primaryButton = `${button} bg-blue-600 text-white shadow hover:bg-blue-700`;
  const secondaryButton = `${button} text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`;
  const dangerButton = `${button} bg-red-500 text-white shadow hover:bg-red-600`;
  
  return (
    <div className={card} onClick={onCancel} aria-modal="true" role="dialog">
      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close modal">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <form onSubmit={handleSave}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Edit Job</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
                <span className={label}>Job Name</span>
                <input type="text" name="name" value={editedJob.name} onChange={handleChange} className={input} required />
            </label>
            <div className="grid grid-cols-2 gap-4">
                <label className="block">
                    <span className={label}>Start Date</span>
                    <input type="date" name="start" value={editedJob.start} onChange={handleStartDateChange} className={input} />
                </label>
                 <label className="block">
                    <span className={label}>End Date</span>
                    <input type="date" name="end" value={editedJob.end} onChange={handleChange} className={input} />
                </label>
            </div>
            <label className="block">
                <span className={label}>Color</span>
                <input type="color" name="color" value={editedJob.color} onChange={handleChange} className={`${input} h-10 p-1`} />
            </label>
            <label className="block">
                <span className={label}>Depends On (Predecessors)</span>
                <select name="links" multiple value={editedJob.links} onChange={handleChange} className={`${input} h-32`}>
                    {otherJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
                <button type="button" onClick={() => onMakeStandalone(job.id)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">Unlink All</button>
            </label>
          </div>
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <button type="button" onClick={() => onDelete(job.id)} className={dangerButton}>Delete Job</button>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}>Save Changes</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobEditorModal;