export function embeddedSignupLoginOptions(configId, session, appId) {
  if (typeof configId !== 'string' || !/^[0-9]{5,32}$/.test(configId)) {
    throw new Error('WhatsApp signup configuration is invalid. Contact ZedPing support.');
  }
  if ((session?.meta_app_id && session.meta_app_id !== appId) ||
      (session?.meta_config_id && session.meta_config_id !== configId)) {
    throw new Error('WhatsApp signup settings do not match. Contact ZedPing support before continuing.');
  }
  const options = {
    config_id: configId,
    response_type: 'code',
    override_default_response_type: true,
    extras: { version: 'v4' }
  };
  if (session?.provider === 'gupshup') {
    if (typeof session.solution_id !== 'string' || !/^[0-9]+$/.test(session.solution_id)) {
      throw new Error('WhatsApp partner setup is incomplete. Contact support.');
    }
    // Use the partner-hosted launch contract, rather than mixing it with
    // the direct Meta flow's extras.version option.
    options.extras = {
      setup: { solutionID: session.solution_id },
      featureType: '',
      sessionInfoVersion: '3'
    };
  } else if (session?.provider && session.provider !== 'meta') {
    throw new Error('WhatsApp connection provider is unsupported.');
  }
  return options;
}

export function partnerCompletionOutcome(result) {
  if (result?.provider !== 'gupshup') return null;
  if (result.provisioning_state === 'registration_confirmation_required') return 'confirmation_required';
  if (result.provisioning_state === 'in_progress') return 'in_progress';
  return 'recoverable_error';
}
