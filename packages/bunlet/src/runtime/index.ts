export { getRuntimeBackend } from './backend';
export type { RuntimeBackend, RuntimeCapabilities, NativeBindings } from './types';
export { assertRuntimeCapability, hasRuntimeCapability } from './capabilities';
export type { RuntimeCapabilityName } from './capabilities';

import { getRuntimeBackend } from './backend';

export const runtime = getRuntimeBackend();
export const native = runtime.bindings;
