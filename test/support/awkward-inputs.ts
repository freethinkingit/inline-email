import { expect } from 'vitest';

const ZERO_WIDTH_JOINER = '\u200D';
const BYTE_ORDER_MARK = '\uFEFF';
const FAMILY_EMOJI = ['👨', '👩', '👧', '👦'].join(ZERO_WIDTH_JOINER);

/**
 * The Awkward_Input set: text a Parsing_Unit must take without crashing, keyed by a name that
 * failure messages quote. Iterate it with `Object.entries(AWKWARD_INPUTS)`.
 */
export const AWKWARD_INPUTS = {
  'family emoji': `Hello ${FAMILY_EMOJI} family`,
  'flag emoji': 'Shipping to 🇯🇵 today',
  'non-Latin script': 'こんにちは、世界',
  '10,000 characters': 'a'.repeat(10_000),
  'surrounding whitespace': '  \t padded text \n ',
  'whitespace only': ' \t\n ',
  'zero-width joiner': `zero${ZERO_WIDTH_JOINER}width`,
  'control character': 'bell\u0007here',
  'byte order mark': `${BYTE_ORDER_MARK}starts with a BOM`
} as const satisfies Record<string, string>;

/** The name of one entry in `AWKWARD_INPUTS`. */
export type AwkwardInputName = keyof typeof AWKWARD_INPUTS;

/** How long a Parsing_Unit may take on any Awkward_Input. */
export const AWKWARD_INPUT_TIME_LIMIT_MS = 1000;

/** How a Parsing_Unit handled an Awkward_Input: it returned a value, or threw the module's own `Error`. */
export type CleanOutcome = { outcome: 'returned'; value: unknown } | { outcome: 'threw'; error: Error };

/**
 * Asserts that a Parsing_Unit handled an Awkward_Input cleanly: the call returned, or threw an
 * `Error` with a message that is not a `TypeError` or `RangeError`, within one second.
 *
 * An asynchronous call that is still pending after one second fails at that point. A synchronous
 * call cannot be interrupted, so a synchronous hang is only reported once it returns, or by the
 * test's own timeout if it never does.
 *
 * @param run - The call under test; it may return a value or a promise.
 * @param inputName - The Awkward_Input's name, quoted in every failure message.
 * @returns `{ outcome: 'returned', value }` with what the call returned, so the test can check the input's text survived, or `{ outcome: 'threw', error }` with the clean `Error` it threw.
 * @throws An assertion error naming the input when the call is slow, throws a non-`Error`, a `TypeError` or `RangeError`, or an `Error` with no message.
 */
export async function expectCleanOutcome(run: () => unknown, inputName: string): Promise<CleanOutcome> {
  const started = performance.now();
  const settled = await settleWithin(run, AWKWARD_INPUT_TIME_LIMIT_MS);
  const elapsedMs = Math.round(performance.now() - started);

  if (settled.kind === 'timed out' || elapsedMs > AWKWARD_INPUT_TIME_LIMIT_MS) {
    expect.fail(`"${inputName}" took ${elapsedMs} ms, over the ${AWKWARD_INPUT_TIME_LIMIT_MS} ms limit`);
  }

  if (settled.kind === 'returned') {
    return { outcome: 'returned', value: settled.value };
  }

  const thrown = settled.error;
  if (!(thrown instanceof Error)) {
    expect.fail(`"${inputName}" threw a non-Error value: ${String(thrown)}`);
  }
  if (thrown instanceof TypeError || thrown instanceof RangeError) {
    expect.fail(`"${inputName}" threw an unhandled ${thrown.name}: ${thrown.message}`);
  }
  if (thrown.message.trim() === '') {
    expect.fail(`"${inputName}" threw ${thrown.name} with an empty message`);
  }
  return { outcome: 'threw', error: thrown };
}

type Settled = { kind: 'returned'; value: unknown } | { kind: 'threw'; error: unknown } | { kind: 'timed out' };

async function settleWithin(run: () => unknown, limitMs: number): Promise<Settled> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<Settled>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timed out' }), limitMs);
  });
  const settled = (async (): Promise<Settled> => {
    try {
      return { kind: 'returned', value: await run() };
    } catch (error) {
      return { kind: 'threw', error };
    }
  })();

  try {
    return await Promise.race([settled, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
