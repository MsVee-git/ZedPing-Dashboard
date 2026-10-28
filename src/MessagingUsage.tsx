import { useEffect, useState } from 'react';
import { messagingUsageView } from './lib/planUsage';

export function MessagingUsage({ customer, request, compact = false }: any) {
  const [result, setResult] = useState<any>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    let sequence = 0;
    let controller: AbortController | undefined;
    setResult(null);
    const refresh = async () => {
      const version = ++sequence;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await request('/workspace/messaging-access', { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load allowance');
        const data = await response.json();
        if (current && version === sequence) setResult({ workspaceId: customer.id, data });
      } catch {
        if (current && version === sequence) setResult({ workspaceId: customer.id, data: { state: 'unavailable' } });
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { current = false; controller?.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [customer.id, request, revision]);
  const data = result?.workspaceId === customer.id ? result.data : null;
  const view = messagingUsageView(data);
  const format = (value: number) => value.toLocaleString('en-US');
  const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Africa/Lusaka', day: 'numeric', month: 'short', year: 'numeric' });
  const topUp = 'https://wa.me/260778621168?text=' + encodeURIComponent(`Hello ZedPing, I would like to purchase extra template messages. Workspace: ${customer.business_name || ''}. Plan: ${customer.subscription_plan || ''}. Please confirm the price and payment instructions.`);
  return <div style={{ padding: compact ? '0' : '0 22px 22px', fontSize: 16, lineHeight: 1.6 }}>
    {!data ? <p role="status">Loading messaging balance…</p> : view.balance ? <>
      <strong style={{ display: 'block', fontSize: compact ? 28 : 36 }}>{format(view.balance.remaining)} remaining</strong>
      <p>{format(view.balance.used)} used or reserved of {format(view.balance.limit)} template messages</p>
      <progress aria-label="Template message allowance used" max={100} value={view.balance.percent} style={{ width: '100%', height: 12 }} />
      <p>Current period: {date(view.balance.periodStart)} – {date(view.balance.periodEnd)}<br />Renewal due: {date(view.balance.periodEnd)}</p>
      {view.warning && <p role="status"><strong>{view.warning}</strong></p>}
      {!compact && <p>Usage is reserved before submission. This balance is not a count of confirmed deliveries. Broadcasts and automated template notifications share this allowance.</p>}
    </> : <p role="status">{view.message}</p>}
    <a className="btn btn-wire" href={topUp} target="_blank" rel="noreferrer">Request extra messages</a>
    <button type="button" className="btn btn-wire" onClick={() => setRevision(value => value + 1)} style={{ margin: '8px 0 8px 8px' }}>Refresh balance</button>
    <p style={{ marginTop: 12 }}>Top-ups are arranged through ZedPing. We confirm the price and add credit after verifying payment. Requesting a top-up does not charge you or add messages.</p>
  </div>;
}
