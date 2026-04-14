import { describe, expect, mock, test } from 'bun:test';

mock.module('./runtime', () => ({
  assertRuntimeCapability() {},
  native: {
    getCookies: async () => [],
    setCookie() {},
    removeCookie() {},
    clearStorageData() {},
    getUserAgent: async () => 'bunlet-test',
  },
}));

const {
  Session,
  attachSessionToWindow,
  detachSessionFromWindow,
  resolveSessionForWebPreferences,
  session,
} = await import('./session');

describe('session model', () => {
  test('resolves default session when no web preferences are provided', () => {
    expect(resolveSessionForWebPreferences()).toBe(session.defaultSession);
  });

  test('resolves partitioned sessions consistently', () => {
    // Without 'persist:' prefix, partition is ephemeral (in-memory only)
    const ephemeral = Session.fromPartition('notes');
    expect(ephemeral.partition).toBe('ephemeral:notes');

    // With 'persist:' prefix, partition is persistent (stored on disk)
    const persistent = Session.fromPartition('persist:notes');
    expect(persistent.partition).toBe('persist:notes');

    // Different types are different sessions
    expect(ephemeral).not.toBe(persistent);
  });

  test('prefers explicit session over implicit defaults', () => {
    const customSession = Session.fromPartition('persist:workspace');

    expect(
      resolveSessionForWebPreferences({
        session: customSession,
        partition: 'persist:workspace',
      })
    ).toBe(customSession);
  });

  test('rejects mismatched session and partition input', () => {
    const customSession = Session.fromPartition('workspace-a');

    expect(() =>
      resolveSessionForWebPreferences({
        session: customSession,
        partition: 'workspace-b',
      })
    ).toThrow('Session partition mismatch');
  });

  test('attach and detach helpers support partition-backed sessions', () => {
    const customSession = Session.fromPartition('persist:ephemeral');

    attachSessionToWindow(1001, customSession);
    detachSessionFromWindow(1001);

    expect(customSession.partition).toBe('persist:ephemeral');
  });
});
