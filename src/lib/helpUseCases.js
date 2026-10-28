export const businessVerificationGuide = {
  id:'business-verification',category:'Getting started',title:'Required: verify your business on Meta',minutes:5,section:'whatsapp',
  intro:'ZedPing requires clients to complete Meta (Facebook) business verification as part of onboarding. Prepare all four items on ZedPing’s business-readiness checklist before starting.',
  checklist:['ZRA tax certificate for the business.','PACRA business registration or incorporation certificate.','A working business website showing the business name, services and contact details.','A professional business email address using the business’s own domain, such as info@yourbusinessdomain.com.'],
  steps:[
    'Prepare the four checklist items: ZRA tax certificate, PACRA certificate, a working website, and a professional email address on your business domain. Make sure the email inbox works and the website opens publicly.',
    'Check that the legal business name, address and contact details are consistent across your official documents, website and Meta Business Portfolio. Explain any difference between a registered name and a trading name to support.',
    'Sign in to Meta Business Suite or Business Settings with administrator access to your own business portfolio. Find Business verification, usually in Security Center, and follow the options Meta shows for your business.',
    'Enter the requested business details. Upload the official documents requested in Meta’s verification flow and complete the available method for confirming your connection to the business.',
    'Check the result in Meta. If the submission is rejected or more information is requested, correct the stated issue or supply the additional evidence requested. Ask ZedPing support for help if the verification option is unavailable.',
    'Confirm the Verified business status with ZedPing support and complete the remaining WhatsApp connection and account checks. Keep administrator access and your business records current.'
  ],
  notes:[
    'The four-item checklist and mandatory verification are ZedPing onboarding requirements. Meta decides which documents and confirmation methods it accepts for each verification case and may request additional proof of the business name, address or phone number.',
    'For an institution registered under a different legal framework, ask ZedPing support which equivalent registration documents are appropriate before onboarding.',
    'This concerns business verification of your Meta Business Portfolio. It does not mean purchasing a Meta Verified subscription or receiving a verified badge.',
    'ZedPing cannot guarantee Meta approval, a review time, or a particular messaging limit. A verified business must still meet the account and messaging requirements shown by Meta.',
    'Keep your Facebook password, verification codes and access tokens private. Use the secure connection flow; do not send login details in a support chat.'
  ],
  resources:[{title:'Meta: verify your business',url:'https://www.facebook.com/business/help/2058515294227817'},{title:'Meta: documents for business verification',url:'https://www.facebook.com/business/help/159334372093366'}],
  related:['getting-started','message-usage','account-team']
};

