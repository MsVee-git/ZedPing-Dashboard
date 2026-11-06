// Mobile browsers can suspend refresh timers while backgrounded. Recover once
// when the API rejects a token, sharing refresh across concurrent inbox loads.
export function createSessionRequest(auth, request) {
  let refreshing = null;
  return async (input, init = {}) => {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    const original = data?.session;
    const send = session => {
      const headers = new Headers(init.headers);
      headers.delete('Authorization');
      if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
      return request(input, { ...init, headers });
    };
    const response = await send(original);
    if (response.status !== 401 || !original) return response;
    const latest = await auth.getSession();
    if (latest.error || !latest.data?.session || latest.data.session.user?.id !== original.user?.id) return response;
    let session = latest.data.session;
    if (session.access_token === original.access_token) {
      if (!refreshing) {
        refreshing = Promise.resolve().then(() => auth.refreshSession()).finally(() => { refreshing = null; });
      }
      const refreshed = await refreshing;
      if (refreshed.error || !refreshed.data?.session) return response;
      session = refreshed.data.session;
    }
    if (session.user?.id !== original.user?.id || init.signal?.aborted) return response;
    return send(session);
  };
}
