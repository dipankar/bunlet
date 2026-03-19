/**
 * Power Monitor API for bunlet
 *
 * Provides power management information and events.
 *
 * @example
 * ```typescript
 * import { powerMonitor } from 'bunlet';
 *
 * // Listen for power events
 * powerMonitor.on('suspend', () => {
 *   console.log('System is suspending');
 * });
 *
 * powerMonitor.on('resume', () => {
 *   console.log('System has resumed');
 * });
 *
 * powerMonitor.on('on-ac', () => {
 *   console.log('Switched to AC power');
 * });
 *
 * powerMonitor.on('on-battery', () => {
 *   console.log('Switched to battery power');
 * });
 *
 * // Check power state
 * console.log('On battery:', powerMonitor.isOnBatteryPower());
 *
 * // Get battery info
 * const battery = powerMonitor.getBatteryInfo();
 * console.log(`Battery: ${battery.level}%, charging: ${battery.charging}`);
 *
 * // Check idle state
 * const idleState = powerMonitor.getSystemIdleState();
 * console.log(`Idle state: ${idleState}, idle time: ${powerMonitor.getSystemIdleTime()}s`);
 * ```
 */

import { EventEmitter } from 'events';
import native from './native/bindings';

/**
 * Battery information
 */
export interface BatteryInfo {
  /** Battery level percentage (0-100) */
  level: number;
  /** Whether the device is charging */
  charging: boolean;
  /** Whether the device is on AC power */
  onAC: boolean;
  /** Estimated time remaining in seconds (-1 if unknown) */
  timeRemaining: number;
}

/**
 * System idle state
 */
export type IdleState = 'active' | 'idle' | 'locked' | 'unknown';

/**
 * Power event types
 */
export type PowerEventType =
  | 'suspend'
  | 'resume'
  | 'on-ac'
  | 'on-battery'
  | 'shutdown'
  | 'lock-screen'
  | 'unlock-screen';

/** Whether the callback has been set up */
let callbackInitialized = false;

/**
 * Power Monitor class
 */
class PowerMonitorImpl extends EventEmitter {
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize power monitoring
   * Called automatically when event listeners are added
   */
  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!callbackInitialized) {
      callbackInitialized = true;
      native.setPowerCallback((event: { eventType: string }) => {
        this.emit(event.eventType);
      });
    }

    native.initPowerMonitor();
  }

  /**
   * Stop power monitoring
   */
  stop(): void {
    if (!this.initialized) return;
    native.stopPowerMonitor();
    this.initialized = false;
  }

  /**
   * Check if the system is on battery power
   */
  isOnBatteryPower(): boolean {
    return native.isOnBatteryPower();
  }

  /**
   * Get battery information
   */
  getBatteryInfo(): BatteryInfo {
    const info = native.getBatteryInfo();
    return {
      level: info.level,
      charging: info.charging,
      onAC: info.onAc,
      timeRemaining: info.timeRemaining,
    };
  }

  /**
   * Get the current system idle state
   * @param idleThreshold - Number of seconds of inactivity to consider "idle" (default: 60)
   */
  getSystemIdleState(idleThreshold = 60): IdleState {
    const state = native.getSystemIdleState(idleThreshold);
    return state.state as IdleState;
  }

  /**
   * Get the system idle time in seconds
   */
  getSystemIdleTime(): number {
    return native.getSystemIdleTime();
  }

  /**
   * Get estimated thermal state
   * Note: Not currently implemented, returns 'nominal'
   */
  getCurrentThermalState(): 'nominal' | 'fair' | 'serious' | 'critical' {
    return 'nominal';
  }

  // Override on to auto-initialize when listeners are added
  on(event: 'suspend', listener: () => void): this;
  on(event: 'resume', listener: () => void): this;
  on(event: 'on-ac', listener: () => void): this;
  on(event: 'on-battery', listener: () => void): this;
  on(event: 'shutdown', listener: () => void): this;
  on(event: 'lock-screen', listener: () => void): this;
  on(event: 'unlock-screen', listener: () => void): this;
  on(event: 'speed-limit-change', listener: () => void): this;
  on(event: 'thermal-state-change', listener: () => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    this.init();
    return super.on(event, listener);
  }

  // Override once as well
  once(event: 'suspend', listener: () => void): this;
  once(event: 'resume', listener: () => void): this;
  once(event: 'on-ac', listener: () => void): this;
  once(event: 'on-battery', listener: () => void): this;
  once(event: 'shutdown', listener: () => void): this;
  once(event: 'lock-screen', listener: () => void): this;
  once(event: 'unlock-screen', listener: () => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, listener: (...args: any[]) => void): this {
    this.init();
    return super.once(event, listener);
  }

  // Override addListener as well
  addListener(event: 'suspend', listener: () => void): this;
  addListener(event: 'resume', listener: () => void): this;
  addListener(event: 'on-ac', listener: () => void): this;
  addListener(event: 'on-battery', listener: () => void): this;
  addListener(event: 'shutdown', listener: () => void): this;
  addListener(event: 'lock-screen', listener: () => void): this;
  addListener(event: 'unlock-screen', listener: () => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addListener(event: string, listener: (...args: any[]) => void): this {
    this.init();
    return super.addListener(event, listener);
  }
}

/**
 * Power monitor singleton instance
 */
export const powerMonitor = new PowerMonitorImpl();
