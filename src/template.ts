import { compileTemplate } from './engine.js';
import type { RenderData, RenderTemplateOptions, TemplateData } from './types.js';

/**
 * Compiles a template and renders it once with the given data.
 *
 * @param template - The template text.
 * @param data - The values and `slots` the template renders with.
 * @param options - The escape mode, strict mode and Handlebars options to compile with.
 * @returns The rendered text.
 * @throws When the escape option is invalid, the template or a partial is malformed, or a
 * strict render names a missing field or reads through a missing or null object.
 */
export function renderTemplate(
  template: string,
  data: RenderData = {},
  options: RenderTemplateOptions = {}
): string {
  const render = compileTemplate(template, options);

  return render(data);
}

/**
 * Tells whether a value can be used as template data.
 *
 * @param value - Any value.
 * @returns `true` for an object that is neither `null` nor an array, otherwise `false`.
 */
export function isTemplateData(value: unknown): value is TemplateData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
