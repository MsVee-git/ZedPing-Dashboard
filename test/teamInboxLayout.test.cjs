const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
let chromium
try { ({ chromium } = require('playwright')) } catch { /* Optional local browser verification dependency. */ }
const esbuild = createRequire(require.resolve('vite'))('esbuild')
const root = path.join(__dirname, '..')
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
const css = app.slice(app.indexOf('const css = `') + 13, app.indexOf('`;', app.indexOf('const css = `'))).replace('${faceliftCss}',fs.readFileSync(path.join(root,'src/facelift.css'),'utf8'))
const topbars=app.slice(app.indexOf('function Topbar('),app.indexOf('// ── PAGE HEADER'))
const shell=app.slice(app.lastIndexOf('  return ('),app.lastIndexOf('\n}'))
const inbox = app.slice(app.indexOf('function TeamInbox('), app.indexOf('// ── AUTOMATIONS'))
const pageHead = app.slice(app.indexOf('function PageHead('), app.indexOf('\n}', app.indexOf('function PageHead(')) + 2)
const fixture = `
import React, {useState,useRef,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useInboxScroll,useInboxComposer} from './src/useInboxScroll';
import {ConversationHandlingStatus} from './src/ConversationHandlingStatus';
import {MarketingOptOutBadge} from './src/MarketingConsent';
const API='https://synthetic.invalid';
const customer={id:'workspace',role:'owner'},user={id:'staff'};
const make=(id,count)=>({conversation:{id,status:'open',control_mode:'automation',contacts:{name:id,phone_number:'+260970000000',marketing_opted_out:true}},messages:Array.from({length:count},(_,i)=>({id:id+i,direction:i%2?'outbound':'inbound',message_body:'Synthetic message '+i+' '+(i===2?'longword'.repeat(90):'Context for this customer question.'),status:'received'}))});
const threads={Long:make('Long',100),Short:make('Short',2)};
function useAPI(endpoint){return {data:endpoint.includes('members')?[{id:'staff',name:'Staff',role:'owner'}]:Object.values(threads).map(t=>t.conversation),loading:false,error:null,refetch:async()=>{}};}
async function apiFetch(url,options){
 window.fixtureRequests.push({url,method:options?.method||'GET'});
 const parts=new URL(url).pathname.split('/'), t=threads[parts[2]];
 if(parts[3]==='handoff')Object.assign(t.conversation,{status:'needs_attention',control_mode:'needs_attention'});
 if(parts[3]==='take')Object.assign(t.conversation,{status:'open',control_mode:'human',assigned_user_id:'staff'});
 if(parts[3]==='resolve')Object.assign(t.conversation,{status:'resolved',control_mode:'human'});
 if(parts[3]==='reply')t.messages.push({id:'new',direction:'outbound',message_body:JSON.parse(options.body).message,status:'sent'});
 return {ok:true,json:async()=>structuredClone(t||{})};
}
const Loader=()=> <p>Loading</p>, Empty=({msg})=><p>{msg}</p>;
const Logo=()=> <span>ZedPing</span>, Ic=()=> <span/>;
const Sidebar=()=> <aside className="sidebar">Synthetic navigation</aside>;
${topbars}
${pageHead}
${inbox}
window.fixtureRequests=[];
function ScrollProbe(){
 const [messages,setMessages]=useState(Array.from({length:30},(_,i)=>i));
 const {historyRef,onHistoryScroll}=useInboxScroll('probe',messages,false);
 window.appendProbe=()=>setMessages(old=>[...old,old.length]);
 return <div ref={historyRef} onScroll={onHistoryScroll} id="probe" style={{height:200,overflowY:'auto'}}>{messages.map(i=><div key={i} style={{height:50}}>{i}</div>)}</div>;
}
window.mountProbe=()=>createRoot(document.getElementById('root')).render(<ScrollProbe/>);
function Fixture(){
 const css=${JSON.stringify(css)},active='messages',navigate=()=>{},onLogout=()=>{},open=false,setOpen=()=>{},workspaces=[customer],workspaceSwitchTarget=null,onWorkspaceChange=()=>{},workspaceChanging=false;
 const cur={title:'Team Inbox',comp:<TeamInbox customer={customer} user={user}/>};
 ${shell}
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`

