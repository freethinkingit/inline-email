import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../src/template.ts';

describe('renderTemplate', () => {
  it('escapes normal variables by default', () => {
    expect(renderTemplate('<p>Hello {{firstName}}</p>', { firstName: '<Dan>' })).toBe(
      '<p>Hello &lt;Dan&gt;</p>'
    );
  });

  it('injects explicit trusted slots without escaping', () => {
    expect(
      renderTemplate('<section>{{slot:summary}}</section>', {
        slots: {
          summary: '<strong>Approved</strong>'
        }
      })
    ).toBe('<section><strong>Approved</strong></section>');
  });

  it('renders repeated blocks', () => {
    expect(
      renderTemplate('<ul>{{#items}}<li>{{label}}</li>{{/items}}</ul>', {
        items: [{ label: 'One' }, { label: 'Two' }]
      })
    ).toBe('<ul><li>One</li><li>Two</li></ul>');
  });

  it('can render without HTML escaping for plain-text output', () => {
    expect(renderTemplate("Hi {{name}}, Tom & Jerry", { name: "O'Brien" }, { escape: false })).toBe(
      "Hi O'Brien, Tom & Jerry"
    );
  });

  it('does not re-expand template syntax found in block item values', () => {
    expect(
      renderTemplate('{{#items}}<li>{{label}}</li>{{/items}}', {
        secret: 'TOPSECRET',
        items: [{ label: '{{secret}}' }]
      })
    ).toBe('<li>{{secret}}</li>');
  });

  it('does not resolve slot syntax found in block item values', () => {
    expect(
      renderTemplate('{{#items}}<li>{{label}}</li>{{/items}}', {
        items: [{ label: '{{slot:admin}}' }],
        slots: { admin: '<b>raw html</b>' }
      })
    ).toBe('<li>{{slot:admin}}</li>');
  });

  it('does not re-expand template syntax found in slot content', () => {
    expect(
      renderTemplate('<div>{{slot:body}}</div>', {
        secret: 'TOPSECRET',
        slots: { body: '<b>{{secret}}</b>' }
      })
    ).toBe('<div><b>{{secret}}</b></div>');
  });

  it('keeps nested block, scalar block and dot semantics', () => {
    expect(
      renderTemplate('{{#show}}{{#tags}}[{{.}}]{{/tags}}{{#user}}{{name}}{{/user}}{{/show}}', {
        show: true,
        tags: ['a', '<b>'],
        user: { name: 'Dan' }
      })
    ).toBe('[a][&lt;b&gt;]Dan');
  });

  it('keeps a complete block found in a value literal', () => {
    expect(
      renderTemplate('{{#items}}<li>{{label}}</li>{{/items}}', {
        secret: 'TOPSECRET',
        items: [{ label: '{{#items}}{{secret}}{{/items}}' }]
      })
    ).toBe('<li>{{#items}}{{secret}}{{/items}}</li>');
  });

  it('keeps slot syntax literal two blocks deep', () => {
    expect(
      renderTemplate('{{#a}}{{#b}}<i>{{v}}</i>{{/b}}{{/a}}', {
        a: [{ b: [{ v: '{{slot:x}}' }] }],
        slots: { x: '<b>raw</b>' }
      })
    ).toBe('<i>{{slot:x}}</i>');
  });

  it('keeps template syntax literal in scalar items rendered with a dot', () => {
    expect(renderTemplate('{{#items}}[{{.}}]{{/items}}', { secret: 'TOPSECRET', items: ['{{secret}}'] })).toBe(
      '[{{secret}}]'
    );
  });

  it('does not let a value close the enclosing block', () => {
    expect(
      renderTemplate('{{#items}}<li>{{label}}</li>{{/items}}{{secret}}', {
        secret: 'A',
        items: [{ label: '{{/items}}{{secret}}{{#items}}' }]
      })
    ).toBe('<li>{{/items}}{{secret}}{{#items}}</li>A');
  });

  it('does not form a token from a value and the template text after it', () => {
    expect(renderTemplate('{{#items}}<p>{{a}}x}}</p>{{/items}}', { x: 'X', items: [{ a: '{{' }] })).toBe(
      '<p>{{x}}</p>'
    );
  });

  it('renders bare blocks over 0 and empty string, nothing for false and missing, and the body once for truthy scalars', () => {
    expect(
      renderTemplate('{{#zero}}0{{/zero}}{{#empty}}e{{/empty}}{{#no}}n{{/no}}{{#missing}}m{{/missing}}{{#yes}}{{name}}{{/yes}}', {
        zero: 0,
        empty: '',
        no: false,
        yes: 'on',
        name: 'Dan'
      })
    ).toBe('0eDan');
  });

  it('renders missing and nested missing keys as empty strings', () => {
    expect(renderTemplate('[{{missing}}][{{user.missing}}][{{user.name.deep}}]', { user: { name: 'Dan' } })).toBe(
      '[][][]'
    );
  });

  it('inherits parent slots and parent variables inside blocks', () => {
    expect(
      renderTemplate('{{#items}}{{slot:badge}}{{label}}/{{owner}}{{/items}}', {
        owner: 'Dan',
        items: [{ label: 'One', slots: { badge: 'ignored' } }],
        slots: { badge: '<b>*</b>' }
      })
    ).toBe('<b>*</b>One/Dan');
  });

  it('resolves dotted paths for block keys and variables', () => {
    expect(
      renderTemplate('{{#user.items}}<li>{{name}} {{user.address.city}}</li>{{/user.items}}', {
        user: { address: { city: 'Oslo' }, items: [{ name: 'a' }, { name: 'b' }] }
      })
    ).toBe('<li>a Oslo</li><li>b Oslo</li>');
  });

  it('renders text and variables between adjacent blocks', () => {
    expect(
      renderTemplate('{{#a}}A{{n}}{{/a}} mid {{y}} {{#b}}B{{n}}{{/b}}', {
        a: [{ n: 1 }],
        b: [{ n: 2 }],
        y: 'Y'
      })
    ).toBe('A1 mid Y B2');
  });

  it('propagates plain-text mode into blocks', () => {
    expect(renderTemplate('{{#items}}{{v}}{{/items}}', { items: [{ v: '<&>' }] }, { escape: false })).toBe('<&>');
  });

  it('closes the innermost block when nested blocks share a name', () => {
    expect(renderTemplate('{{#a}}[{{#a}}x{{/a}}]{{/a}}', { a: [{ a: [1, 2] }] })).toBe('[xx]');
  });

  it('renders recursive item lists that reuse the block name', () => {
    expect(
      renderTemplate('{{#items}}<li>{{name}}{{#items}} > {{name}}{{/items}}</li>{{/items}}', {
        items: [{ name: 'Parent', items: [{ name: 'Child' }] }, { name: 'Leaf', items: [] }]
      })
    ).toBe('<li>Parent > Child</li><li>Leaf</li>');
  });

  it('throws a parse error for stray close tags and unclosed blocks', () => {
    expect(() => renderTemplate('{{/items}}{{#items}}{{name}}', { items: [{ name: 'A' }], name: 'top' })).toThrow(
      /Parse error on line 1/
    );
    expect(() => renderTemplate('{{#items}}{{name}}', { items: [{ name: 'A' }] })).toThrow(/Parse error on line 1/);
  });
});

