import React from 'react';

export function BroadcastSubmissionReceipt({ result }: { result: {accepted:number;failed:number} | null }) {
  if (!result) return null;
  const label=result.accepted > 0 ? (result.failed > 0 ? 'Partially sent' : 'Sent') : 'Not sent';
  return <div role="status" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}>
    <button type="button" className="btn btn-gold" disabled style={{opacity:1,cursor:'default',fontSize:14}}>{label}</button>
    <span style={{fontSize:14}}>{result.accepted} accepted for sending · {result.failed} submission failures. Delivery is tracked below.</span>
  </div>;
}
