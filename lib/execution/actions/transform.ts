/**
 * Data Transformation Action for Bottleneck-Bots
 * Map/transform data between actions with JSONPath and template interpolation
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
} from './base';
import { ActionType } from '../types';

/**
 * Transformation types
 */
export type TransformationType =
  | 'map'           // Map object properties
  | 'pick'          // Pick specific fields
  | 'omit'          // Omit specific fields
  | 'flatten'       // Flatten nested objects
  | 'merge'         // Merge multiple objects
  | 'array_map'     // Map over array items
  | 'array_filter'  // Filter array items
  | 'array_reduce'  // Reduce array to single value
  | 'template'      // Template string interpolation
  | 'jsonpath';     // JSONPath expression

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** Source field path (supports dot notation) */
  from: string;
  /** Target field name */
  to: string;
  /** Default value if source is undefined */
  default?: unknown;
  /** Transform function name */
  transform?: TransformFunction;
  /** Transform arguments */
  transformArgs?: unknown[];
}

/**
 * Built-in transform functions
 */
export type TransformFunction =
  | 'toString'
  | 'toNumber'
  | 'toBoolean'
  | 'toArray'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'trim'
  | 'split'
  | 'join'
  | 'slice'
  | 'replace'
  | 'json_parse'
  | 'json_stringify'
  | 'encode_uri'
  | 'decode_uri'
  | 'encode_base64'
  | 'decode_base64';

/**
 * Transform action configuration
 */
export interface TransformActionConfig {
  /** Transformation type */
  transformType: TransformationType;
  /** Source data path (defaults to previous action output) */
  source?: string;
  /** Field mappings for 'map' type */
  mappings?: FieldMapping[];
  /** Fields to pick */
  pickFields?: string[];
  /** Fields to omit */
  omitFields?: string[];
  /** Objects to merge (paths) */
  mergeSources?: string[];
  /** Template string for 'template' type */
  template?: string;
  /** JSONPath expression for 'jsonpath' type */
  jsonPath?: string;
  /** Array item transformation for array operations */
  itemTransform?: FieldMapping[];
  /** Filter condition for array_filter */
  filterCondition?: {
    field: string;
    operator: string;
    value: unknown;
  };
  /** Reduce configuration */
  reduce?: {
    initialValue: unknown;
    accumulator: string;
    expression: string;
  };
  /** Output key (wraps result in object with this key) */
  outputKey?: string;
  /** Whether to preserve original data */
  preserveOriginal?: boolean;
}

/**
 * Transform result data
 */
export interface TransformResultData {
  /** Transformed data */
  data: unknown;
  /** Original data if preserved */
  original?: unknown;
  /** Transformation type used */
  transformType: TransformationType;
  /** Number of fields/items processed */
  processedCount: number;
}

/**
 * Transform Action Implementation
 */