const HOSTILE_VALUES = ['{{secret}}', '{{slot:x}}', '{{#a}}x{{/a}}', '{{{slots.x}}}', '{{'];

const DECOYS = {
  secret: 'TOPSECRET',
  a: true,
  x: 'X',
  slots: { x: '<b>RAW</b>' }
};

type HostilePosition = {
  position: string;
  template: string;
  data: (value: string) => Parameters<typeof renderTemplate>[1];
};

const HOSTILE_POSITIONS: HostilePosition[] = [
  { position: 'at top level', template: '[{{v}}]', data: (value) => ({ ...DECOYS, v: value }) },
  {
    position: 'inside a block',
    template: '{{#outer}}[{{v}}]{{/outer}}',
    data: (value) => ({ ...DECOYS, outer: [{ v: value }] })
  },
  {
    position: 'inside a nested block',
    template: '{{#outer}}{{#inner}}[{{v}}]{{/inner}}{{/outer}}',
    data: (value) => ({ ...DECOYS, outer: [{ inner: [{ v: value }] }] })
  },
  {
    position: 'inside a scalar block with a dot',
    template: '{{#list}}[{{.}}]{{/list}}',
    data: (value) => ({ ...DECOYS, list: [value] })
  },
  {
    position: 'inside slot content',
    template: '[{{slot:body}}]',
    data: (value) => ({ ...DECOYS, slots: { ...DECOYS.slots, body: value } })
  }
];

