import { BunletError, BunletErrorCode } from '../errors';
import type { RuntimeBackend, RuntimeCapabilities } from './types';

export type RuntimeCapabilityName = keyof RuntimeCapabilities;
type RuntimeBackendInfo = Pick<RuntimeBackend, 'engine' | 'capabilities'>;

function getActiveBackend(): RuntimeBackendInfo {
  const { getRuntimeBackend } = require('./backend') as {
    getRuntimeBackend: () => RuntimeBackendInfo;
  };
  return getRuntimeBackend();
}

export function hasCapability(
  backend: RuntimeBackendInfo,
  capability: RuntimeCapabilityName
): boolean {
  return backend.capabilities[capability];
}

export function createCapabilityErrorMessage(
  engine: RuntimeBackendInfo['engine'],
  capability: RuntimeCapabilityName,
  apiName: string
): string {
  return `[bunlet] ${apiName} is not supported by the "${engine}" backend. Missing capability: ${capability}.`;
}

export function assertCapability(
  backend: RuntimeBackendInfo,
  capability: RuntimeCapabilityName,
  apiName: string
): void {
  if (hasCapability(backend, capability)) {
    return;
  }

  throw new BunletError(
    BunletErrorCode.CAPABILITY_MISSING,
    createCapabilityErrorMessage(backend.engine, capability, apiName),
  );
}

export function hasRuntimeCapability(capability: RuntimeCapabilityName): boolean {
  return hasCapability(getActiveBackend(), capability);
}

export function assertRuntimeCapability(
  capability: RuntimeCapabilityName,
  apiName: string
): void {
  assertCapability(getActiveBackend(), capability, apiName);
}
