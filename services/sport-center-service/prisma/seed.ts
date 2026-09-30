import { main } from './seeds';

main().catch((error) => {
  console.error('Failed to seed', error);
  process.exit(1);
});
