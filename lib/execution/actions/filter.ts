/**
 * Conditional Filter Action for Bottleneck-Bots
 * Skip remaining actions based on conditions
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
} from './base';
import { ActionType } from '../types';

/**
 * Comparison operators for filter conditions
 */
export type ComparisonOperator =
  | 'eq' | 'neq'           // equal, not equal
  | 'gt' | 'gte'           // greater than, greater than or equal
  | 'lt' | 'lte'           // less than, less than or equal
  | 'contains'             // string/array contains
  | 'not_contains'         // string/array does not contain
  | 'starts_with'          // string starts with
  | 'ends_with'            // string ends with
  | 'matches'              // regex match
  | 'in'                   // value in array
  | 'not_in'               // value not in array
  | 'exists'               // field exists (not null/undefined)
  | 'not_exists'           // field does not exist
  | 'empty'                // value is empty (null, undefined, '', [], {})
  | 'not_empty'            // value is not empty
  | 'is_type';             // type checking

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'and' | 'or';

/**
 * Single condition definition
 */
export interface FilterCondition {
  /** Field path to check (supports dot notation and template variables) */
  field: string;
  /** Comparison operator */
  operator: ComparisonOperator;
  /** Value to compare against (not needed for exists/empty checks) */
  value?: unknown;
  /** Case insensitive comparison for strings */
  caseInsensitive?: boolean;
}

/**
 * Condition group for logical combinations
 */
export interface ConditionGroup {
  /** Logical operator to combine conditions */
  logic: LogicalOperator;
  /** Conditions in this group */
  conditions: Array<FilterCondition | ConditionGroup>;
}

/**
 * Filter action configuration
 */
export interface FilterActionConfig {
  /** Single condition or condition group */
  condition: FilterCondition | ConditionGroup;
  /** What to do when condition is met: 'continue' or 'skip' (default: 'continue') */
  onMatch?: 'continue' | 'skip';
  /** Reason for skipping (used in logs) */
  skipReason?: string;
  /** Pass the evaluation result to next action */
  passResult?: boolean;
}

/**
 * Filter result data
 */
export interface FilterResultData {
  /** Whether the condition matched */
  matched: boolean;
  /** Whether remaining actions should be skipped */
  shouldSkip: boolean;
  /** Reason for the decision */
  reason: string;
  /** Evaluated conditions details */
  evaluations?: ConditionEvaluation[];
}

/**
 * Individual condition evaluation result
 */
export interface ConditionEvaluation {
  field: string;
  operator: ComparisonOperator;
  actualValue: unknown;
  expectedValue: unknown;
  result: boolean;
}

/**
 * Filter Action Implementation
 */
