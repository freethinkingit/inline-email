// @ts-expect-error Inky 1 ships no type declarations, and the tests only call releaseTheKraken.
import { Inky } from 'inky';
import { transform } from 'inky-2';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompileEmailTemplateOptions } from '../src/index.ts';

const BUILT_IN_LAYOUT_MARKUP = /\bie-|data-ie-preserve-style/;
const INKY_TAG = /<\/?(container|row|columns|button|spacer)\b/i;

const inkyMarkup = [
  { name: 'container', html: '<container><p>Hello</p></container>' },
  { name: 'row with columns', html: '<row><columns small="12" large="6">Left</columns><columns small="12" large="6">Right</columns></row>' },
  { name: 'button', html: '<button href="https://example.com">Open</button>' },
  { name: 'spacer', html: '<spacer size="16"></spacer>' },
  { name: 'mix with section', html: '<container><section><row><columns>In a section</columns></row></section></container>' },
  {
    name: 'Handlebars expressions',
    html: '<container><row><columns><p>Hi {{name}}</p>{{#if vip}}<p>VIP</p>{{/if}}<button href="{{url}}">Go</button></columns></row></container>'
  }
];

const handlebarsData = { name: 'Dan', vip: true, url: 'https://example.com/go' };

async function loadLibrary(inky?: () => object | Promise<object>) {
  vi.resetModules();

  if (inky) {
    vi.doMock('inky', inky);
  }

  return import('../src/index.ts');
}

// Vitest's mock proxy throws on reading an export the factory did not return, and the library looks
// for `default`, `Inky` and `transform`, so each mock module names all three.
function inkyModule(exports: Record<string, unknown>) {
  return () => ({ default: undefined, Inky: undefined, transform: undefined, ...exports });
}

// Vitest wraps an error thrown by a mock factory in its own "error when mocking a module" error,
// which hides the error's `code`. It reads `then` on the factory's result outside that wrapper, so a
// result whose `then` throws makes the import reject with the error itself.
function failingImport(error: unknown) {
  return () => ({
    then() {
      throw error;
    }
  });
}

function moduleNotFound() {
  return Object.assign(new Error("Cannot find package 'inky' imported from src/inky.ts"), { code: 'ERR_MODULE_NOT_FOUND' });
}

afterEach(() => {
  vi.doUnmock('inky');
  vi.resetModules();
});

describe("Property 3: Under 'inky', only Inky lays out", () => {
  it.each(inkyMarkup)('renders the $name with Inky alone', async ({ html }) => {
    const { compileEmailTemplate } = await loadLibrary();

    const compiled = await compileEmailTemplate({ html, responsive: 'inky' });

    expect(compiled.html).not.toMatch(BUILT_IN_LAYOUT_MARKUP);
    expect(compiled.html).not.toMatch(INKY_TAG);
  });

  it('keeps Handlebars expressions intact for render', async () => {
    const { compileEmailTemplate } = await loadLibrary();
    const { html } = inkyMarkup.find((markup) => markup.name === 'Handlebars expressions')!;

    const email = (await compileEmailTemplate({ html, responsive: 'inky' })).render(handlebarsData);

    expect(email.html).toContain('<p>Hi Dan</p>');
    expect(email.html).toContain('<p>VIP</p>');
    expect(email.html).toContain('href="https://example.com/go"');
    expect(email.html).not.toContain('{{');
  });
});

describe('Property 6: Inky loads only on request', () => {
  const html = '<container><section><row><columns>Hi</columns></row></section></container>';
  const responsiveValues: (CompileEmailTemplateOptions['responsive'] | null)[] = [
    undefined,
    null,
    true,
    false,
    'default',
    {},
    { enabled: true },
    { enabled: false }
  ];

  it('does not import inky for any value other than inky', async () => {
    const inky = vi.fn(inkyModule({ transform }));
    const { compileEmailTemplate, inlineEmailHtml } = await loadLibrary(inky);

    for (const responsive of responsiveValues) {
      await compileEmailTemplate({ html, responsive: responsive as CompileEmailTemplateOptions['responsive'] });
      await inlineEmailHtml(html, '', { responsive: responsive as boolean | undefined });
    }

    await expect(
      compileEmailTemplate({ html, responsive: 'Inky' as CompileEmailTemplateOptions['responsive'] })
    ).rejects.toThrow("Unknown responsive value 'Inky'.");
    expect(inky).not.toHaveBeenCalled();
  });

  it('imports inky once for inky', async () => {
    const inky = vi.fn(inkyModule({ transform }));
    const { compileEmailTemplate } = await loadLibrary(inky);

    await compileEmailTemplate({ html, responsive: 'inky' });
    await compileEmailTemplate({ html, responsive: 'inky' });

    expect(inky).toHaveBeenCalledTimes(1);
  });
});

