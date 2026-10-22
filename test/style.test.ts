import { describe, expect, it } from 'vitest';
import { compileEmailTemplate } from '../src/index.ts';
import { applyEmailStyle } from '../src/style.ts';
import { AWKWARD_INPUTS, expectCleanOutcome } from './support/awkward-inputs.ts';

const PANEL_STYLE = 'background:#f7f9fc;border:1px solid #d8dee8;border-radius:8px;';
const PANEL_CONTENT_STYLE = 'padding:16px;color:#344054;';

function component(name: string, tone: string, style = PANEL_STYLE, contentStyle = PANEL_CONTENT_STYLE): string {
  return `<table data-ie-component="${name}" data-ie-variant="${tone}" style="${style}"><tr><td data-ie-component-content="${name}" data-ie-variant="${tone}" style="${contentStyle}">Hi</td></tr></table>`;
}

describe('applyEmailStyle', () => {
  it('colours a panel with a bordered box from a built-in tone', () => {
    const html = applyEmailStyle(component('panel', 'info'));

    expect(html).toContain('style="background:#eff8ff;border:1px solid #b2ddff;border-radius:8px;"');
    expect(html).toContain(
      'style="padding:16px;color:#1849a9;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;"'
    );
  });

  it('colours an alert with a left accent bar and tighter text from a built-in tone', () => {
    const html = applyEmailStyle(component('alert', 'warning'));

    expect(html).toContain('style="background:#fff7e8;border-left:4px solid #f2a900;"');
    expect(html).toContain(
      'style="padding:14px 16px;color:#4f3a0b;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;"'
    );
  });

  it('lets a style override replace a built-in tone', () => {
    const html = applyEmailStyle(component('panel', 'info'), {
      tones: { info: { background: '#000001', border: '#000002', text: '#000003' } }
    });

    expect(html).toContain('style="background:#000001;border:1px solid #000002;border-radius:8px;"');
    expect(html).toContain('color:#000003;');
  });

  it('fills a partial override from the built-in palette', () => {
    const html = applyEmailStyle(component('panel', 'info'), { tones: { info: { background: '#123456' } } });

    expect(html).toContain('background:#123456;border:1px solid #b2ddff;');
    expect(html).toContain('color:#1849a9;');
  });

  it('leaves the styles of an unknown tone as they are', () => {
    const before = component('panel', 'mystery');

    expect(applyEmailStyle(before, { tones: { info: { background: '#123456' } } })).toBe(before);
  });

  it("keeps the panel's own background when a custom tone sets none", () => {
    const html = applyEmailStyle(component('panel', 'brand', 'background: #abcdef;'), {
      tones: { brand: { border: '#000000' } }
    });

    expect(html).toContain('style="background:#abcdef;border:1px solid #000000;border-radius:8px;"');
  });

  it('falls back to the warning background for an alert with none of its own when a custom tone sets none', () => {
    const html = applyEmailStyle(component('alert', 'brand', 'border:0;'), { tones: { brand: { accent: '#000000' } } });

    expect(html).toContain('style="background:#fff7e8;border-left:4px solid #000000;"');
  });

  it('gives an alert the warning accent bar when a custom tone sets a background but no accent', () => {
    const html = applyEmailStyle(component('alert', 'brand'), { tones: { brand: { background: '#000000' } } });

    expect(html).toContain('style="background:#000000;border-left:4px solid #f2a900;"');
  });

  it('changes only the text of a custom tone that sets only a text colour', () => {
    const html = applyEmailStyle(component('panel', 'brand'), { tones: { brand: { text: '#111111' } } });

    expect(html).toContain(`style="${PANEL_STYLE}"`);
    expect(html).toContain('style="padding:16px;color:#111111;');
  });

  it('keeps the text unchanged for a custom tone that sets no text colour', () => {
    const html = applyEmailStyle(component('panel', 'brand'), { tones: { brand: { border: '#000000' } } });

    expect(html).toContain(`style="${PANEL_CONTENT_STYLE}"`);
  });

  it('colours a tone chosen by data at render, even one whose name Handlebars escapes', async () => {
    const compiled = await compileEmailTemplate({ html: '<panel tone="{{tone}}">{{message}}</panel>' });

    const builtIn = compiled.render({ data: { message: 'Ready', tone: 'success' } });
    const escaped = compiled.render({
      data: { message: 'Ready', tone: "it's=`odd`" },
      style: { tones: { "it's=`odd`": { background: '#654321' } } }
    });

    expect(builtIn.html).toContain('background:#ecfdf3;border:1px solid #b8edc9;');
    expect(escaped.html).toContain('background:#654321;');
  });

  it('takes awkward text as a tone name or a tone colour and keeps it intact', async () => {
    for (const [name, input] of Object.entries(AWKWARD_INPUTS)) {
      const unknown = component('panel', input);
      const asUnknownTone = await expectCleanOutcome(() => applyEmailStyle(unknown), name);
      expect(asUnknownTone, name).toEqual({ outcome: 'returned', value: unknown });

      const asCustomTone = await expectCleanOutcome(
        () => applyEmailStyle(unknown, { tones: { [input]: { background: '#000001', border: '#000002' } } }),
        name
      );
      expect(asCustomTone, name).toEqual({
        outcome: 'returned',
        value: expect.stringContaining(
          `data-ie-variant="${input}" style="background:#000001;border:1px solid #000002;border-radius:8px;"`
        )
      });

      const asColour = await expectCleanOutcome(
        () => applyEmailStyle(component('panel', 'info'), { tones: { info: { background: input, text: input } } }),
        name
      );
      expect(asColour, name).toEqual({
        outcome: 'returned',
        value: expect.stringContaining(`style="background:${input};border:1px solid #b2ddff;border-radius:8px;"`)
      });
      expect(asColour, name).toEqual({
        outcome: 'returned',
        value: expect.stringContaining(`style="padding:16px;color:${input};`)
      });
    }
  });
});
