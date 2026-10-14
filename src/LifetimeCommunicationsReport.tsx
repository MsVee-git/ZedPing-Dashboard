import { useState } from 'react';
import { PageTitle, ResourceState, Surface, useResource } from './WorkspaceUI';
import { csv, summaryRows, campaignRows } from './lib/lifetimeReportExport';

export function LifetimeCommunicationsReport({customer,request}:any) {
  const [mode,setMode] = useState('lifetime');
  const [start,setStart] = useState('');
  const [end,setEnd] = useState('');
  const [path,setPath] = useState('/reports/lifetime');
  const [periodError,setPeriodError] = useState('');
  function applyPeriod() {
    if(mode === 'lifetime') { setPath('/reports/lifetime'); setPeriodError(''); return; }
    if(!start || !end || start > end) { setPeriodError('Choose a start date and an end date on or after it.'); return; }
    const from = new Date(start+'T00:00:00');
    const until = new Date(end+'T00:00:00'); until.setDate(until.getDate()+1);
    setPath('/reports/lifetime?start='+encodeURIComponent(from.toISOString())+'&end='+encodeURIComponent(until.toISOString()));
    setPeriodError('');
  }
  const resource = useResource(request, path, customer.id);
  const [downloadError,setDownloadError] = useState('');
  const report = resource.data;
  function download(kind:string) {
    if (!report || report.workspace_id !== customer.id) return;
    setDownloadError('');
    try {
      const json = kind === 'json';
      const blob = new Blob([json ? JSON.stringify(report,null,2) : csv(kind === 'campaigns' ? campaignRows(report) : summaryRows(report))],
        {type:json?'application/json;charset=utf-8':'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download='zedping-'+report.scope+'-'+customer.id+'-'+report.generated_at.slice(0,10)+'-'+kind+(json?'.json':'.csv');
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch { setDownloadError('The export could not be saved. Please try again.'); }
  }
  const number = (x:any) => typeof x === 'number' ? x.toLocaleString() : 'Not available';
  return <div className="pad">
    <PageTitle title="Communications report" description="Choose all retained history or a reporting period for this business." action={<button className="btn btn-wire" disabled={resource.loading} onClick={resource.retry}>Refresh report</button>}/>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20,alignItems:'end'}}>
      <label>Period <select value={mode} onChange={e=>setMode(e.target.value)}><option value="lifetime">All time</option><option value="period">Custom dates</option></select></label>
      {mode==='period'&&<><label>Start date <input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End date <input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></>}
      <button className="btn btn-gold" onClick={applyPeriod}>Apply period</button>
    </div>
    <p className="report-note">Dates include the whole selected day in your browser’s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Contact, conversation and automation counts always show current records.</p>
    {periodError&&<p role="alert">{periodError}</p>}
    <ResourceState resource={resource}>
      {report && <><p className="report-note">{report.scope==='period' ? 'Selected period: '+new Date(report.period.start_inclusive).toLocaleDateString()+' through '+new Date(new Date(report.period.end_exclusive).getTime()-1).toLocaleDateString()+'. ' : 'All time. '}Report through {new Date(report.generated_at).toLocaleString()} (your local time). Exports include the UTC cutoff.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
        <button className="btn btn-gold" onClick={()=>download('summary')}>Export summary CSV</button>
        <button className="btn btn-wire" onClick={()=>download('campaigns')}>Export campaigns CSV</button>
        <button className="btn btn-wire" onClick={()=>download('json')}>Export full report JSON</button>
      </div>
      {downloadError&&<p role="alert">{downloadError}</p>}
      <div className="metric-grid">{[
        ['Recorded messages',report.messages.total],['Inbound',report.messages.inbound],['Outbound',report.messages.outbound],
        ['Recorded correspondents',report.messages.recorded_correspondents],['Recorded broadcasts',report.broadcasts.total],
        ['Current contacts',report.current.contacts],['Current conversations',report.current.conversations],['Current automations',report.current.automations]
      ].map(([label,value])=><div className="metric" key={String(label)}><strong>{number(value)}</strong><span>{label}</span></div>)}</div>
      <Surface title="Recorded outbound statuses">
        <p className="surface-message">Accepted or sent does not prove delivery. These are stored statuses, not delivery or read rates.</p>
        <div className="table-scroll"><table className="work-table"><thead><tr><th>Status</th><th>Messages</th></tr></thead><tbody>
          {Object.entries(report.messages.outbound_statuses).map(([status,count])=><tr key={status}><td>{status}</td><td>{number(count)}</td></tr>)}
        </tbody></table></div>
        {!Object.keys(report.messages.outbound_statuses).length&&<p className="surface-message">No recorded outbound messages.</p>}
      </Surface>
      <Surface title="Broadcast history">
        <p className="surface-message">Showing {Math.min(100,report.broadcasts.campaigns.length)} of {report.broadcasts.campaigns.length} records. The CSV includes every report record. Accepted counts are already represented where messages were stored.</p>
        <div className="table-scroll"><table className="work-table"><thead><tr><th>Campaign</th><th>Status</th><th>Accepted</th><th>Failed</th><th>Audience entries</th></tr></thead><tbody>
          {report.broadcasts.campaigns.slice(0,100).map((c:any)=><tr key={c.id}><td>{c.name}</td><td>{c.status}</td><td>{number(c.accepted)}</td><td>{number(c.failed)}</td><td>{number(c.recorded_recipients)}</td></tr>)}
        </tbody></table></div>
      </Surface>
      <Surface title="Report definitions"><ul>{report.definitions.map((text:string)=><li key={text} style={{margin:'8px 24px'}}>{text}</li>)}</ul><p className="surface-message">Not available: {report.unavailable.join('; ')}.</p></Surface>
      </>}
    </ResourceState>
  </div>;
}
