import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// AppModule loads `.env` relative to cwd. Move integration tests to an empty
// directory before any application module is evaluated.
process.chdir(mkdtempSync(join(tmpdir(), 'elite-drive-integration-')));

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Integration tests require NODE_ENV=test');
}
if (!process.env.DATABASE_URL) {
  throw new Error('Integration tests require an explicit DATABASE_URL');
}
