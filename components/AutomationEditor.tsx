import React, { useState, useEffect } from 'react';
import { Automation, AutomationAction } from './types';

interface AutomationEditorProps {
  existingAutomation: Automation | null;
  onSave: (automation: Omit<Automation, 'id'> | Automation) => Promise<void>;
  onCancel: () => void;
}

export default function AutomationEditor({ existingAutomation, onSave, onCancel }: AutomationEditorProps) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'new_customer' | 'job_status_updated'>('new_customer');
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (existingAutomation) {
      setName(existingAutomation.name);
      setTriggerType(existingAutomation.trigger_type);
      setTriggerConfig(existingAutomation.trigger_config || {});
      setActions(existingAutomation.actions || []);
      setIsEnabled(existingAutomation.is_enabled);
    }
  }, [existingAutomation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const automation: Omit<Automation, 'id'> | Automation = {
      ...(existingAutomation?.id ? { id: existingAutomation.id } : {}),
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      actions,
      is_enabled: isEnabled,
    };
    await onSave(automation);
  };

  const addAction = () => {
    setActions([...actions, { action_type: 'webhook', action_config: {}, order: actions.length }]);
  };

  const updateAction = (index: number, field: keyof AutomationAction, value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-xl font-bold dark:text-white">
            {existingAutomation ? 'Edit Automation' : 'Create Automation'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Trigger</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as 'new_customer' | 'job_status_updated')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
            >
              <option value="new_customer">New Customer Created</option>
              <option value="job_status_updated">Job Status Updated</option>
            </select>
          </div>

          {triggerType === 'job_status_updated' && (
            <div>
              <label className="block text-sm font-medium mb-1">To Status</label>
              <select
                value={triggerConfig.to_status || ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, to_status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                required
              >
                <option value="">Select status...</option>
                <option value="sold">Sold</option>
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">Actions</label>
              <button type="button" onClick={addAction} className="text-sm text-blue-600 hover:text-blue-700">
                + Add Action
              </button>
            </div>
            <div className="space-y-3">
              {actions.map((action, index) => (
                <div key={index} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <select
                      value={action.action_type}
                      onChange={(e) => updateAction(index, 'action_type', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                    >
                      <option value="webhook">Webhook</option>
                      <option value="create_task">Create Task</option>
                      <option value="add_to_schedule">Add to Schedule</option>
                      <option value="send_email">Send Email</option>
                      <option value="update_inventory">Update Inventory</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  {action.action_type === 'webhook' && (
                    <input
                      type="url"
                      placeholder="Webhook URL"
                      value={action.action_config.url || ''}
                      onChange={(e) => updateAction(index, 'action_config', { ...action.action_config, url: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                    />
                  )}

                  {action.action_type === 'create_task' && (
                    <>
                      <input
                        type="text"
                        placeholder="Task title"
                        value={action.action_config.task_title || ''}
                        onChange={(e) => updateAction(index, 'action_config', { ...action.action_config, task_title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white mb-2"
                      />
                      <textarea
                        placeholder="Task description"
                        value={action.action_config.task_description || ''}
                        onChange={(e) => updateAction(index, 'action_config', { ...action.action_config, task_description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                        rows={2}
                      />
                    </>
                  )}

                  {action.action_type === 'send_email' && (
                    <>
                      <input
                        type="text"
                        placeholder="Email subject"
                        value={action.action_config.email_subject || ''}
                        onChange={(e) => updateAction(index, 'action_config', { ...action.action_config, email_subject: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white mb-2"
                      />
                      <textarea
                        placeholder="Email body"
                        value={action.action_config.email_body || ''}
                        onChange={(e) => updateAction(index, 'action_config', { ...action.action_config, email_body: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                        rows={3}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="enabled" className="text-sm">Enable this automation</label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-200 dark:bg-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
