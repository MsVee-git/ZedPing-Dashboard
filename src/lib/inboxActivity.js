const activityTime = row => Math.max(...['last_message_at','last_inbound_at','last_outbound_at'].map(key => Date.parse(row[key] || '') || 0));
export function sortInboxRows(rows) {
  return [...rows].sort((a,b) => activityTime(b)-activityTime(a) || String(b.id).localeCompare(String(a.id)));
}
export function mergeInboxRows(rows, updates) {
  const byId = new Map(rows.map(row => [row.id,row]));
  for(const update of updates) {
    const old = byId.get(update.id);
    if(old && Date.parse(old.updated_at||'') > Date.parse(update.updated_at||''))continue;
    byId.set(update.id,{...old,...update});
  }
  return sortInboxRows([...byId.values()]);
}
export function subscribeInboxActivity(client,workspaceId,onActivity,onReady) {
  const receive = table => payload => {
    const row=payload.new;
    if(!row || row.customer_id!==workspaceId)return;
    onActivity(table==='conversations' ? {conversationId:row.id,conversation:row} : {conversationId:row.conversation_id,message:row});
  };
  const channel=client.channel(`inbox-activity:${workspaceId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:`customer_id=eq.${workspaceId}`},receive('conversations'))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`customer_id=eq.${workspaceId}`},receive('messages'))
    .subscribe(status=>{if(status==='SUBSCRIBED')onReady();});
  return ()=>{void client.removeChannel(channel);};
}