const HOSTILE_CASES = HOSTILE_POSITIONS.flatMap((position) => HOSTILE_VALUES.map((value) => ({ ...position, value })));

describe('Property 1: Rendered values are inert', () => {
  it.each(HOSTILE_CASES)('renders $value literally $position', ({ template, data, value }) => {
    const output = renderTemplate(template, data(value));

    expect(output).toBe(`[${value}]`);
    expect(output).not.toContain('TOPSECRET');
    expect(output).not.toContain('RAW');
  });
});

const STRICT_EQUAL_CASES: {
  name: string;
  template: string;
  data: Parameters<typeof renderTemplate>[1];
  options?: Parameters<typeof renderTemplate>[2];
}[] = [
  { name: 'escaped variable', template: '<p>Hello {{firstName}}</p>', data: { firstName: '<Dan>' } },
  {
    name: 'trusted slot',
    template: '<section>{{slot:summary}}</section>',
    data: { slots: { summary: '<strong>Approved</strong>' } }
  },
  {
    name: 'repeated block',
    template: '<ul>{{#items}}<li>{{label}}</li>{{/items}}</ul>',
    data: { items: [{ label: 'One' }, { label: 'Two' }] }
  },
  {
    name: 'plain-text output',
    template: 'Hi {{name}}, Tom & Jerry',
    data: { name: "O'Brien" },
    options: { escape: false }
  },
  {
    name: 'template syntax in block item values',
    template: '{{#items}}<li>{{label}}</li>{{/items}}',
    data: { secret: 'TOPSECRET', items: [{ label: '{{secret}}' }] }
  },
  {
    name: 'slot syntax in block item values',
    template: '{{#items}}<li>{{label}}</li>{{/items}}',
    data: { items: [{ label: '{{slot:admin}}' }], slots: { admin: '<b>raw html</b>' } }
  },
  {
    name: 'template syntax in slot content',
    template: '<div>{{slot:body}}</div>',
    data: { secret: 'TOPSECRET', slots: { body: '<b>{{secret}}</b>' } }
  },
  {
    name: 'nested data, scalar block and dot',
    template: '{{#show}}{{#tags}}[{{.}}]{{/tags}}{{#user}}{{name}}{{/user}}{{/show}}',
    data: { show: true, tags: ['a', '<b>'], user: { name: 'Dan' } }
  },
  {
    name: 'a complete block in a value literal',
    template: '{{#items}}<li>{{label}}</li>{{/items}}',
    data: { secret: 'TOPSECRET', items: [{ label: '{{#items}}{{secret}}{{/items}}' }] }
  },
  {
    name: 'slot syntax two blocks deep',
    template: '{{#a}}{{#b}}<i>{{v}}</i>{{/b}}{{/a}}',
    data: { a: [{ b: [{ v: '{{slot:x}}' }] }], slots: { x: '<b>raw</b>' } }
  },
  {
    name: 'template syntax in scalar items rendered with a dot',
    template: '{{#items}}[{{.}}]{{/items}}',
    data: { secret: 'TOPSECRET', items: ['{{secret}}'] }
  },
  {
    name: 'value literal inside a block',
    template: '{{#items}}<li>{{label}}</li>{{/items}}{{secret}}',
    data: { secret: 'A', items: [{ label: '{{/items}}{{secret}}{{#items}}' }] }
  },
  {
    name: 'a value next to template text',
    template: '{{#items}}<p>{{a}}x}}</p>{{/items}}',
    data: { x: 'X', items: [{ a: '{{' }] }
  },
  {
    name: 'adjacent blocks',
    template: '{{#a}}A{{n}}{{/a}} mid {{y}} {{#b}}B{{n}}{{/b}}',
    data: { a: [{ n: 1 }], b: [{ n: 2 }], y: 'Y' }
  },
  {
    name: 'plain-text mode inside blocks',
    template: '{{#items}}{{v}}{{/items}}',
    data: { items: [{ v: '<&>' }] },
    options: { escape: false }
  },
  { name: 'inverted block over an empty list', template: '{{^items}}none{{/items}}', data: { items: [] } },
  { name: 'inverted block over a present list', template: '{{^items}}none{{/items}}', data: { items: [1] } },
  { name: 'same-name nesting', template: '{{#a}}[{{#a}}x{{/a}}]{{/a}}', data: { a: [{ a: [1, 2] }] } },
  {
    name: 'recursive item lists',
    template: '{{#items}}<li>{{name}}{{#items}} > {{name}}{{/items}}</li>{{/items}}',
    data: { items: [{ name: 'Parent', items: [{ name: 'Child' }] }, { name: 'Leaf', items: [] }] }
  },
  {
    name: 'enclosing context through ../ and @root.',
    template: '{{#items}}{{label}}/{{../owner}}/{{@root.owner}}{{/items}}',
    data: { owner: 'Dan', items: [{ label: 'One' }] }
  }
];

