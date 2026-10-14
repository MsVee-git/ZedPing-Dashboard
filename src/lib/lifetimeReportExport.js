export function csvCell(value) {
  if (value === null || value === undefined) return '"Not available"';
  let text = String(value);
  // Excel treats a quoted cell beginning with these characters as a formula.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function summaryRows(report) {
  const rows = [['Metric','Value','Definition'],['Workspace',report.workspace_id,'Selected authorized business'],['Report generated UTC',report.generated_at,'Inclusive creation cutoff'],
    ['Scope',report.scope,'Lifetime or selected period'],['Period start UTC',report.period?.start_inclusive,'Inclusive; blank for lifetime'],['Period end UTC',report.period?.end_exclusive,'Exclusive; blank for lifetime'],
    ['Recorded messages',report.messages.total,'Retained messages within selected bounds and creation cutoff'],
    ['Inbound messages',report.messages.inbound,'Recorded inbound direction'],
    ['Outbound messages',report.messages.outbound,'Recorded outbound direction; not necessarily delivered'],
    ['Other/missing direction',report.messages.other_direction,'Not classified as inbound or outbound'],
    ['Recorded correspondents',report.messages.recorded_correspondents,'Normalized phone; contact ID fallback'],
    ['Current contacts',report.current.contacts,'Current record count'],
    ['Current conversations',report.current.conversations,'Current record count; not resolved count'],
    ['Current automations',report.current.automations,'Current record count; not executions'],
    ['Recorded broadcasts',report.broadcasts.total,'Includes scheduled and unfinished records'],
    ['First recorded message UTC',report.messages.first_recorded_at,'Retained history start'],
    ['Last recorded message UTC',report.messages.last_recorded_at,'Retained history end']];
  if(report.delivery){
    for(const [key,label] of [['delivered','Delivered (includes read)'],['read','Read'],['failed','Provider failed'],['sent_pending','Sent awaiting outcome'],['accepted_pending','Accepted awaiting receipt'],['unconfirmed','Unconfirmed legacy messages'],['submission_failures','Recorded submission failures']])
      rows.push([label,report.delivery[key],'Latest saved evidence for selected messages; Read is included in Delivered']);
    rows.push(['First provider receipt UTC',report.delivery.first_receipt_at,'Saved receipt coverage'],['Last provider receipt UTC',report.delivery.last_receipt_at,'Saved receipt coverage']);
    for(const [reason,count] of Object.entries(report.delivery.failure_reasons))rows.push(['Provider failure: '+reason,count,'Failure receipt without successful delivery/read evidence; a message may have multiple reasons']);
  }
  for (const [status,count] of Object.entries(report.messages.outbound_statuses)) rows.push(['Outbound status: '+status,count,'Stored latest status; not an inferred rate']);
  for (const [status,count] of Object.entries(report.broadcasts.statuses)) rows.push(['Broadcast status: '+status,count,'Current recorded status']);
  for (const metric of report.unavailable) rows.push([metric,null,'Not established by these records']);
  for (const definition of report.definitions) rows.push(['Definition','',definition]);
  return rows;
}
export function campaignRows(report) {
  return [['Workspace','Report generated UTC','Period start UTC','Period end UTC','Campaign ID','Name','Status','Created UTC','Scheduled UTC','Completed UTC','Recorded accepted','Recorded failed','Audience entries','Linked message records','Delivered (includes read)','Read','Provider failed','Sent awaiting outcome','Accepted awaiting receipt','Unconfirmed','Recorded submission failures','Provider failure reasons'],
    ...report.broadcasts.campaigns.map(c => [report.workspace_id,report.generated_at,report.period?.start_inclusive,report.period?.end_exclusive,c.id,c.name,c.status,c.created_at,c.scheduled_at,c.completed_at,c.accepted,c.failed,c.recorded_recipients,c.delivery?.linked_messages,c.delivery?.delivered,c.delivery?.read,c.delivery?.failed,c.delivery?.sent_pending,c.delivery?.accepted_pending,c.delivery?.unconfirmed,c.delivery?.submission_failures,c.delivery ? JSON.stringify(c.delivery.failure_reasons) : null])];
}
