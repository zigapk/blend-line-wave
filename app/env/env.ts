import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'staging']),
  },
  client: {
    PUBLIC_TEST: z.string().optional(),
  },
  clientPrefix: 'PUBLIC_',
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (error) => {
    throw new Error(
      `Invalid environment variables: ${error.errors.map((error) => error.path[0]).join(', ')}`,
    );
  },
});
