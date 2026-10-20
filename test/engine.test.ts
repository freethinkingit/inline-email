import Handlebars from 'handlebars';
import { describe, expect, it } from 'vitest';
import { compileTemplate, normalizeEscapeMode } from '../src/engine.ts';

const SPECIAL_CHARACTERS = ['&', '<', '>', '"', "'", '=', '`'];
const ORDINARY_TEXT = ['a', 'Dan', ' ', 'O', 'Tom', '42', 'é', '\n', 'x-y', '{', '}'];
const GENERATED_COUNT = 50;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 2 ** 32;
  };
}

function generateEscapeInputs(count: number, seed: number): string[] {
  const random = seededRandom(seed);
  const pick = (items: string[]) => items[Math.floor(random() * items.length)];

  return Array.from({ length: count }, (_, index) => {
    const pieces = [SPECIAL_CHARACTERS[index % SPECIAL_CHARACTERS.length]];
    const length = 1 + Math.floor(random() * 12);

    for (let piece = 0; piece < length; piece += 1) {
      pieces.push(random() < 0.5 ? pick(SPECIAL_CHARACTERS) : pick(ORDINARY_TEXT));
    }

    return pieces.join('');
  });
}

const escapeInputs = generateEscapeInputs(GENERATED_COUNT, 20261019);

describe('Property 2: Escape modes are exact', () => {
  it('generates the full table with every special character', () => {
    expect(escapeInputs).toHaveLength(GENERATED_COUNT);

    for (const character of SPECIAL_CHARACTERS) {
      expect(escapeInputs.some((value) => value.includes(character))).toBe(true);
    }
  });

  it.each(escapeInputs.map((value, index) => [index, value]))(
    'escapes generated input %i as Handlebars does in html mode and leaves it unchanged in none mode',
    (_index, value) => {
      const expected = Handlebars.Utils.escapeExpression(value);

      expect(compileTemplate('{{value}}')({ value })).toBe(expected);
      expect(compileTemplate('{{value}}', { escape: 'html' })({ value })).toBe(expected);
      expect(compileTemplate('{{value}}', { escape: true })({ value })).toBe(expected);
      expect(compileTemplate('{{value}}', { escape: 'none' })({ value })).toBe(value);
      expect(compileTemplate('{{value}}', { escape: false })({ value })).toBe(value);
    }
  );

  it('maps the 3.x booleans to html and none', () => {
    expect(normalizeEscapeMode(true)).toBe('html');
    expect(normalizeEscapeMode(false)).toBe('none');
    expect(normalizeEscapeMode(undefined)).toBe('html');
  });

  it('escapes the seven special characters with the Handlebars entities', () => {
    expect(compileTemplate('{{value}}')({ value: '&<>"\'=`' })).toBe('&amp;&lt;&gt;&quot;&#x27;&#x3D;&#x60;');
  });

  it.each(escapeInputs.map((value, index) => [index, value]))(
    'escapes a helper string result for generated input %i in html mode only',
    (_index, value) => {
      const handlebars = { helpers: { echo: (text: string) => text } };

      expect(compileTemplate('{{echo value}}', { handlebars })({ value })).toBe(
        Handlebars.Utils.escapeExpression(value)
      );
      expect(compileTemplate('{{echo value}}', { escape: 'none', handlebars })({ value })).toBe(value);
    }
  );

  it.each(escapeInputs.map((value, index) => [index, value]))(
    'inserts a helper SafeString result for generated input %i unchanged in both modes',
    (_index, value) => {
      const handlebars = { helpers: { safe: (text: string) => new Handlebars.SafeString(text) } };

      expect(compileTemplate('{{safe value}}', { handlebars })({ value })).toBe(value);
      expect(compileTemplate('{{safe value}}', { escape: 'none', handlebars })({ value })).toBe(value);
    }
  );
});

describe('Property 5: Compiles are isolated', () => {
  it('keeps a helper registered for one compile unknown to another', () => {
    const first = compileTemplate('{{shout name}}', {
      handlebars: { helpers: { shout: (text: string) => text.toUpperCase() } }
    });
    const second = compileTemplate('{{shout name}}', {
      handlebars: { helpers: { whisper: (text: string) => text.toLowerCase() } }
    });

    expect(first({ name: 'Dan' })).toBe('DAN');
    expect(() => second({ name: 'Dan' })).toThrow('Missing helper: "shout"');
  });
});

describe('compileTemplate errors and reserved options', () => {
  it('applies the Library value for reserved engine fields without error', () => {
    const render = compileTemplate('{{value}}{{missing}}{{#each items}}{{outer}}{{/each}}', {
      handlebars: {
        compat: false,
        noEscape: true,
        strict: true,
        helpers: { lookup: () => 'caller lookup' }
      }
    });

    expect(render({ value: '<b>', items: [{}], outer: ' outer' })).toBe('&lt;b&gt; outer');
    expect(compileTemplate('{{slot:x}}', { handlebars: { helpers: { lookup: () => 'caller lookup' } } })({
      slots: { x: '<i>slot</i>' }
    })).toBe('<i>slot</i>');
  });

  it('throws naming the accepted values for an invalid escape value', () => {
    expect(() => compileTemplate('{{value}}', { escape: 'xml' as never })).toThrow(
      "Invalid escape option xml. Expected one of 'html', 'none', true or false."
    );
  });

  it('throws with the line and a position marker for an unclosed block at compile time', () => {
    expect(() => compileTemplate('<p>\n{{#if ready}}\nready')).toThrow(/Parse error on line 3:[\s\S]*\^/);
  });

  it('throws at compile time for a partial reference with two context arguments', () => {
    expect(() => compileTemplate('{{> card first second}}', { handlebars: { partials: { card: 'card' } } })).toThrow(
      'Unsupported number of partial arguments: 2'
    );
  });

  it('compiles with knownHelpersOnly and a registered helper', () => {
    const render = compileTemplate('{{shout name}} {{slot:x}}', {
      handlebars: {
        helpers: { shout: (text: string) => text.toUpperCase() },
        knownHelpersOnly: true,
        knownHelpers: { shout: true }
      }
    });

    expect(render({ name: 'Dan', slots: { x: '<b>x</b>' } })).toBe('DAN <b>x</b>');
  });
});

describe('slot rewrite', () => {
  it('reads a dotted slot name as one key', () => {
    expect(compileTemplate('{{slot:a.b}}')({ slots: { 'a.b': '<b>dotted</b>' } })).toBe('<b>dotted</b>');
  });

  it('still calls a registered helper from a bare mustache', () => {
    const render = compileTemplate('{{greeting}}', { handlebars: { helpers: { greeting: () => 'Hello' } } });

    expect(render({ greeting: 'data' })).toBe('Hello');
  });

  it('reads the root slot inside an each whose item has its own slots key', () => {
    const render = compileTemplate('{{#each items}}{{slot:x}}{{/each}}');

    expect(render({ items: [{ slots: { x: 'item' } }], slots: { x: '<b>root</b>' } })).toBe('<b>root</b>');
  });

  it('renders an escaped slot mustache literally', () => {
    expect(compileTemplate('\\{{slot:x}}')({ slots: { x: 'value' } })).toBe('{{slot:x}}');
  });
});
