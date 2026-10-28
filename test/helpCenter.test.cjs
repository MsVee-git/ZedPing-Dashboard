const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {build}=require('esbuild');
let chromium;try{({chromium}=require('playwright'));}catch{}
const options={skip:!chromium&&'Install Playwright to run browser acceptance'};
const root=path.join(__dirname,'..');
let built;
async function setup(width=1366){
 if(!built)built=build({stdin:{resolveDir:root,loader:'tsx',contents:`
 import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';
 import{HelpCenter}from'./src/HelpCenter';import{parseDashboardRoute,routeToPath}from'./src/lib/dashboardRouting';
 import './src/index.css';import './src/workspace.css';
 function Fixture(){const[route,setRoute]=useState(()=>parseDashboardRoute(location.pathname));useEffect(()=>{const pop=()=>setRoute(parseDashboardRoute(location.pathname));addEventListener('popstate',pop);return()=>removeEventListener('popstate',pop)},[]);const navigate=next=>{const r=typeof next==='string'?{section:next}:next;history.pushState({},'',routeToPath(r));setRoute(parseDashboardRoute(location.pathname));};return <main className="main workspace" style={{marginLeft:0}}>{route.section==='help'?<HelpCenter guideId={route.resourceId} navigate={navigate}/>:<h1>Opened: {route.section}</h1>}</main>};createRoot(document.getElementById('root')).render(<Fixture/>);`},external:['/fonts/*'],bundle:true,outfile:path.join(root,'dist/help-fixture/app.js'),jsx:'automatic',format:'iife',tsconfigRaw:{},loader:{'.css':'css'}});
 await built;
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/fonts/')){const file=path.join(root,'public',req.url);if(fs.existsSync(file)){res.setHeader('Content-Type','font/woff2');return res.end(fs.readFileSync(file));}res.writeHead(404);return res.end();}
  if(req.url==='/app.js'||req.url==='/app.css'){const file=path.join(root,'dist/help-fixture/'+req.url.slice(1));res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/css');return res.end(fs.readFileSync(file));}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.INBOX_CHROME_PATH?{executablePath:process.env.INBOX_CHROME_PATH}:{})});
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
 window.spoken=[];window.printed=0;window.cancelled=0;
 class Utterance{constructor(text){this.text=text;}};
 Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance,configurable:true});
 Object.defineProperty(window,'speechSynthesis',{value:{speak:value=>window.spoken.push(value.text),pause(){},resume(){},cancel(){window.cancelled++}},configurable:true});window.print=()=>window.printed++;
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/help`);await page.getByRole('heading',{name:'Help & Guides',exact:true}).waitFor();
 return {page,errors,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}
test('clients can find a guide, listen, print, use deep links and open the matching feature',options,async()=>{
 const{page,errors,close}=await setup();try{
  await page.getByRole('searchbox',{name:'What do you want to do?'}).fill('broadcast');
  await page.getByRole('link',{name:/Send a broadcast and check its progress/}).click();
  assert.equal(new URL(page.url()).pathname,'/help/guides/campaigns');
  await page.getByRole('heading',{name:'Send a broadcast and check its progress',exact:true}).waitFor();
  assert.equal(await page.locator('.help-steps li').count(),6);
  await page.getByRole('button',{name:'Listen to this guide',exact:true}).click();
  assert.ok((await page.evaluate(()=>window.spoken[0])).includes('Step 1.'));
  await page.getByRole('button',{name:'Pause reading',exact:true}).click();await page.getByRole('button',{name:'Resume reading',exact:true}).click();
  await page.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();assert.equal(await page.evaluate(()=>window.printed),1);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.help-related').isVisible(),false);
  await page.pdf({path:'/tmp/zedping-help-print.pdf',format:'A4',margin:{top:'15mm',right:'15mm',bottom:'15mm',left:'15mm'}});await page.emulateMedia({media:'screen'});
  await page.getByRole('link',{name:'Open Campaigns',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/campaigns');assert.ok(await page.evaluate(()=>window.cancelled)>0);
  await page.goBack();await page.getByRole('heading',{name:'Send a broadcast and check its progress',exact:true}).waitFor();assert.deepEqual(errors,[]);
 }finally{await close();}
});
test('mobile guides fit the screen and search has a recoverable empty state',options,async()=>{
 const{page,errors,close}=await setup(390);try{
  await page.getByRole('combobox',{name:'Topic'}).selectOption('Team Inbox');assert.equal(await page.locator('.help-card').count(),3);
  await page.getByRole('searchbox',{name:'What do you want to do?'}).fill('not-a-feature-xyz');await page.getByText('No guides match this search. Try another phrase or topic.').waitFor();
  await page.getByRole('button',{name:'Show all guides',exact:true}).click();assert.ok(await page.locator('.help-card').count()>=15);
  await page.getByRole('link',{name:'Start with the basics',exact:true}).click();await page.getByRole('heading',{name:'Your first day on ZedPing',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/zedping-help-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 }finally{await close();}
});
