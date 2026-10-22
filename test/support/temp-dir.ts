import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

/**
 * Creates an empty directory under the system temp folder for the running test, and removes it,
 * with everything in it, when that test finishes, whether it passed or failed.
 *
 * @param prefix - Start of the directory name, such as `inline-email-cli-`, so a leftover directory says which test made it.
 * @returns The absolute path of the new directory.
 * @throws When called outside a running test, since there is no test to tie the clean-up to.
 */
export function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
