import { describe, it, expect } from 'vitest';
import {
  coordinateProperties,
  screenshotQuerySchema,
  clickSchema,
  scrollSchema,
  dragSchema,
  moveSchema,
  typeSchema,
  keySchema,
  clipboardWriteSchema,
  bashSchema,
  execSchema,
  batchActionsSchema,
  validateKeyCombo,
  containsNullBytes,
} from '../schemas/actions.js';

// ---------------------------------------------------------------------------
// Schema structure tests
// ---------------------------------------------------------------------------

describe('Action Schemas', () => {
  describe('coordinateProperties', () => {
    it('defines x and y with correct bounds', () => {
      expect(coordinateProperties.x).toEqual({
        type: 'number',
        minimum: 0,
        maximum: 32767,
      });
      expect(coordinateProperties.y).toEqual({
        type: 'number',
        minimum: 0,
        maximum: 32767,
      });
    });
  });

  describe('clickSchema', () => {
    it('requires x and y in body', () => {
      expect(clickSchema.body.required).toContain('x');
      expect(clickSchema.body.required).toContain('y');
    });

    it('disallows additional properties', () => {
      expect(clickSchema.body.additionalProperties).toBe(false);
    });

    it('has type object', () => {
      expect(clickSchema.body.type).toBe('object');
    });
  });

  describe('scrollSchema', () => {
    it('defines direction enum with four values', () => {
      expect(scrollSchema.body.properties.direction.enum).toEqual([
        'up',
        'down',
        'left',
        'right',
      ]);
    });

    it('has amount with min/max bounds', () => {
      expect(scrollSchema.body.properties.amount.minimum).toBe(1);
      expect(scrollSchema.body.properties.amount.maximum).toBe(50);
    });
  });

  describe('dragSchema', () => {
    it('requires all four coordinate fields', () => {
      expect(dragSchema.body.required).toEqual([
        'start_x',
        'start_y',
        'end_x',
        'end_y',
      ]);
    });
  });

  describe('moveSchema', () => {
    it('requires x and y', () => {
      expect(moveSchema.body.required).toEqual(['x', 'y']);
    });
  });

  describe('typeSchema', () => {
    it('requires text field', () => {
      expect(typeSchema.body.required).toEqual(['text']);
    });

    it('enforces text length bounds', () => {
      expect(typeSchema.body.properties.text.minLength).toBe(1);
      expect(typeSchema.body.properties.text.maxLength).toBe(10000);
    });
  });

  describe('keySchema', () => {
    it('requires key field', () => {
      expect(keySchema.body.required).toEqual(['key']);
    });

    it('has a pattern for valid key characters', () => {
      expect(keySchema.body.properties.key.pattern).toBeDefined();
    });
  });

  describe('clipboardWriteSchema', () => {
    it('requires text', () => {
      expect(clipboardWriteSchema.body.required).toEqual(['text']);
    });

    it('has a 1MB max length', () => {
      expect(clipboardWriteSchema.body.properties.text.maxLength).toBe(1048576);
    });
  });

  describe('bashSchema', () => {
    it('requires command', () => {
      expect(bashSchema.body.required).toEqual(['command']);
    });

    it('has timeout with bounds', () => {
      expect(bashSchema.body.properties.timeout.minimum).toBe(1);
      expect(bashSchema.body.properties.timeout.maximum).toBe(300);
    });
  });

  describe('execSchema', () => {
    it('requires code', () => {
      expect(execSchema.body.required).toEqual(['code']);
    });

    it('supports multiple languages', () => {
      expect(execSchema.body.properties.language.enum).toContain('python');
      expect(execSchema.body.properties.language.enum).toContain('bash');
      expect(execSchema.body.properties.language.enum).toContain('node');
    });
  });

  describe('batchActionsSchema', () => {
    it('requires actions array', () => {
      expect(batchActionsSchema.body.required).toEqual(['actions']);
    });

    it('allows 1 to 50 actions', () => {
      expect(batchActionsSchema.body.properties.actions.minItems).toBe(1);
      expect(batchActionsSchema.body.properties.actions.maxItems).toBe(50);
    });

    it('defines all action types in the enum', () => {
      const actionEnum =
        batchActionsSchema.body.properties.actions.items.properties.action.enum;
      expect(actionEnum).toContain('click');
      expect(actionEnum).toContain('screenshot');
      expect(actionEnum).toContain('type');
      expect(actionEnum).toContain('key');
      expect(actionEnum).toContain('bash');
      expect(actionEnum).toContain('scroll');
      expect(actionEnum).toContain('drag');
    });
  });

  describe('screenshotQuerySchema', () => {
    it('supports png and jpeg formats', () => {
      expect(screenshotQuerySchema.querystring.properties.format.enum).toEqual([
        'png',
        'jpeg',
      ]);
    });

    it('has quality range 1-100', () => {
      expect(
        screenshotQuerySchema.querystring.properties.quality.minimum,
      ).toBe(1);
      expect(
        screenshotQuerySchema.querystring.properties.quality.maximum,
      ).toBe(100);
    });
  });
});

// ---------------------------------------------------------------------------
// Validation helper tests
// ---------------------------------------------------------------------------

describe('validateKeyCombo', () => {
  it('accepts single letter keys', () => {
    expect(validateKeyCombo('a')).toBe(true);
    expect(validateKeyCombo('z')).toBe(true);
  });

  it('accepts single digit keys', () => {
    expect(validateKeyCombo('0')).toBe(true);
    expect(validateKeyCombo('9')).toBe(true);
  });

  it('accepts special keys', () => {
    expect(validateKeyCombo('enter')).toBe(true);
    expect(validateKeyCombo('tab')).toBe(true);
    expect(validateKeyCombo('escape')).toBe(true);
    expect(validateKeyCombo('backspace')).toBe(true);
    expect(validateKeyCombo('f1')).toBe(true);
    expect(validateKeyCombo('f12')).toBe(true);
  });

  it('accepts modifier combos', () => {
    expect(validateKeyCombo('ctrl+c')).toBe(true);
    expect(validateKeyCombo('shift+alt+f1')).toBe(true);
    expect(validateKeyCombo('ctrl+shift+a')).toBe(true);
    expect(validateKeyCombo('super+l')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(validateKeyCombo('Enter')).toBe(true);
    expect(validateKeyCombo('CTRL+C')).toBe(true);
    expect(validateKeyCombo('Shift+Alt+F1')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(validateKeyCombo('')).toBe(false);
  });

  it('rejects strings with null bytes', () => {
    expect(validateKeyCombo('a\0b')).toBe(false);
  });

  it('rejects invalid modifier keys', () => {
    expect(validateKeyCombo('invalidmod+a')).toBe(false);
  });

  it('rejects overly long strings', () => {
    expect(validateKeyCombo('a'.repeat(101))).toBe(false);
  });

  it('rejects unknown key names', () => {
    expect(validateKeyCombo('notakey')).toBe(false);
  });
});

describe('containsNullBytes', () => {
  it('returns false for normal text', () => {
    expect(containsNullBytes('hello world')).toBe(false);
  });

  it('returns true when null byte is present', () => {
    expect(containsNullBytes('hello\0world')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(containsNullBytes('')).toBe(false);
  });
});
