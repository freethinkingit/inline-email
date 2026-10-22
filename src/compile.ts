import juice from 'juice';
import { compileTemplate } from './engine.js';
import { renderResponsiveLayout } from './layout.js';
import { applyEmailStyle } from './style.js';
import { isTemplateData } from './template.js';
import type {
  CompiledEmailTemplate,
  CompileEmailTemplateOptions,
  EmailRenderContext,
  EmailStyle,
  JuiceOptions,
  RenderData,
  RenderEmailOptions,
  RenderedEmail,
  TemplateTransform
} from './types.js';

type WebResources = NonNullable<JuiceOptions['webResources']>;

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

/**
 * Compiles an email template once so it can be rendered many times with different data.
 *
 * The HTML goes through the responsive layout, the `transform` and CSS inlining at compile time;
 * the subject, HTML and text are then compiled as Handlebars templates.
 *
 * @param options - The template's HTML, optional CSS, subject and text, and how to compile them.
 * @returns The compiled template, with the processed subject, HTML and text and a `render` function
 * that takes data, or `{ data, style }`, and returns the rendered email.
 * @rejects When `html` is missing, a layout tag lacks a required attribute, the escape option is
 * invalid, a template is malformed, or, with `juice.webResources.strict` on, an external resource
 * cannot be inlined. `render` throws when strict mode finds a missing field.
 */
export async function compileEmailTemplate(
  options: CompileEmailTemplateOptions
): Promise<CompiledEmailTemplate> {
  if (options.html === undefined || options.html === null) {
    throw new Error('HTML is required.');
  }

  const html = await inlineEmailHtml(options.html, options.css, {
    responsive: normalizeResponsiveOption(options.responsive),
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

function normalizeResponsiveOption(responsive: CompileEmailTemplateOptions['responsive']): boolean | undefined {
  if (typeof responsive === 'boolean') {
    return responsive;
  }

  return responsive?.enabled;
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
 * Prepares email HTML: applies the responsive layout and the transform, inlines any external
 * resources the juice options ask for, then inlines the CSS into `style` attributes.
 *
 * @param html - The email HTML.
 * @param css - CSS to inline. When given, only this CSS is inlined and the HTML's `<style>`
 * blocks are left in place; when empty or whitespace only, the `<style>` blocks are inlined instead.
 * @param options - How to prepare the HTML.
 * @param options.responsive - Whether to apply the responsive layout; by default, when the HTML
 * has a layout tag.
 * @param options.transform - A function run on the HTML after the responsive layout.
 * @param options.juice - Options passed to juice. Images are not inlined unless
 * `webResources.images` asks for it.
 * @returns The HTML with its CSS inlined.
 * @rejects When a layout tag lacks a required attribute, the transform throws, or, with
 * `juice.webResources.strict` on, an external resource cannot be inlined.
 */
export async function inlineEmailHtml(
  html: string,
  css = '',
  options: { responsive?: boolean; transform?: TemplateTransform; juice?: JuiceOptions } = {}
): Promise<string> {
  const transformedHtml = await applyTransforms(html, options);
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

async function applyTransforms(
  html: string,
  options: { responsive?: boolean; transform?: TemplateTransform }
): Promise<string> {
  const responsiveHtml = shouldRenderResponsiveLayout(html, options.responsive) ? renderResponsiveLayout(html) : html;
  return options.transform ? options.transform(responsiveHtml) : responsiveHtml;
}

function shouldRenderResponsiveLayout(html: string, responsive: boolean | undefined): boolean {
  if (responsive !== undefined) {
    return responsive;
  }

  return LAYOUT_TAG_PATTERN.test(html);
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
