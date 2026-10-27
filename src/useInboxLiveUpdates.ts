import { useEffect, useRef } from 'react';
import { subscribeInboxActivity } from './lib/inboxActivity';

export function useInboxLiveUpdates(client:any,workspaceId:string,onEvent:any,onRefresh:any) {
  const handlers=useRef({onEvent,onRefresh});handlers.current={onEvent,onRefresh};
  useEffect(()=>{
    if(!workspaceId)return;
    let active=true,timer:any=null;const ids=new Set<string>();
    const flush=()=>{
      timer=null;
      if(!active || document.visibilityState==='hidden')return;
      const changed=[...ids];ids.clear();void handlers.current.onRefresh(changed);
    };
    const schedule=()=>{if(timer===null)timer=setTimeout(flush,250);};
    const cleanup=subscribeInboxActivity(client,workspaceId,(event:any)=>{
      if(!active)return;
      handlers.current.onEvent(event);
      if(event.conversationId)ids.add(event.conversationId);
      schedule();
    },schedule);
    const focus=()=>{if(document.visibilityState!=='hidden')schedule();};
    // Reconcile after network interruption or missed events without requiring Refresh.
    const fallback=setInterval(focus,15000);
    document.addEventListener('visibilitychange',focus);window.addEventListener('online',focus);
    return()=>{active=false;cleanup();clearInterval(fallback);if(timer!==null)clearTimeout(timer);document.removeEventListener('visibilitychange',focus);window.removeEventListener('online',focus);};
  },[client,workspaceId]);
}
