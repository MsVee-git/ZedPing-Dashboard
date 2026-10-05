
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const out=require('node:path').resolve('desktop-artifacts');
fs.mkdirSync(out,{recursive:true});
const workspace={id:'review-workspace',auth_user_id:'review-user',business_name:'Manda Boutique',subscription_plan:'business',subscription_status:'active',profile_completed_at:'2026-10-03',email:'review@example.invalid',industry:'retail'};
const user={id:'review-user',email:'review@example.invalid',email_confirmed_at:'2026-10-03',aud:'authenticated',role:'authenticated',user_metadata:{business_name:'Manda Boutique'}};
const agents=[{id:'agent-one',name:'Manda Assistant',lifecycle_status:'active',deployment_mode:'live',knowledge:[{id:'knowledge-one',name:'Product information'}],configuration:{communication_style:'friendly',handoff:{}},whatsapp_number_id:'number-one',activated_configuration_version:1}];
const contacts=[{id:'contact-one',name:'Thandi M.',phone_number:'+260970000001',created_at:'2026-10-03T10:00:00Z'},{id:'contact-two',name:'Chanda K.',phone_number:'+260970000002'}];
const conversations=[
 {id:'chat-one',status:'needs_attention',control_mode:'needs_attention',contacts:contacts[0],unread_count:0,updated_at:'2026-10-03T10:00:00Z',last_message_preview:'Do you have this dress in medium?'},
 {id:'chat-two',status:'open',control_mode:'human',assigned_user_id:'review-user',contacts:contacts[1],unread_count:0,updated_at:'2026-10-03T10:00:00Z',last_message_preview:'Thank you for checking.'}
];
const campaigns=[{id:'campaign-one',broadcast_name:'October collection',message:'Explore our latest collection.',status:'completed',created_at:'2026-10-03T10:00:00Z',contacts:['1','2'],recorded_recipients:2,sent_count:2,failed_count:0}];
const messages=[{id:'m-one',direction:'inbound',message_body:'Do you have this dress in medium?',from_number:'+260970000001',created_at:'2026-10-03T10:00:00Z'},{id:'m-two',direction:'outbound',message_body:'Yes, we can help you find your size.',to_number:'+260970000001',created_at:'2026-10-03T10:01:00Z'}];
const setup={workspace,role:'owner',onboarding:{email_verified:true,business_profile_complete:true,whatsapp_connected:true},whatsapp_connection:{id:'number-one',status:'connected',provisioning_state:'operational',phone_number:'+260970000000'},setup_checklist:{completed:2,total:7,presentation:'primary',items:[{key:'profile',label:'Complete business profile',complete:true},{key:'whatsapp',label:'Connect WhatsApp',complete:true},{key:'contacts',label:'Import contacts',complete:false}]}};
const fixtures={
 '/workspace':setup, '/contacts':contacts, '/messages':messages,
 '/conversations/counts':{needs_attention:1,zoe:0,all:2,assigned_to_me:1,unread:0,resolved:0,unassigned_human:1},
 '/conversations/members':[{id:user.id,name:'Review owner'}],
 '/broadcasts/scheduled':campaigns,
 '/broadcasts/scheduled/campaign-one':campaigns[0],
 '/broadcasts/setup':{numbers:[{id:'number-one',display_phone_number:'+260970000000',display_name:'Manda Boutique'}],groups:[{id:'group-one',name:'Customers',total_contacts:2}]},
 '/broadcasts/templates':{templates:[{id:'template-one',name:'october_collection',language:'en',status:'APPROVED',sendable:true,variables:[],body_preview:'Explore our October collection.'}]},
 '/ai-agents':{agents}, '/ai-agents/library':{templates:[{key:'common_questions',title:'Customer questions',role:'Answer common questions',handoff:'Requests needing a person',can:'Answer from approved knowledge',unavailable:'Make payments'}]},
 '/ai-agents/knowledge-items':{items:[{id:'knowledge-one',name:'Product information',source_type:'text'}]},
 '/ai-agents/numbers':{numbers:[{id:'number-one',phone_number:'+260970000000'}]},
 '/ai-agents/agent-one/test-contacts':{test_contacts:[]},
 '/automations':[], '/automations/library':{templates:[],recommendations:[]}, '/automations/history':[], '/automations/settings':{},
 '/contact-groups':[{id:'group-one',name:'Customers',member_count:2}], '/content':[],
 '/chatbot-flows':[], '/chatbot-flows/setup':{numbers:[]}, '/chatbot-flows/activity':[], '/team/members':[], '/team/invitations':[], '/whatsapp-numbers':[], '/whatsapp-templates':[], '/templates':{templates:[]}
};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const errors=[],unhandled=[];
 await context.addInitScript(({user})=>{
   const encode=x=>btoa(JSON.stringify(x)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
   const session={access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated'})+'.review-only',refresh_token:'review-only',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user};
   localStorage.setItem('sb-zzhqhgeyxbdqdkacrviq-auth-token',JSON.stringify(session));
 },{user});
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname.includes('supabase')){
     let data=[];
     if(url.pathname.includes('/auth/'))data=user;
     else if(url.pathname.endsWith('/customers'))data=req.headers()['accept']?.includes('object')?workspace:[workspace];
     else if(url.pathname.endsWith('/workspace_members'))data=[{customer_id:workspace.id,user_id:user.id,role:'owner'}];
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(url.hostname.includes('railway')){
     let data=fixtures[url.pathname];
     if(url.pathname==='/conversations') data={conversations:conversations.filter(c=>url.searchParams.get('view')!=='needs_attention'||c.status==='needs_attention'),next_offset:null};
     if(/^\/conversations\/chat-/.test(url.pathname))data={conversation:conversations.find(c=>c.id===url.pathname.split('/')[2]),messages};
     if(data===undefined){unhandled.push(url.pathname);data=[];}
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4186/dashboard');
 await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
 await page.getByText('October collection',{exact:true}).waitFor();
 await page.screenshot({path:out+'/redesign-overview-implemented.png',fullPage:true});
 console.log('Overview rendered');
 const routes=[['/campaigns','Campaigns'],['/contacts','Contacts'],['/contacts/groups','Contacts'],['/automations/library','Automations'],['/automations/keywords','Automations'],['/automations/flows','Chatbot Flows'],['/zed-ai/agents','Zed AI'],['/whatsapp/numbers','WhatsApp'],['/whatsapp/templates','WhatsApp Templates'],['/analytics/messaging','Analytics'],['/settings/business','Business profile'],['/settings/team','Team'],['/settings/billing','Billing & subscription'],['/settings/integrations','Integrations']];
 for(const [path] of routes){
   await page.goto('http://127.0.0.1:4186'+path);
   await page.locator('main .pad, main .ai-page').first().waitFor();
   await page.screenshot({path:out+'/route-'+path.slice(1).replaceAll('/','-')+'.png',fullPage:true});
   console.log('Rendered '+path);
 }
 await page.goto('http://127.0.0.1:4186/team-inbox/chat-two?view=assigned_to_me');
 await page.locator('.inbox-composer textarea').waitFor();
 await page.locator('.inbox-composer textarea').fill('Draft reply for this customer');
 await page.reload();
 await page.locator('.inbox-composer textarea').waitFor();
 assert.equal(await page.locator('.inbox-composer textarea').inputValue(),'Draft reply for this customer');
 assert.ok(page.url().endsWith('/team-inbox/chat-two?view=assigned_to_me'));
 await page.screenshot({path:out+'/redesign-inbox-implemented.png',fullPage:true});
 console.log('Inbox resource, filter and reply restored after refresh');
 await page.getByRole('link',{name:'Campaigns',exact:true}).click();
 await page.goBack();
 await page.locator('.inbox-composer textarea').waitFor();
 assert.equal(await page.locator('.inbox-composer textarea').inputValue(),'Draft reply for this customer');
 console.log('Back restores conversation and draft');
 await page.goto('http://127.0.0.1:4186/campaigns/new');
 const selects=page.locator('main select');
 await selects.nth(0).selectOption('number-one');
 await selects.nth(1).selectOption('group-one');
 await selects.nth(2).selectOption('template-one');
 await page.reload();
 await page.locator('main select').nth(2).locator('option[value="template-one"]').waitFor({state:'attached'});
 assert.equal(await page.locator('main select').nth(0).inputValue(),'number-one');
 assert.equal(await page.locator('main select').nth(1).inputValue(),'group-one');
 assert.equal(await page.locator('main select').nth(2).inputValue(),'template-one');
 console.log('Campaign draft restored after refresh');
 await page.goto('http://127.0.0.1:4186/zed-ai/agents/agent-one');
 await page.getByRole('heading',{name:'Manda Assistant',exact:true}).waitFor();
 await page.getByRole('button',{name:'Back to agents'}).click();
 assert.ok(page.url().endsWith('/zed-ai/agents'));
 await page.getByRole('heading',{name:'Zed AI',exact:true}).waitFor();
 console.log('AI detail and return route passed');
 await page.goto('http://127.0.0.1:4186/zed-ai/agents/agent-one');
 await page.getByRole('button',{name:'Edit draft',exact:true}).click();
 await page.getByPlaceholder('For example: AutoGuard Assistant').fill('Manda Support');
 await page.reload();
 await page.getByPlaceholder('For example: AutoGuard Assistant').waitFor();
 assert.equal(await page.getByPlaceholder('For example: AutoGuard Assistant').inputValue(),'Manda Support');
 console.log('AI draft restored without publishing changes');
 for(const state of ['registering','failed','operational']){
   fixtures['/workspace'].whatsapp_connection.provisioning_state=state;
   await page.goto('http://127.0.0.1:4186/dashboard');
   const label=state==='operational'?'Connected':state==='failed'?'Failed · needs attention':'Registering';
   await page.getByText('WhatsApp · '+label,{exact:true}).waitFor();
 }
 console.log('WhatsApp registering, failed and operational states passed');
 await context.route('**/conversations/counts',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Queue unavailable'})}));
 await page.goto('http://127.0.0.1:4186/dashboard');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('.metric strong').nth(0).innerText(),'—');
 console.log('Unavailable metrics do not become zero');
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:4186/dashboard');
 await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('link',{name:'Campaigns',exact:true}).click();
 assert.ok(page.url().endsWith('/campaigns'));
 await page.screenshot({path:out+'/redesign-small-screen-check.png',fullPage:true});
 console.log('Existing small-screen layout and menu remain usable');

 console.log(JSON.stringify({errors,unhandled:[...new Set(unhandled)]}));
 await browser.close();
 assert.deepEqual(errors,[]);
 assert.deepEqual([...new Set(unhandled)],[]);
})().catch(error=>{console.error(error);process.exit(1)});