const STRICT_THROW_CASES = [
  {
    name: 'a missing top-level variable',
    template: '[{{name}}]',
    data: {},
    message: /"name" not defined/,
    nonStrict: '[]'
  },
  {
    name: 'a missing leaf',
    template: '[{{user.nmae}}]',
    data: { user: {} },
    message: /"nmae" not defined/,
    nonStrict: '[]'
  },
  {
    name: 'a missing first segment, where Handlebars names the leaf and not the missing segment',
    template: '[{{custmer.name}}]',
    data: {},
    message: /"name" not defined in undefined/,
    nonStrict: '[]'
  },
  {
    name: 'a path three segments deep through a missing object, rethrown with a hint',
    template: '[{{a.b.c}}]',
    data: {},
    message: /^Strict render failed: Cannot read properties of undefined .*dotted path/,
    nonStrict: '[]'
  },
  {
    name: 'a missing block name',
    template: '[{{#blk}}x{{/blk}}]',
    data: {},
    message: /"blk" not defined/,
    nonStrict: '[]'
  },
  {
    name: 'a missing inverted block name',
    template: '[{{^blk}}x{{/blk}}]',
    data: {},
    message: /"blk" not defined/,
    nonStrict: '[x]'
  },
  {
    name: 'a missing row key inside each',
    template: '{{#each rows}}[{{nmae}}]{{/each}}',
    data: { rows: [{ name: 'a' }] },
    message: /"nmae" not defined/,
    nonStrict: '[]'
  },
  {
    name: 'an enclosing-context name read without ../ or @root.',
    template: '{{#items}}[{{owner}}]{{/items}}',
    data: { owner: 'Dan', items: [{ label: 'One' }] },
    message: /"owner" not defined/,
    nonStrict: '[Dan]'
  }
];

const STRICT_SAFE_CASES = [
  { name: 'a null-valued field', template: '[{{name}}]', data: { name: null }, expected: '[]' },
  { name: 'a missing slot', template: '[{{slot:x}}]', data: {}, expected: '[]' },
  { name: 'an if over a missing name', template: '[{{#if missing}}y{{/if}}]', data: {}, expected: '[]' },
  { name: 'an each over a missing name', template: '[{{#each missing}}y{{/each}}]', data: {}, expected: '[]' },
  {
    name: 'a ../ reference',
    template: '{{#items}}[{{../owner}}]{{/items}}',
    data: { owner: 'Dan', items: [{}] },
    expected: '[Dan]'
  },
  {
    name: 'an @root. reference',
    template: '{{#items}}[{{@root.owner}}]{{/items}}',
    data: { owner: 'Dan', items: [{}] },
    expected: '[Dan]'
  }
];

describe('Property 4: Strict is a pure refinement', () => {
  it.each(STRICT_EQUAL_CASES)('renders $name the same with strict on', ({ template, data, options }) => {
    expect(renderTemplate(template, data, { ...options, strict: true })).toBe(renderTemplate(template, data, options));
  });

  it.each(STRICT_THROW_CASES)('throws naming $name', ({ template, data, message, nonStrict }) => {
    expect(() => renderTemplate(template, data, { strict: true })).toThrow(message);
    expect(renderTemplate(template, data)).toBe(nonStrict);
  });

  it.each(STRICT_SAFE_CASES)('does not throw for $name', ({ template, data, expected }) => {
    expect(renderTemplate(template, data, { strict: true })).toBe(expected);
  });
});
