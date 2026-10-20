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

const DEFAULT_JUICE_OPTIONS: JuiceOptions = {
  webResources: {
    images: false
  }
};

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

export async function inlineEmailHtml(
  html: string,
  css = '',
  options: { responsive?: boolean; transform?: TemplateTransform; juice?: JuiceOptions } = {}
): Promise<string> {
  const transformedHtml = await applyTransforms(html, options);
  const juiceOptions = mergeJuiceOptions(options.juice);
  const webResources = juiceOptions.webResources ?? {};
  const resourceHtml = webResources.images || webResources.links || webResources.scripts || webResources.svgs
    ? await inlineExternalResources(transformedHtml, { links: false, scripts: false, svgs: false, ...webResources })
    : transformedHtml;

  if (css) {
    return juice.inlineContent(resourceHtml, css, juiceOptions);
  }

  return juice(resourceHtml, juiceOptions);
}

// juice exports inlineExternal at runtime but its bundled typings omit it.
type InlineExternal = (
  html: string,
  webResources: NonNullable<JuiceOptions['webResources']>,
  callback: (err: Error | null, html: string) => void
) => void;

function inlineExternalResources(
  html: string,
  webResources: NonNullable<JuiceOptions['webResources']>
): Promise<string> {
  const inlineExternal = (juice as unknown as { inlineExternal: InlineExternal }).inlineExternal;

  return new Promise((resolve, reject) => {
    inlineExternal(html, webResources, (err, result) => (err ? reject(err) : resolve(result)));
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

  return /<\/?(email|preview|container|section|columns|column|button|spacer|divider|image|hero-image|otp|alert|panel|brand|footer)\b/i.test(html);
}

function mergeJuiceOptions(options: JuiceOptions = {}): JuiceOptions {
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
  return Boolean(value) && typeof value === 'object' && typeof (value as CompiledEmailTemplate).render === 'function';
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
  if (!input || typeof input !== 'object') {
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
