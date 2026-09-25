import { useLayoutEffect, useRef } from 'react';

export function useInboxScroll(selectedId, messages, loading) {
  const historyRef = useRef(null);
  const followLatest = useRef(true);
  const previousConversation = useRef('');
  const previousScrollTop = useRef(0);

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
  return { historyRef, onHistoryScroll };
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
