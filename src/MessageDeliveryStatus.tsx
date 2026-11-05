import React from 'react';
import { messageDeliveryState } from './lib/messageDeliveryState.js';
export function MessageDeliveryStatus({message}) {
 const state=messageDeliveryState(message);
 if(!state)return null;
 return <span className={'message-delivery '+(state.read?'is-read':'')} aria-label={state.label} title={state.label}>
  {state.ticks>0?<svg aria-hidden="true" width={state.ticks===2?21:16} height="15" viewBox={state.ticks===2?'0 0 26 18':'0 0 18 18'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2 9 4 4 9-10"/>{state.ticks===2&&<path d="m11 12 2 2L24 3"/>}</svg>:<span aria-hidden="true">{state.failed?'!':'◷'}</span>}
  <span>{state.label}</span>
 </span>;
}