export const industryGuides = [
 {id:'restaurant-examples',category:'Practical examples',title:'Restaurants: bookings, takeaway and repeat visits',minutes:5,section:'broadcasts',
 intro:'Use ZedPing to answer menu questions, collect reservation and takeaway enquiries, and bring opted-in guests back with relevant offers.',
 steps:[
  'Create clear groups, such as takeaway customers, event enquiries, regular diners, or people who opted in to specials. A previous order alone is not permission for every promotion.',
  'Add the current menu, opening hours, address and reservation policy to Content Library. Keep prices, availability and offer dates accurate.',
  'Use an automation for common requests such as “menu”, “location” and “opening hours”. A chatflow can collect the requested date, time and party size for a booking enquiry.',
  'Have staff check table capacity, kitchen availability, prices and delivery arrangements before confirming a reservation or order.',
  'Send the relevant approved template to the right audience. Personalize confirmed reservation reminders rather than sending everyone the same booking details.',
  'Monitor replies in Team Inbox. Assign a staff member to reservation changes, dietary questions and complaints; resolve the handoff after helping.'
 ],
 examples:[
  {title:'Bring back diners with a lunch special',audience:'Guests who opted in to restaurant offers.',message:'Lunch plans? Our {{1}} special is available on {{2}} from {{3}} at {{4}}. Reply MENU for the options or TABLE to request a reservation. Reply STOP to opt out.',followUp:'Share the current menu, check the requested time and party size, then confirm the booking after checking capacity.'},
  {title:'Remind a guest about a confirmed table',audience:'The individual guest with an existing confirmed reservation.',message:'Hello {{1}}, a reminder of your table reservation for {{2}} guests at {{3}} on {{4}}. Reply CONFIRM or CHANGE so our team can assist.',followUp:'Treat CHANGE as a request. A staff member checks availability and confirms the revised arrangement.'},
  {title:'Collect a takeaway enquiry',audience:'A customer who asks for takeaway on WhatsApp.',message:'Thank you for contacting {{1}}. Please share the items and quantities you would like, and your preferred collection time. Our team will confirm availability and your total.',followUp:'Check stock, preparation time and the final price before asking the customer to proceed.'},
  {title:'Follow up an event or catering enquiry',audience:'People who asked about catering or a private event.',message:'Hello {{1}}, following up on your catering enquiry. Please confirm the event date, location and estimated guest count so our team can prepare the next steps.',followUp:'Qualify the guest count, menu needs, budget and service requirements, then assign the quotation to the responsible person.'}
 ],notes:['These examples do not create a restaurant booking, kitchen order or POS record automatically. Use your business’s confirmed process or an approved integration.','Use the actual approved template category for the message’s purpose; promotional offers and booking reminders serve different purposes.'],related:['contacts-groups','templates','inbox-replies']},
 {id:'garage-examples',category:'Practical examples',title:'Garages: recover leads and keep customers informed',minutes:5,section:'broadcasts',
 intro:'Follow up workshop and accessory enquiries, collect vehicle details, and keep customers informed about confirmed job progress.',
 steps:[
  'Group enquiries by genuine interest: servicing, bodywork, tonneau covers, nudge bars, canopies, or fleet work. Keep booked jobs separate from unqualified enquiries.',
  'Store your approved service descriptions, location, opening hours and current quotation requirements in Content Library.',
  'Ask for the vehicle make, model, year and the customer’s requirement. Ask staff to check product compatibility or assess damage before promising fitment or a repair price.',
  'Use Copilot to find interested customers who still need qualification. Open each matching chat and ask for the missing information.',
  'Send relevant follow-up templates, confirmed booking reminders, and accurate job or collection updates to the specific customers concerned.',
  'Keep the workshop or sales tracker up to date through your usual business process. Assign each quotation or booking request to a staff member who can progress it.'
 ],
 examples:[
  {title:'Recover a tonneau-cover enquiry',audience:'Leads who previously enquired about tonneau covers.',message:'Hello {{1}}, are you still looking for a tonneau cover for your pickup? Please reply with your vehicle make, model and year so we can help confirm the right option. Reply STOP to opt out.',followUp:'Confirm compatibility, ask when they need it, and provide a verified quotation or arrange a visit.'},
  {title:'Follow up an unanswered quotation',audience:'The individual customer who requested that quotation.',message:'Hello {{1}}, following up on the quotation we shared for {{2}}. Would you like us to clarify anything or help you arrange the next step?',followUp:'Ask whether the issue is price, timing, suitability or missing information. Record the outcome and agree on the next follow-up.'},
  {title:'Remind a customer about a confirmed service booking',audience:'Customers with a confirmed workshop appointment.',message:'Hello {{1}}, a reminder of your vehicle booking at {{2}} on {{3}} at {{4}}. Please reply if you need to request a change or need directions.',followUp:'Have the workshop confirm any requested change. Do not promise an immediate completion time without checking the job.'},
  {title:'Share a verified collection update',audience:'Only the owner or authorized contact for a job confirmed ready for collection.',message:'Hello {{1}}, your vehicle is ready for collection from {{2}}. Our collection hours are {{3}}. Please contact our team if you need assistance with the collection arrangements.',followUp:'Check that workshop quality checks and the business’s collection requirements are complete before sending.'},
  {title:'Offer seasonal load protection',audience:'Opted-in customers interested in pickup accessories.',message:'Keep your pickup load protected this rainy season. Ask us about {{1}} options for your vehicle. Reply with your make, model and year for assistance. Reply STOP to opt out.',followUp:'Share approved product images, confirm fitment and current pricing, and qualify whether the lead is ready for a quotation.'}
 ],notes:['Use only confirmed job progress, prices, compatibility and completion dates.','A chat summary does not create a quotation or update a job card automatically. Staff must complete the business’s sales and workshop records.'],related:['copilot','campaigns','handoff-resolve']},
 {id:'healthcare-examples',category:'Practical examples',title:'Hospitals and clinics: appointments and patient administration',minutes:5,section:'broadcasts',
 intro:'Use ZedPing for clear administrative communication, including appointment reminders, directions, rescheduling requests and approved service notices.',
 steps:[
  'Have the facility approve the WhatsApp communication process, message wording and intended recipients. Confirm the patient’s preferred contact details and permission to receive relevant messages.',
  'Keep routine messages minimal. Use appropriate individual appointments or relevant administrative groups rather than a broadcast list that includes every patient.',
  'Add approved opening hours, location, appointment-request instructions and administrative FAQs to Content Library.',
  'Use a chatflow or staff conversation to collect a general appointment request. Reception staff check the booking system and confirm an available time.',
  'Send reminders only for verified appointment details. Route rescheduling, billing questions and complaints to the appropriate authorized staff member.',
  'Limit AI to approved administrative information. Escalate symptom descriptions, medication questions, clinical interpretation and urgent care concerns to the facility’s authorized clinical process.'
 ],
 examples:[
  {title:'Remind a patient about an appointment',audience:'The individual patient or an authorized contact for the confirmed appointment.',message:'Hello, this is a reminder of your appointment at {{1}} on {{2}} at {{3}}. Reply CONFIRM or CHANGE to contact our reception team.',followUp:'Reception confirms attendance or handles the change through the actual appointment system.'},
  {title:'Collect a rescheduling request',audience:'A patient who asks to change an appointment.',message:'Thank you for letting us know. Please share your preferred date and time. Our reception team will check availability and confirm the new arrangement.',followUp:'Record the request in the facility’s approved system and confirm the available slot. Do not treat the request as a completed booking change.'},
  {title:'Provide directions and reception hours',audience:'A patient or visitor requesting location information.',message:'You can find {{1}} at {{2}}. Reception is available {{3}}. Please reply if you need help finding the entrance or confirming your appointment details.',followUp:'Share an approved location pin where useful. Hand accessibility or clinical-service questions to the relevant team.'},
  {title:'Notify affected patients of a schedule change',audience:'Only people affected by a verified appointment or administrative schedule change.',message:'An update from {{1}}: there has been a change to the appointment schedule for {{2}}. Please contact reception on {{3}} so we can assist with your arrangements.',followUp:'Reception contacts the affected individuals and confirms any revised appointment through the official booking system.'}
 ],notes:['Keep diagnoses, test results, medication details and other sensitive clinical information out of routine broadcasts. Use the facility’s approved secure channels and access rules for clinical information.','These examples are administrative communication drafts, not medical advice or a clinical triage system.','The facility must review how it uses WhatsApp, patient information and any AI assistant before deployment. ZedPing does not replace clinical judgment or emergency response.'],related:['templates','inbox-replies','account-team']},
 {id:'beauty-examples',category:'Practical examples',title:'Salons, spas and beauty businesses: bookings and repeat sales',minutes:4,section:'broadcasts',
 intro:'Collect treatment or product enquiries, remind clients about confirmed appointments, and share relevant updates with opted-in customers.',
 steps:[
  'Create relevant groups such as nail appointments, haircare enquiries, spa bookings or customers interested in particular product ranges.',
  'Keep the approved service menu, price list, location and booking policy in Content Library.',
  'Collect the requested service, preferred date and time. Ask staff to check the calendar and any consultation requirements before confirming.',
  'Use individual reminders for confirmed appointments. Share promotions only with the appropriate opted-in audience.',
  'Handle product questions using approved information. Ask staff for help when suitability or a customer’s health concern needs specialist review.',
  'Follow up enquiries in Team Inbox, record confirmed appointments or sales in the business’s usual system, and resolve completed staff handoffs.'
 ],
 examples:[
  {title:'Remind a client about a booking',audience:'A client with a confirmed salon or spa appointment.',message:'Hello {{1}}, a reminder of your {{2}} appointment at {{3}} on {{4}} at {{5}}. Please reply if you need to request a change.',followUp:'Check the appointment calendar before confirming any revised time.'},
  {title:'Follow up a product enquiry',audience:'Customers who asked about the specific product or range.',message:'Hello {{1}}, are you still interested in {{2}}? Our team can help with the current options and pricing. Reply to let us know what you are looking for. Reply STOP to opt out.',followUp:'Confirm actual stock and the customer’s requirements before recommending an available option.'},
  {title:'Share a relocation notice',audience:'Existing customers who should receive a relevant business-location update.',message:'A location update from {{1}}: we are now at {{2}}. Our opening hours are {{3}}. Reply LOCATION for directions or contact our team for booking assistance.',followUp:'Send the approved map location and help clients confirm where their next appointment will take place.'},
  {title:'Promote a confirmed appointment offer',audience:'Clients who opted in to relevant offers.',message:'Looking to book your next {{1}} appointment? Our {{2}} offer is available until {{3}}, subject to confirmed availability. Reply BOOK to request a time. Reply STOP to opt out.',followUp:'Check staff availability, offer conditions and the booking calendar before confirming.'}
 ],notes:['An appointment enquiry is not a confirmed calendar entry until the team or an approved integration confirms it.','Use approved product descriptions and avoid unsupported treatment or health claims.'],related:['content-library','automations','campaigns']},
 {id:'retail-examples',category:'Practical examples',title:'Retail and product businesses: enquiries, stock and collection',minutes:4,section:'broadcasts',
 intro:'Turn product enquiries into clear next steps and keep customers informed about verified orders and collection arrangements.',
 steps:[
  'Segment contacts by the product category they asked about and their permission to receive offers.',
  'Add accurate catalogue descriptions, images and current pricing to the Content Library. Have staff check stock before promising availability.',
  'Use automations for catalogue, location or opening-hours requests. Ask for the product, quantity and requirements when a customer enquires.',
  'Send a relevant approved template to re-engage interested customers or promote a confirmed offer to an opted-in group.',
  'Use individual order or collection updates only when the business has verified the actual order state.',
  'Follow up replies in Team Inbox and record the sale, reservation or collection in the shop’s actual operating system.'
 ],
 examples:[
  {title:'Re-engage a product lead',audience:'Customers who enquired about that product category.',message:'Hello {{1}}, following up on your enquiry about {{2}}. Please let us know the option and quantity you need so our team can check availability and assist. Reply STOP to opt out.',followUp:'Check current stock and pricing, then confirm the next step with the customer.'},
  {title:'Notify opted-in customers about new stock',audience:'Customers who agreed to updates about this product range.',message:'New arrivals at {{1}}: {{2}}. Reply CATALOGUE to see the available options and ask our team about current pricing. Reply STOP to opt out.',followUp:'Share approved product information and check stock before confirming an order.'},
  {title:'Confirm collection readiness',audience:'The individual customer whose verified order is ready.',message:'Hello {{1}}, your order {{2}} is ready for collection at {{3}}. Collection hours are {{4}}. Please reply if you need assistance.',followUp:'Verify the order and authorized collection process before releasing goods.'},
  {title:'Clarify a quotation request',audience:'A customer who requested a product quotation.',message:'Thank you for your enquiry. Please confirm the product, quantity and whether you need collection or delivery so our team can prepare the correct quotation.',followUp:'Check pricing and delivery arrangements, then share an approved quotation through the business’s process.'}
 ],notes:['ZedPing does not automatically synchronize stock, payments or an order system unless the relevant integration has been specifically configured.'],related:['templates','content-library','inbox-replies']},
 {id:'property-examples',category:'Practical examples',title:'Property businesses: viewings, enquiries and tenant updates',minutes:4,section:'broadcasts',
 intro:'Qualify property enquiries, collect viewing requests, and send focused administrative reminders to the right prospects or tenants.',
 steps:[
  'Keep rental prospects, buyers, scheduled viewings and existing tenants in separate relevant groups.',
  'Use approved property details and ask staff to verify availability, pricing and viewing arrangements before communicating them.',
  'Qualify an enquiry with the preferred location, property type, budget range and intended timeframe.',
  'Use individual reminders for confirmed viewings and accurate tenant-account communication. Review recipient and variable mappings carefully.',
  'Send property offers only to prospects who opted in to the relevant updates.',
  'Use Team Inbox to progress replies and record the agreed next step in the property business’s existing records.'
 ],
 examples:[
  {title:'Qualify a property enquiry',audience:'A prospect who asked for property assistance.',message:'Hello {{1}}, to help with your property enquiry, please share your preferred area, property type, budget range and intended move date.',followUp:'Match the request against verified available listings and assign a staff member to follow up.'},
  {title:'Remind a prospect about a confirmed viewing',audience:'The prospect with a confirmed viewing appointment.',message:'Hello {{1}}, a reminder of your property viewing at {{2}} on {{3}} at {{4}}. Please reply if you need directions or need to request a change.',followUp:'Check access arrangements and confirm any change with the responsible agent.'},
  {title:'Send a private rent reminder',audience:'Only the correct tenant or authorized account contact.',message:'Hello {{1}}, this is a reminder that your rent payment for {{2}} is due on {{3}}. Please contact our accounts team if you need to confirm your account details.',followUp:'Verify the account before discussing balances and update payment records through the business’s approved process.'},
  {title:'Share a relevant available listing',audience:'Opted-in prospects looking for that property type and area.',message:'Still looking for a {{1}} in {{2}}? Contact {{3}} for information about a currently available option and viewing arrangements. Reply STOP to opt out.',followUp:'Confirm that the listing remains available before arranging a viewing or making any commitment.'}
 ],notes:['Do not share one tenant’s account information with a group or another prospect.','A viewing request, rent enquiry or payment message does not automatically update a booking calendar or financial ledger.'],related:['contacts-groups','campaigns','handoff-resolve']}
];

