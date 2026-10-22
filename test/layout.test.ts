import { describe, expect, it } from 'vitest';
import { compileEmailTemplate, renderResponsiveLayout } from '../src/index.ts';
import { AWKWARD_INPUTS, expectCleanOutcome } from './support/awkward-inputs.ts';

describe('renderResponsiveLayout', () => {
  it('renders semantic email tags into responsive table markup', () => {
    const html = renderResponsiveLayout(`
      <email>
        <preview>Welcome to ACME</preview>
        <container>
          <section padding="28">
            <columns>
              <column width="40%">Hello {{firstName}}</column>
              <column width="60%"><button href="{{appUrl}}">Open ACME</button></column>
            </columns>
            <spacer size="24" />
          </section>
        </container>
      </email>
    `);

    expect(html).toContain('data-ie-preserve-style');
    expect(html).toContain('mso-hide:all;">Welcome to ACME</div>');
    expect(html).toContain('class="ie-container"');
    expect(html).toContain('class="ie-section"');
    expect(html).toContain('class="ie-column"');
    expect(html).toContain('class="ie-button"');
    expect(html).toContain('class="ie-spacer"');
    expect(html).toContain('Hello {{firstName}}');
    expect(html).toContain('href="{{appUrl}}"');
  });

  it('renders auth-oriented primitives into table markup', () => {
    const html = renderResponsiveLayout(`
      <email>
        <container>
          <section>
            <otp>123456</otp>
            <brand mark="A">ACME</brand>
            <hero-image src="{{imageUrl}}" alt="Product preview" width="528" />
            <alert tone="warning">Check this request.</alert>
            <panel tone="success">Updated.</panel>
            <divider />
            <footer>Sent by Freethinking IT</footer>
          </section>
        </container>
      </email>
    `);

    expect(html).toContain('class="ie-otp"');
    expect(html).toContain('class="ie-brand"');
    expect(html).toContain('class="ie-image"');
    expect(html).toContain('class="ie-alert"');
    expect(html).toContain('class="ie-panel"');
    expect(html).toContain('class="ie-divider"');
    expect(html).toContain('123456');
    expect(html).toContain('Sent by Freethinking IT');
  });

  it('renders a section nested inside another section', () => {
    const html = renderResponsiveLayout('<section><section>Inner</section></section>');

    expect(html.match(/class="ie-section"/g)).toHaveLength(2);
    expect(html).not.toContain('<section');
  });

  it('puts the responsive style inside an existing head, or before the markup when there is none', () => {
    expect(renderResponsiveLayout('<html><head lang="en"><title>T</title></head></html>')).toMatch(
      /^<html><head lang="en"><style data-ie-preserve-style>[\s\S]*<\/style><title>T<\/title>/
    );
    expect(renderResponsiveLayout('<p>Hi</p>')).toMatch(/^<style data-ie-preserve-style>[\s\S]*<\/style><p>Hi<\/p>$/);
  });

  it('inserts the responsive style after a head tag whose attribute contains a greater-than sign', () => {
    expect(renderResponsiveLayout('<html><head data-x="a>b"><title>T</title></head></html>')).toMatch(
      /^<html><head data-x="a>b"><style data-ie-preserve-style>/
    );
  });

  it('links an image and a brand when they have an href, and sets the image height and alignment', () => {
    const html = renderResponsiveLayout(
      '<image src="a.png" href="https://example.com" height="40" align="left" /><brand href="https://example.com">ACME</brand>'
    );

    expect(html).toContain('<a href="https://example.com" style="text-decoration:none;"><img src="a.png"');
    expect(html).toContain('height="40"');
    expect(html).toContain('<td align="left">');
    expect(html).toContain('<a href="https://example.com" style="color:#17202a;text-decoration:none;">ACME</a>');
  });

  it('gives a hero image without a width the full 600px and rounded corners', () => {
    const html = renderResponsiveLayout('<hero-image src="a.png" />');

    expect(html).toContain('width="600"');
    expect(html).toContain('border-radius:12px;');
  });

  it('keeps a footer background that contains a double quote whole', () => {
    const html = renderResponsiveLayout(`<footer background='a"b'>F</footer>`);

    expect(html).toContain('style="background:a&quot;b;"');
  });

  it('refuses an image without a src', () => {
    expect(() => renderResponsiveLayout('<image alt="No source" />')).toThrow('<image> requires a src attribute.');
  });

  it('refuses an image whose src is missing its closing quote instead of swallowing the next tag', () => {
    expect(() => renderResponsiveLayout('<image src="a.png /><p class="x">Hi</p>')).toThrow('<image> requires a src attribute.');
  });

  it('renders an alert as a warning by default and prefers variant over tone', () => {
    expect(renderResponsiveLayout('<alert>Careful.</alert>')).toContain('data-ie-variant="warning"');
    expect(renderResponsiveLayout('<alert variant="danger" tone="info">Stop.</alert>')).toContain(
      'data-ie-variant="danger"'
    );
  });

  it('escapes &, " and < in attribute values', () => {
    const html = renderResponsiveLayout(`<button href='a&b"<c'>Go</button>`);

    expect(html).toContain('href="a&amp;b&quot;&lt;c"');
  });

  it('reads an unquoted attribute value up to the next space', () => {
    const html = renderResponsiveLayout('<image src=logo.png alt=Logo width=120 />');

    expect(html).toContain('<img src="logo.png" width="120" alt="Logo"');
  });

  it('ignores an attribute whose name only ends with the one asked for', () => {
    expect(renderResponsiveLayout('<image src="a.png" data-width="300" />')).toContain('<img src="a.png" width="600"');
    expect(renderResponsiveLayout('<hero-image src="a.png" data-width="300" />')).toContain('<img src="a.png" width="600"');
  });

  it('reads an explicit width that comes after a data-width', () => {
    expect(renderResponsiveLayout('<image src="a.png" data-width="300" width="120" />')).toContain(
      '<img src="a.png" width="120"'
    );
    expect(renderResponsiveLayout('<hero-image src="a.png" data-width="300" width="120" />')).toContain(
      '<img src="a.png" width="120"'
    );
  });

  it("ignores an attribute name inside another attribute's quoted value", () => {
    expect(renderResponsiveLayout('<image src="a.png" alt="x width=5" />')).toContain('<img src="a.png" width="600"');
    expect(renderResponsiveLayout('<hero-image src="a.png" alt="x width=5" />')).toContain('<img src="a.png" width="600"');
    expect(renderResponsiveLayout(`<image src="a.png" alt='x width=5' />`)).toContain('<img src="a.png" width="600"');
  });

  it('reads an attribute that follows a closing quote, has spaces around =, or comes after a value-less one', () => {
    expect(renderResponsiveLayout('<image src="a.png"width=120 />')).toContain('<img src="a.png" width="120"');
    expect(renderResponsiveLayout('<image src = "a.png" width = 120 />')).toContain('<img src="a.png" width="120"');
    expect(renderResponsiveLayout('<image hidden src="a.png" width width="120" />')).toContain(
      '<img src="a.png" width="120"'
    );
  });

  it('reads the first of two attributes with the same name, whatever their case', () => {
    expect(renderResponsiveLayout('<image src="a.png" WIDTH="120" width="300" />')).toContain(
      '<img src="a.png" width="120"'
    );
  });

  it('keeps a self-closing tag attribute value that contains a greater-than sign', () => {
    const html = renderResponsiveLayout('<image src="chart.png" alt="Revenue > target" />');

    expect(html).toContain('alt="Revenue &gt; target"');
    expect(html).not.toContain('target" />');
  });

  it('keeps a paired tag attribute value that contains a greater-than sign', () => {
    const html = renderResponsiveLayout('<button href="https://x.test/?a=1&b=2>3">Go</button>');

    expect(html).toContain('href="https://x.test/?a=1&amp;b=2&gt;3"');
    expect(html).toContain('>Go</a>');
  });

  it('is available through compileEmailTemplate by default', async () => {
    const compiled = await compileEmailTemplate({
      html: '<email><container><section><button href="{{url}}">Go</button></section></container></email>'
    });

    expect(compiled.html).toContain('class="ie-button"');
    expect(compiled.render({ url: 'https://example.com?a=1&b=2' }).html).toContain(
      'href="https://example.com?a&#x3D;1&amp;b&#x3D;2"'
    );
  });

  it('repeats compiled layout blocks at render time', async () => {
    const compiled = await compileEmailTemplate({
      html: '<email><container><section>{{#features}}<panel><p>{{title}}</p></panel>{{/features}}</section></container></email>'
    });

    const email = compiled.render({
      features: [{ title: 'One' }, { title: 'Two' }]
    });

    expect(email.html.match(/class="ie-panel"/g)).toHaveLength(2);
    expect(email.html).toContain('<p>One</p>');
    expect(email.html).toContain('<p>Two</p>');
  });

  it('renders an unknown tone with the neutral colours', () => {
    const html = renderResponsiveLayout('<panel tone="mystery">Heads up.</panel>');

    expect(html).toContain('background:#f7f9fc;border:1px solid #d8dee8;');
    expect(html).toContain('color:#344054;');
  });
});

