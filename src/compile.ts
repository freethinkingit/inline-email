import juice from 'juice';
import { compileTemplate } from './engine.js';
import { renderInky } from './inky.js';
import { renderResponsiveLayout } from './layout.js';
import { applyEmailStyle } from './style.js';
import { isTemplateData } from './template.js';
import type {
  CompiledEmailTemplate,
  CompileEmailTemplateOptions,
  EmailRenderContext,
  EmailStyle,
  JuiceOptions,
  LayoutFlavor,
  RenderData,
  RenderEmailOptions,
  RenderedEmail,
  TemplateTransform
} from './types.js';

type WebResources = NonNullable<JuiceOptions['webResources']>;
type ResolvedLayout = LayoutFlavor | 'none';
type HtmlOptions = { transform?: TemplateTransform; juice?: JuiceOptions };

const DEFAULT_JUICE_OPTIONS: JuiceOptions = {
  webResources: {
    images: false
  }
};

/**
 * Matches an opening or closing layout tag that the responsive layout renders, such as
 * `<section>` or `</button>`. HTML containing one gets the responsive layout unless the
 * `responsive` option says otherwise.
 */
export const LAYOUT_TAG_PATTERN =
  /<\/?(email|preview|container|section|columns|column|button|spacer|divider|image|hero-image|otp|alert|panel|brand|footer)\b/i;

const LAYOUT_FLAVORS: Record<LayoutFlavor, (html: string) => Promise<string>> = {
  default: async (html) => renderResponsiveLayout(html),
  inky: renderInky
};

const ACCEPTED_RESPONSIVE_VALUES = [...Object.keys(LAYOUT_FLAVORS).map((flavor) => `'${flavor}'`), 'true', 'false'];

/**
 * Compiles an email template once so it can be rendered many times with different data.
 *
 * The HTML goes through the layout chosen by `responsive`, the `transform` and CSS inlining at
 * compile time; the subject, HTML and text are then compiled as Handlebars templates. `responsive`
 * takes `'default'` or `true` for the built-in layout, `'inky'` for the installed Inky, `false` for
 * no layout, `{ enabled }` like a boolean, or is left out to apply the built-in layout when the HTML
 * has a layout tag.
 *
 * @param options - The template's HTML, optional CSS, subject and text, and how to compile them.
 * @returns The compiled template, with the processed subject, HTML and text and a `render` function
 * that takes data, or `{ data, style }`, and returns the rendered email.
 * @rejects When `html` is missing, `responsive` is not one of the values above, `responsive` is
 * `'inky'` and the `inky` package is missing or cannot render the HTML, a layout tag lacks a
 * required attribute, the escape option is invalid, a template is malformed, or, with
 * `juice.webResources.strict` on, an external resource cannot be inlined. `render` throws when
 * strict mode finds a missing field.
 */
export async function compileEmailTemplate(
  options: CompileEmailTemplateOptions
): Promise<CompiledEmailTemplate> {
  if (options.html === undefined || options.html === null) {
    throw new Error('HTML is required.');
  }

  const layout = resolveLayout(options.responsive, options.html);
  const html = await prepareEmailHtml(options.html, options.css, layout, {
    transform: options.transform,
    juice: options.juice
  });
  const subject = options.subject ?? '';
  const text = options.text ?? '';
  const engine = { strict: options.strict, handlebars: options.handlebars };
  const renderHtml = compileTemplate(html, { ...engine, escape: options.escape });
  const renderSubject = compileTemplate(subject, { ...engine, escape: 'none' });
  const renderText = compileTemplate(text, { ...engine, escape: 'none' });

  return {
    subject,
    html,
    text,
    render(input: RenderData | EmailRenderContext = {}): RenderedEmail {
      const { data, style } = normalizeRenderContext(input);

      return {
        subject: renderSubject(data),
        html: applyEmailStyle(renderHtml(data), style),
        text: renderText(data)
      };
    }
  };
}

