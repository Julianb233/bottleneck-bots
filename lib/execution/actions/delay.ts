/**
 * Delay Action for Bottleneck-Bots
 * Pause execution for specified duration
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
} from './base';
import { ActionType } from '../types';

/**
 * Time unit options
 */
export type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours';

/**
 * Delay action configuration
 */
export interface DelayActionConfig {
  /** Duration value */
  duration: number;
  /** Time unit (default: seconds) */
  unit?: TimeUnit;
  /** Optional reason for the delay (for logging) */
  reason?: string;
  /** Maximum allowed delay in milliseconds (safety limit) */
  maxDuration?: number;
  /** Whether to use jitter (randomize delay slightly) */
  jitter?: boolean;
  /** Jitter percentage (0-100, default: 10) */
  jitterPercent?: number;
}

/**
 * Delay result data
 */
export interface DelayResultData {
  /** Requested delay in milliseconds */
  requestedMs: number;
  /** Actual delay applied (may differ due to jitter or limits) */
  actualMs: number;
  /** Whether jitter was applied */
  jitterApplied: boolean;
  /** Reason for delay if provided */
  reason?: string;
}

/**
 * Delay Action Implementation
 */
export class DelayAction extends BaseAction {
  readonly type = ActionType.DELAY;
  readonly name = 'Delay';
  readonly description = 'Pause execution for a specified duration';

  // Safety limits
  private readonly MAX_DELAY_MS = 3600000; // 1 hour
  private readonly DEFAULT_MAX_DELAY_MS = 300000; // 5 minutes

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'duration',
        type: 'number',
        description: 'Duration to wait',
        min: 0,
      },
    ],
    optional: [
      {
        name: 'unit',
        type: 'string',
        description: 'Time unit',
        enumValues: ['milliseconds', 'seconds', 'minutes', 'hours'],
        defaultValue: 'seconds',
      },
      {
        name: 'reason',
        type: 'string',
        description: 'Optional reason for the delay',
      },
      {
        name: 'maxDuration',
        type: 'number',
        description: 'Maximum allowed delay in milliseconds',
        min: 0,
      },
      {
        name: 'jitter',
        type: 'boolean',
        description: 'Whether to randomize delay slightly',
        defaultValue: false,
      },
      {
        name: 'jitterPercent',
        type: 'number',
        description: 'Jitter percentage (0-100)',
        min: 0,
        max: 100,
        defaultValue: 10,
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as DelayActionConfig;
    const { abortSignal } = input;

    // Calculate delay in milliseconds
    const requestedMs = this.calculateDelayMs(config);

    // Apply safety limits
    const maxAllowed = config.maxDuration ?? this.DEFAULT_MAX_DELAY_MS;
    const effectiveMax = Math.min(maxAllowed, this.MAX_DELAY_MS);

    let actualMs = Math.min(requestedMs, effectiveMax);

    // Apply jitter if enabled
    let jitterApplied = false;
    if (config.jitter && actualMs > 0) {
      const jitterPercent = config.jitterPercent ?? 10;
      const jitterRange = actualMs * (jitterPercent / 100);
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      actualMs = Math.max(0, Math.round(actualMs + jitter));
      jitterApplied = true;
    }

    // Execute delay with abort support
    if (actualMs > 0) {
      await this.sleep(actualMs, abortSignal);
    }

    const resultData: DelayResultData = {
      requestedMs,
      actualMs,
      jitterApplied,
      reason: config.reason,
    };

    return {
      data: resultData,
      metadata: {
        requestedMs,
        actualMs,
        jitterApplied,
        unit: config.unit ?? 'seconds',
      },
    };
  }

  /**
   * Calculate delay duration in milliseconds
   */
  private calculateDelayMs(config: DelayActionConfig): number {
    const durationValue = config.duration;

    if (isNaN(durationValue) || durationValue < 0) {
      return 0;
    }

    // Convert to milliseconds based on unit
    const unit = config.unit ?? 'seconds';

    switch (unit) {
      case 'milliseconds':
        return Math.round(durationValue);
      case 'seconds':
        return Math.round(durationValue * 1000);
      case 'minutes':
        return Math.round(durationValue * 60 * 1000);
      case 'hours':
        return Math.round(durationValue * 60 * 60 * 1000);
      default:
        return Math.round(durationValue * 1000);
    }
  }

  /**
   * Sleep for specified duration with abort support
   */
  private sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (abortSignal?.aborted) {
        reject(new Error('Delay was aborted'));
        return;
      }

      const timeoutId = setTimeout(resolve, ms);

      // Set up abort listener
      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new Error('Delay was aborted'));
      };

      abortSignal?.addEventListener('abort', onAbort, { once: true });

      // Clean up abort listener when sleep completes
      setTimeout(() => {
        abortSignal?.removeEventListener('abort', onAbort);
      }, ms + 1);
    });
  }

  /**
   * Helper to create a delay config
   */
  static createConfig(
    duration: number,
    unit: TimeUnit = 'seconds',
    options?: Partial<DelayActionConfig>
  ): DelayActionConfig {
    return {
      duration,
      unit,
      ...options,
    };
  }

  /**
   * Shorthand for seconds delay
   */
  static seconds(duration: number): DelayActionConfig {
    return DelayAction.createConfig(duration, 'seconds');
  }

  /**
   * Shorthand for minutes delay
   */
  static minutes(duration: number): DelayActionConfig {
    return DelayAction.createConfig(duration, 'minutes');
  }

  /**
   * Shorthand for hours delay
   */
  static hours(duration: number): DelayActionConfig {
    return DelayAction.createConfig(duration, 'hours');
  }
}

// Export singleton instance
export const delayAction = new DelayAction();

// Export static helpers
export const delay = {
  seconds: DelayAction.seconds,
  minutes: DelayAction.minutes,
  hours: DelayAction.hours,
  create: DelayAction.createConfig,
};
