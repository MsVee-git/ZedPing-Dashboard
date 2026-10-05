// Canonical destinations; old customer bookmarks remain valid below.
export const sectionPaths = Object.freeze({
  overview: '/dashboard', messages: '/team-inbox', contacts: '/contacts',
  contactGroups: '/contacts/groups', broadcasts: '/campaigns',
  automations: '/automations/library', chatbotFlows: '/automations/flows',
  content: '/content-library', zoeAi: '/zed-ai/agents',
  whatsapp: '/whatsapp/numbers', templates: '/whatsapp/templates',
  analytics: '/analytics/messaging', team: '/settings/team', settings: '/settings/business',
  billing: '/settings/billing', integrations: '/settings/integrations'
});
const exact = new Map<string, string>(Object.entries(sectionPaths).map(([section, path]) => [path, section]));
Object.entries({ '/broadcasts':'broadcasts', '/contact-groups':'contactGroups', '/automations':'automations', '/chatbot-flows':'chatbotFlows', '/zoe-ai':'zoeAi', '/whatsapp-templates':'templates', '/team-members':'team', '/settings':'settings', '/whatsapp':'whatsapp', '/zed-ai':'zoeAi', '/analytics':'analytics' }).forEach(([path,section])=>exact.set(path,section));
const resources = [
  { prefix:'/zed-ai/agents/', section:'zoeAi', kind:'agent' },
  { prefix:'/automations/flows/', section:'chatbotFlows', kind:'flow' },
  { prefix:'/content-library/', section:'content', kind:'content' },
  { prefix:'/team-inbox/', section:'messages', kind:'conversation' },
  { prefix:'/contacts/groups/', section:'contactGroups', kind:'contactGroup' },
  { prefix:'/campaigns/', section:'broadcasts', kind:'campaign' },
  { prefix:'/zoe-ai/agents/', section:'zoeAi', kind:'agent' },
  { prefix:'/chatbot-flows/', section:'chatbotFlows', kind:'flow' },
  { prefix:'/contact-groups/', section:'contactGroups', kind:'contactGroup' }
];
export function parseDashboardRoute(pathname = window.location.pathname) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  if (exact.has(path)) return { section:exact.get(path), resourceId:null, resourceKind:null };
  if (path === '/automations/keywords') return { section:'automations', tab:'keywords', resourceId:null, resourceKind:null };
  if (path.startsWith('/analytics/') && ['campaigns','conversations','automations','ai'].includes(path.slice(11))) return { section:'analytics', tab:path.slice(11), resourceId:null, resourceKind:null };
  for (const route of resources) {
    if (!path.startsWith(route.prefix)) continue;
    try {
      const resourceId = decodeURIComponent(path.slice(route.prefix.length));
      if (resourceId && !resourceId.includes('/')) return { section:route.section, resourceId, resourceKind:route.kind };
    } catch { /* Malformed links render a recoverable route notice. */ }
  }
  return { section:'overview', resourceId:null, resourceKind:null, invalid:path !== '/' && path !== '/dashboard' };
}
export function routeToPath(route) {
  const section = sectionPaths[route?.section] ? route.section : 'overview';
  if (section === 'automations' && route?.tab === 'keywords') return '/automations/keywords';
  if (section === 'analytics' && ['campaigns','conversations','automations','ai'].includes(route?.tab)) return '/analytics/' + route.tab;
  const prefix = resources.find(item=>item.section === section && item.kind === route?.resourceKind)?.prefix;
  return route?.resourceId && prefix ? prefix + encodeURIComponent(route.resourceId) : sectionPaths[section];
}
export function safeParentRoute(route) { return { section:sectionPaths[route?.section] ? route.section : 'overview', resourceId:null, resourceKind:null }; }
export function isResourceRoute(route) { return Boolean(route?.resourceId && route?.resourceKind); }