describe('Property 7: Either Inky renders', () => {
  it.each(inkyMarkup)("gives what Inky 1's own API returns for the $name", async ({ html }) => {
    const { compileEmailTemplate } = await loadLibrary();

    const compiled = await compileEmailTemplate({ html, responsive: 'inky' });

    expect(compiled.html).toBe(new Inky().releaseTheKraken(html));
  });

  it.each(inkyMarkup)("gives what Inky 2's own API returns for the $name", async ({ html }) => {
    const { compileEmailTemplate } = await loadLibrary(() => import('inky-2'));

    const compiled = await compileEmailTemplate({ html, responsive: 'inky' });

    expect(compiled.html).toBe(transform(html));
    expect(compiled.html).not.toMatch(BUILT_IN_LAYOUT_MARKUP);
    expect(compiled.html).not.toMatch(INKY_TAG);
  });

  it('keeps Handlebars expressions intact for render with Inky 2', async () => {
    const { compileEmailTemplate } = await loadLibrary(() => import('inky-2'));
    const { html } = inkyMarkup.find((markup) => markup.name === 'Handlebars expressions')!;

    const email = (await compileEmailTemplate({ html, responsive: 'inky' })).render(handlebarsData);

    expect(email.html).toContain('<p>Hi Dan</p>');
    expect(email.html).toContain('<p>VIP</p>');
    expect(email.html).toContain('href="https://example.com/go"');
    expect(email.html).not.toContain('{{');
  });

  it.each([
    { shape: 'Inky 1 on the module', exports: { Inky: class { releaseTheKraken = () => 'inky 1'; } }, expected: 'inky 1' },
    {
      shape: 'Inky 1 on the default export',
      exports: { default: { Inky: class { releaseTheKraken = () => 'inky 1'; } } },
      expected: 'inky 1'
    },
    { shape: 'Inky 2 on the module', exports: { transform: (): string => 'inky 2' }, expected: 'inky 2' },
    { shape: 'Inky 2 on the default export', exports: { default: { transform: (): string => 'inky 2' } }, expected: 'inky 2' },
    {
      shape: 'both, where transform wins',
      exports: { Inky: class { releaseTheKraken = () => 'inky 1'; }, transform: (): string => 'inky 2' },
      expected: 'inky 2'
    }
  ])('renders with $shape', async ({ exports, expected }) => {
    const { compileEmailTemplate } = await loadLibrary(inkyModule(exports));

    const compiled = await compileEmailTemplate({ html: '<row></row>', responsive: 'inky' });

    expect(compiled.html).toBe(expected);
  });
});

describe('Inky failures', () => {
  const html = '<row><columns>Hi</columns></row>';

  it('names the inky package and the install command when Inky is missing, with no fallback', async () => {
    const missing = moduleNotFound();
    const { compileEmailTemplate } = await loadLibrary(failingImport(missing));

    const error = await compileEmailTemplate({ html, responsive: 'inky' }).then(
      (compiled) => expect.fail(`expected a rejection, got ${compiled.html}`),
      (rejection: Error) => rejection
    );

    expect(error.message).toBe("responsive: 'inky' needs the inky package. Install it with npm install inky.");
    expect(error.cause).toBe(missing);
  });

  it('says it could not load the inky package when the import fails another way', async () => {
    const syntaxError = new SyntaxError('Unexpected token');
    const { compileEmailTemplate } = await loadLibrary(failingImport(syntaxError));

    const error = await compileEmailTemplate({ html, responsive: 'inky' }).catch((rejection: Error) => rejection);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("responsive: 'inky' could not load the inky package.");
    expect((error as Error).cause).toBe(syntaxError);
  });

  it('tries the import again after a failed load', async () => {
    let attempts = 0;
    const { compileEmailTemplate } = await loadLibrary(() =>
      attempts++ === 0 ? failingImport(moduleNotFound())() : inkyModule({ transform: () => 'installed now' })()
    );

    await expect(compileEmailTemplate({ html, responsive: 'inky' })).rejects.toThrow('needs the inky package');
    const compiled = await compileEmailTemplate({ html, responsive: 'inky' });

    expect(compiled.html).toBe('installed now');
  });

  it("passes Inky's own error through unchanged", async () => {
    const krakenError = new Error('the kraken refused');
    const { compileEmailTemplate } = await loadLibrary(
      inkyModule({
        Inky: class {
          releaseTheKraken(): string {
            throw krakenError;
          }
        }
      })
    );

    await expect(compileEmailTemplate({ html, responsive: 'inky' })).rejects.toBe(krakenError);
  });

  it('names the supported Inky versions when the package exports neither', async () => {
    const { compileEmailTemplate } = await loadLibrary(inkyModule({ default: { render: () => '' }, migrate: () => '' }));

    await expect(compileEmailTemplate({ html, responsive: 'inky' })).rejects.toThrow(
      "responsive: 'inky' supports Inky 1 and Inky 2; the installed inky package exports neither."
    );
  });

  it.each(['{{> footer}}', '{{~> footer}}', '{{#> footer}}Fallback{{/footer}}', '{{~#> footer}}Fallback{{/footer}}'])(
    'rejects the partial %s with Inky 2',
    async (partial) => {
      const { compileEmailTemplate } = await loadLibrary(() => import('inky-2'));

      await expect(compileEmailTemplate({ html: `<row><columns>${partial}</columns></row>`, responsive: 'inky' })).rejects.toThrow(
        'Inky 2 escapes Handlebars partials ({{> name}}); Inky 1 keeps them. Use Inky 1 (npm install inky@1), or inline the partial.'
      );
    }
  );
});
