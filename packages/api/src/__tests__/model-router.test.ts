import { describe, it, expect } from 'vitest';
import { detectProvider } from '../services/model-router.js';
import type { Provider } from '../services/model-router.js';

describe('detectProvider', () => {
  it('routes claude- models to anthropic', () => {
    expect(detectProvider('claude-3-5-sonnet-20241022')).toBe('anthropic');
    expect(detectProvider('claude-3-opus-20240229')).toBe('anthropic');
    expect(detectProvider('claude-sonnet-4-20250514')).toBe('anthropic');
  });

  it('routes anthropic/ prefixed models to anthropic', () => {
    expect(detectProvider('anthropic/claude-3-5-sonnet-20241022')).toBe(
      'anthropic',
    );
  });

  it('routes gemini- models to google', () => {
    expect(detectProvider('gemini-2.0-flash')).toBe('google');
    expect(detectProvider('gemini-1.5-pro')).toBe('google');
    expect(detectProvider('gemini-1.5-flash')).toBe('google');
  });

  it('routes google/ prefixed models to google', () => {
    expect(detectProvider('google/gemini-2.0-flash')).toBe('google');
  });

  it('routes gpt- models to openai', () => {
    expect(detectProvider('gpt-4o')).toBe('openai');
    expect(detectProvider('gpt-4o-mini')).toBe('openai');
    expect(detectProvider('gpt-4-turbo')).toBe('openai');
  });

  it('routes o1- and o3- models to openai', () => {
    expect(detectProvider('o1-preview')).toBe('openai');
    expect(detectProvider('o1-mini')).toBe('openai');
    expect(detectProvider('o3-mini')).toBe('openai');
  });

  it('defaults unknown models to openai', () => {
    expect(detectProvider('some-unknown-model')).toBe('openai');
    expect(detectProvider('llama-3')).toBe('openai');
  });

  it('returns a valid Provider type', () => {
    const validProviders: Provider[] = ['anthropic', 'openai', 'google'];
    expect(validProviders).toContain(detectProvider('claude-3-5-sonnet-20241022'));
    expect(validProviders).toContain(detectProvider('gpt-4o'));
    expect(validProviders).toContain(detectProvider('gemini-2.0-flash'));
  });
});
