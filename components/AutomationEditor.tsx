import React, { useState } from 'react';

interface AutomationEditorProps {
  onSave: (automation: any) => void;
  onCancel: () => void;
}

export default function AutomationEditor({ onSave, onCancel }: AutomationEditorProps) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [action, setAction] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, trigger, action });
  };

  return (
    <div className="automation-editor">
      <h2>Create Automation</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Trigger:</label>
          <input
            type="text"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Action:</label>
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            required
          />
        </div>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </form>
    </div>
  );
}
