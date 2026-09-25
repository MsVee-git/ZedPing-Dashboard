import { useLayoutEffect, useRef } from 'react';

export function useInboxScroll(selectedId, messages, loading) {
  const gridRef = useRef(null);
  const historyRef = useRef(null);
  const followLatest = useRef(true);
  const previousConversation = useRef('');
  const previousScrollTop = useRef(0);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const fit = () => {
      const top = grid.getBoundingClientRect().top + window.scrollY;
      const bottom = Math.max(16, parseFloat(getComputedStyle(grid.parentElement).paddingBottom) || 0);
      grid.style.setProperty('--inbox-height', `${Math.max(240, window.innerHeight - top - bottom)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(grid.parentElement);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history || loading) return;
    if (previousConversation.current !== selectedId || followLatest.current) {
      history.scrollTop = history.scrollHeight;
      followLatest.current = true;
    } else {
      history.scrollTop = previousScrollTop.current;
    }
    previousConversation.current = selectedId;
  }, [selectedId, messages, loading]);

  const onHistoryScroll = () => {
    const history = historyRef.current;
    if (history) {
      previousScrollTop.current = history.scrollTop;
      followLatest.current = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
    }
  };
  return { gridRef, historyRef, onHistoryScroll };
}

// Size only the reply field; sending and conversation state stay with TeamInbox.
export function useInboxComposer(reply, selectedId, loading) {
  const composerRef = useRef(null);
  useLayoutEffect(() => {
    const field = composerRef.current;
    if (!field) return;
    const resize = () => {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight + 2}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [reply, selectedId, loading]);
  return composerRef;
}
