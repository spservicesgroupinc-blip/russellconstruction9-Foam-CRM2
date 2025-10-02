import React, { useState, useEffect } from 'react';
import { Automation, TriggerType, ActionType } from './types.ts';
import { JobStatus } from '../lib/db.ts';

interface AutomationEditorProps {
    existingAutomation: Automation | null;
    onSave: (automation: Omit<Automation, 'id'> | Automation) => void;
    onCancel: () => void;
}

const EMPTY_AUTOMATION: Omit<Automation, 'id'> = {
    name: '',
    trigger_type: 'new_customer',
    trigger_config: {},
    action_type: 'webhook',
    action_config: {},
    is_enabled: true,
};

const JOB_STATUSES: JobStatus[] = ['estimate', 'sold', 'invoiced', 'paid'];

const AutomationEditor: React.FC<AutomationEditorProps> = ({ existingAutomation, onSave, onCancel }) => {
    const [automation, setAutomation] = useState(existingAutomation || EMPTY_AUTOMATION);

    useEffect(() => {
        setAutomation(existingAutomation || EMPTY_AUTOMATION);
    }, [existingAutomation]);
    
    const handleFieldChange = <T extends keyof Automation>(field: T, value: Automation[T]) => {
        setAutomation(prev => ({...prev, [field]: value}));
    };
    
    const handleConfigChange = <T extends 'trigger_config' | 'action_config'>(configType: T, field: keyof Automation[T], value: any) => {
        setAutomation(prev => ({
            ...prev,
            [configType]: { ...prev[configType], [field]: value }
        }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(automation);
    };

    const labelClass = "text-sm font-medium text-slate-600 dark:text-slate-300";
    const inputClass = "mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
    const selectClass = `${inputClass} appearance-none`;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
            <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400">&times;</button>
                <form onSubmit={handleSubmit}>
                    <h2 className="text-xl font-bold dark:text-white">{existingAutomation ? 'Edit Automation' : 'Create Automation'}</h2>
                    <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        <label className="block">
                            <span className={labelClass}>Automation Name</span>
                            <input type="text" value={automation.name} onChange={e => handleFieldChange('name', e.target.value)} className={inputClass} required />
                        </label>
                        
                        <div className="p-4 border rounded-lg border-slate-200 dark:border-slate-600">
                            <h3 className="font-semibold text-lg">When...</h3>
                            <label className="block mt-2">
                                <span className={labelClass}>This happens (Trigger)</span>
                                <select value={automation.trigger_type} onChange={e => handleFieldChange('trigger_type', e.target.value as TriggerType)} className={selectClass}>
                                    <option value="new_customer">A new customer is created</option>
                                    <option value="job_status_updated">A job's status is updated</option>
                                </select>
                            </label>
                            {automation.trigger_type === 'job_status_updated' && (
                                <label className="block mt-2">
                                    <span className={labelClass}>Condition: Status becomes</span>
                                    <select value={automation.trigger_config.to_status || ''} onChange={e => handleConfigChange('trigger_config', 'to_status', e.target.value)} className={selectClass}>
                                        <option value="">-- Select Status --</option>
                                        {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </label>
                            )}
                        </div>

                        <div className="p-4 border rounded-lg border-slate-200 dark:border-slate-600">
                            <h3 className="font-semibold text-lg">Then...</h3>
                             <label className="block mt-2">
                                <span className={labelClass}>Do this (Action)</span>
                                <select value={automation.action_type} onChange={e => handleFieldChange('action_type', e.target.value as ActionType)} className={selectClass}>
                                    <option value="webhook">Trigger a webhook</option>
                                    <option value="create_task">Create a new task</option>
                                    <option value="add_to_schedule">Add job to schedule</option>
                                </select>
                            </label>
                            {automation.action_type === 'webhook' && (
                                <label className="block mt-2">
                                    <span className={labelClass}>Webhook URL</span>
                                    <input type="url" value={automation.action_config.url || ''} onChange={e => handleConfigChange('action_config', 'url', e.target.value)} className={inputClass} placeholder="https://..." required />
                                </label>
                            )}
                            {automation.action_type === 'create_task' && (
                                <div className="mt-2 space-y-2">
                                    <label className="block">
                                        <span className={labelClass}>Task Title</span>
                                        <input type="text" value={automation.action_config.task_title || ''} onChange={e => handleConfigChange('action_config', 'task_title', e.target.value)} className={inputClass} required />
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Task Description (Optional)</span>
                                        <textarea value={automation.action_config.task_description || ''} onChange={e => handleConfigChange('action_config', 'task_description', e.target.value)} rows={2} className={inputClass}></textarea>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You can use placeholders like [customer_name], [job_number], etc.</p>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={automation.is_enabled} onChange={e => handleFieldChange('is_enabled', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className={labelClass}>Enabled</span>
                        </label>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={onCancel}>Cancel</button>
                            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700">Save Automation</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AutomationEditor;