export class TransformAction extends BaseAction {
  readonly type = ActionType.TRANSFORM;
  readonly name = 'Data Transform';
  readonly description = 'Transform and map data between actions';

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'transformType',
        type: 'string',
        description: 'Type of transformation to apply',
        enumValues: ['map', 'pick', 'omit', 'flatten', 'merge', 'array_map', 'array_filter', 'array_reduce', 'template', 'jsonpath'],
      },
    ],
    optional: [
      {
        name: 'source',
        type: 'string',
        description: 'Source data path',
      },
      {
        name: 'mappings',
        type: 'array',
        description: 'Field mappings for map transformation',
      },
      {
        name: 'pickFields',
        type: 'array',
        description: 'Fields to pick',
      },
      {
        name: 'omitFields',
        type: 'array',
        description: 'Fields to omit',
      },
      {
        name: 'mergeSources',
        type: 'array',
        description: 'Source paths to merge',
      },
      {
        name: 'template',
        type: 'string',
        description: 'Template string for interpolation',
      },
      {
        name: 'jsonPath',
        type: 'string',
        description: 'JSONPath expression',
      },
      {
        name: 'itemTransform',
        type: 'array',
        description: 'Mappings for array item transformation',
      },
      {
        name: 'filterCondition',
        type: 'object',
        description: 'Condition for array filtering',
      },
      {
        name: 'reduce',
        type: 'object',
        description: 'Configuration for array reduce',
      },
      {
        name: 'outputKey',
        type: 'string',
        description: 'Wrap result in object with this key',
      },
      {
        name: 'preserveOriginal',
        type: 'boolean',
        description: 'Include original data in output',
        defaultValue: false,
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as TransformActionConfig;
    const { context } = input;

    // Get source data
    const sourceData = this.getSourceData(config, context);

    // Apply transformation
    const { data, processedCount } = this.applyTransformation(config, sourceData, context);

    // Wrap in output key if specified
    let outputData = data;
    if (config.outputKey) {
      outputData = { [config.outputKey]: data };
    }

    const resultData: TransformResultData = {
      data: outputData,
      original: config.preserveOriginal ? sourceData : undefined,
      transformType: config.transformType,
      processedCount,
    };

    return {
      data: resultData,
      metadata: {
        transformType: config.transformType,
        processedCount,
        hasOriginal: config.preserveOriginal,
      },
    };
  }

  /**
   * Get source data from context
   */
  private getSourceData(
    config: TransformActionConfig,
    context: import('../context').ExecutionContext
  ): unknown {
    if (config.source) {
      // Resolve path from context
      const state = context.getState();
      const evalContext: Record<string, unknown> = {
        trigger: state.triggerData,
        previous: context.getPreviousOutput(),
        ...state.actionOutputs,
      };
      return this.getNestedValue(evalContext, config.source);
    }

    // Default to previous action output
    return context.getPreviousOutput();
  }

  /**
   * Apply transformation based on type
   */
  private applyTransformation(
    config: TransformActionConfig,
    sourceData: unknown,
    context: import('../context').ExecutionContext
  ): { data: unknown; processedCount: number } {
    switch (config.transformType) {
      case 'map':
        return this.transformMap(config.mappings!, sourceData);

      case 'pick':
        return this.transformPick(config.pickFields!, sourceData);

      case 'omit':
        return this.transformOmit(config.omitFields!, sourceData);

      case 'flatten':
        return this.transformFlatten(sourceData);

      case 'merge':
        return this.transformMerge(config.mergeSources!, context);

      case 'array_map':
        return this.transformArrayMap(config.itemTransform!, sourceData);

      case 'array_filter':
        return this.transformArrayFilter(config.filterCondition!, sourceData);

      case 'array_reduce':
        return this.transformArrayReduce(config.reduce!, sourceData);

      case 'template':
        return this.transformTemplate(config.template!, context);

      case 'jsonpath':
        return this.transformJsonPath(config.jsonPath!, sourceData);

      default:
        throw new Error(`Unknown transformation type: ${config.transformType}`);
    }
  }

  /**
   * Map transformation - map fields from source to target
   */
  private transformMap(
    mappings: FieldMapping[],
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    const result: Record<string, unknown> = {};
    let processedCount = 0;

    for (const mapping of mappings) {
      let value = this.getNestedValue(sourceData as Record<string, unknown>, mapping.from);

      // Apply default if undefined
      if (value === undefined && mapping.default !== undefined) {
        value = mapping.default;
      }

      // Apply transform function
      if (mapping.transform && value !== undefined) {
        value = this.applyTransformFunction(value, mapping.transform, mapping.transformArgs);
      }

      this.setNestedValue(result, mapping.to, value);
      processedCount++;
    }

    return { data: result, processedCount };
  }

  /**
   * Pick transformation - select specific fields
   */
  private transformPick(
    fields: string[],
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    if (typeof sourceData !== 'object' || sourceData === null) {
      return { data: {}, processedCount: 0 };
    }

    const result: Record<string, unknown> = {};
    let processedCount = 0;

    for (const field of fields) {
      const value = this.getNestedValue(sourceData as Record<string, unknown>, field);
      if (value !== undefined) {
        this.setNestedValue(result, field, value);
        processedCount++;
      }
    }

    return { data: result, processedCount };
  }

  /**
   * Omit transformation - remove specific fields
   */
  private transformOmit(
    fields: string[],
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    if (typeof sourceData !== 'object' || sourceData === null) {
      return { data: sourceData, processedCount: 0 };
    }

    const result = JSON.parse(JSON.stringify(sourceData));
    let processedCount = 0;

    for (const field of fields) {
      if (this.deleteNestedValue(result, field)) {
        processedCount++;
      }
    }

    return { data: result, processedCount };
  }

  /**
   * Flatten transformation - flatten nested objects
   */
  private transformFlatten(
    sourceData: unknown,
    prefix = '',
    result: Record<string, unknown> = {}
  ): { data: unknown; processedCount: number } {
    let processedCount = 0;

    if (typeof sourceData !== 'object' || sourceData === null) {
      return { data: sourceData, processedCount: 0 };
    }

    for (const [key, value] of Object.entries(sourceData)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nested = this.transformFlatten(value, newKey, result);
        processedCount += nested.processedCount;
      } else {
        result[newKey] = value;
        processedCount++;
      }
    }

    return { data: result, processedCount };
  }

  /**
   * Merge transformation - merge multiple sources
   */
  private transformMerge(
    sources: string[],
    context: import('../context').ExecutionContext
  ): { data: unknown; processedCount: number } {
    const state = context.getState();
    const evalContext: Record<string, unknown> = {
      trigger: state.triggerData,
      previous: context.getPreviousOutput(),
      ...state.actionOutputs,
    };

    const result: Record<string, unknown> = {};
    let processedCount = 0;

    for (const source of sources) {
      const data = this.getNestedValue(evalContext, source);
      if (typeof data === 'object' && data !== null) {
        Object.assign(result, data);
        processedCount++;
      }
    }

    return { data: result, processedCount };
  }

  /**
   * Array map transformation
   */
  private transformArrayMap(
    itemTransform: FieldMapping[],
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    if (!Array.isArray(sourceData)) {
      return { data: [], processedCount: 0 };
    }

    const result = sourceData.map(item => {
      const mapped: Record<string, unknown> = {};

      for (const mapping of itemTransform) {
        let value = this.getNestedValue(item as Record<string, unknown>, mapping.from);

        if (value === undefined && mapping.default !== undefined) {
          value = mapping.default;
        }

        if (mapping.transform && value !== undefined) {
          value = this.applyTransformFunction(value, mapping.transform, mapping.transformArgs);
        }

        this.setNestedValue(mapped, mapping.to, value);
      }

      return mapped;
    });

    return { data: result, processedCount: sourceData.length };
  }

  /**
   * Array filter transformation
   */
  private transformArrayFilter(
    condition: { field: string; operator: string; value: unknown },
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    if (!Array.isArray(sourceData)) {
      return { data: [], processedCount: 0 };
    }

    const result = sourceData.filter(item => {
      const fieldValue = this.getNestedValue(item as Record<string, unknown>, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });

    return { data: result, processedCount: sourceData.length };
  }

  /**
   * Array reduce transformation
   */
  private transformArrayReduce(
    reduce: { initialValue: unknown; accumulator: string; expression: string },
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    if (!Array.isArray(sourceData)) {
      return { data: reduce.initialValue, processedCount: 0 };
    }

    let result = reduce.initialValue;

    switch (reduce.expression) {
      case 'sum':
        result = sourceData.reduce((acc: number, item) => {
          const value = this.getNestedValue(item as Record<string, unknown>, reduce.accumulator);
          return acc + (typeof value === 'number' ? value : 0);
        }, 0);
        break;

      case 'count':
        result = sourceData.length;
        break;

      case 'min':
        result = sourceData.reduce((acc: number | null, item) => {
          const value = this.getNestedValue(item as Record<string, unknown>, reduce.accumulator);
          if (typeof value !== 'number') return acc;
          return acc === null ? value : Math.min(acc, value);
        }, null as number | null);
        break;

      case 'max':
        result = sourceData.reduce((acc: number | null, item) => {
          const value = this.getNestedValue(item as Record<string, unknown>, reduce.accumulator);
          if (typeof value !== 'number') return acc;
          return acc === null ? value : Math.max(acc, value);
        }, null as number | null);
        break;

      case 'concat':
        result = sourceData.map(item => {
          return this.getNestedValue(item as Record<string, unknown>, reduce.accumulator);
        });
        break;

      default:
        result = reduce.initialValue;
    }

    return { data: result, processedCount: sourceData.length };
  }

  /**
   * Template transformation
   */
  private transformTemplate(
    template: string,
    context: import('../context').ExecutionContext
  ): { data: unknown; processedCount: number } {
    const result = context.interpolate(template);
    return { data: result, processedCount: 1 };
  }

  /**
   * JSONPath transformation (simplified)
   */
  private transformJsonPath(
    jsonPath: string,
    sourceData: unknown
  ): { data: unknown; processedCount: number } {
    // Simple JSONPath implementation
    // Supports: $.field, $.field.nested, $.array[0]

    if (!jsonPath.startsWith('$')) {
      throw new Error('JSONPath must start with $');
    }

    const path = jsonPath.slice(1); // Remove $
    let current: unknown = sourceData;
    let processedCount = 0;

    if (!path || path === '.') {
      return { data: current, processedCount: 1 };
    }

    const segments = this.parseJsonPath(path);

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return { data: undefined, processedCount };
      }

      if (segment.type === 'property') {
        current = (current as Record<string, unknown>)[segment.value as string];
        processedCount++;
      } else if (segment.type === 'index') {
        if (!Array.isArray(current)) {
          return { data: undefined, processedCount };
        }
        current = current[segment.value as number];
        processedCount++;
      }
    }

    return { data: current, processedCount };
  }

  /**
   * Parse JSONPath into segments
   */
  private parseJsonPath(path: string): Array<{ type: 'property' | 'index'; value: string | number }> {
    const segments: Array<{ type: 'property' | 'index'; value: string | number }> = [];
    const regex = /\.([a-zA-Z_][a-zA-Z0-9_]*)|(\[(\d+)\])/g;
    let match;

    while ((match = regex.exec(path)) !== null) {
      if (match[1]) {
        // Property access
        segments.push({ type: 'property', value: match[1] });
      } else if (match[3]) {
        // Array index
        segments.push({ type: 'index', value: parseInt(match[3], 10) });
      }
    }

    return segments;
  }

  /**
   * Apply a transform function to a value
   */
  private applyTransformFunction(
    value: unknown,
    fn: TransformFunction,
    args?: unknown[]
  ): unknown {
    switch (fn) {
      case 'toString':
        return String(value);

      case 'toNumber':
        return typeof value === 'string' ? parseFloat(value) : Number(value);

      case 'toBoolean':
        return Boolean(value);

      case 'toArray':
        return Array.isArray(value) ? value : [value];

      case 'toUpperCase':
        return typeof value === 'string' ? value.toUpperCase() : value;

      case 'toLowerCase':
        return typeof value === 'string' ? value.toLowerCase() : value;

      case 'trim':
        return typeof value === 'string' ? value.trim() : value;

      case 'split':
        if (typeof value !== 'string') return [value];
        const delimiter = (args?.[0] as string) ?? ',';
        return value.split(delimiter);

      case 'join':
        if (!Array.isArray(value)) return value;
        const joinDelimiter = (args?.[0] as string) ?? ',';
        return value.join(joinDelimiter);

      case 'slice':
        if (typeof value === 'string' || Array.isArray(value)) {
          const start = (args?.[0] as number) ?? 0;
          const end = args?.[1] as number | undefined;
          return value.slice(start, end);
        }
        return value;

      case 'replace':
        if (typeof value !== 'string') return value;
        const search = (args?.[0] as string) ?? '';
        const replacement = (args?.[1] as string) ?? '';
        return value.replace(new RegExp(search, 'g'), replacement);

      case 'json_parse':
        if (typeof value !== 'string') return value;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }

      case 'json_stringify':
        return JSON.stringify(value);

      case 'encode_uri':
        return typeof value === 'string' ? encodeURIComponent(value) : value;

      case 'decode_uri':
        return typeof value === 'string' ? decodeURIComponent(value) : value;

      case 'encode_base64':
        return typeof value === 'string' ? Buffer.from(value).toString('base64') : value;

      case 'decode_base64':
        return typeof value === 'string' ? Buffer.from(value, 'base64').toString('utf-8') : value;

      default:
        return value;
    }
  }

  /**
   * Get nested value from object
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
   * Set nested value in object
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Delete nested value from object
   */
  private deleteNestedValue(obj: Record<string, unknown>, path: string): boolean {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return false;
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey in current) {
      delete current[lastKey];
      return true;
    }

    return false;
  }

  /**
   * Evaluate simple condition for array filter
   */
  private evaluateCondition(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'eq':
      case '==':
      case '===':
        return actual === expected;
      case 'neq':
      case '!=':
      case '!==':
        return actual !== expected;
      case 'gt':
      case '>':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'gte':
      case '>=':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case 'lt':
      case '<':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'lte':
      case '<=':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.includes(expected);
        }
        return false;
      case 'exists':
        return actual !== null && actual !== undefined;
      default:
        return false;
    }
  }
}

// Export singleton instance
export const transformAction = new TransformAction();
