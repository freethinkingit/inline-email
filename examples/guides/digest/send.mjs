import { readFileSync } from 'node:fs';
import { compileEmailTemplate } from 'inline-email';

const html = readFileSync(new URL('./digest.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./digest.css', import.meta.url), 'utf8');
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

const numberFormat = new Intl.NumberFormat('en-US');
const formatNumber = (value) => numberFormat.format(value);
const position = (index) => index + 1;

const template = await compileEmailTemplate({
  subject: 'Weekly digest for {{workspaceName}}',
  text: '{{workspaceName}}, {{periodLabel}}: {{formatNumber total}} items moved.',
  html,
  css,
  handlebars: { helpers: { formatNumber, position } }
});

console.log(JSON.stringify(template.render({ data }), null, 2));
