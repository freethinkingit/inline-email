import type { RenderData, RenderTemplateOptions, TemplateData, TemplateValue } from './types.js';

const BLOCK_TAG_PATTERN = /{{([#/])\s*([A-Za-z0-9_.-]+)\s*}}/g;
const SLOT_PATTERN = /{{\s*slot:([A-Za-z0-9_.-]+)\s*}}/g;
const VARIABLE_PATTERN = /{{\s*([A-Za-z0-9_.-]+|\.)\s*}}/g;
const TEXT_PATTERN = new RegExp(`${SLOT_PATTERN.source}|${VARIABLE_PATTERN.source}`, 'g');

export function renderTemplate(
  template: string,
  data: RenderData = {},
  options: RenderTemplateOptions = {}
): string {
  const escape = options.escape ?? true;
  let output = '';
  let cursor = 0;

  for (const block of findBlocks(template)) {
    output += renderText(template.slice(cursor, block.start), data, escape);
    output += renderBlock(block.key, block.body, data, escape);
    cursor = block.end;
  }

  return output + renderText(template.slice(cursor), data, escape);
}

interface Block {
  key: string;
  body: string;
  start: number;
  end: number;
}

interface OpenBlock {
  key: string;
  start: number;
  bodyStart: number;
}

function findBlocks(template: string): Block[] {
  const blocks: Block[] = [];
  const open: OpenBlock[] = [];

  for (const match of template.matchAll(BLOCK_TAG_PATTERN)) {
    const [tag, kind, key] = match;
    const top = open.at(-1);

    if (kind === '#') {
      open.push({ key, start: match.index, bodyStart: match.index + tag.length });
      continue;
    }

    if (!top || top.key !== key) {
      continue;
    }

    open.pop();

    if (open.length === 0) {
      blocks.push({
        key,
        body: template.slice(top.bodyStart, match.index),
        start: top.start,
        end: match.index + tag.length
      });
    }
  }

  return blocks;
}

function renderBlock(key: string, body: string, data: RenderData, escape: boolean): string {
  const value = resolveValue(data, key);

  if (Array.isArray(value)) {
    return value
      .map((item) => renderTemplate(body, mergeData(data, item), { escape }))
      .join('');
  }

  if (isTruthyObject(value)) {
    return renderTemplate(body, mergeData(data, value), { escape });
  }

  return value ? renderTemplate(body, data, { escape }) : '';
}

function renderText(text: string, data: RenderData, escape: boolean): string {
  return text.replace(TEXT_PATTERN, (_match, slotName: string | undefined, key: string) => {
    if (slotName !== undefined) {
      return data.slots?.[slotName] ?? '';
    }

    const value = stringifyValue(resolveValue(data, key));
    return escape ? escapeHtml(value) : value;
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

export function isTemplateData(value: unknown): value is TemplateData {
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
