import { useCallback, useEffect, useState } from 'react';

export function readDraft(key:string) {
  try { return JSON.parse(sessionStorage.getItem(key)||'null'); } catch { return null; }
}
export function writeDraft(key:string,value:unknown) {
  try { sessionStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; }
}

// Filters are URL-addressable, so refresh and browser Back restore them.
export function useQueryState(key:string, fallback:string) {
  const read=()=>new URLSearchParams(window.location.search).get(key) || fallback;
  const [value,setValue]=useState(read);
  useEffect(()=>{const restore=()=>setValue(read());window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[key,fallback]);
  const update=useCallback((next:string)=>{
    const url=new URL(window.location.href);
    if(next===fallback||!next)url.searchParams.delete(key);else url.searchParams.set(key,next);
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);setValue(next);
  },[key,fallback]);
  return [value,update] as const;
}

// Store text drafts only in this browser tab, partitioned by user/workspace/resource.
export function useReplyDraft(workspaceId:string,userId:string,conversationId:string) {
  const key=['zedping.reply.v1',workspaceId,userId,conversationId].map(encodeURIComponent).join(':');
  const [draft,setDraft]=useState({key,text:''});
  useEffect(()=>{let text='';try{text=conversationId?sessionStorage.getItem(key)||'':'';}catch{}setDraft({key,text});},[key,conversationId]);
  const update=useCallback((text:string)=>{
    setDraft({key,text});
    if(!conversationId)return;
    try{if(text)sessionStorage.setItem(key,text);else sessionStorage.removeItem(key);}catch{}
  },[key,conversationId]);
  return [draft.key===key?draft.text:'',update] as const;
}
