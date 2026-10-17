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
});