describe('layout sizes', () => {
  const heightOf = (markup: string) => renderResponsiveLayout(markup).match(/height="(\d+)"/)?.[1];

  it('reads a size as a whole number of pixels and turns a negative, empty or non-numeric size into zero', () => {
    expect(heightOf('<spacer size="0" />')).toBe('0');
    expect(heightOf('<spacer size="1" />')).toBe('1');
    expect(heightOf('<spacer size="12px" />')).toBe('12');
    expect(heightOf('<spacer size="-1" />')).toBe('0');
    expect(heightOf('<spacer size="" />')).toBe('0');
    expect(heightOf('<spacer size="NaN" />')).toBe('0');
  });

  it('defaults a spacer to 24px, a divider to 1px, a section to 32px and a footer to 24px of padding', () => {
    expect(heightOf('<spacer />')).toBe('24');
    expect(heightOf('<divider />')).toBe('1');
    expect(renderResponsiveLayout('<section>S</section>')).toContain('padding:32px;');
    expect(renderResponsiveLayout('<footer>F</footer>')).toContain('padding:24px;');
  });

  it('reads a paired spacer size from its content, defaulting to 24px when the content is blank', () => {
    expect(heightOf('<spacer>8</spacer>')).toBe('8');
    expect(heightOf('<spacer> </spacer>')).toBe('24');
    expect(heightOf('<spacer>-3</spacer>')).toBe('0');
  });

  it('gives a column without a width half the row', () => {
    expect(renderResponsiveLayout('<column>C</column>')).toContain('width="50%" style="width:50%;');
  });

  it('applies a size to divider height, footer padding, button radius and image width', () => {
    expect(heightOf('<divider size="3" />')).toBe('3');
    expect(renderResponsiveLayout('<footer padding="0">F</footer>')).toContain('padding:0px;');
    expect(renderResponsiveLayout('<button radius="-2">Go</button>')).toContain('border-radius:0px;');
    expect(renderResponsiveLayout('<image src="a.png" width="abc" />')).toContain('width="0"');
  });
});

describe('awkward text', () => {
  it('keeps each awkward input intact as an attribute value and as tag content, and reads it as a size of zero', async () => {
    for (const [name, input] of Object.entries(AWKWARD_INPUTS)) {
      const asAttribute = await expectCleanOutcome(
        () => renderResponsiveLayout(`<button href="${input}">Go</button>`),
        name
      );
      const asContent = await expectCleanOutcome(() => renderResponsiveLayout(`<section>${input}</section>`), name);
      const asSize = await expectCleanOutcome(() => renderResponsiveLayout(`<spacer size="${input}" />`), name);

      expect(asAttribute, name).toEqual({ outcome: 'returned', value: expect.stringContaining(`href="${input}"`) });
      expect(asContent, name).toEqual({
        outcome: 'returned',
        value: expect.stringContaining(`padding:32px;">${input}</td>`)
      });
      expect(asSize, name).toEqual({ outcome: 'returned', value: expect.stringContaining('height="0"') });
    }
  });
});
