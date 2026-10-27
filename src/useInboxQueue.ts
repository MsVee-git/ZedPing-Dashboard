import { mergeInboxRows, sortInboxRows } from './lib/inboxActivity';
import { useCallback, useEffect, useRef, useState } from 'react';

export const INBOX_VIEWS = [['needs_attention','Needs Attention'],['zoe','AI handling'],['assigned_to_me','My conversations'],['unassigned_human','Unassigned'],['unread','Unread'],['resolved','Resolved'],['all','All']];

export function matchesInboxView(row,view,userId) {
  if(view==='needs_attention')return row.status==='needs_attention' && row.control_mode==='needs_attention';
  if(view==='zoe')return row.status==='open' && row.control_mode==='automation';
  if(view==='assigned_to_me')return row.assigned_user_id===userId && row.status!=='resolved' && ['needs_attention','human'].includes(row.control_mode);
  if(view==='unassigned_human')return !row.assigned_user_id && row.status==='needs_attention' && row.control_mode==='needs_attention';
  if(view==='unread')return row.unread_count>0;
  if(view==='resolved')return row.status==='resolved';
  return view==='all';
}

export function useInboxQueue(apiFetch, api, workspaceId, view, userId) {
  const [rows,setRows]=useState([]), [counts,setCounts]=useState(null), [members,setMembers]=useState([]);
  const [loading,setLoading]=useState(true), [error,setError]=useState(''), [nextOffset,setNextOffset]=useState(null);
  const rowsRef=useRef(rows); rowsRef.current=rows;
  const viewRef=useRef({view,userId});viewRef.current={view,userId};
  const generation=useRef(0), countGeneration=useRef(0), workspace=useRef(workspaceId);
  workspace.current=workspaceId;
  const refreshCounts=useCallback(async()=>{
    const version=++countGeneration.current;
    try {
      const response=await apiFetch(`${api}/conversations/counts`); const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Unable to load counts');
      if(version===countGeneration.current && workspace.current===workspaceId)setCounts(data);
    } catch { if(version===countGeneration.current && workspace.current===workspaceId)setCounts(null); }
  },[apiFetch,api,workspaceId]);
  const loadPage=useCallback(async(offset=0,append=false,background=false)=>{
    const version=++generation.current;if(!background)setLoading(true);setError('');
    try {
      const response=await apiFetch(`${api}/conversations?view=${view}&offset=${offset}`);const data=await response.json();
      if(!response.ok || !Array.isArray(data.conversations))throw new Error(data.error || 'Unable to load conversations');
      if(version!==generation.current || workspace.current!==workspaceId)return;
      const next = append || (background && data.next_offset!==null) ? mergeInboxRows(rowsRef.current,data.conversations).filter(row=>matchesInboxView(row,view,userId)) : sortInboxRows(data.conversations);
      rowsRef.current=next;setRows(next);
      setNextOffset(data.next_offset===null?null:next.length);
    } catch(error) { if(version===generation.current)setError(error.message); }
    finally { if(version===generation.current)setLoading(false); }
  },[apiFetch,api,workspaceId,view,userId]);
  useEffect(()=>{setRows([]);setNextOffset(null);loadPage();return()=>{generation.current++};},[loadPage]);
  useEffect(()=>{
    let current=true;setCounts(null);setMembers([]);refreshCounts();
    apiFetch(`${api}/conversations/members`).then(async response=>{
      const data=await response.json();if(current && response.ok)setMembers(Array.isArray(data)?data:[]);
    }).catch(()=>{});
    return()=>{current=false;countGeneration.current++};
  },[apiFetch,api,workspaceId,refreshCounts]);
  const selectView=useCallback(async()=>{
    const version=++generation.current;
    const selected=new Map();let offset=0,pages=0;
    do {
      const response=await apiFetch(`${api}/conversations?view=${view}&offset=${offset}`);
      const data=await response.json();
      if(!response.ok || !Array.isArray(data.conversations))throw new Error(data.error || 'Unable to select this view');
      if(version!==generation.current || workspace.current!==workspaceId)return [];
      for(const row of data.conversations)if(selected.size<200)selected.set(row.id,row);
      offset=data.next_offset;pages++;
    }while(offset!==null && selected.size<200 && pages<4);
    const selectedRows=[...selected.values()];setRows(selectedRows);setNextOffset(offset);setLoading(false);
    return selectedRows;
  },[apiFetch,api,workspaceId,view,userId]);
  const patchRow=useCallback(row=>{
    if(!row)return;
    const {view:currentView,userId:currentUser}=viewRef.current;
    // Partial activity events can update known rows; only joined API rows can add a new chat.
    const exists=rowsRef.current.some(item=>item.id===row.id);
    if(!exists && (!row.contacts || (rowsRef.current.length && sortInboxRows([...rowsRef.current,row])[0].id!==row.id)))return;
    const next=mergeInboxRows(rowsRef.current,[row]).filter(item=>matchesInboxView(item,currentView,currentUser));
    rowsRef.current=next;setRows(next);
    if(!exists && next.some(item=>item.id===row.id))setNextOffset(offset=>offset===null?null:offset+1);
    if(exists && !next.some(item=>item.id===row.id))setNextOffset(offset=>offset===null?null:Math.max(0,offset-1));
  },[]);
  const refresh=useCallback((background=false)=>Promise.all([loadPage(0,false,background),refreshCounts()]),[loadPage,refreshCounts]);
  return {rows,counts,members,loading,error,nextOffset,selectView,loadMore:()=>loadPage(nextOffset,true),refresh,refreshCounts,patchRow};
}
