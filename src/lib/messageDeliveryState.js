export function messageDeliveryState(message) {
 if(message?.direction!=='outbound')return null;
 const status=String(message.status||'').toLowerCase();
 if(status==='read')return {label:'Read',ticks:2,read:true};
 if(status==='delivered')return {label:'Delivered',ticks:2};
 if(status==='sent')return {label:'Sent',ticks:1};
 if(['failed','error','rejected','undelivered'].includes(status))return {label:'Failed',ticks:0,failed:true};
 if(['accepted','submitted','queued','pending','sending'].includes(status))return {label:'Pending delivery',ticks:0};
 return {label:'Delivery status unavailable',ticks:0};
}