function resolveLayout(responsive: unknown, html: string): ResolvedLayout {
  // `{ enabled }` is read like its boolean; `{}`, like a value left out, falls back to layout tag detection.
  const value = isPlainObject(responsive) ? responsive.enabled : responsive;

  if (value === undefined || responsive === null) {
    return LAYOUT_TAG_PATTERN.test(html) ? 'default' : 'none';
  }

  if (value === true) {
    return 'default';
  }

  if (value === false) {
    return 'none';
  }

  if (isLayoutFlavor(responsive)) {
    return responsive;
  }

  throw new Error(`Unknown responsive value ${describeValue(responsive)}. Use ${listAcceptedValues()}.`);
}

function isLayoutFlavor(value: unknown): value is LayoutFlavor {
  return typeof value === 'string' && Object.hasOwn(LAYOUT_FLAVORS, value);
}

function listAcceptedValues(): string {
  return `${ACCEPTED_RESPONSIVE_VALUES.slice(0, -1).join(', ')} or ${ACCEPTED_RESPONSIVE_VALUES.at(-1)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Names the value as it would be written in JavaScript, so `NaN`, `1n` or `{ enabled: Symbol(s) }`
// read as given rather than as JSON would render them.
function describeValue(value: unknown, seen = new Set<object>()): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }

  if (typeof value === 'bigint') {
    return `${value}n`;
  }

  if (typeof value === 'function') {
    return 'a function';
  }

  if (typeof value !== 'object' || value === null) {
    return String(value);
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    return `a ${value.constructor?.name || 'non-plain object'}`;
  }

  if (seen.has(value)) {
    return 'a circular reference';
  }

  seen.add(value);
  const description = Array.isArray(value)
    ? `[${value.map((item) => describeValue(item, seen)).join(', ')}]`
    : describeEntries(Object.entries(value).map(([key, item]) => `${key}: ${describeValue(item, seen)}`));
  seen.delete(value);
  return description;
}

function describeEntries(entries: string[]): string {
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

/**
 * Renders an email in one call, compiling the template first when it is not compiled yet.
 *
 * @param options - The template, as an HTML string, compile options or a compiled template, with
 * the data and optional style to render it with.
 * @returns The rendered subject, HTML and text.
 * @rejects With whatever {@link compileEmailTemplate} rejects with or the compiled template's `render` throws.
 */
export async function renderEmail(options: RenderEmailOptions): Promise<RenderedEmail> {
  const data = options.data ?? {};
  const style = options.style;

  if (typeof options.template === 'string') {
    const compiled = await compileEmailTemplate({ html: options.template });
    return compiled.render({ data, style });
  }

  if (isCompiledEmailTemplate(options.template)) {
    return options.template.render({ data, style });
  }

  const compiled = await compileEmailTemplate(options.template);
  return compiled.render({ data, style });
}

/**
 * Prepares email HTML: applies the layout chosen by `responsive` and the transform, inlines any
 * external resources the juice options ask for, then inlines the CSS into `style` attributes.
 *
 * @param html - The email HTML.
 * @param css - CSS to inline. When given, only this CSS is inlined and the HTML's `<style>`
 * blocks are left in place; when empty or whitespace only, the `<style>` blocks are inlined instead.
 * @param options - How to prepare the HTML.
 * @param options.responsive - Which layout to apply: `'default'` or `true` for the built-in layout,
 * `'inky'` for the installed Inky, `false` for none; by default, the built-in layout when the HTML
 * has a layout tag.
 * @param options.transform - A function run on the HTML after the layout.
 * @param options.juice - Options passed to juice. Images are not inlined unless
 * `webResources.images` asks for it.
 * @returns The HTML with its CSS inlined.
 * @rejects When `responsive` is not one of the values above, `responsive` is `'inky'` and the
 * `inky` package is missing or cannot render the HTML, a layout tag lacks a required attribute,
 * the transform throws, or, with `juice.webResources.strict` on, an external resource cannot be
 * inlined.
 */
export async function inlineEmailHtml(
  html: string,
  css = '',
  options: { responsive?: boolean | LayoutFlavor; transform?: TemplateTransform; juice?: JuiceOptions } = {}
): Promise<string> {
  return prepareEmailHtml(html, css, resolveLayout(options.responsive, html), options);
}

async function prepareEmailHtml(
  html: string,
  css: string | undefined,
  layout: ResolvedLayout,
  options: HtmlOptions
): Promise<string> {
  const transformedHtml = await applyTransforms(html, layout, options.transform);
  const juiceOptions = mergeJuiceOptions(options.juice);
  const resourceHtml = await inlineRequestedResources(transformedHtml, juiceOptions.webResources);

  if (css?.trim()) {
    // inlineContent drops whatever it cannot inline, such as @media rules, unless the CSS is also given as extraCss.
    const extraCss = [juiceOptions.extraCss, css].filter(Boolean).join('\n');
    return juice.inlineContent(resourceHtml, css, { ...juiceOptions, extraCss });
  }

  return juice(resourceHtml, juiceOptions);
}

async function inlineRequestedResources(html: string, webResources: WebResources): Promise<string> {
  if (!requestsExternalResources(webResources)) {
    return html;
  }

  return inlineExternalResources(html, { links: false, scripts: false, svgs: false, ...webResources });
}

function requestsExternalResources(webResources: WebResources): boolean {
  return Boolean(webResources.images || webResources.links || webResources.scripts || webResources.svgs);
}

// juice exports inlineExternal at runtime but its bundled typings omit it.
type InlineExternal = (
  html: string,
  webResources: WebResources,
  callback: (error: Error | null, html: string) => void
) => void;

// web-resource-inliner deletes " data-inline" wherever it appears, so an attribute merely starting with it
// would be cut in half. Only its own data-inline and data-inline-ignore attributes are left for it to read.
const INLINER_ATTRIBUTE_PREFIX = /(\s)data-(inline)(?=[\w-])(?!-ignore(?![\w-]))/gi;
const PROTECTED_ATTRIBUTE_PREFIX = /(\s)data-ie-protected-(inline)/gi;

function inlineExternalResources(html: string, webResources: WebResources): Promise<string> {
  const inlineExternal = (juice as unknown as { inlineExternal: InlineExternal }).inlineExternal;
  const protectedHtml = html.replace(INLINER_ATTRIBUTE_PREFIX, '$1data-ie-protected-$2');

  return new Promise((resolve, reject) => {
    inlineExternal(protectedHtml, webResources, (error, inlinedHtml) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(inlinedHtml.replace(PROTECTED_ATTRIBUTE_PREFIX, '$1data-$2'));
    });
  });
}

async function applyTransforms(html: string, layout: ResolvedLayout, transform?: TemplateTransform): Promise<string> {
  const laidOutHtml = layout === 'none' ? html : await LAYOUT_FLAVORS[layout](html);
  return transform ? transform(laidOutHtml) : laidOutHtml;
}

function mergeJuiceOptions(options: JuiceOptions = {}): JuiceOptions & { webResources: WebResources } {
  return {
    ...DEFAULT_JUICE_OPTIONS,
    ...options,
    webResources: {
      ...DEFAULT_JUICE_OPTIONS.webResources,
      ...options.webResources
    }
  };
}

function isCompiledEmailTemplate(value: unknown): value is CompiledEmailTemplate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CompiledEmailTemplate).render === 'function'
  );
}

function normalizeRenderContext(input: RenderData | EmailRenderContext): { data: RenderData; style?: EmailStyle } {
  if (isRenderContext(input)) {
    return {
      data: input.data ?? {},
      style: input.style
    };
  }

  return { data: input };
}

function isRenderContext(input: RenderData | EmailRenderContext): input is EmailRenderContext {
  if (input === null || typeof input !== 'object') {
    return false;
  }

  const keys = Object.keys(input);
  const context = input as EmailRenderContext;

  return (
    keys.length > 0 &&
    keys.every((key) => key === 'data' || key === 'style') &&
    isOptionalPlainObject(context.data) &&
    isOptionalPlainObject(context.style)
  );
}

function isOptionalPlainObject(value: unknown): boolean {
  return value === undefined || isTemplateData(value);
}
