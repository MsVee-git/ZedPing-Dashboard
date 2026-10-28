import { useEffect, useRef, useState } from 'react';
import { PageTitle, RouteLink } from './WorkspaceUI';
import { helpGuides, helpCategories, searchHelpGuides, guideNarration } from './lib/helpGuides';
import './helpCenter.css';

export function HelpCenter({ guideId, navigate }:any) {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('All guides');
  const [audio,setAudio]=useState('idle');
  const [audioError,setAudioError]=useState('');
  const heading=useRef<HTMLHeadingElement>(null);
  const utterance=useRef<SpeechSynthesisUtterance|null>(null);
  const guide=helpGuides.find(item=>item.id===guideId);
  const canListen=typeof window!=='undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  useEffect(()=>{
    if(utterance.current){window.speechSynthesis?.cancel();utterance.current=null;}
    setAudio('idle');setAudioError('');heading.current?.focus();
    return()=>{if(utterance.current){window.speechSynthesis?.cancel();utterance.current=null;}};
  },[guideId]);
  function listen() {
    if(!guide || !canListen)return;
    if(audio==='playing'){window.speechSynthesis.pause();setAudio('paused');return;}
    if(audio==='paused'){window.speechSynthesis.resume();setAudio('playing');return;}
    const speech=new SpeechSynthesisUtterance(guideNarration(guide));
    speech.lang='en-GB';speech.rate=.95;
    speech.onend=()=>{if(utterance.current===speech){utterance.current=null;setAudio('idle');}};
    speech.onerror=()=>{if(utterance.current===speech){utterance.current=null;setAudio('idle');setAudioError('Read-aloud could not start. Try your browser or device’s text-to-speech option.');}};
    utterance.current=speech;setAudioError('');setAudio('playing');window.speechSynthesis.speak(speech);
  }
  const support='https://wa.me/260778621168?text='+encodeURIComponent(`Hello ZedPing, I need help${guide?' with '+guide.title:''}.`);
  const matches=searchHelpGuides(query,category);
  return <div className="pad help-center">
    <PageTitle title="Help & Guides" description="Practical steps for using ZedPing, from your first login to daily follow-ups." action={<a className="btn btn-wire" href={support} target="_blank" rel="noreferrer">Contact support</a>}/>
    {guideId ? guide ? <>
      <div className="help-toolbar"><RouteLink route="help" navigate={navigate} className="btn btn-wire">← All guides</RouteLink><div className="help-audio">{canListen&&<><button className="btn btn-wire" onClick={listen}>{audio==='playing'?'Pause reading':audio==='paused'?'Resume reading':'Listen to this guide'}</button>{audio!=='idle'&&<button className="btn btn-wire" onClick={()=>{utterance.current=null;window.speechSynthesis.cancel();setAudio('idle');}}>Stop reading</button>}</>}<button className="btn btn-wire" onClick={()=>window.print()}>Print / Save as PDF</button></div></div>
      {audioError&&<p role="status">{audioError}</p>}
      <article className="help-article" aria-labelledby="help-guide-title">
        <div className="help-eyebrow">{guide.category} · {guide.minutes} minute guide</div><h2 id="help-guide-title" ref={heading} tabIndex={-1}>{guide.title}</h2><p className="help-intro">{guide.intro}</p>
        <section className="help-required" hidden={!guide.checklist?.length}><h3>Required before onboarding</h3><ul>{guide.checklist?.map(item=><li key={item}>{item}</li>)}</ul></section>
        <ol className="help-steps">{guide.steps.map((step,index)=><li key={index}>{step}</li>)}</ol>
        {guide.example&&<section className="help-example"><h3>Example</h3><p>{guide.example}</p></section>}
        {!!guide.examples?.length&&<section className="help-use-cases"><h3>Messages you can adapt</h3><p>Replace the placeholders with verified details. Submit the relevant template for approval before a broadcast.</p>{guide.examples.map(item=><article className="help-use-case" key={item.title}><h4>{item.title}</h4><p><strong>Who to send it to:</strong> {item.audience}</p><blockquote>{item.message}</blockquote><p><strong>What staff do next:</strong> {item.followUp}</p></article>)}</section>}
        {guide.practice&&<section className="help-practice"><h3>Try it</h3><p>{guide.practice}</p></section>}
        {!!guide.notes?.length&&<section className="help-notes"><h3>Things to know</h3><ul>{guide.notes.map(note=><li key={note}>{note}</li>)}</ul></section>}
        {!!guide.resources?.length&&<section className="help-source-links"><h3>Official guidance</h3><ul>{guide.resources.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a></li>)}</ul></section>}
        <div className="help-guide-actions"><RouteLink route={guide.section} navigate={navigate} className="btn btn-gold">Open {({overview:'Overview',messages:'Team Inbox',contacts:'Contacts',templates:'Templates',broadcasts:'Campaigns',content:'Content Library',zoeAi:'ZedPing Ai',automations:'Automations',chatbotFlows:'Chatbot flows',billing:'Billing',account:'My Account',analytics:'Analytics'})[guide.section]}</RouteLink></div>
      </article>
      <section className="help-related"><h2>Related guides</h2><div className="help-grid">{guide.related.map(id=>helpGuides.find(item=>item.id===id)).filter(Boolean).map(item=><GuideCard key={item.id} guide={item} navigate={navigate}/>)}</div></section>
    </> : <section className="help-article"><h2 ref={heading} tabIndex={-1}>Guide unavailable</h2><p>Choose a guide from the Help & Guides library.</p><RouteLink route="help" navigate={navigate} className="btn btn-wire">View all guides</RouteLink></section> : <>
      <section className="help-welcome"><div><h2>Start here, then learn as you go.</h2><p>Short guides you can read, listen to, and practise in your workspace.</p></div><RouteLink route={{section:'help',resourceKind:'guide',resourceId:'getting-started'}} navigate={navigate} className="btn btn-gold">Start with the basics</RouteLink></section>
      <aside className="help-onboarding-requirement"><h2>Required: Meta business verification</h2><p>Before onboarding, prepare your ZRA tax certificate, PACRA certificate, a working business website and a professional email address on your business domain.</p><RouteLink route={{section:'help',resourceKind:'guide',resourceId:'business-verification'}} navigate={navigate} className="btn btn-wire">View required checklist</RouteLink></aside>
      <div className="help-search"><label htmlFor="help-search">What do you want to do?</label><input className="input" id="help-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search: broadcasts, reply, images, AI, message balance…"/><label htmlFor="help-category">Topic</label><select className="input" id="help-category" value={category} onChange={event=>setCategory(event.target.value)}>{helpCategories.map(item=><option key={item}>{item}</option>)}</select></div>
      <p className="help-count" role="status">{matches.length} guide{matches.length===1?'':'s'}</p><div className="help-grid">{matches.map(item=><GuideCard key={item.id} guide={item} navigate={navigate}/>)}</div>
      {!matches.length&&<div className="help-empty"><p>No guides match this search. Try another phrase or topic.</p><button className="btn btn-wire" onClick={()=>{setQuery('');setCategory('All guides');}}>Show all guides</button></div>}
      <aside className="help-support"><h2>Still need a hand?</h2><p>Send support your business name, the feature, what you tried, and a screenshot of any error. Keep passwords and access tokens private.</p><a className="btn btn-wire" href={support} target="_blank" rel="noreferrer">Ask ZedPing support</a></aside>
    </>}
  </div>;
}
function GuideCard({guide,navigate}:any) {
  return <RouteLink className="help-card" route={{section:'help',resourceKind:'guide',resourceId:guide.id}} navigate={navigate}><span className="help-eyebrow">{guide.category} · {guide.minutes} min</span><h3>{guide.title}</h3><p>{guide.intro}</p><span className="help-card-action">Read guide →</span></RouteLink>;
}