export class FilterAction extends BaseAction {
  readonly type = ActionType.FILTER;
  readonly name = 'Conditional Filter';
  readonly description = 'Skip remaining actions based on conditions';

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'condition',
        type: 'object',
        description: 'Condition or condition group to evaluate',
      },
    ],
    optional: [
      {
        name: 'onMatch',
        type: 'string',
        description: 'What to do when condition matches',
        enumValues: ['continue', 'skip'],
        defaultValue: 'continue',
      },
      {
        name: 'skipReason',
        type: 'string',
        description: 'Reason for skipping (for logs)',
      },
      {
        name: 'passResult',
        type: 'boolean',
        description: 'Include evaluation details in output',
        defaultValue: false,
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as FilterActionConfig;
    const { context } = input;

    // Build evaluation context from execution context
    const evalContext = this.buildEvaluationContext(context);

    // Evaluate condition
    const evaluations: ConditionEvaluation[] = [];
    const matched = this.evaluateCondition(config.condition, evalContext, evaluations);

    // Determine if we should skip
    const onMatch = config.onMatch ?? 'continue';
    const shouldSkip = (matched && onMatch === 'skip') || (!matched && onMatch === 'continue');

    // Build reason
    let reason: string;
    if (config.skipReason && shouldSkip) {
      reason = config.skipReason;
    } else {
      reason = matched
        ? (onMatch === 'skip' ? 'Condition matched - skipping remaining actions' : 'Condition matched - continuing')
        : (onMatch === 'continue' ? 'Condition not matched - skipping remaining actions' : 'Condition not matched - continuing');
    }

    const resultData: FilterResultData = {
      matched,
      shouldSkip,
      reason,
      evaluations: config.passResult ? evaluations : undefined,
    };

    return {
      data: resultData,
      metadata: {
        matched,
        shouldSkip,
        evaluationCount: evaluations.length,
      },
    };
  }

  /**
   * Build evaluation context from execution context
   */
  private buildEvaluationContext(
    context: import('../context').ExecutionContext
  ): Record<string, unknown> {
    const state = context.getState();

    const evalContext: Record<string, unknown> = {
      trigger: state.triggerData,
      runId: state.runId,
      botId: state.botId,
      previous: context.getPreviousOutput(),
    };

    // Add all action outputs
    for (const [key, value] of Object.entries(state.actionOutputs)) {
      evalContext[`action_${key}`] = value;
    }

    // Add variables
    for (const [key, variable] of Object.entries(state.variables)) {
      evalContext[key] = variable.value;
    }

    return evalContext;
  }

  /**
   * Evaluate a condition or condition group
   */
  private evaluateCondition(
    condition: FilterCondition | ConditionGroup,
    context: Record<string, unknown>,
    evaluations: ConditionEvaluation[]
  ): boolean {
    // Check if it's a condition group
    if ('logic' in condition) {
      return this.evaluateConditionGroup(condition as ConditionGroup, context, evaluations);
    }

    return this.evaluateSingleCondition(condition as FilterCondition, context, evaluations);
  }

  /**
   * Evaluate a condition group
   */
  private evaluateConditionGroup(
    group: ConditionGroup,
    context: Record<string, unknown>,
    evaluations: ConditionEvaluation[]
  ): boolean {
    if (group.logic === 'and') {
      return group.conditions.every(c => this.evaluateCondition(c, context, evaluations));
    } else {
      return group.conditions.some(c => this.evaluateCondition(c, context, evaluations));
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateSingleCondition(
    condition: FilterCondition,
    context: Record<string, unknown>,
    evaluations: ConditionEvaluation[]
  ): boolean {
    // Get actual value from context
    const actualValue = this.getNestedValue(context, condition.field);

    // Evaluate based on operator
    const result = this.compare(
      actualValue,
      condition.value,
      condition.operator,
      condition.caseInsensitive
    );

    // Record evaluation
    evaluations.push({
      field: condition.field,
      operator: condition.operator,
      actualValue,
      expectedValue: condition.value,
      result,
    });

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && key in (current as object)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Compare values based on operator
   */
  private compare(
    actual: unknown,
    expected: unknown,
    operator: ComparisonOperator,
    caseInsensitive?: boolean
  ): boolean {
    // Normalize strings for case-insensitive comparison
    const normalize = (v: unknown): unknown => {
      if (caseInsensitive && typeof v === 'string') {
        return v.toLowerCase();
      }
      return v;
    };

    const normalizedActual = normalize(actual);
    const normalizedExpected = normalize(expected);

    switch (operator) {
      case 'eq':
        return normalizedActual === normalizedExpected;

      case 'neq':
        return normalizedActual !== normalizedExpected;

      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

      case 'contains':
        if (typeof normalizedActual === 'string' && typeof normalizedExpected === 'string') {
          return normalizedActual.includes(normalizedExpected);
        }
        if (Array.isArray(actual)) {
          return actual.some(item => normalize(item) === normalizedExpected);
        }
        return false;

      case 'not_contains':
        if (typeof normalizedActual === 'string' && typeof normalizedExpected === 'string') {
          return !normalizedActual.includes(normalizedExpected);
        }
        if (Array.isArray(actual)) {
          return !actual.some(item => normalize(item) === normalizedExpected);
        }
        return true;

      case 'starts_with':
        return (
          typeof normalizedActual === 'string' &&
          typeof normalizedExpected === 'string' &&
          normalizedActual.startsWith(normalizedExpected)
        );

      case 'ends_with':
        return (
          typeof normalizedActual === 'string' &&
          typeof normalizedExpected === 'string' &&
          normalizedActual.endsWith(normalizedExpected)
        );

      case 'matches':
        if (typeof actual !== 'string' || typeof expected !== 'string') {
          return false;
        }
        try {
          const flags = caseInsensitive ? 'i' : '';
          const regex = new RegExp(expected, flags);
          return regex.test(actual);
        } catch {
          return false;
        }

      case 'in':
        if (!Array.isArray(expected)) {
          return false;
        }
        return expected.some(item => normalize(item) === normalizedActual);

      case 'not_in':
        if (!Array.isArray(expected)) {
          return true;
        }
        return !expected.some(item => normalize(item) === normalizedActual);

      case 'exists':
        return actual !== null && actual !== undefined;

      case 'not_exists':
        return actual === null || actual === undefined;

      case 'empty':
        return this.isEmpty(actual);

      case 'not_empty':
        return !this.isEmpty(actual);

      case 'is_type':
        return this.checkType(actual, expected as string);

      default:
        return false;
    }
  }

  /**
   * Check if value is empty
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Check value type
   */
  private checkType(value: unknown, expectedType: string): boolean {
    switch (expectedType.toLowerCase()) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'null':
        return value === null;
      case 'undefined':
        return value === undefined;
      default:
        return false;
    }
  }
}

// Export singleton instance
export const filterAction = new FilterAction();

// Export helper functions
export const filter = {
  /**
   * Create a simple equality condition
   */
  equals(field: string, value: unknown): FilterCondition {
    return { field, operator: 'eq', value };
  },

  /**
   * Create a not equals condition
   */
  notEquals(field: string, value: unknown): FilterCondition {
    return { field, operator: 'neq', value };
  },

  /**
   * Create a contains condition
   */
  contains(field: string, value: string, caseInsensitive?: boolean): FilterCondition {
    return { field, operator: 'contains', value, caseInsensitive };
  },

  /**
   * Create an exists condition
   */
  exists(field: string): FilterCondition {
    return { field, operator: 'exists' };
  },

  /**
   * Create an AND condition group
   */
  and(...conditions: Array<FilterCondition | ConditionGroup>): ConditionGroup {
    return { logic: 'and', conditions };
  },

  /**
   * Create an OR condition group
   */
  or(...conditions: Array<FilterCondition | ConditionGroup>): ConditionGroup {
    return { logic: 'or', conditions };
  },
};
