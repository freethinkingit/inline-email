export type TemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateData
  | TemplateValue[];

export interface TemplateData {
  [key: string]: TemplateValue;
}

export interface RenderData extends TemplateData {
  slots?: Record<string, string | null | undefined>;
}

export interface EmailStyleVariant {
  accent?: string;
  background?: string;
  border?: string;
  text?: string;
}

export interface EmailStyle {
  tones?: Record<string, EmailStyleVariant>;
  [key: string]: unknown;
}

export interface EmailRenderContext {
  data?: RenderData;
  style?: EmailStyle;
}

export interface JuiceOptions {
  [key: string]: unknown;
  webResources?: {
    images?: boolean;
    [key: string]: unknown;
  };
}

export type TemplateTransform = (html: string) => string | Promise<string>;

export interface ResponsiveLayoutOptions {
  enabled?: boolean;
}

export interface CompileEmailTemplateOptions {
  html: string;
  css?: string;
  subject?: string;
  text?: string;
  responsive?: boolean | ResponsiveLayoutOptions;
  transform?: TemplateTransform;
  juice?: JuiceOptions;
}

export interface RenderEmailOptions {
  template: CompileEmailTemplateOptions | CompiledEmailTemplate | string;
  data?: RenderData;
  style?: EmailStyle;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface CompiledEmailTemplate {
  subject: string;
  html: string;
  text: string;
  render(input?: RenderData | EmailRenderContext): RenderedEmail;
}
