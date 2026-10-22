import { describe, expect, it } from 'vitest';
import { isTemplateData, renderTemplate } from '../src/template.ts';

describe('renderTemplate', () => {
  it('renders a template with escaped variables and raw slots by default', () => {
    expect(
      renderTemplate('<p>Hello {{firstName}}</p>{{slot:summary}}', {
        firstName: '<Dan>',
        slots: { summary: '<strong>Approved</strong>' }
      })
    ).toBe('<p>Hello &lt;Dan&gt;</p><strong>Approved</strong>');
  });

  it('passes its options to the engine', () => {
    expect(renderTemplate('Hi {{name}}, Tom & Jerry', { name: "O'Brien" }, { escape: false })).toBe(
      "Hi O'Brien, Tom & Jerry"
    );
    expect(() => renderTemplate('Hi {{firstNmae}}', { firstName: 'Dan' }, { strict: true })).toThrow(
      /"firstNmae" not defined/
    );
  });
});

describe('isTemplateData', () => {
  it('accepts a plain object and refuses null, an array and a string', () => {
    expect(isTemplateData({ name: 'Dan' })).toBe(true);
    expect(isTemplateData(null)).toBe(false);
    expect(isTemplateData([])).toBe(false);
    expect(isTemplateData('name')).toBe(false);
  });
});
