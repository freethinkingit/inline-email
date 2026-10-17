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

  it('renders nothing for falsy block values and the body once for truthy scalars', () => {
    expect(
      renderTemplate('{{#zero}}0{{/zero}}{{#empty}}e{{/empty}}{{#no}}n{{/no}}{{#missing}}m{{/missing}}{{#yes}}{{name}}{{/yes}}', {
        zero: 0,
        empty: '',
        no: false,
        yes: 'on',
        name: 'Dan'
      })
    ).toBe('Dan');
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
});
