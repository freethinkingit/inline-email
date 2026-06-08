export {
  compileEmailTemplate,
  inlineEmailHtml,
  renderEmail
} from './compile.js';

export { renderTemplate } from './template.js';
export { renderResponsiveLayout } from './layout.js';

export type {
  CompiledEmailTemplate,
  CompileEmailTemplateOptions,
  EmailRenderContext,
  EmailStyle,
  EmailStyleVariant,
  RenderData,
  RenderedEmail,
  RenderEmailOptions,
  ResponsiveLayoutOptions,
  TemplateData,
  TemplateTransform,
  TemplateValue
} from './types.js';
