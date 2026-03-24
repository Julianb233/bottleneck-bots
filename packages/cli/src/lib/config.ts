import Conf from 'conf';

export interface OrgoConfig {
  apiUrl: string;
  apiKey: string;
  activeWorkspace: string;
}

const config = new Conf<OrgoConfig>({
  projectName: 'bottleneck-bots',
  schema: {
    apiUrl: {
      type: 'string',
      default: 'http://localhost:3000',
    },
    apiKey: {
      type: 'string',
      default: '',
    },
    activeWorkspace: {
      type: 'string',
      default: '',
    },
  },
});

/** Get API URL from env override or config. */
export function getApiUrl(): string {
  return process.env.BNB_API_URL || config.get('apiUrl') || 'http://localhost:3000';
}

/** Get API key from env override or config. */
export function getApiKey(): string {
  return process.env.BNB_API_KEY || config.get('apiKey') || '';
}

/** Get active workspace ID. */
export function getActiveWorkspace(): string {
  return config.get('activeWorkspace') || '';
}

/** Set a config value. */
export function setConfig<K extends keyof OrgoConfig>(key: K, value: OrgoConfig[K]): void {
  config.set(key, value);
}

/** Delete a config value. */
export function deleteConfig(key: keyof OrgoConfig): void {
  config.delete(key);
}

/** Clear all config. */
export function clearConfig(): void {
  config.clear();
}

/** Get the path to the config file. */
export function getConfigPath(): string {
  return config.path;
}

export { config };
