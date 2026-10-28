import {businessVerificationGuide,industryGuides,schoolMessageExamples} from './helpUseCases.js';
export const helpGuides = [
  {id:'getting-started',category:'Getting started',title:'Your first day on ZedPing',minutes:5,section:'overview',intro:'Set up your workspace, check your WhatsApp connection, and practise with a small audience before messaging clients.',steps:[
    'Sign in with your ZedPing email and password. Check the business name shown in the sidebar before working with client information.',
    'Before onboarding, complete the Meta business verification required by ZedPing. Prepare your ZRA tax certificate, PACRA certificate, working website and professional email on your business domain. Read the business-verification guide for the full checklist.',
    'Open Overview and review the connection banner, setup checklist, and message balance. Complete any outstanding setup tasks shown for your workspace.',
    'Open WhatsApp → Numbers & connection. Confirm that the correct business number is connected. If setup is incomplete, follow the connection flow or ask your workspace administrator.',
    'Open Settings → Business profile and check the business details. Owners and administrators manage workspace configuration.',
    'Add a small group of contacts who have agreed to receive your messages. Create an approved template, then send a test to a contact you control.',
    'Open Team Inbox to check the response. Practise taking a conversation, replying, and resolving it. Review the campaign delivery report before sending to a larger group.'
  ],practice:'Run a complete practice cycle: one approved template to your own test contact, one customer reply, one staff reply, then resolve the chat.',notes:['Available features and controls depend on your plan and workspace role.','Use My Account to manage your personal name and password. Workspace business details are separate.'],related:['business-verification','contacts-groups','templates','inbox-replies']},
  businessVerificationGuide,
  {id:'inbox-replies',category:'Team Inbox',title:'Read and reply to customer messages',minutes:4,section:'messages',intro:'Use Team Inbox to see recent conversations, take ownership, and follow up without losing the customer’s context.',steps:[
    'Open Team Inbox. Use All, Unread, My conversations, or More views to find the conversations you need.',
    'Select a conversation. Read the latest customer message and earlier messages. Expand Previous campaign when you need the background of a broadcast.',
    'Check who is handling the conversation. If AI is handling it, use Take Conversation to take over. If it belongs to another team member, ask an owner or administrator to reassign it.',
    'Type your message in Write a reply. Use Reply beside a specific message when your response needs to quote it.',
    'Use Attach image or document for a file, or Send location for a location. Review the message, attachment, and recipient before sending.',
    'Select Send reply or Send attachment. Check the message status in the conversation. New staff messages and customer replies bring active conversations to the top of the queue.'
  ],practice:'Ask a test contact what product they need. Reply to their answer using the Reply control so your message includes its context.',notes:['A previous campaign is background history; it does not prove the customer used WhatsApp’s quoted-reply feature.','If WhatsApp rejects a reply, check the displayed reason. An approved template may be required to restart contact.','Image previews load inside the conversation. Use Open full-size image for a larger view or Retry preview if loading fails.'],related:['handoff-resolve','copilot','delivery-problems']},
  {id:'handoff-resolve',category:'Team Inbox',title:'Triage, assignment, and returning a chat to AI',minutes:3,section:'messages',intro:'Keep each conversation with the right person and close staff handoffs when the work is finished.',steps:[
    'Use More views → Needs Attention to find chats waiting for staff. Check the customer’s question before deciding who should handle it.',
    'Take Conversation when you will handle the chat. Owners and administrators can use Details to assign a conversation to another team member.',
    'Use My conversations to return to your assigned work. Send the follow-up and record any business information your team needs in its usual sales system.',
    'When you have finished helping, select Resolve & return to AI in the conversation header.',
    'Confirm that the conversation shows as resolved. The next incoming customer message can return to the workspace’s configured AI or automations.',
    'Use the Resolved view to find closed conversations. Reopen Conversation is available when staff need to resume handling a resolved chat.'
  ],practice:'Take a test chat, send a helpful response, resolve it, and then send a new message from the customer’s phone to check your configured automation.',notes:['Resolving a chat does not send an AI reply immediately or repeat earlier messages.','AI responses require an eligible, configured live agent. A resolved chat alone does not create or activate an agent.'],related:['inbox-replies','ai-agent','copilot']},
  {id:'copilot',category:'Team Inbox',title:'Ask Copilot for lead summaries and follow-ups',minutes:3,section:'messages',intro:'Ask ZedPing Ai Copilot questions about your open inbox and open the matching conversations for review.',steps:[
    'Open Team Inbox and select Ai assistant. Copilot is available to eligible Business and Pro workspaces.',
    'Type a specific request into Ask about your open inbox. For example: “Show warm leads that still need qualifying, and suggest the next question for each.”',
    'Select Ask ZedPing Ai. The review works through open chats in batches and shows progress. Each batch uses one copilot request from your allowance.',
    'Read the matching conversation summaries, supporting message excerpts, and suggested next steps. Use Stop review if you want to stop; results shown at that point may be partial.',
    'Select Open conversation on a result. The assistant closes and the full chat opens so you can read the context and follow up.',
    'For one selected conversation, use Classify selected lead or Suggest a reply. Review a suggested reply before using it in the reply box and sending it yourself.'
  ],example:'Show customers interested in tonneau covers who have not provided their vehicle model. Suggest a short follow-up question for each.',notes:['Copilot reviews bounded recent text from open conversations. It does not review every historical message or interpret attachment contents in this review.','Suggestions do not send messages, update lead records, or assign conversations. Verify conclusions against the actual chat.','A warm-lead suggestion is based on stated interest and available context, not a guaranteed sale.'],related:['inbox-replies','handoff-resolve','message-usage']},
  {id:'contacts-groups',category:'Contacts',title:'Add contacts and create focused groups',minutes:4,section:'contacts',intro:'Use groups to reach the people who are interested in a particular service, product, or announcement.',steps:[
    'Open Contacts. Use Import Contacts to upload a supported contact file, following the fields and validation shown in the import screen.',
    'Check the name and complete international phone number, including the country code. Correct invalid numbers before using them in a campaign.',
    'Open Groups & segments and choose New Contact Group. Give the group a clear name, such as “Grade 3 parents” or “Tonneau cover enquiries”.',
    'Add the relevant existing contacts, or use the group’s upload option. Check the resulting member count and the numbers shown.',
    'Keep groups relevant to the message. Separate prospective customers, existing customers, and different product interests where useful.',
    'Before each broadcast, review the audience again. Marketing opt-outs are excluded from eligible marketing recipients.'
  ],practice:'Create a small group called “Staff test contacts” and add only colleagues who have agreed to help with testing.',notes:['Having a phone number in a file is not evidence that its owner agreed to receive marketing.','Do not assume the same customer should receive every campaign. Review the audience and recent conversation history before sending.'],related:['campaigns','school-examples','templates']},
  {id:'templates',category:'Campaigns',title:'Create a WhatsApp message template',minutes:5,section:'templates',intro:'Prepare a reusable message and submit it for approval before using it in a template broadcast.',steps:[
    'Open WhatsApp → Templates and choose the create-template control. Template management requires an eligible workspace role.',
    'Enter a clear template name and select the category and language. Match the category to the real purpose of the message.',
    'Choose a header: none, text, image, or PDF document. When using media, provide the sample required by the creation form.',
    'Write the message body in the large editor. Keep it clear, useful, and relevant to the audience.',
    'If personalizing the message, use consecutive placeholders such as {{1}} and {{2}} and supply the example values requested. Add a footer or supported buttons if needed.',
    'Review the content and submit the template. Check its approval status before using it in a campaign. If it is rejected, review the reason and revise the content.'
  ],example:'Hello {{1}}, this is a reminder that the Grade 3 parent meeting is on {{2}} at {{3}}. Please reply if you need assistance.',notes:['Approval is handled by the messaging provider and Meta; submitting a template does not guarantee approval.','A sample image used for approval is not automatically attached to a later broadcast. Select the actual image or PDF when composing the campaign.','Owners and administrators should review business details, prices, dates, and links before submission.'],related:['campaigns','delivery-problems','school-examples']},
  {id:'campaigns',category:'Campaigns',title:'Send a broadcast and check its progress',minutes:5,section:'broadcasts',intro:'A broadcast sends a separate message to each eligible recipient. Review the group carefully before starting.',steps:[
    'Open Campaigns and select New campaign.',
    'Choose the sending business number, the contact group, and an approved template in the correct language.',
    'Complete any template variables. For an image or document header, upload the actual file you want recipients to receive.',
    'Select Review broadcast. Check selected contacts, eligible recipients, opt-outs, the sending number, and the message preview.',
    'Confirm sending once. ZedPing opens the campaign progress page. You can leave that page while sending continues.',
    'Review the saved campaign outcome and delivery metrics. Sent means submission has finished; check Delivered, Read, failures, and awaiting outcomes to understand what reached customers.'
  ],practice:'Send to your Staff test contacts group, reply from one recipient, and confirm the conversation appears in Team Inbox.',notes:['One message to 100 recipients uses 100 recipient messages, rather than one message for the whole broadcast.','Submission and delivery are separate. A provider can accept a message and later report that it could not be delivered.','If progress is unclear, open Campaigns and inspect the existing activity before sending again. Resending can create duplicate messages.','A broadcast can partially send if the available allowance runs out. Check its recorded outcome before following up.'],related:['delivery-problems','message-usage','templates']},
  {id:'delivery-problems',category:'Troubleshooting',title:'A message failed or has not arrived',minutes:4,section:'broadcasts',intro:'Use the saved campaign details or conversation status to find out whether sending failed or delivery is still pending.',steps:[
    'Open the relevant campaign in Campaigns. Check its processing state and recipient counts before assuming it was not sent.',
    'Compare Accepted for sending with Delivered, Read, Provider failures, and Awaiting delivery outcome.',
    'Read the listed failure reason. Check the sending number, recipient number, approved template, variables, and any required header file.',
    'Open Overview or Billing to check your subscription state and available template-message balance.',
    'For payment, account restrictions, or provider-limit errors, ask your administrator or ZedPing support to check the specific account. Adding funds does not resolve every possible delivery error.',
    'Contact support with your workspace name, campaign name, approximate sending time, displayed error, and a screenshot. Avoid sharing passwords or access tokens.'
  ],notes:['Read messages are included in delivered totals; do not add those totals together.','An awaiting delivery outcome is not proof of delivery or failure.','When only some recipients failed, inspect their reasons before deciding whether any deliberate retry is appropriate.'],related:['campaigns','message-usage','inbox-replies']},
  {id:'content-library',category:'AI & automation',title:'Build a useful Content Library',minutes:4,section:'content',intro:'Save accurate business information and reusable content so staff and configured automations can use consistent answers.',steps:[
    'Open Content Library and select Add Content.',
    'Choose the content type offered by the form, such as text, link, image, or document. Use a name that staff will recognize.',
    'Add the content and description. Keep related facts together: product, price, compatibility, conditions, and validity dates where relevant.',
    'Save the item. For an image knowledge review, check the extracted information, correct errors, and confirm what can be used by ZedPing Ai.',
    'When configuring an AI agent, select the appropriate knowledge sources. Saving content does not automatically attach every item to every agent.',
    'Update or archive information when prices, stock policies, promotions, or services change. Publish the corresponding agent update when required.'
  ],practice:'Add a short text item with your business hours, location, and the details a customer should provide when requesting a quote.',notes:['Review image-extracted information before approval. Unclear text or missing details should not be treated as confirmed facts.','Content Library is a source of business information; the agent’s draft and live configuration are managed separately.'],related:['ai-agent','automations','templates']},
  {id:'ai-agent',category:'AI & automation',title:'Set up and update ZedPing Ai',minutes:6,section:'zoeAi',intro:'Configure what your AI agent should answer, which information it can use, and when it should hand a customer to staff.',steps:[
    'Open ZedPing Ai and create an agent or open an existing one. Agent management requires an eligible plan and workspace role.',
    'Set the agent name, instructions, intended business number, and the behavior available in its configuration form.',
    'Select approved, relevant knowledge sources. Specify which questions should be handled by a team member, including quotation enquiries where appropriate.',
    'Save the draft. Use the private Test Agent area to check common questions, missing information, prices, and handoff requests.',
    'Follow the activation review. Test-mode activation uses approved test contacts; Go Live is a separate step for eligible customer traffic.',
    'After editing an active agent, use Update Live Agent to publish the draft changes. Confirm the live version has updated. Pause Agent when you need to stop the agent’s responses.'
  ],practice:'Test a straightforward question, an ambiguous request, and a request for a human. Confirm the answers use your approved information and the handoff behaves as intended.',notes:['A saved draft is not automatically a live update.','The inbox Copilot is a staff assistant; your configured live AI agent handles eligible customer messages.','Staff takeover pauses automated handling for that conversation. Resolve the handoff when the team is finished.'],related:['content-library','handoff-resolve','copilot']},
  {id:'automations',category:'AI & automation',title:'Create a keyword or custom automation',minutes:4,section:'automations',intro:'Use automations for repeatable responses such as opening hours, FAQs, welcome messages, and human handoffs.',steps:[
    'Open Automations. Browse the library and recommendations, or choose the custom automation builder.',
    'Choose the supported automation type and define when it should run. For keyword rules, enter the customer phrases the form requests.',
    'Write the response or choose supported Content Library content. Use a clear customer-facing answer.',
    'Review the trigger, response, and any active-rule conflicts before activation.',
    'Activate the automation and test it from a customer contact using the expected phrase.',
    'Review Active automations and the available history when checking behavior. Pause or edit rules that are outdated or conflict with another customer journey.'
  ],example:'When a customer asks “opening hours”, respond with your verified business hours, address, and the next step for booking.',notes:['Use the trigger format shown in the builder. Do not assume an exact-phrase rule understands every variation of a question.','A staff-controlled conversation may suppress automated replies until the handoff is resolved.'],related:['chatflows','content-library','handoff-resolve']},
  {id:'chatflows',category:'AI & automation',title:'Build and test a chatflow',minutes:4,section:'chatbotFlows',intro:'Use a chatflow when customers need to follow a sequence rather than receive a single keyword response.',steps:[
    'Open Automations → Chatbot flows and create a flow or open an existing draft.',
    'Set the entry trigger and business number as requested by the builder.',
    'Add the supported message, question, branch, and handoff steps you need. Keep each question simple and offer clear choices.',
    'Connect the steps and review every branch, including what happens when an answer does not match the expected option.',
    'Use the flow’s available test and validation controls before publishing or activating it.',
    'Run the flow from a test customer contact and check the conversation in Team Inbox. Refine any unclear instructions before wider use.'
  ],practice:'Sketch a short journey: choose a service → provide the requested details → ask for staff assistance when needed.',notes:['Available step types and controls are those offered by your current builder.','Avoid collecting information the business does not need, and explain what customers should do if they need a person.'],related:['automations','handoff-resolve','inbox-replies']},
  {id:'message-usage',category:'Account & usage',title:'Understand your message balance and renewal',minutes:3,section:'billing',intro:'Check your actual workspace balance and subscription state before planning a large campaign.',steps:[
    'Open Overview for a quick balance snapshot, or Settings → Billing for the detailed usage and plan information.',
    'Read the remaining template-message allowance and the amount used or reserved. Reserved messages may be set aside while sending is in progress.',
    'Estimate the recipient messages needed. For example, sending one template to 400 eligible contacts requires 400 recipient messages.',
    'If the balance is too low, use the extra-message or support action shown in the dashboard to request a top-up and confirm the current price and payment instructions.',
    'If the workspace shows a renewal restriction, arrange renewal and ask support to confirm activation after payment.',
    'Review the campaign outcome after a send. Do not assume a higher ZedPing allowance changes Meta’s separate recipient or account limits.'
  ],notes:['Your dashboard balance is the source for your current allowance. Plan prices and extra-usage rates should be confirmed in Billing or with support.','AI-agent replies and Copilot requests have separate usage controls. A template-message balance does not mean unlimited AI usage.','The displayed subscription state must be active for the relevant messaging features to operate.'],related:['campaigns','delivery-problems','copilot']},
  {id:'analytics',category:'Getting started',title:'Review activity in Analytics',minutes:3,section:'analytics',intro:'Use the workspace activity reports to check messaging, campaigns, conversation workload, automations, and AI configuration.',steps:[
    'Open Analytics and check that you are viewing the correct workspace.',
    'Choose the Messaging, Campaigns, Conversations, Automations, or ZedPing Ai tab for the area you need.',
    'Read the summary and activity records together. Conversation counts show the current queue; they do not explain every customer outcome.',
    'Open the relevant campaign or conversation for detailed evidence when investigating a specific message or lead.',
    'Use Refresh when you need an updated snapshot. Share the relevant business follow-up or operational issue with the person responsible.'
  ],notes:['A sent or accepted message is different from a delivered message. Check the campaign delivery report for its delivery outcome.','These reports do not automatically establish a completed sale or revenue attribution. Keep your sales records up to date in your business system.'],related:['campaigns','delivery-problems','handoff-resolve']},
  {id:'account-team',category:'Account & usage',title:'Manage your account and invite your team',minutes:3,section:'account',intro:'Keep personal login details current and give colleagues access through their own accounts.',steps:[
    'Open My Account under Settings to update your personal display name using the profile form.',
    'To change your password, enter the current password, the new password, and its confirmation. Follow the requirements shown by the form.',
    'If you cannot sign in, use the password-reset option on the login screen. Check the inbox and spam folder for the reset email.',
    'Owners and administrators can open Settings → Team to invite colleagues. Check the email address and role before sending an invitation.',
    'Ask the colleague to follow the invitation and sign in with the intended email address.',
    'Assign work in Team Inbox and check My conversations to verify each person sees their own assigned conversations.'
  ],notes:['Personal profile changes are separate from your business name and WhatsApp display-name configuration.','Each colleague should use their own login. If a button is unavailable, check your workspace role with an administrator.'],related:['getting-started','handoff-resolve']},
  ...industryGuides,
  {id:'school-examples',category:'Practical examples',title:'Broadcast ideas for a school',minutes:4,section:'broadcasts',intro:'Use focused parent and prospect groups so each message reaches the people it is relevant to.',steps:[
    'Create groups by campus, grade, or enquiry type where appropriate, and keep the intended audience up to date.',
    'Use parent meeting reminders to share the date, time, location, and who should attend.',
    'Send school notices such as term opening dates, transport changes, event logistics, or document-collection instructions to the affected group.',
    'Use personalized fee reminders only with accurate individual details. Review every variable mapping and recipient before sending.',
    'For prospective parents, send relevant admissions or open-day information to contacts who agreed to receive it.',
    'Monitor replies in Team Inbox. Assign questions to the right staff member and resolve the conversation after helping.'
  ],examples:schoolMessageExamples,notes:['Use these as drafting ideas and submit the appropriate template for approval. Confirm the category for the actual purpose of the message.','Avoid broadcasting sensitive individual learner information. Check audience and variable mappings carefully.'],related:['contacts-groups','templates','campaigns']}
];
export const helpCategories = ['All guides',...new Set(helpGuides.map(guide=>guide.category))];
export function searchHelpGuides(query='',category='All guides') {
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return helpGuides.filter(guide=>(category==='All guides'||guide.category===category)&&words.every(word=>[guide.title,guide.intro,guide.category,...guide.steps,...(guide.notes||[]),guide.example||'',...(guide.checklist||[]),...(guide.examples||[]).flatMap(item=>[item.title,item.audience,item.message,item.followUp])].join(' ').toLowerCase().includes(word)));
}
export function guideNarration(guide) {
  return [guide.title,guide.intro,...(guide.checklist||[]).map(item=>`Required. ${item}`),...guide.steps.map((step,index)=>`Step ${index+1}. ${step}`),guide.example?`Example. ${guide.example}`:'',...(guide.examples||[]).map(item=>`${item.title}. Audience: ${item.audience}. Example message: ${item.message}. Follow-up: ${item.followUp}`),guide.practice?`Try it. ${guide.practice}`:'',...(guide.notes||[])].filter(Boolean).join('\n\n');
}
