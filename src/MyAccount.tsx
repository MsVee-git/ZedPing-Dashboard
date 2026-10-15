import { useRef, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { PageTitle } from './WorkspaceUI';
import { createAccountService } from './lib/accountManagement';
import './myAccount.css';

type Props = { user: User; auth: SupabaseClient['auth']; verifyPassword: (email: string, password: string, userId: string) => Promise<void> };
export function MyAccount({ user, auth, verifyPassword }: Props) {
  const [name, setName] = useState(user.user_metadata?.name || '');
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [nonce, setNonce] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ area: '', text: '', ok: false });
  const inFlight = useRef(false);
  const service = createAccountService({ auth, verifyPassword, userId: user.id });
  async function run(area: string, action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(area); setNotice({ area: '', text: '', ok: false });
    try { await action(); }
    catch (error: any) { setNotice({ area, text: error?.message || 'We could not save this change. Please try again.', ok: false }); }
    finally { setCurrentPassword(''); setPassword(''); setConfirmation(''); setEmailPassword(''); setNonce(''); inFlight.current = false; setBusy(''); }
  }
  function feedback(area: string) { return notice.area === area ? <p className={notice.ok ? 'account-success' : 'account-error'} role={notice.ok ? 'status' : 'alert'}>{notice.text}</p> : null; }
  return <div className="pad my-account">
    <PageTitle title="My Account" description="Manage your personal profile, sign-in details and account security." />
    <p className="account-intro">These settings belong to your login and apply across your workspaces. Your business profile is managed separately.</p>
    <section className="work-surface account-card" aria-labelledby="account-profile-title">
      <h2 id="account-profile-title">Personal profile</h2>
      <form onSubmit={event => { event.preventDefault(); run('profile', async () => {
        await service.saveName(name); setNotice({ area: 'profile', text: 'Your display name has been saved.', ok: true });
      }); }}>
        <fieldset disabled={Boolean(busy)}>
          <label htmlFor="account-name">Display name</label>
          <input id="account-name" className="input" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
          <p>This is your personal name, not your business name or a separate login username.</p>
          <button className="btn btn-gold" type="submit">{busy === 'profile' ? 'Saving…' : 'Save display name'}</button>
        </fieldset>
        {feedback('profile')}
      </form>
    </section>
    <section className="work-surface account-card" aria-labelledby="account-email-title">
      <h2 id="account-email-title">Login email</h2>
      <p className="account-current-email">Current email: <strong>{user.email}</strong></p>
      {user.new_email && <p role="status">Pending confirmation: {user.new_email}</p>}
      <form onSubmit={event => { event.preventDefault(); run('email', async () => {
        await service.changeEmail({ email, currentPassword: emailPassword, redirectTo: window.location.origin + '/settings/account' });
        setEmail(''); setNotice({ area: 'email', text: 'Check your inbox to confirm the email change. You may need to confirm it from both email addresses. Your business contact email is unchanged.', ok: true });
      }); }}>
        <fieldset disabled={Boolean(busy)}>
          <label htmlFor="account-email">New login email</label>
          <input id="account-email" className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required />
          <label htmlFor="account-email-password">Current password</label>
          <input id="account-email-password" className="input" type="password" autoComplete="current-password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} required />
          <button className="btn btn-gold" type="submit">{busy === 'email' ? 'Requesting change…' : 'Change login email'}</button>
        </fieldset>
        {feedback('email')}
      </form>
    </section>
    <section className="work-surface account-card" aria-labelledby="account-password-title">
      <h2 id="account-password-title">Change password</h2>
      <form onSubmit={event => { event.preventDefault(); run('password', async () => {
        await service.changePassword({ currentPassword, password, confirmation, nonce });
        setNotice({ area: 'password', text: 'Your password has been changed.', ok: true });
      }); }}>
        <fieldset disabled={Boolean(busy)}>
          <label htmlFor="account-current-password">Current password</label>
          <input id="account-current-password" className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          <label htmlFor="account-new-password">New password</label>
          <input id="account-new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required aria-describedby="account-password-help" />
          <p id="account-password-help">Use at least 8 characters. The account security policy may require a stronger password.</p>
          <label htmlFor="account-confirm-password">Confirm new password</label>
          <input id="account-confirm-password" className="input" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={8} required />
          <details className="account-verification"><summary>Asked for an email verification code?</summary>
            <p>If your password change requires verification, email yourself a code, then enter it below with your passwords.</p>
            <button className="btn btn-wire" type="button" onClick={() => run('verification', async () => {
              await service.sendVerificationCode(); setNotice({ area: 'verification', text: 'Verification code requested. Check your confirmed email address, then enter the code and your passwords.', ok: true });
            })}>Email verification code</button>
            <label htmlFor="account-nonce">Verification code</label>
            <input id="account-nonce" className="input" autoComplete="one-time-code" inputMode="numeric" value={nonce} onChange={e => setNonce(e.target.value)} maxLength={128} />
          </details>
          <button className="btn btn-gold" type="submit">{busy === 'password' ? 'Changing password…' : 'Change password'}</button>
        </fieldset>
        {feedback('password')}{feedback('verification')}
      </form>
    </section>
    <section className="work-surface account-card" aria-labelledby="account-sessions-title">
      <h2 id="account-sessions-title">Other sessions</h2>
      <p>Sign out other browsers and devices while staying signed in here. Existing access can continue until the current access token expires.</p>
      <button className="btn btn-wire" type="button" disabled={Boolean(busy)} onClick={() => {
        if (!window.confirm('Sign out your other browsers and devices? You will stay signed in here.')) return;
        run('sessions', async () => { await service.signOutOthers(); setNotice({ area: 'sessions', text: 'Other sessions have been signed out. This session remains active.', ok: true }); });
      }}>{busy === 'sessions' ? 'Signing out…' : 'Sign out other sessions'}</button>
      {feedback('sessions')}
    </section>
  </div>;
}
