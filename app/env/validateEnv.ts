import { env } from '~/env/env';

try {
  console.log(env);
} catch (error) {
  console.error(error);
  process.exit(1);
}
