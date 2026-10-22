import { describe, expect, it } from 'vitest';
import { compileTemplate } from '../src/engine.ts';
import { AWKWARD_INPUTS, expectCleanOutcome, type AwkwardInputName } from './support/awkward-inputs.ts';

const SPECIAL_CHARACTERS = '&<>"\'=`';
const HANDLEBARS_ENTITIES = '&amp;&lt;&gt;&quot;&#x27;&#x3D;&#x60;';

describe('escaping', () => {
  it('escapes the seven special characters with Handlebars entities by default, for html and for true', () => {
    const data = { value: SPECIAL_CHARACTERS };

    expect(compileTemplate('{{value}}')(data)).toBe(HANDLEBARS_ENTITIES);
    expect(compileTemplate('{{value}}', { escape: 'html' })(data)).toBe(HANDLEBARS_ENTITIES);
    expect(compileTemplate('{{value}}', { escape: true })(data)).toBe(HANDLEBARS_ENTITIES);
  });

  it('leaves values unchanged for none and for false', () => {
    const data = { value: SPECIAL_CHARACTERS };

    expect(compileTemplate('{{value}}', { escape: 'none' })(data)).toBe(SPECIAL_CHARACTERS);
    expect(compileTemplate('{{value}}', { escape: false })(data)).toBe(SPECIAL_CHARACTERS);
  });

  it('escapes a helper string result in html mode only', () => {
    const handlebars = { helpers: { echo: (text: string) => text } };

    expect(compileTemplate('{{echo value}}', { handlebars })({ value: '<b>' })).toBe('&lt;b&gt;');
    expect(compileTemplate('{{echo value}}', { escape: 'none', handlebars })({ value: '<b>' })).toBe('<b>');
  });

  it('throws naming the accepted values for an invalid escape value', () => {
    expect(() => compileTemplate('{{value}}', { escape: 'xml' as never })).toThrow(
      "Invalid escape option xml. Expected one of 'html', 'none', true or false."
    );
  });

  it('renders template syntax inside a value literally instead of expanding it', () => {
    const render = compileTemplate('{{#items}}[{{label}}]{{/items}}');

    expect(
      render({ secret: 'TOPSECRET', items: [{ label: '{{secret}}{{slot:x}}' }], slots: { x: '<b>RAW</b>' } })
    ).toBe('[{{secret}}{{slot:x}}]');
  });
});

describe('slots', () => {
  it('inserts slot content raw in html mode without expanding template syntax in it', () => {
    const render = compileTemplate('<div>{{slot:body}}</div>');

    expect(render({ secret: 'TOPSECRET', slots: { body: '<b>{{secret}}</b>' } })).toBe('<div><b>{{secret}}</b></div>');
  });

  it('reads a dotted slot name as one key', () => {
    expect(compileTemplate('{{slot:a.b}}')({ slots: { 'a.b': '<b>dotted</b>' } })).toBe('<b>dotted</b>');
  });

  it('reads the root slot inside an each whose item has its own slots key', () => {
    const render = compileTemplate('{{#each items}}{{slot:x}}{{/each}}');

    expect(render({ items: [{ slots: { x: 'item' } }], slots: { x: '<b>root</b>' } })).toBe('<b>root</b>');
  });

  it('renders a missing slot as empty, even in strict mode', () => {
    expect(compileTemplate('[{{slot:x}}]')({})).toBe('[]');
    expect(compileTemplate('[{{slot:x}}]', { strict: true })({})).toBe('[]');
  });

  it('renders null data as empty data instead of failing on its slots', () => {
    expect(compileTemplate('<p>{{name}}{{slot:body}}</p>')(null as never)).toBe('<p></p>');
  });

  it('renders an escaped slot mustache literally', () => {
    expect(compileTemplate('\\{{slot:x}}')({ slots: { x: 'value' } })).toBe('{{slot:x}}');
  });
});

