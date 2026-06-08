import type { RenderData, TemplateData, TemplateValue } from './types';

const BLOCK_PATTERN = /{{#\s*([A-Za-z0-9_.-]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g;
const SLOT_PATTERN = /{{\s*slot:([A-Za-z0-9_.-]+)\s*}}/g;
const VARIABLE_PATTERN = /{{\s*([A-Za-z0-9_.-]+|\.)\s*}}/g;

export function renderTemplate(template: string, data: RenderData = {}): string {
  const withoutBlocks = renderBlocks(template, data);
  const withSlots = withoutBlocks.replace(SLOT_PATTERN, (_match, slotName: string) => {
    return data.slots?.[slotName] ?? '';
  });

  return withSlots.replace(VARIABLE_PATTERN, (_match, key: string) => {
    return escapeHtml(stringifyValue(resolveValue(data, key)));
  });
}

function renderBlocks(template: string, data: RenderData): string {
  return template.replace(BLOCK_PATTERN, (_match, key: string, body: string) => {
    const value = resolveValue(data, key);

    if (Array.isArray(value)) {
      return value
        .map((item) => renderTemplate(body, mergeData(data, item)))
        .join('');
    }

    if (isTruthyObject(value)) {
      return renderTemplate(body, mergeData(data, value));
    }

    return value ? renderTemplate(body, data) : '';
  });
}

function mergeData(parent: RenderData, value: TemplateValue): RenderData {
  if (isTemplateData(value)) {
    return { ...parent, ...value, slots: parent.slots };
  }

  return { ...parent, '.': value, slots: parent.slots };
}

function resolveValue(data: TemplateData, path: string): TemplateValue {
  if (path === '.') {
    return data['.'];
  }

  return path.split('.').reduce<TemplateValue>((current, segment) => {
    if (!isTemplateData(current)) {
      return undefined;
    }

    return current[segment];
  }, data);
}

function stringifyValue(value: TemplateValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return '';
  }

  return String(value);
}

function isTruthyObject(value: TemplateValue): value is TemplateData {
  return isTemplateData(value) && Object.keys(value).length > 0;
}

function isTemplateData(value: TemplateValue): value is TemplateData {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
