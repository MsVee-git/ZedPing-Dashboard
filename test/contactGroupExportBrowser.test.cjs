const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {build}=require('esbuild');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const browserAvailable=fs.existsSync(process.env.INBOX_CHROME_PATH || chromium.executablePath());
test('segment export downloads complete CSV and phone-only TXT from the actual Contacts UI',{skip:!browserAvailable && 'Playwright browser is not installed'},async()=>{
 const source=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
 const contacts=source.slice(source.indexOf('function Contacts('),source.indexOf('// ── MESSAGE LOG'));
 const bundle=await build({stdin:{resolveDir:root,loader:'tsx',contents:`
 import React,{useState,useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';
 import {prepareContactGroupExport,downloadContactGroupExport} from './src/lib/contactGroupExport.js';
 const API='https://synthetic.invalid';
 const group={id:'segment',name:'Ford enquiries',member_count:1205};
 const members=Array.from({length:1205},(_,i)=>({id:'link'+i,contact_id:'c'+i,contact:{id:'c'+i,name:'Customer '+i,phone_number:'+26097'+String(i).padStart(7,'0'),tag:'Warm'}}));
 window.requests=[];
 const useAPI=()=>({data:[],loading:false,refetch(){}});
 const useQueryState=(key,value)=>useState(value);
 const apiFetch=async url=>{window.requests.push(url);if(window.failExport&&url.endsWith('/members'))throw new Error('Could not load segment');return{json:async()=>url.endsWith('/members')?{group,members}:[group]}};
 const PageHead=({title,action})=><header><h1>{title}</h1>{action}</header>;
 const Empty=({msg})=><p>{msg}</p>,Loader=()=>null,Ic=()=>null,ContactsImport=()=>null;
 ${contacts}
 function Fixture(){const[id,setId]=useState(null);return <Contacts customer={{id:'workspace',role:'owner'}} initialTab='groups' routeGroupId={id} onRouteOpen={setId} onRouteUnavailable={()=>setId(null)}/>};
 createRoot(document.getElementById('root')).render(<Fixture/>);
 `},bundle:true,write:false,jsx:'automatic',format:'iife',tsconfigRaw:{}});
 const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');return res.end(bundle.outputFiles[0].text)}res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser=await chromium.launch({headless:true,...(process.env.INBOX_CHROME_PATH?{executablePath:process.env.INBOX_CHROME_PATH}:{})});const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button',{name:'Export',exact:true}).click();
  let pending=page.waitForEvent('download');await page.getByRole('button',{name:'Phone numbers (.txt)',exact:true}).click();
  let download=await pending;let content=fs.readFileSync(await download.path(),'utf8');
  assert.equal(download.suggestedFilename(),'Ford_enquiries_contacts.txt');assert.equal(content.trim().split('\r\n').length,1205);assert.ok(!content.includes('Customer'));
  await page.getByRole('button',{name:'Manage',exact:true}).click();
  await page.getByPlaceholder('Search group members...').fill('Customer 1204');
  await page.getByRole('button',{name:'Export contacts',exact:true}).click();
  pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();download=await pending;content=fs.readFileSync(await download.path(),'utf8');
  assert.equal(download.suggestedFilename(),'Ford_enquiries_contacts.csv');assert.ok(content.includes('Customer 0'));assert.ok(content.includes('Customer 1204'));assert.equal(content.split('\r\n').length,1207);
  await page.evaluate(()=>window.failExport=true);await page.getByRole('button',{name:'Export contacts',exact:true}).click();await page.getByRole('button',{name:'Download CSV',exact:true}).click();await page.getByText('Could not load segment',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
 }finally {if(browser)await browser.close();await new Promise(r=>server.close(r))}
});