describe('strict mode', () => {
  it('throws naming a missing field in strict mode and renders it empty without', () => {
    expect(() => compileTemplate('Hi {{firstNmae}}', { strict: true })({ firstName: 'Dan' })).toThrow(
      /"firstNmae" not defined/
    );
    expect(compileTemplate('Hi {{firstNmae}}')({ firstName: 'Dan' })).toBe('Hi ');
  });

  it('rethrows a TypeError from a path through a missing object with a hint and the TypeError as cause', () => {
    const render = compileTemplate('{{a.b.c}}', { strict: true });
    let thrown: unknown;

    try {
      render({});
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toMatch(/^Strict render failed: Cannot read properties of undefined .*dotted path/);
    expect((thrown as Error).cause).toBeInstanceOf(TypeError);
  });

  it('looks names and null fields up in the enclosing context only without strict mode', () => {
    const owner = '{{#items}}[{{owner}}]{{/items}}';
    const nullName = '{{#items}}[{{name}}]{{/items}}';

    expect(compileTemplate(owner)({ owner: 'Dan', items: [{}] })).toBe('[Dan]');
    expect(() => compileTemplate(owner, { strict: true })({ owner: 'Dan', items: [{}] })).toThrow(/"owner" not defined/);
    expect(compileTemplate('{{#items}}[{{../owner}}]{{/items}}', { strict: true })({ owner: 'Dan', items: [{}] })).toBe(
      '[Dan]'
    );
    expect(compileTemplate(nullName)({ name: 'ROOT', items: [{ name: null }] })).toBe('[ROOT]');
    expect(compileTemplate(nullName, { strict: true })({ name: 'ROOT', items: [{ name: null }] })).toBe('[]');
  });
});

describe('strict mode as the reference documents it', () => {
  it('throws for a missing raw slots reference in strict mode', () => {
    expect(() => compileTemplate('[{{{slots.x}}}]', { strict: true })({ slots: {} })).toThrow(/"x" not defined/);
  });

  it('throws naming a missing block and a missing inverted block in strict mode', () => {
    expect(() => compileTemplate('{{#items}}x{{/items}}', { strict: true })({})).toThrow(/"items" not defined/);
    expect(() => compileTemplate('{{^items}}x{{/items}}', { strict: true })({})).toThrow(/"items" not defined/);
  });

  it('names the leaf of a missing two-segment path in strict mode', () => {
    expect(() => compileTemplate('{{user.name}}', { strict: true })({})).toThrow(/"name" not defined/);
  });

  it('does not check names used only as if and each parameters in strict mode', () => {
    expect(compileTemplate('{{#if maybe}}yes{{else}}no{{/if}}', { strict: true })({})).toBe('no');
    expect(compileTemplate('[{{#each list}}x{{/each}}]', { strict: true })({})).toBe('[]');
  });

  it('resolves an @root path inside an each in strict mode', () => {
    const render = compileTemplate('{{#each items}}{{@root.appUrl}}/items/{{id}}{{/each}}', { strict: true });

    expect(render({ appUrl: 'https://x.test', items: [{ id: 1 }] })).toBe('https://x.test/items/1');
  });
});

describe('helpers and engine options', () => {
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

  it('ignores the reserved engine options and a caller lookup helper in favour of its own', () => {
    const render = compileTemplate('{{value}}{{missing}}{{#each items}}{{outer}}{{/each}}{{slot:x}}', {
      handlebars: {
        compat: false,
        noEscape: true,
        strict: true,
        helpers: { lookup: () => 'caller lookup' }
      }
    });

    expect(render({ value: '<b>', items: [{}], outer: ' outer', slots: { x: '<i>slot</i>' } })).toBe(
      '&lt;b&gt; outer<i>slot</i>'
    );
  });

  it('passes other engine options to Handlebars, keeping slots working under knownHelpersOnly', () => {
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

describe('partials and malformed templates', () => {
  it('rewrites slots inside a partial', () => {
    const render = compileTemplate('<p>{{> card}}</p>', { handlebars: { partials: { card: '{{slot:x}}' } } });

    expect(render({ slots: { x: '<b>x</b>' } })).toBe('<p><b>x</b></p>');
  });

  it('throws at compile time for a partial reference with two context arguments', () => {
    expect(() => compileTemplate('{{> card first second}}', { handlebars: { partials: { card: 'card' } } })).toThrow(
      'Unsupported number of partial arguments: 2'
    );
  });

  it('throws with the line and a position marker for an unclosed block at compile time', () => {
    expect(() => compileTemplate('<p>\n{{#if ready}}\nready')).toThrow(/Parse error on line 3:[\s\S]*\^/);
  });
});

// Handlebars ends a name at whitespace (the BOM included), so these slot names read as a helper call or the empty slot.
const SLOT_NAME_ERRORS: Partial<Record<AwkwardInputName, string>> = {
  'family emoji': 'Missing helper: "slot:Hello"',
  'flag emoji': 'Missing helper: "slot:Shipping"',
  'surrounding whitespace': 'Missing helper: "slot:"',
  'byte order mark': 'Missing helper: "slot:"'
};
const EMPTY_SLOT_NAMES: AwkwardInputName[] = ['whitespace only'];

describe('awkward text', () => {
  it('keeps each awkward input intact as template text, data and slot content, and handles it as a slot name', async () => {
    for (const [name, input] of Object.entries(AWKWARD_INPUTS) as [AwkwardInputName, string][]) {
      const asText = await expectCleanOutcome(() => compileTemplate(input)({}), name);
      const asData = await expectCleanOutcome(() => compileTemplate('[{{v}}]')({ v: input }), name);
      const asSlot = await expectCleanOutcome(() => compileTemplate('[{{slot:x}}]')({ slots: { x: input } }), name);
      const asSlotName = await expectCleanOutcome(
        () => compileTemplate(`[{{slot:${input}}}]`)({ slots: { [input]: 'S' } }),
        name
      );

      expect(asText, name).toEqual({ outcome: 'returned', value: input });
      expect(asData, name).toEqual({ outcome: 'returned', value: `[${input}]` });
      expect(asSlot, name).toEqual({ outcome: 'returned', value: `[${input}]` });

      const slotNameError = SLOT_NAME_ERRORS[name];
      if (slotNameError !== undefined) {
        expect(asSlotName, name).toEqual({ outcome: 'threw', error: expect.objectContaining({ message: slotNameError }) });
      } else if (EMPTY_SLOT_NAMES.includes(name)) {
        expect(asSlotName, name).toEqual({ outcome: 'returned', value: '[]' });
      } else {
        expect(asSlotName, name).toEqual({ outcome: 'returned', value: '[S]' });
      }
    }
  });
});
