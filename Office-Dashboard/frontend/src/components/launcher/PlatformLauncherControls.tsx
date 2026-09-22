import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { launchApi, localLauncherApi } from '@/lib/api';
import type { PlatformAccount } from '@/types';

function errorText(error: unknown): string {
  const value = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return value?.response?.data?.error?.message || value?.message || 'Action failed';
}

export const PlatformLauncherControls: React.FC<{
  phoneId: string; account: PlatformAccount; localDeviceId: string | null;
}> = ({ phoneId, account, localDeviceId }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [identifier, setIdentifier] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const expected = account.accountHandle || account.loginIdentifier || account.displayName || 'the selected account';
  const sessionQuery = useQuery({
    queryKey: ['platform-session', phoneId, account.id, localDeviceId],
    queryFn: () => launchApi.session(phoneId, account.id, localDeviceId!),
    enabled: expanded && !!localDeviceId,
  });
  const session = sessionQuery.data;

  const start = async (operation: 'SETUP' | 'OPEN') => {
    if (!localDeviceId || !password || busy) return;
    setBusy(true); setError(''); setMessage('Checking password and this PC...');
    try {
      const grant = await launchApi.reauth({
        phoneNumberId: phoneId, platformAccountId: account.id, deviceId: localDeviceId,
        operation, password,
      });
      setPassword('');
      const proof = await localLauncherApi.proof('grant', grant.grantId);
      if (proof.deviceId !== localDeviceId) throw new Error('This launcher belongs to a different PC');
      const issued = await launchApi.issue(phoneId, account.id, operation, {
        deviceId: localDeviceId, grantId: grant.grantId, grantSecret: grant.grantSecret,
        expectedVersion: session?.version ?? undefined, proof,
      });
      setMessage('Opening browser...');
      await localLauncherApi.launch(issued.ticket);
      const result = await launchApi.operation(issued.operationId);
      if (result.state !== 'BROWSER_LAUNCHED') throw new Error(result.errorCode || 'Launch acknowledgement pending');
      setMessage(operation === 'SETUP'
        ? 'Browser launched. Sign in on the official site, then confirm the visible account below.'
        : 'Browser launched. Check that the correct account is still signed in.');
      await sessionQuery.refetch();
    } catch (failure) {
      setError(errorText(failure));
      setMessage('');
    } finally { setPassword(''); setBusy(false); }
  };

  const confirm = async () => {
    if (!localDeviceId || !session?.id || !session.version || !identifier.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const proof = await localLauncherApi.proof('confirm', `${session.id}:${session.version}`);
      if (proof.deviceId !== localDeviceId) throw new Error('This launcher belongs to a different PC');
      await launchApi.confirm(session.id, {
        phoneNumberId: phoneId, platformAccountId: account.id, deviceId: localDeviceId,
        version: session.version, confirmedIdentifier: identifier.trim(), proof,
      });
      setIdentifier('');
      setMessage('Identity marked as user-confirmed on this PC.');
      await sessionQuery.refetch();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
      <button type="button" onClick={() => setExpanded(value => !value)}
        className="rounded border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
        aria-expanded={expanded}>
        {expanded ? 'Hide launcher' : 'Manage on this PC'}
      </button>
      {expanded && <div className="mt-3 space-y-3">
        {!localDeviceId && <p className="text-amber-700">Start the approved Windows launcher on this PC to set up or open this account.</p>}
        {localDeviceId && <>
          <p className="text-gray-600">Expected account: <strong>{expected}</strong>. The account link alone does not prove which identity is signed in.</p>
          <p className="text-gray-600">This PC: {localDeviceId.slice(0, 8)}… · Status: {sessionQuery.isLoading ? 'Loading...' : session?.state?.replace(/_/g, ' ') || 'Unknown'}</p>
          {sessionQuery.error && <p role="alert" className="text-red-700">{errorText(sessionQuery.error)}</p>}
          {session && <>
            <label className="block font-medium text-gray-700" htmlFor={`launch-password-${account.id}`}>Dashboard password</label>
            <input id={`launch-password-${account.id}`} type="password" autoComplete="current-password"
              value={password} onChange={event => setPassword(event.target.value)}
              className="w-full max-w-sm rounded border border-gray-300 px-3 py-2" />
            {session.state === 'USER_CONFIRMED' ?
              <button type="button" disabled={busy || !password} onClick={() => start('OPEN')}
                className="rounded bg-primary-600 px-3 py-2 font-medium text-white disabled:opacity-50">Open account</button> :
              <button type="button" disabled={busy || !password || session.state === 'SETUP_IN_PROGRESS'}
                onClick={() => start('SETUP')}
                className="rounded bg-primary-600 px-3 py-2 font-medium text-white disabled:opacity-50">Set up on this PC</button>}
            {session.state === 'SETUP_IN_PROGRESS' && <div className="space-y-2 rounded bg-amber-50 p-3">
              <p>After signing in on the official site, visually check the exact handle, email or channel. Confirm only the account shown above.</p>
              <label className="block font-medium" htmlFor={`confirmed-id-${account.id}`}>Visible signed-in identity</label>
              <input id={`confirmed-id-${account.id}`} value={identifier}
                onChange={event => setIdentifier(event.target.value)}
                className="w-full max-w-sm rounded border border-gray-300 px-3 py-2" />
              <button type="button" disabled={busy || !identifier.trim()} onClick={confirm}
                className="rounded border border-amber-600 px-3 py-2 font-medium text-amber-800 disabled:opacity-50">Confirm visible account</button>
            </div>}
          </>}
        </>}
        {message && <p role="status" className="text-green-700">{message}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <p className="text-xs text-gray-500">Browser launched means a window opened. Check the current signed-in identity on the platform.</p>
      </div>}
    </div>
  );
};
