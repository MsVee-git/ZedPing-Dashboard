// Synthetic, network-free acceptance fixture using the actual TeamInbox component.
import fs from 'node:fs';
import { build } from 'esbuild';
const source=fs.readFileSync('src/App.tsx','utf8');
const inbox=source.slice(source.indexOf('function TeamInbox('),source.indexOf('// ── AUTOMATIONS'));
const css=source.slice(source.indexOf('const css = `')+13,source.indexOf('`;',source.indexOf('const css = `')))
 .replace('${faceliftCss}',fs.readFileSync('src/facelift.css','utf8')).replace('${redesignCss}',fs.readFileSync('src/workspace.css','utf8'));
const fixture=`
import React,{useState,useEffect,useRef,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {useInboxQueue,INBOX_VIEWS} from './src/useInboxQueue';
import {useInboxScroll,useInboxComposer} from './src/useInboxScroll';
import {useInboxLiveUpdates} from './src/useInboxLiveUpdates';
import {useQueryState,useReplyDraft} from './src/usePageState';
import {ConversationHandlingStatus} from './src/ConversationHandlingStatus';
import {MarketingOptOutBadge} from './src/MarketingConsent';
import {InboxMessageBody} from './src/InboxMessageBody';
import {InboxCopilot} from './src/InboxCopilot';
import './src/index.css';import './src/teamInbox.css';
const API='https://synthetic.invalid';
window.fixtureListeners=[];
const supabase={channel(){const c={on(kind,filter,callback){window.fixtureListeners.push({filter,callback});return c},subscribe(callback){callback('SUBSCRIBED');return c}};return c},removeChannel(){window.fixtureListeners=[]}};
window.emitFixtureActivity=(table,row)=>window.fixtureListeners.filter(item=>item.filter.table===table).forEach(item=>item.callback({new:row}));
const customer={id:'synthetic',role:'owner'},user={id:'staff'};
const row=(id,name,mode='human',status='open')=>({id,status,control_mode:mode,assigned_user_id:'staff',updated_at:'2026-10-20',contacts:{name,phone_number:'+260970000000'},last_message:{message_body:'Can you send me the school fees information?'},unread_count:0,last_message_at:'2026-10-20T08:00:00Z'});
const threads={human:{conversation:row('human','School enquiries'),messages:[{id:'campaign',direction:'outbound',message_body:'[Earlier outbound message — background, not a quoted reply]\\nAdmissions are open for the new school term. Contact us to book a visit.',status:'sent'},...Array.from({length:20},(_,i)=>({id:'m'+i,direction:i%2?'outbound':'inbound',message_body:i%2?'We can help with that.':'Can you send the fees for Grade 3?',status:'delivered'})),{id:'quoted',direction:'inbound',message_body:'Yes, for the new school term please.',reply_to:{id:'campaign',message_body:'Admissions are open for the new school term.'}}]},auto:{conversation:row('auto','Product enquiry','automation'),messages:[{id:'a',direction:'inbound',message_body:'What products do you have?'}]}};
window.fixtureRequests=[];
window.receiveFixtureMessage=(id,text)=>{
 const t=threads[id],now=new Date().toISOString();
 const message={id:'incoming-'+now,conversation_id:id,customer_id:'synthetic',direction:'inbound',message_body:text,created_at:now,status:'received'};
 t.messages.push(message);Object.assign(t.conversation,{last_message_at:now,updated_at:now,unread_count:1,last_message:message});
 window.emitFixtureActivity('messages',message);
};
async function apiFetch(url,init={}){
 const u=new URL(url),parts=u.pathname.split('/'),data=init.body?JSON.parse(init.body):{};
 window.fixtureRequests.push({path:u.pathname,method:init.method||'GET',data});
 const response=value=>({ok:true,json:async()=>structuredClone(value)});
 if(u.pathname==='/inbox-copilot/access')return response({enabled:true,monthly_limit:100});
 if(u.pathname==='/inbox-copilot')return response({mode:'summary',overview:'Review these chats',reviewed:2,items:[{conversation_id:'human',name:'School enquiries',summary:'Needs school fees follow-up'}]});
 if(parts[2]==='counts')return response({all:2,unread:0,assigned_to_me:1,zoe:1,needs_attention:0,resolved:0,unassigned_human:0});
 if(parts[2]==='members')return response([{id:'staff',name:'Test teammate'}]);
 if(!parts[2])return response({conversations:Object.values(threads).map(t=>t.conversation).sort((a,b)=>Date.parse(b.last_message_at)-Date.parse(a.last_message_at)).filter(r=>u.searchParams.get('view')!=='zoe'||r.control_mode==='automation'),next_offset:null});
 if(parts[2]==='bulk')return response({results:data.items.map(item=>({id:item.id,outcome:'applied',conversation:threads[item.id].conversation}))});
 const t=threads[parts[2]];
 if(parts[3]==='reply'){t.messages.push({id:'sent',direction:'outbound',message_body:data.message,status:'sent'});Object.assign(t.conversation,{last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()});}
 if(parts[3]==='take')Object.assign(t.conversation,{control_mode:'human',status:'open'});
 if(parts[3]==='resolve')t.conversation.status='resolved';
 return response(t);
}
const Loader=()=> <p role="status">Loading…</p>,Empty=({msg})=><p>{msg}</p>,PageHead=()=> <h1>Team Inbox</h1>;
${inbox}
function Fixture(){const [id,setId]=useState('');return <><style>{${JSON.stringify(css)}}</style><main className="main workspace inbox-workspace" style={{marginLeft:0}}><header className="mob-bar" style={{color:'#fff',background:'#102e23'}}>☰　ZedPing　　Exit</header><div className="desk-bar">ZedPing · Team Inbox</div><div className="inbox-route" style={{flex:1}}><TeamInbox customer={customer} user={user} routeConversationId={id} onRouteOpen={setId}/></div></main></>}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
await build({stdin:{contents:fixture,loader:'tsx',resolveDir:process.cwd()},bundle:true,outfile:'dist/inbox-fixture/app.js',jsx:'automatic',format:'iife',tsconfigRaw:{},loader:{'.css':'css'}});
