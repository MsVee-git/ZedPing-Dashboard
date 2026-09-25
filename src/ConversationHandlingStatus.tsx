import React from 'react';

export function conversationHandlingStatus(conversation) {
  if (conversation?.status === 'resolved') return { label: 'Resolved', badge: 'badge-cream' };
  if (conversation?.status === 'needs_attention' || conversation?.control_mode === 'needs_attention') return { label: 'NEEDS ATTENTION', badge: 'badge-gold' };
  if (conversation?.control_mode === 'human') return { label: 'TEAM MEMBER HANDLING', badge: 'badge-blue' };
  if (conversation?.control_mode === 'automation') return { label: 'ZOE IS HANDLING THIS CHAT', badge: 'badge-green' };
  return { label: 'Status unavailable', badge: 'badge-cream' };
}

export function ConversationHandlingStatus({ conversation }) {
  const status = conversationHandlingStatus(conversation);
  return <span className={'badge ' + status.badge}>{status.label}</span>;
}