test('real Inbox layout keeps long/short histories, composer and actions usable without production requests', { skip: !chromium && 'Playwright is required for browser layout verification' }, async () => {
  const bundle = await esbuild.build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfigRaw: {}, plugins: [{ name: 'fixture-resolution', setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if (args.path.startsWith('.')) {
        const target = path.resolve(args.resolveDir, args.path)
        for (const extension of ['', '.tsx', '.ts', '.js']) if (fs.existsSync(target + extension) && fs.statSync(target + extension).isFile()) return { path: target + extension }
      }
      return { path: require.resolve(args.path, { paths: [args.resolveDir, root] }) }
    })
  } }] })
  const browser = await chromium.launch({ headless: true, ...(process.env.INBOX_CHROME_PATH ? { executablePath: process.env.INBOX_CHROME_PATH } : {}) })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.abort())
  try {
    for (const [width,height] of [[1440,900],[1366,768],[1366,650],[1280,600],[1024,768]]) {
      await page.setViewportSize({width,height})
      await page.setContent(`<style>${fs.readFileSync(path.join(root,'src/index.css'),'utf8')}\n${fs.readFileSync(path.join(root,'src/teamInbox.css'),'utf8')}</style><div id="root"></div>`)
      await page.addScriptTag({content:bundle.outputFiles[0].text})
      await page.getByRole('button',{name:/Long/}).click()
      await page.locator('.inbox-composer').waitFor()
      const long = await page.evaluate(() => {
        const history=document.querySelector('.inbox-history'), form=document.querySelector('.inbox-composer');
        const bounds=history.getBoundingClientRect();
        const visible=[...history.children].filter(el=>{const r=el.getBoundingClientRect();return r.top>=bounds.top && r.bottom<=bounds.bottom}).length;
        const grid=document.querySelector('.team-inbox').getBoundingClientRect(), panel=history.parentElement.getBoundingClientRect();
        const route=document.querySelector('.inbox-route').getBoundingClientRect(),page=document.querySelector('.inbox-page'),style=getComputedStyle(page);
        return {gridTop:grid.top,gridHeight:grid.height,gridBottom:grid.bottom,cardHeight:panel.height,routeBottom:route.bottom,pagePadding:parseFloat(style.paddingBottom),composerHeight:form.getBoundingClientRect().height,historyHeight:history.clientHeight,panelHeight:history.parentElement.clientHeight,visible,textareaHeight:form.querySelector("textarea").clientHeight,bottom:form.getBoundingClientRect().bottom,viewport:innerHeight,scrollable:history.scrollHeight>history.clientHeight,atBottom:history.scrollHeight-history.scrollTop-history.clientHeight<3,pageHeight:document.documentElement.scrollHeight,pageWidth:document.documentElement.scrollWidth,width:innerWidth};
      })
      assert.ok(long.bottom<=height,`${width}x${height}: composer bottom ${long.bottom}`)
      assert.ok(long.visible>=3,`multiple full messages required: ${JSON.stringify(long)}`)
      assert.ok(long.historyHeight>=long.panelHeight*.5,`history must dominate: ${JSON.stringify(long)}`)
      if(height>=768 && width>=1280) assert.ok(long.historyHeight>=long.panelHeight*.65,`desktop history target: ${JSON.stringify(long)}`)
      assert.ok(long.textareaHeight>=50 && long.textareaHeight<=60)
      assert.ok(long.gridHeight >= (height-long.gridTop)*.95,`workspace must consume remaining viewport: ${JSON.stringify(long)}`)
      assert.ok(Math.abs(long.cardHeight-long.gridHeight)<2,`center must fill grid: ${JSON.stringify(long)}`)
      assert.ok(Math.abs(height-long.gridBottom-long.pagePadding)<2,`workspace bottom: ${JSON.stringify(long)}`)
      assert.ok(long.gridBottom<=height && long.routeBottom<=height)
      assert.ok(long.historyHeight>long.composerHeight*1.7,`history taller than composer: ${JSON.stringify(long)}`)
      console.log('INBOX GEOMETRY '+JSON.stringify(long))
      assert.ok(long.scrollable)
      assert.ok(long.atBottom)
      assert.ok(long.pageHeight<=height+2,`page grows: ${JSON.stringify(long)}`)
      assert.ok(long.pageWidth<=width,`horizontal overflow ${width}`)
      if (width===1366 && process.env.INBOX_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.INBOX_SCREENSHOT_DIR,'inbox-full-shell-long-'+height+'.png')})
      const before=await page.locator('.inbox-composer').boundingBox()
      await page.locator('.inbox-history').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'))})
      assert.deepEqual(await page.locator('.inbox-composer').boundingBox(),before)
      await page.locator('.inbox-details').evaluate(el=>{el.style.paddingBottom='800px'})
      assert.deepEqual(await page.locator('.inbox-composer').boundingBox(),before)
      await page.locator('.inbox-details').evaluate(el=>{el.style.paddingBottom=''})
      await page.locator('.inbox-list').evaluate(el=>{el.style.paddingBottom='800px'})
      assert.deepEqual(await page.locator('.inbox-composer').boundingBox(),before)
      await page.locator('.inbox-list').evaluate(el=>{el.style.paddingBottom=''})
      await page.getByRole('button',{name:/Short/}).click()
      await page.locator('.inbox-history').getByText(/Synthetic message 1/).waitFor()
      const short = await page.evaluate(()=>({historyHeight:document.querySelector('.inbox-history').clientHeight,composerBottom:document.querySelector('.inbox-composer').getBoundingClientRect().bottom}))
      assert.equal(short.historyHeight,long.historyHeight,`short history must fill the panel`)
      assert.ok(short.composerBottom<=height)
      if (width===1366 && process.env.INBOX_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.INBOX_SCREENSHOT_DIR,'inbox-full-shell-short-'+height+'.png')})
      await page.getByRole('button',{name:'Request human attention',exact:true}).click()
      await page.locator('.inbox-conversation').getByText('NEEDS ATTENTION',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Take Conversation',exact:true}).click()
      await page.locator('.inbox-conversation').getByText('TEAM MEMBER HANDLING',{exact:true}).waitFor()
      assert.equal(await page.locator('.inbox-composer textarea').isEnabled(),true)
      await page.locator('.inbox-composer textarea').fill('A longer draft\n'.repeat(20))
      const expanded=await page.locator('.inbox-composer textarea').evaluate(el=>({height:el.clientHeight,scrolls:el.scrollHeight>el.clientHeight,bottom:el.closest('form').getBoundingClientRect().bottom,history:document.querySelector('.inbox-history').clientHeight}))
      assert.ok(expanded.height>long.textareaHeight && expanded.height<=120)
      assert.ok(expanded.scrolls && expanded.bottom<=height && expanded.history>=long.historyHeight-70)
      await page.locator('.inbox-composer textarea').fill('Synthetic staff reply')
      await page.getByRole('button',{name:'Send reply',exact:true}).click()
      await page.locator('.inbox-history').getByText('Synthetic staff reply',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Resolve Conversation',exact:true}).click()
      await page.locator('.inbox-conversation').getByText('Resolved',{exact:true}).waitFor()
      assert.equal(await page.locator('.inbox-composer textarea').isDisabled(),true)
      assert.ok(await page.locator('.inbox-conversation').getByText('MARKETING OPTED OUT',{exact:true}).isVisible())
    }
    await page.setViewportSize({width:390,height:844})
    await page.getByRole('button',{name:/Long/}).click()
    await page.locator('.inbox-composer').scrollIntoViewIfNeeded()
    assert.ok(await page.locator('.inbox-composer').isVisible())
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await page.getByRole('button',{name:'Request human attention',exact:true}).scrollIntoViewIfNeeded()
    assert.ok(await page.getByRole('button',{name:'Request human attention',exact:true}).isVisible())
    await page.setContent('<div id="root"></div>')
    await page.evaluate(()=>window.mountProbe())
    await page.locator('#probe').waitFor()
    await page.evaluate(()=>window.appendProbe())
    await page.waitForFunction(()=>{const e=document.querySelector('#probe');return e.children.length===31 && e.scrollHeight-e.scrollTop-e.clientHeight<3})
    await page.locator('#probe').evaluate(e=>{e.scrollTop=150;e.dispatchEvent(new Event('scroll'))})
    await page.evaluate(()=>window.appendProbe())
    await page.waitForFunction(()=>document.querySelector('#probe').children.length===32)
    assert.equal(await page.locator('#probe').evaluate(e=>e.scrollTop),150)
    assert.deepEqual(errors,[])
  } finally { await browser.close() }
})
