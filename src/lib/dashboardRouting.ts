export const sectionPaths = Object.freeze({
  overview: "/dashboard",
  messages: "/team-inbox",
  contacts: "/contacts",
  contactGroups: "/contact-groups",
  broadcasts: "/broadcasts",
  automations: "/automations",
  chatbotFlows: "/chatbot-flows",
  content: "/content-library",
  zoeAi: "/zoe-ai",
  templates: "/whatsapp-templates",
  team: "/team-members",
  settings: "/settings"
});

const exact = new Map(Object.entries(sectionPaths).map(([section, path]) => [path, section]));
const resources = [
  { prefix: "/zoe-ai/agents/", section: "zoeAi", kind: "agent" },
  { prefix: "/chatbot-flows/", section: "chatbotFlows", kind: "flow" },
  { prefix: "/content-library/", section: "content", kind: "content" },
  { prefix: "/team-inbox/", section: "messages", kind: "conversation" },
  { prefix: "/contact-groups/", section: "contactGroups", kind: "contactGroup" }
];

export function parseDashboardRoute(pathname = window.location.pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (exact.has(path)) return { section: exact.get(path), resourceId: null, resourceKind: null };
  for (const route of resources) {
    if (!path.startsWith(route.prefix)) continue;
    const resourceId = decodeURIComponent(path.slice(route.prefix.length));
    if (resourceId && !resourceId.includes("/")) return { section: route.section, resourceId, resourceKind: route.kind };
  }
  return { section: "overview", resourceId: null, resourceKind: null, invalid: path !== "/" && path !== "/dashboard" };
}

export function routeToPath(route) {
  const section = sectionPaths[route?.section] ? route.section : "overview";
  if (!route?.resourceId) return sectionPaths[section];
  const prefix = resources.find((item) => item.section === section && item.kind === route.resourceKind)?.prefix;
  return prefix ? prefix + encodeURIComponent(route.resourceId) : sectionPaths[section];
}

export function safeParentRoute(route) {
  return { section: sectionPaths[route?.section] ? route.section : "overview", resourceId: null, resourceKind: null };
}

export function isResourceRoute(route) {
  return Boolean(route?.resourceId && route?.resourceKind);
}
