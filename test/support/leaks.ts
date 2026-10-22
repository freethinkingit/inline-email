import { expect } from 'vitest';
import { LAYOUT_TAG_PATTERN } from '../../src/compile.ts';

// Any Handlebars mustache that survived rendering: {{name}}, {{ name }}, {{#each items}}, {{/each}}, {{^x}}, {{> partial}}, {{else}}.
const leftoverPlaceholder = /{{[^{}]*}}/;

/**
 * Asserts that rendered email HTML has no Handlebars placeholder left in it and no layout tag
 * the library should have turned into email-safe tables.
 *
 * @param html - The rendered HTML, or CLI output, to check.
 * @param label - Names the email in a failure message, such as the template's file name.
 * @throws An assertion error quoting the leftover placeholder or layout tag.
 */
export function expectNoPlaceholdersOrLayoutTags(html: string, label?: string): void {
  expect(html, label).not.toMatch(leftoverPlaceholder);
  expect(html, label).not.toMatch(LAYOUT_TAG_PATTERN);
}
