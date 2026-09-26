import { useCallback, useEffect, useRef, useState } from 'react';

export const INBOX_VIEWS = [['needs_attention','Needs Attention'],['zoe','Zoe Handling'],['assigned_to_me','My Conversations'],['unassigned_human','Unassigned'],['unread','Unread'],['resolved','Resolved'],['all','All']];

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
  const loadPage=useCallback(async(offset=0,append=false)=>{
    const version=++generation.current;setLoading(true);setError('');
    try {
      const response=await apiFetch(`${api}/conversations?view=${view}&offset=${offset}`);const data=await response.json();
      if(!response.ok || !Array.isArray(data.conversations))throw new Error(data.error || 'Unable to load conversations');
      if(version!==generation.current || workspace.current!==workspaceId)return;
      setRows(old=>append?[...new Map([...old,...data.conversations].map(row=>[row.id,row])).values()]:data.conversations);
      setNextOffset(data.next_offset);
    } catch(error) { if(version===generation.current)setError(error.message); }
    finally { if(version===generation.current)setLoading(false); }
  },[apiFetch,api,workspaceId,view]);
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
  },[apiFetch,api,workspaceId,view]);
  const patchRow=useCallback(row=>{
    if(!row)return;
    const {view:currentView,userId:currentUser}=viewRef.current;
    const removed=rowsRef.current.some(item=>item.id===row.id)&&!matchesInboxView(row,currentView,currentUser);
    setRows(old=>old.map(item=>item.id===row.id?{...item,...row}:item).filter(item=>matchesInboxView(item,currentView,currentUser)));
    if(removed)setNextOffset(offset=>offset===null?null:Math.max(0,offset-1));
  },[]);
  const refresh=useCallback(()=>Promise.all([loadPage(),refreshCounts()]),[loadPage,refreshCounts]);
  return {rows,counts,members,loading,error,nextOffset,selectView,loadMore:()=>loadPage(nextOffset,true),refresh,refreshCounts,patchRow};
}
