// Submission state comes from the saved campaign, independently of delivery receipts.
export function campaignStatus(activity) {
  if (activity.status === 'completed') {
    if (activity.sent_count === 0) return {label:'Not sent',cls:'badge-cream'};
    return {label:Number(activity.failed_count) > 0 ? 'Partially sent' : 'Sent',cls:'badge-green'};
  }
  if (activity.status === 'failed') return {label:'Failed',cls:'badge-cream'};
  if (activity.status === 'pending') return {label:'Scheduled',cls:'badge-gold'};
  if (activity.status === 'sending') return {label:'Sending',cls:'badge-blue'};
  return {label:activity.status || 'Unknown',cls:'badge-cream'};
}
export function campaignReceipt(activity) {
  if (!activity || !['completed','failed'].includes(activity.status)) return null;
  // Missing historical counts must not become invented zeroes.
  if (!Number.isFinite(activity.sent_count) || !Number.isFinite(activity.failed_count)) return null;
  return {accepted:activity.sent_count,failed:activity.failed_count};
}
