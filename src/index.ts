export {
  compileEmailTemplate,
  inlineEmailHtml,
  renderEmail
} from './compile';

export { renderTemplate } from './template';
export { renderResponsiveLayout } from './layout';

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
} from './types';