export const schoolMessageExamples = [
 {title:'Parent meeting reminder',audience:'Parents or guardians of the relevant class or grade.',message:'Hello {{1}}, [School name], [Campus], invites Grade {{2}} parents to a meeting on {{3}} at {{4}}. Please reply if you need directions or assistance.',followUp:'Route attendance questions to the relevant teacher or administrator.'},
 {title:'Individual fee reminder',audience:'Only the authorized parent or guardian for the correct learner account.',message:'Hello {{1}}, a reminder that the next school-fee payment for {{2}} is due on {{3}}. Please contact the accounts office on {{4}} if you need to confirm your account details.',followUp:'Have accounts verify the individual record before discussing balances or payment arrangements.'},
 {title:'Transport or collection update',audience:'Only parents affected by the verified route or collection change.',message:'A transport update from [School name]: {{1}} on {{2}}. Please contact {{3}} if you need assistance with your child’s arrangements.',followUp:'Confirm that the affected parents have the correct instructions and direct questions to the transport team.'},
 {title:'Admissions open day',audience:'Prospective parents who agreed to relevant admissions updates.',message:'Exploring a school for your child? Join [School name] for our open day on {{1}} at {{2}}. Reply VISIT to ask about attendance and available places. Reply STOP to opt out.',followUp:'Ask the intended grade and admission year, then have the school confirm places and visit arrangements.'}
];
