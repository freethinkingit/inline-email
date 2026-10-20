import { compileTemplate } from './engine.js';
import type { RenderData, RenderTemplateOptions, TemplateData } from './types.js';

export function renderTemplate(
  template: string,
  data: RenderData = {},
  options: RenderTemplateOptions = {}
): string {
  return compileTemplate(template, options)(data);
}

export function isTemplateData(value: unknown): value is TemplateData {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
