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
});
