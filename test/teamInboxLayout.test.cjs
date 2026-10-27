const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.join(__dirname,'..');
const options={skip:!chromium&&'Install Playwright to run browser geometry acceptance'};
async function setup(width=390,height=760){
 execFileSync(process.execPath,['test/buildInboxFixture.mjs'],{cwd:root});
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const files={'/':'test/fixtures/inbox-case.html','/app.js':'dist/inbox-fixture/app.js','/app.css':'dist/inbox-fixture/app.css'};
  if(!files[pathname]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(path.join(root,files[pathname])));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{browser=await chromium.launch({headless:true,...(process.env.INBOX_CHROME_PATH?{executablePath:process.env.INBOX_CHROME_PATH}:{})});}
 catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
 const page=await browser.newPage({viewport:{width,height}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'All (2)',exact:true}).waitFor();
 return {page,errors,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));}};
}
test('mobile separates list and thread, preserves drafts, and pins composer inside viewport',options,async()=>{
 const {page,errors,close}=await setup();try{
  assert.equal(await page.locator('.inbox-conversation').isVisible(),false);
  assert.equal(await page.getByRole('checkbox').count(),0);
  await page.locator('.inbox-open').filter({hasText:'School enquiries'}).click();
  const reply=page.getByRole('textbox',{name:'Reply or caption'});await reply.waitFor();
  assert.equal(await page.locator('.inbox-list').isVisible(),false);
  assert.equal(await page.getByRole('group',{name:'Inbox views'}).isVisible(),false);
  assert.equal(await page.locator('.inbox-details').isVisible(),false);
  const geometry=await page.locator('.inbox-composer').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,width:document.documentElement.scrollWidth,viewport:innerHeight}));
  assert.ok(geometry.bottom<=geometry.viewport+1,JSON.stringify(geometry));assert.ok(geometry.width<=390);
  await reply.fill('Preserved reply draft');await page.getByRole('button',{name:'← Chats',exact:true}).click();
  assert.equal(await page.locator('.inbox-list').isVisible(),true);
  await page.locator('.inbox-open').filter({hasText:'School enquiries'}).click();assert.equal(await reply.inputValue(),'Preserved reply draft');
  assert.equal(await page.getByRole('button',{name:'Resolve & return to AI',exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'Details',exact:true}).click();await page.getByRole('button',{name:'Resolve & return to AI',exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to chat',exact:true}).click();assert.equal(await page.locator('.inbox-details').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
test('selection is opt-in and cannot mark chats read or send bulk writes before confirmation',options,async()=>{
 const {page,errors,close}=await setup();try{
  await page.getByRole('button',{name:'Select',exact:true}).click();
  await page.getByRole('button',{name:'Select shown chats',exact:true}).click();
  await page.getByText('2 chats selected',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.method!=='GET').length),0);
  await page.getByRole('button',{name:'Resolve selected',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixtureRequests.filter(r=>r.path.endsWith('/bulk')).length),0);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Done selecting',exact:true}).click();
  assert.equal(await page.getByRole('checkbox').count(),0);assert.deepEqual(errors,[]);
 }finally{await close();}
});
test('desktop retains independent list and conversation; background and native quotes remain distinct',options,async()=>{
 const {page,errors,close}=await setup(1366,900);try{
  await page.locator('.inbox-open').filter({hasText:'School enquiries'}).click();await page.locator('.inbox-history').waitFor();
  assert.equal(await page.locator('.inbox-list').isVisible(),true);assert.equal(await page.locator('.inbox-conversation').isVisible(),true);
  assert.equal(await page.locator('.inbox-campaign-context').getAttribute('open'),null);
  assert.equal(await page.locator('.inbox-history .inbox-quote').count(),1);
  await page.locator('.inbox-campaign-context summary').click();
  assert.equal(await page.locator('.inbox-campaign-context .inbox-message-body').isVisible(),true);
  await page.getByRole('combobox',{name:'More inbox filters'}).selectOption('zoe');
  await page.waitForFunction(()=>document.querySelectorAll('.inbox-open').length===1);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('Resolve is visible in the chat header and closes the handoff without sending a message',options,async()=>{
 const {page,errors,close}=await setup(1366,900);try{
  await page.getByRole('button',{name:'My conversations (1)',exact:true}).waitFor();
  await page.locator('.inbox-open').filter({hasText:'School enquiries'}).click();
  const resolve=page.getByRole('button',{name:'Resolve & return to AI',exact:true});
  assert.equal(await resolve.isVisible(),true);
  assert.equal(await page.locator('.inbox-details').isVisible(),false);
  await resolve.click();
  await page.getByText('Conversation resolved. The next customer message returns to your configured AI and automations.',{exact:true}).waitFor();
  assert.equal(await resolve.count(),0);
  const writes=await page.evaluate(()=>window.fixtureRequests.filter(r=>r.method!=='GET'));
  assert.equal(writes.filter(r=>r.path==='/conversations/human/resolve').length,1);
  assert.equal(writes.filter(r=>r.path.endsWith('/reply')).length,0);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});


test('desktop gives messages most of the thread and assistant does not shrink history',options,async()=>{
 const {page,errors,close}=await setup(1366,768);try{
  await page.locator('.inbox-open').filter({hasText:'School enquiries'}).click();
  const history=page.getByRole('region',{name:'Message history'});
  await page.locator('.inbox-history').waitFor();
  const before=await page.locator('.inbox-history').boundingBox();
  assert.ok(before.height>=340,`Message history is only ${before.height}px high`);
  assert.equal(await page.locator('.inbox-thread-nav').isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'Details',exact:true}).isVisible(),true);
  const composer=await page.locator('.inbox-composer').boundingBox();assert.ok(composer.y+composer.height<=768);
  await page.locator('.inbox-copilot-toggle').click();
  await page.getByRole('textbox',{name:'Ask about your open inbox'}).waitFor();
  const after=await page.locator('.inbox-history').boundingBox();
  assert.equal(after.height,before.height);
  await page.getByRole('button',{name:'Close assistant',exact:true}).click();
  assert.equal(await page.locator('.inbox-assistant').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
