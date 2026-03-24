function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  isProduction: boolean;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  jwt: {
    secret: string;
  };
  /** Convenience alias — used by @fastify/jwt and lib/jwt.ts */
  jwtSecret: string;
  docker: {
    host: string;
  };
  /** Convenience alias for docker.host — used by workers and cleanup utilities. */
  dockerHost: string;
}

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    host: process.env.HOST ?? '0.0.0.0',
    nodeEnv,
    isProduction: nodeEnv === 'production',
    database: {
      url: requireEnv('DATABASE_URL'),
    },
    redis: {
      url: requireEnv('REDIS_URL'),
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    },
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    docker: {
      host: process.env.DOCKER_HOST ?? 'unix:///var/run/docker.sock',
    },
    dockerHost: process.env.DOCKER_HOST ?? 'unix:///var/run/docker.sock',
  };
}

export const config = loadConfig();
