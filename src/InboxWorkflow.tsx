import { useState } from 'react';

type WorkflowField = 'callback_due_at' | 'booked_at' | 'paid_at';
type Props = {
  conversation: Partial<Record<WorkflowField, string | null>>;
  disabled: boolean;
  onSave: (field: WorkflowField, value: string | boolean | null) => void;
};

function localDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function InboxWorkflow({ conversation, disabled, onSave }: Props) {
  const due = conversation.callback_due_at;
  const [callbackTime, setCallbackTime] = useState(() => localDateTime(due));
  const callbackDate = new Date(callbackTime);
  const validCallback = Number.isFinite(callbackDate.getTime());
  return (
    <section className="inbox-workflow" aria-label="Follow-up and outcome">
      <div className="label">FOLLOW-UP AND OUTCOME</div>
      <form onSubmit={event => {
        event.preventDefault();
        if (validCallback) onSave('callback_due_at', callbackDate.toISOString());
      }}>
        <label htmlFor="inbox-callback-time">Callback time (your local time)</label>
        <input id="inbox-callback-time" className="input" type="datetime-local"
          required value={callbackTime} disabled={disabled}
          onChange={event => setCallbackTime(event.target.value)} />
        <div className="inbox-workflow-actions">
          <button type="submit" className="btn btn-gold"
            disabled={disabled || !validCallback || callbackTime === localDateTime(due)}>
            {due ? 'Reschedule' : 'Set callback'}
          </button>
          {due && <button type="button" className="btn btn-wire" disabled={disabled}
            onClick={() => onSave('callback_due_at', null)}>Clear callback</button>}
        </div>
      </form>
      <div className="inbox-workflow-outcomes">
        {([['booked_at', 'Booked'], ['paid_at', 'Paid']] as const).map(([field, label]) => (
          <label key={field}>
            <input type="checkbox" checked={Boolean(conversation[field])} disabled={disabled}
              onChange={event => onSave(field, event.target.checked)} />
            {label}
            {conversation[field] && <small>{new Date(conversation[field]!).toLocaleDateString()}</small>}
          </label>
        ))}
      </div>
    </section>
  );
}
