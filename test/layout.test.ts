import { describe, expect, it } from 'vitest';
import { compileEmailTemplate, renderResponsiveLayout } from '../src';

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

    expect(html).toContain('data-inline-email-preserve-style');
    expect(html).toContain('.ie-column { display: block !important;');
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

  it('is available through compileEmailTemplate by default', async () => {
    const compiled = await compileEmailTemplate({
      html: '<email><container><section><button href="{{url}}">Go</button></section></container></email>'
    });

    expect(compiled.html).toContain('class="ie-button"');
    expect(compiled.render({ url: 'https://example.com?a=1&b=2' }).html).toContain(
      'href="https://example.com?a=1&amp;b=2"'
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

  it('can render repeated blocks with data only', async () => {
    const compiled = await compileEmailTemplate({
      html: `
        <email>
          <container>
            <section>
              {{#features}}
              <panel tone="{{tone}}">
                <p>{{title}}</p>
              </panel>
              {{/features}}
            </section>
          </container>
        </email>
      `
    });

    const email = compiled.render({
      data: {
        features: [
          { title: 'Decision trails', tone: 'info' },
          { title: 'Handoff checks', tone: 'success' }
        ]
      }
    });

    expect(email.html.match(/class="ie-panel"/g)).toHaveLength(2);
    expect(email.html).toContain('data-ie-variant="info"');
    expect(email.html).toContain('data-ie-variant="success"');
    expect(email.html).toContain('<p>Decision trails</p>');
    expect(email.html).toContain('<p>Handoff checks</p>');
  });

  it('can render repeated blocks with data and a small style object', async () => {
    const compiled = await compileEmailTemplate({
      html: `
        <email>
          <container>
            <section>
              {{#features}}
              <panel tone="{{tone}}">
                <p>{{title}}</p>
              </panel>
              {{/features}}
            </section>
          </container>
        </email>
      `
    });

    const email = compiled.render({
      data: {
        features: [
          { title: 'Decision trails', tone: 'info' },
          { title: 'Handoff checks', tone: 'success' }
        ]
      },
      style: {
        tones: {
          info: {
            accent: '#1570ef',
            background: '#eff8ff',
            border: '#b2ddff',
            text: '#1849a9'
          },
          success: {
            accent: '#12b76a',
            background: '#ecfdf3',
            border: '#abefc6',
            text: '#067647'
          }
        }
      }
    });

    expect(email.html.match(/class="ie-panel"/g)).toHaveLength(2);
    expect(email.html).toContain('data-ie-variant="info"');
    expect(email.html).toContain('style="background:#eff8ff;border:1px solid #b2ddff;border-radius:8px;"');
    expect(email.html).toContain('style="padding:16px;color:#1849a9;');
    expect(email.html).toContain('data-ie-variant="success"');
    expect(email.html).toContain('style="background:#ecfdf3;border:1px solid #abefc6;border-radius:8px;"');
    expect(email.html).toContain('style="padding:16px;color:#067647;');
    expect(email.html).toContain('<p>Decision trails</p>');
    expect(email.html).toContain('<p>Handoff checks</p>');
  });
});
