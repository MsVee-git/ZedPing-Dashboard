export function validateDisplayName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Enter a display name between 1 and 100 characters.');
  return name;
}
export function validatePassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Use at least 8 characters for your new password.');
  if (password !== confirmation) throw new Error('The new passwords do not match.');
}
export function createAccountService({ auth, verifyPassword, userId }) {
  async function currentUser() {
    const { data, error } = await auth.getUser();
    if (error || !data?.user || data.user.id !== userId) throw new Error('Your session changed. Sign in again before changing your account.');
    return data.user;
  }
  async function verifyCurrentPassword(password) {
    if (!password) throw new Error('Enter your current password.');
    const user = await currentUser();
    if (!user.email) throw new Error('This account has no password sign-in email.');
    await verifyPassword(user.email, password, user.id);
    await currentUser();
    return user;
  }
  return {
    async saveName(value) {
      const name = validateDisplayName(value);
      await currentUser();
      const { data, error } = await auth.updateUser({ data: { name } });
      if (error) throw error;
      return data.user;
    },
    async changePassword({ currentPassword, password, confirmation, nonce }) {
      validatePassword(password, confirmation);
      if (password === currentPassword) throw new Error('Choose a different new password.');
      await verifyCurrentPassword(currentPassword);
      const { error } = await auth.updateUser({ password, ...(nonce?.trim() ? { nonce: nonce.trim() } : {}) });
      if (error) throw error;
    },
    async changeEmail({ email, currentPassword, redirectTo }) {
      const next = String(email || '').trim();
      if (next.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) throw new Error('Enter a valid email address.');
      const user = await currentUser();
      if (next.toLowerCase() === user.email?.toLowerCase()) throw new Error('Enter a different email address.');
      await verifyCurrentPassword(currentPassword);
      const { data, error } = await auth.updateUser({ email: next }, { emailRedirectTo: redirectTo });
      if (error) throw error;
      return data.user;
    },
    async sendVerificationCode() {
      await currentUser();
      const { error } = await auth.reauthenticate();
      if (error) throw error;
    },
    async signOutOthers() {
      await currentUser();
      const { error } = await auth.signOut({ scope: 'others' });
      if (error) throw error;
    }
  };
}
