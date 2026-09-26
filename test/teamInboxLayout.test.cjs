const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
let chromium;try{({chromium}=require('playwright'))}catch{}
const esbuild=createRequire(require.resolve('vite'))('esbuild'),root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const css=app.slice(app.indexOf('const css = `')+13,app.indexOf('`;',app.indexOf('const css = `'))).replace('${faceliftCss}',fs.readFileSync(path.join(root,'src/facelift.css'),'utf8'));
const inbox=app.slice(app.indexOf('function TeamInbox('),app.indexOf('// ── AUTOMATIONS'));
const pageHead=app.slice(app.indexOf('function PageHead('),app.indexOf('\n}',app.indexOf('function PageHead('))+2);
const topbars=app.slice(app.indexOf('function Topbar('),app.indexOf('// ── PAGE HEADER'));
const shell=app.slice(app.lastIndexOf('  return ('),app.lastIndexOf('\n}'));
const fixture=`
import React,{useState,useRef,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useInboxQueue,INBOX_VIEWS,matchesInboxView} from './src/useInboxQueue';
import {useInboxScroll,useInboxComposer} from './src/useInboxScroll';
import {ConversationHandlingStatus} from './src/ConversationHandlingStatus';
import {MarketingOptOutBadge} from './src/MarketingConsent';
const API='https://synthetic.invalid',customer={id:'workspace',role:'owner'},user={id:'staff'};
const make=(id,count,mode='automation',status='open',assignee=null,unread=0)=>({conversation:{id,customer_id:'workspace',updated_at:'2026-09-25T10:00:00.000Z',status,control_mode:mode,assigned_user_id:assignee,unread_count:unread,contacts:{name:id,phone_number:'+260970000000',marketing_opted_out:true}},messages:Array.from({length:count},(_,i)=>({id:id+i,direction:i%2?'outbound':'inbound',message_body:'Synthetic message '+i+' Context for this customer question.',status:'received'}))});
const threads={Long:make('Long',100),Short:make('Short',2),Waiting:make('Waiting',8,'needs_attention','needs_attention',null,3),Human:make('Human',8,'human','open','staff'),Other:make('Other',8,'human','open','other'),Resolved:make('Resolved',8,'human','resolved','other')};
window.fixtureRequests=[];
window.fixtureAddMany=()=>{for(let i=0;i<230;i++)threads["Queue"+i]=make("Queue"+i,1,"needs_attention","needs_attention");};
async function apiFetch(url,options){
 window.fixtureRequests.push({url,method:options?.method||'GET',body:options?.body?JSON.parse(options.body):null});
 const u=new URL(url),parts=u.pathname.split('/'),data=options?.body?JSON.parse(options.body):{},t=threads[parts[2]];
 const response=value=>({ok:true,json:async()=>structuredClone(value)});
 if(parts[2]==='members')return response([{id:'staff',name:'Staff',role:'owner'},{id:'other',name:'Other staff',role:'member'}]);
 if(parts[2]==='counts')return response(Object.fromEntries(INBOX_VIEWS.map(([view])=>[view,Object.values(threads).filter(t=>matchesInboxView(t.conversation,view,user.id)).length])));
 if(!parts[2]){const offset=Number(u.searchParams.get('offset')||0),rows=Object.values(threads).map(t=>t.conversation).filter(c=>matchesInboxView(c,u.searchParams.get('view')||'all',user.id));return response({conversations:rows.slice(offset,offset+50),next_offset:rows.length>offset+50?offset+50:null});}
 if(options?.method)await new Promise(resolve=>setTimeout(resolve,40));
 if(parts[2]==='bulk')return response({results:data.items.map(item=>{const row=threads[item.id].conversation;
   if(row.control_mode==='automation')return {id:item.id,outcome:'skipped',reason:'Zoe handling is unchanged.'};
   if(data.action==='assign'||data.action==='assign_me')row.assigned_user_id=data.action==='assign_me'?'staff':data.assigned_user_id;
   if(data.action==='resolve')Object.assign(row,{status:'resolved',control_mode:'human',unread_count:0});
   if(data.action==='reopen')Object.assign(row,{status:'open',control_mode:'human',assigned_user_id:'staff'});
   return {id:item.id,outcome:'applied',conversation:row};
 })});
 if(parts[3]==='take')Object.assign(t.conversation,{status:'open',control_mode:'human',assigned_user_id:'staff'});
 if(parts[3]==='read')t.conversation.unread_count=0;
 if(parts[3]==='resolve')Object.assign(t.conversation,{status:'resolved',control_mode:'human'});
 if(parts[3]==='reopen')Object.assign(t.conversation,{status:'open',control_mode:'human',assigned_user_id:'staff'});
 if(parts[3]==='reply')t.messages.push({id:'reply'+t.messages.length,direction:'outbound',message_body:data.message,status:'sent'});
 return response(t);
}
const Logo=()=> <span>ZedPing</span>,Ic=()=> <span/>,Sidebar=()=> <aside className="sidebar">Synthetic navigation</aside>,Loader=()=> <p>Loading</p>,Empty=({msg})=><p>{msg}</p>;
${topbars}
${pageHead}
${inbox}
function Fixture(){
 const [role,setRole]=useState('owner');window.fixtureRole=setRole;customer.role=role;
 const css=${JSON.stringify(css)},active='messages',navigate=()=>{},onLogout=()=>{},open=false,setOpen=()=>{},workspaces=[customer],workspaceSwitchTarget=null,onWorkspaceChange=()=>{},workspaceChanging=false;
 const cur={title:'Team Inbox',comp:<TeamInbox customer={customer} user={user}/>};
 ${shell}
}
function ScrollProbe(){
 const [messages,setMessages]=useState(Array.from({length:30},(_,i)=>i));const {historyRef,onHistoryScroll}=useInboxScroll('probe',messages,false);
 window.appendProbe=()=>setMessages(old=>[...old,old.length]);
 return <div ref={historyRef} onScroll={onHistoryScroll} id="probe" style={{height:200,overflowY:'auto'}}>{messages.map(i=><div key={i} style={{height:50}}>{i}</div>)}</div>;
}
window.mountProbe=()=>createRoot(document.getElementById('root')).render(<ScrollProbe/>);
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
async function setup(){
 const bundle=await esbuild.build({stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',tsconfigRaw:{},plugins:[{name:'fixture-resolution',setup(build){
  build.onResolve({filter:/.*/},args=>{if(args.path.startsWith('.')){const target=path.resolve(args.resolveDir,args.path);for(const ext of ['','.tsx','.ts','.js'])if(fs.existsSync(target+ext)&&fs.statSync(target+ext).isFile())return {path:target+ext};}return {path:require.resolve(args.path,{paths:[args.resolveDir,root]})};});
 }}]});
 const browser=await chromium.launch({headless:true,...(process.env.INBOX_CHROME_PATH?{executablePath:process.env.INBOX_CHROME_PATH}:{})}),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
 const mount=async(width=1366,height=768)=>{await page.setViewportSize({width,height});await page.setContent('<style>'+fs.readFileSync(path.join(root,'src/index.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/teamInbox.css'),'utf8')+'</style><div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:'All (6)',exact:true}).waitFor();};
 return {browser,page,errors,mount};
}
const options={skip:!chromium&&'Playwright required for geometry verification'};
test('production shell: state-aware controls, compact composer, independent scrolling and mobile geometry',options,async()=>{
 const {browser,page,errors,mount}=await setup();
 try{
 for(const [width,height] of [[1440,900],[1366,768],[1366,650],[1280,600],[1024,768],[390,844]]){
  await mount(width,height);await page.locator('.inbox-open').filter({has:page.getByText('Long',{exact:true})}).click();await page.locator('.inbox-control').waitFor();
  assert.equal(await page.locator('.inbox-composer textarea').count(),0);
  const before=await page.evaluate(()=>{const h=document.querySelector('.inbox-history'),g=document.querySelector('.team-inbox').getBoundingClientRect(),c=document.querySelector('.inbox-control').getBoundingClientRect(),bounds=h.getBoundingClientRect();return {height:h.clientHeight,card:h.parentElement.clientHeight,control:c.height,bottom:c.bottom,gridBottom:g.bottom,gridHeight:g.height,gridTop:g.top,page:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,visible:[...h.children].filter(e=>{const r=e.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom}).length,latest:h.scrollHeight-h.scrollTop-h.clientHeight<3};});
  assert.ok(before.latest);assert.ok(before.height>before.control*2);assert.ok(before.visible>=3,JSON.stringify({width,height,before}));assert.ok(before.width<=width);
  if(width>768){assert.ok(before.bottom<=height);assert.ok(before.page<=height+2);assert.ok(before.gridHeight>(height-before.gridTop)*.95);assert.ok(Math.abs(before.card-before.gridHeight)<3);}
  const box=await page.locator('.inbox-control').boundingBox();await page.locator('.inbox-history').evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'))});assert.deepEqual(await page.locator('.inbox-control').boundingBox(),box);
  await page.locator('.inbox-details').evaluate(e=>e.style.paddingBottom='800px');assert.deepEqual(await page.locator('.inbox-control').boundingBox(),box);await page.locator('.inbox-details').evaluate(e=>e.style.paddingBottom='');
  await page.getByRole('button',{name:'Take Conversation',exact:true}).click();assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.url.endsWith('/take')).length),0);
  await page.getByRole('button',{name:'Confirm action'}).click();await page.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
  const textarea=page.getByRole('textbox',{name:'Reply',exact:true});assert.ok((await textarea.boundingBox()).height<=60);
  await textarea.fill('Long draft\n'.repeat(20));assert.ok(await textarea.evaluate(e=>e.clientHeight<=120&&e.scrollHeight>e.clientHeight));
  if(width>768)assert.ok((await page.locator('.inbox-composer').boundingBox()).y+(await page.locator('.inbox-composer').boundingBox()).height<=height);
  await textarea.fill('Synthetic reply');await page.getByRole('button',{name:'Send reply',exact:true}).click();await page.locator('.inbox-history').getByText('Synthetic reply',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Resolve Conversation',exact:true}).click();await page.getByRole('button',{name:'Reopen Conversation',exact:true}).waitFor();assert.equal(await textarea.count(),0);
  await page.locator('.inbox-open').filter({has:page.getByText('Short',{exact:true})}).click();await page.locator('.inbox-control').waitFor();assert.equal(await page.locator('.inbox-history').evaluate(e=>e.clientHeight),before.height);
  if(width===1366&&height===650&&process.env.INBOX_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.INBOX_SCREENSHOT_DIR,'inbox-triage-compact-controls.png')});
 }
 await page.setContent('<div id="root"></div>');await page.evaluate(()=>window.mountProbe());await page.locator('#probe').waitFor();await page.evaluate(()=>window.appendProbe());await page.waitForFunction(()=>{const e=document.querySelector('#probe');return e.children.length===31&&e.scrollHeight-e.scrollTop-e.clientHeight<3});await page.locator('#probe').evaluate(e=>{e.scrollTop=150;e.dispatchEvent(new Event('scroll'))});await page.evaluate(()=>window.appendProbe());await page.waitForFunction(()=>document.querySelector('#probe').children.length===32);assert.equal(await page.locator('#probe').evaluate(e=>e.scrollTop),150);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('triage views, filtered selection, confirmations, request counts and permission-aware composer',options,async()=>{
 const {browser,page,errors,mount}=await setup();try{
 await mount();assert.equal(await page.evaluate(()=>window.fixtureRequests.length),3,'one list, counts and members request');
 for(const [label,names] of [['Needs Attention (1)',['Waiting']],['Zoe Handling (2)',['Long','Short']],['My Conversations (1)',['Human']],['Unassigned (1)',['Waiting']],['Unread (1)',['Waiting']],['Resolved (1)',['Resolved']],['All (6)',['Long','Short','Waiting','Human','Other','Resolved']]]){
  await page.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.inbox-open').length===n,names.length);assert.deepEqual(await page.locator('.inbox-open strong').allTextContents(),names);
 }
 assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.url.endsWith('/members')).length),1);
 assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.url.endsWith('/counts')).length),1);
 await page.getByRole('button',{name:'Needs Attention (1)',exact:true}).click();await page.getByRole('checkbox',{name:'Select Waiting',exact:true}).waitFor();
 await page.getByRole('button',{name:'Select loaded (max 200)',exact:true}).click();await page.getByText('1 selected',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.url.endsWith('/Waiting')).length),0,'selection must not open/read a chat');
 await page.getByRole('combobox',{name:'Bulk assignee'}).selectOption('other');await page.getByRole('button',{name:'Assign to member',exact:true}).click();
 await page.getByRole('button',{name:'Confirm action'}).evaluate(e=>{e.click();e.click()});await page.getByRole('button',{name:'Close results'}).waitFor();assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.url.endsWith('/bulk')).length),1);
 await page.getByRole('button',{name:'Close results'}).click();await page.locator('.inbox-open').filter({has:page.getByText('Waiting',{exact:true})}).click();await page.locator('.inbox-control').waitFor();assert.equal(await page.getByRole('textbox',{name:'Reply',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Take Conversation',exact:true}).count(),0,'cannot take another assignee');
 await page.getByRole('button',{name:'All (6)',exact:true}).click();await page.getByRole('checkbox',{name:'Select Long',exact:true}).check();await page.getByRole('checkbox',{name:'Select Human',exact:true}).check();await page.getByRole('button',{name:'Resolve selected',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.url.endsWith('/bulk')).length),1,'resolve waits for confirmation');await page.getByRole('button',{name:'Confirm action'}).click();await page.getByText('1 applied · 1 not changed',{exact:true}).waitFor();await page.getByRole('button',{name:'Close results'}).click();
 await page.evaluate(()=>window.fixtureRole('member'));await page.locator('.inbox-open').filter({has:page.getByText('Other',{exact:true})}).click();await page.locator('.inbox-control').waitFor();assert.equal(await page.getByRole('textbox',{name:'Reply',exact:true}).count(),0);await page.getByRole('button',{name:'Manage Other',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Bulk assignee'}).count(),0);
 await page.getByRole('button',{name:'Clear selection'}).click();assert.equal(await page.getByRole('group',{name:'Selected conversation actions'}).count(),0);
 await page.evaluate(()=>window.fixtureRole('owner'));
 await page.getByRole('button',{name:'Manage Waiting',exact:true}).click();await page.getByRole('button',{name:'Assign to me',exact:true}).click();await page.getByRole('button',{name:'Confirm action'}).click();await page.getByRole('button',{name:'Close results'}).click();
 await page.locator('.inbox-open').filter({has:page.getByText('Waiting',{exact:true})}).click();await page.getByRole('button',{name:'Take Conversation',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Reply',exact:true}).count(),0,'assign-to-me does not take control');
 await page.getByRole('button',{name:'Take Conversation',exact:true}).click();await page.getByRole('textbox',{name:'Reply',exact:true}).waitFor();
 await page.getByRole('button',{name:'Manage Resolved',exact:true}).click();await page.getByRole('button',{name:'Reopen selected',exact:true}).click();await page.getByRole('button',{name:'Confirm action'}).click();await page.getByRole('button',{name:'Close results'}).click();
 await page.locator('.inbox-open').filter({has:page.locator('strong').filter({hasText:/^Resolved$/})}).click();await page.getByRole('textbox',{name:'Reply',exact:true}).waitFor();assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('select this view is bounded to 200 matching conversations across pages without opening them',options,async()=>{
 const {browser,page,errors,mount}=await setup();try{
 await mount();await page.evaluate(()=>window.fixtureAddMany());await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('button',{name:'Needs Attention (231)',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.inbox-open').length===50);
 await page.getByRole('button',{name:'Select this view (max 200)',exact:true}).click();await page.getByText('200 selected',{exact:true}).waitFor();
 assert.equal(await page.getByRole('checkbox',{checked:true}).count(),200);assert.equal(await page.locator('.inbox-open').count(),200);
 assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.method!=='GET').length),0);
 assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>/conversations\/(Long|Short|Waiting|Queue)/.test(r.url)).length),0);
 await page.getByRole('button',{name:'Clear selection'}).click();assert.equal(await page.getByRole('checkbox',{checked:true}).count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
