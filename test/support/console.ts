import { onTestFinished, vi, type MockInstance } from 'vitest';

/** A console method a test can silence and read back. */
export type ConsoleMethod = 'log' | 'error' | 'warn';

/**
 * Silences one console method for the running test and records what was printed to it.
 * The real method is restored when that test finishes, whether it passed or failed.
 *
 * @param method - The console method to capture: `log`, `error` or `warn`.
 * @returns The spy, so the test can read `mock.calls` or assert how often the method was called.
 * @throws When called outside a running test, since there is no test to tie the restore to.
 */
export function captureConsole(method: ConsoleMethod): MockInstance<(...args: unknown[]) => void> {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  onTestFinished(() => spy.mockRestore());
  return spy;
}
