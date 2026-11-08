import { createHttpApplication } from './bootstrap';
import { loadConfig } from './config/env';

async function main() {
  const app = await createHttpApplication();
  await app.listen(loadConfig().PORT);
}
void main();
