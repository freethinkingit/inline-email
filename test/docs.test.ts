import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const guidesDir = join(rootDir, 'docs', 'guides');
const readmePath = join(rootDir, 'README.md');
const referencePath = join(rootDir, 'docs', 'reference.md');
const llmsPath = join(rootDir, 'llms.txt');
const cliPath = join(rootDir, 'src', 'cli.ts');
const packagePath = join(rootDir, 'package.json');
const guidePaths = readdirSync(guidesDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => join(guidesDir, name));
const guideLinks = guidePaths.map((path) => relative(rootDir, path).split(sep).join('/'));
const requiredDocLinks = [...guideLinks, 'docs/reference.md', 'MIGRATION.md'];
const quickstartFiles = ['examples/guides/quickstart/welcome.html', 'examples/guides/quickstart/send.mjs'];

const README_MAX_LINES = 220;
const README_OPENING_LINES = 60;
const LLMS_MAX_LINES = 60;
const repoBlobPrefix = 'https://github.com/freethinkingit/inline-email/blob/master/';
const repoRawPrefix = 'https://raw.githubusercontent.com/freethinkingit/inline-email/master/';
const npmPackageUrl = 'https://www.npmjs.com/package/inline-email';
const fixturePath = join(rootDir, 'fixture.md');

interface FencedBlock {
  info: string;
  body: string;
  line: number;
  endLine: number;
}

const read = (path: string) => readFileSync(path, 'utf8');
const lines = (text: string) => text.replace(/\n$/, '').split('\n');
const fenceOpener = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const fileMarker = /(?:^|\s)file=(\S+)/;

function fencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const source = markdown.split('\n');
  for (let i = 0; i < source.length; i++) {
    const open = fenceOpener.exec(source[i]);
    if (!open) continue;
    const [, indent, fence, info] = open;
    if (fence[0] === '`' && info.includes('`')) continue;
    const closer = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
    const bodyIndent = new RegExp(`^ {0,${indent.length}}`);
    const start = i;
    const body: string[] = [];
    for (i++; i < source.length && !closer.test(source[i]); i++) body.push(source[i].replace(bodyIndent, ''));
    blocks.push({ info: info.trim(), body: body.join('\n'), line: start + 1, endLine: i + 1 });
  }
  return blocks;
}

function withoutFencedBlocks(markdown: string): string {
  const source = markdown.split('\n');
  for (const block of fencedBlocks(markdown)) {
    for (let i = block.line - 1; i < Math.min(block.endLine, source.length); i++) source[i] = '';
  }
  return source.join('\n');
}

function checkFileBlocks(docName: string, markdown: string, readRepoFile: (path: string) => string | undefined): string[] {
  const problems: string[] = [];
  const blocks = fencedBlocks(markdown);
  const openerLines = new Set(blocks.map((block) => block.line));
  markdown.split('\n').forEach((line, index) => {
    if (/^\s*(`{3,}|~{3,}).*\bfile=/.test(line) && !openerLines.has(index + 1)) {
      problems.push(`${docName}:${index + 1}: fence with file= was not parsed as a fenced block`);
    }
  });
  for (const block of blocks) {
    const path = fileMarker.exec(block.info)?.[1];
    if (!path) continue;
    const content = readRepoFile(path);
    if (content === undefined) {
      problems.push(`${docName}:${block.line}: file=${path} does not exist`);
      continue;
    }
    const expected = lines(content);
    const actual = lines(block.body);
    const max = Math.max(expected.length, actual.length);
    for (let i = 0; i < max; i++) {
      if (expected[i] !== actual[i]) {
        problems.push(
          `${docName}:${block.line}: block differs from ${path} at line ${i + 1}: ` +
            `doc has ${JSON.stringify(actual[i])}, file has ${JSON.stringify(expected[i])}`
        );
        break;
      }
    }
  }
  return problems;
}

function checkFileBlockPresence(docName: string, markdown: string, requiredPaths: string[] = []): string[] {
  const quoted = fencedBlocks(markdown)
    .map((block) => fileMarker.exec(block.info)?.[1])
    .filter((path): path is string => path !== undefined);
  if (quoted.length === 0) return [`${docName} has no file= block`];
  return requiredPaths.filter((path) => !quoted.includes(path)).map((path) => `${docName} does not quote ${path}`);
}

function checkLineLimit(docName: string, text: string, max: number): string[] {
  const count = lines(text).length;
  return count > max ? [`${docName} has ${count} lines, over the limit of ${max}`] : [];
}

const readRepoFile = (path: string) => {
  const full = join(rootDir, path);
  return existsSync(full) ? read(full) : undefined;
};

function headingSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
}

function headingSlugs(markdown: string): string[] {
  return withoutFencedBlocks(markdown)
    .split('\n')
    .map((line) => /^#{1,6}\s+(.*)$/.exec(line)?.[1])
    .filter((heading): heading is string => heading !== undefined)
    .map(headingSlug);
}

const inlineLink = /\]\(\s*(?:<([^>\n]*)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const referenceDefinition = /^ {0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]*)>|(\S+))/gm;
const htmlAttribute = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function linkTargets(markdown: string): string[] {
  const prose = withoutFencedBlocks(markdown).replace(/`[^`\n]*`/g, '');
  return [inlineLink, referenceDefinition, htmlAttribute].flatMap((pattern) =>
    [...prose.matchAll(pattern)].map((match) => match[1] ?? match[2])
  );
}

// existsSync ignores case on macOS and Windows, so each segment is compared with the real directory listing as Linux CI would.
function existsWithExactCase(path: string): boolean {
  const fromRoot = relative(rootDir, path);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) return false;
  let dir = rootDir;
  for (const segment of fromRoot.split(sep).filter(Boolean)) {
    if (!statSync(dir).isDirectory() || !readdirSync(dir).includes(segment)) return false;
    dir = join(dir, segment);
  }
  return true;
}

function checkLinks(docPath: string, markdown: string): string[] {
  const docName = relative(rootDir, docPath);
  const problems: string[] = [];
  for (const target of linkTargets(markdown)) {
    const hash = target.indexOf('#');
    const pathPart = hash < 0 ? target : target.slice(0, hash);
    const anchor = hash < 0 ? undefined : target.slice(hash + 1);
    const repoPrefix = [repoBlobPrefix, repoRawPrefix].find((prefix) => target.startsWith(prefix));
    let file: string;
    if (repoPrefix !== undefined) {
      file = join(rootDir, decodeURI(pathPart.slice(repoPrefix.length)));
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
      continue;
    } else {
      file = pathPart === '' ? docPath : resolve(dirname(docPath), decodeURI(pathPart));
    }
    if (pathPart !== '') {
      if (!existsWithExactCase(file)) {
        problems.push(`${docName}: link ${target} does not resolve to a file`);
        continue;
      }
      if (anchor !== undefined && statSync(file).isDirectory()) {
        problems.push(`${docName}: link ${target} has an anchor but points at a directory`);
        continue;
      }
    }
    if (anchor !== undefined && !headingSlugs(pathPart === '' ? markdown : read(file)).includes(anchor)) {
      problems.push(`${docName}: link ${target} names an anchor with no matching heading`);
    }
  }
  return problems;
}

function lastBadgeIndex(readmeLines: string[]): number {
  let index = readmeLines.length - 1;
  while (index >= 0 && !readmeLines[index].startsWith('[![')) index--;
  return index;
}

function checkReadmeOpening(readme: string): string[] {
  const all = lines(readme);
  const lastBadge = lastBadgeIndex(all);
  if (lastBadge < 0) return ['README has no badge line'];
  const problems: string[] = [];
  const opening = all.slice(lastBadge + 1);
  const pitch = opening.find((line) => line.trim() !== '');
  if (!pitch?.startsWith('inline-email turns HTML and CSS')) {
    problems.push(`README's first line after the badges is not the pitch: ${JSON.stringify(pitch)}`);
  }
  const whenToUse = opening.indexOf('## When to use it');
  const quickstart = opening.indexOf('## Quickstart');
  if (whenToUse < 0 || whenToUse >= README_OPENING_LINES) {
    problems.push(`README "## When to use it" is not within the first ${README_OPENING_LINES} lines after the badges`);
  }
  if (quickstart <= whenToUse) problems.push('README "## Quickstart" does not come after "## When to use it"');
  const linkWindow = opening.slice(0, whenToUse < 0 ? README_OPENING_LINES : Math.min(whenToUse, README_OPENING_LINES));
  const linked = new Set(linkTargets(linkWindow.join('\n')).map((target) => target.split('#')[0]));
  for (const link of requiredDocLinks) {
    if (!linked.has(link)) problems.push(`README does not link ${link} before "## When to use it"`);
  }
  return problems;
}

function checkLlms(llms: string): string[] {
  const problems: string[] = [];
  const firstLine = lines(llms)[0];
  if (firstLine !== '# inline-email') problems.push(`llms.txt first line is ${JSON.stringify(firstLine)}, not "# inline-email"`);
  const linked = new Set(linkTargets(llms));
  const required = [...['README.md', ...requiredDocLinks].map((path) => repoBlobPrefix + path), npmPackageUrl];
  for (const url of required) {
    if (!linked.has(url)) problems.push(`llms.txt does not link ${url}`);
  }
  return [...problems, ...checkLineLimit('llms.txt', llms, LLMS_MAX_LINES)];
}

function usageOptions(cliSource: string): string[] {
  const usageBody = /function usage\(\): string \{\s*return `([\s\S]*?)`;/.exec(cliSource)?.[1] ?? '';
  const options = usageBody.split('\nOptions:\n')[1] ?? '';
  return options.split('\n').map((line) => line.replace(/^ {2}/, ''));
}

function referenceCliBlock(reference: string): string[] | undefined {
  const marker = reference.indexOf('Supported options:\n');
  if (marker < 0) return undefined;
  const block = fencedBlocks(reference.slice(marker))[0];
  return block === undefined ? undefined : lines(block.body);
}

function checkCliBlock(cliSource: string, reference: string): string[] {
  const options = usageOptions(cliSource);
  if (!options.some((line) => line.startsWith('--html')) || !options.some((line) => line.startsWith('--strict'))) {
    return ['src/cli.ts usage() options were not found (no --html or --strict line)'];
  }
  const block = referenceCliBlock(reference);
  if (block === undefined) return ['docs/reference.md has no "Supported options:" fenced block'];
  const max = Math.max(options.length, block.length);
  for (let i = 0; i < max; i++) {
    if (options[i] !== block[i]) {
      return [
        `docs/reference.md CLI block differs from usage() at line ${i + 1}: ` +
          `reference has ${JSON.stringify(block[i])}, usage() has ${JSON.stringify(options[i])}`
      ];
    }
  }
  return [];
}

interface ShellCommand {
  line: number;
  words: string[];
}

interface CommandContext {
  flags: Set<string>;
  scripts: Set<string>;
  fileExists: (path: string) => boolean;
}

function shellCommands(markdown: string): ShellCommand[] {
  return fencedBlocks(markdown)
    .filter((block) => /^(sh|bash|shell)\b/.test(block.info))
    .flatMap((block) =>
      block.body.split('\n').map((text, index) => ({ line: block.line + 1 + index, words: text.trim().split(/\s+/) }))
    )
    .filter(({ words }) => words[0] !== '' && !words[0].startsWith('#'));
}

function cliFlags(cliSource: string): Set<string> {
  return new Set(usageOptions(cliSource).flatMap((line) => line.split(/\s{2,}/)[0].match(/-{1,2}[A-Za-z]+/g) ?? []));
}

function isCliCommand([first, second]: string[]): boolean {
  return first === 'inline-email' || (first === 'npx' && second === 'inline-email') || (first === 'node' && second === 'dist/cli.js');
}

function checkCommands(docName: string, markdown: string, context: CommandContext): string[] {
  const problems: string[] = [];
  for (const { line, words } of shellCommands(markdown)) {
    const [first, second, third] = words;
    if (isCliCommand(words)) {
      for (const flag of words.filter((word) => word.startsWith('-'))) {
        if (!context.flags.has(flag)) problems.push(`${docName}:${line}: ${flag} is not a flag in the CLI's usage()`);
      }
    }
    if (first === 'node' && second?.includes('/') && !context.fileExists(second)) {
      problems.push(`${docName}:${line}: node ${second} names a file that does not exist`);
    }
    const script = first !== 'npm' ? undefined : second === 'run' ? third : second === 'test' ? 'test' : undefined;
    if (script !== undefined && !context.scripts.has(script)) {
      problems.push(`${docName}:${line}: npm script ${script} is not in package.json`);
    }
  }
  return problems;
}

const commandContext: CommandContext = {
  flags: cliFlags(read(cliPath)),
  scripts: new Set(Object.keys((JSON.parse(read(packagePath)) as { scripts: Record<string, string> }).scripts)),
  // dist/ is build output, so a command naming it is checked against the source file it is built from.
  fileExists: (path) => existsWithExactCase(join(rootDir, path.replace(/^dist\/(.*)\.js$/, 'src/$1.ts')))
};

describe('Property 1: Guides show real files', () => {
  it.each([readmePath, ...guidePaths].map((path) => [relative(rootDir, path), path]))(
    '%s shows each file= block exactly as the file',
    (name, path) => {
      expect(checkFileBlocks(name, read(path), readRepoFile)).toEqual([]);
    }
  );

  it.each(guidePaths.map((path) => [relative(rootDir, path), path]))('%s has at least one file= block', (name, path) => {
    expect(checkFileBlockPresence(name, read(path))).toEqual([]);
  });

  it('README quotes both quickstart files', () => {
    expect(checkFileBlockPresence('README.md', read(readmePath), quickstartFiles)).toEqual([]);
  });

  it('reports an altered block with the file and the first differing line', () => {
    const doc = ['# Doc', '', '```html file=a.html', '<p>one</p>', '<p>TWO</p>', '```', ''].join('\n');
    const files: Record<string, string> = { 'a.html': '<p>one</p>\n<p>two</p>\n' };
    expect(checkFileBlocks('doc.md', doc, (path) => files[path])).toEqual([
      'doc.md:3: block differs from a.html at line 2: doc has "<p>TWO</p>", file has "<p>two</p>"'
    ]);
  });

  it('tolerates a single trailing newline difference', () => {
    const doc = ['```html file=a.html', '<p>one</p>', '```'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n')).toEqual([]);
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>')).toEqual([]);
  });

  it('reports a file= path that does not exist', () => {
    const doc = ['```js file=examples/guides/nowhere/send.mjs', 'run();', '```'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => undefined)).toEqual([
      'doc.md:1: file=examples/guides/nowhere/send.mjs does not exist'
    ]);
  });

  it('checks indented and tilde fences, closing only on the same character and at least the same length', () => {
    const doc = ['   ~~~~html file=a.html', '   <p>one</p>', '```', '~~~', '~~~~'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n```\n~~~\n')).toEqual([]);
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n')).toEqual([
      'doc.md:1: block differs from a.html at line 2: doc has "```", file has undefined'
    ]);
  });

  it('reports a file= fence the parser did not handle', () => {
    const doc = ['    ```html file=a.html', '    <p>one</p>', '    ```'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n')).toEqual([
      'doc.md:1: fence with file= was not parsed as a fenced block'
    ]);
  });

  it('reports a document with no file= block and a README missing a quickstart file', () => {
    expect(checkFileBlockPresence('guide.md', '# Guide\n\n```html\n<p></p>\n```\n')).toEqual(['guide.md has no file= block']);
    const readme = '```html file=examples/guides/quickstart/welcome.html\n<p></p>\n```\n';
    expect(checkFileBlockPresence('README.md', readme, quickstartFiles)).toEqual([
      'README.md does not quote examples/guides/quickstart/send.mjs'
    ]);
  });
});

describe('Property 3: Every documentation link resolves', () => {
  it.each([readmePath, ...guidePaths, referencePath, llmsPath].map((path) => [relative(rootDir, path), path]))(
    'every relative link in %s resolves',
    (_name, path) => {
      expect(checkLinks(path, read(path))).toEqual([]);
    }
  );

  it.each([
    ['an inline link with a title', '[a](nowhere.md "Title")', '[a](MIGRATION.md "Title")', 'nowhere.md'],
    ['an angle-bracket target', '[a](<no where.md>)', '[a](<MIGRATION.md>)', 'no where.md'],
    ['a reference definition', '[ref]: nowhere.md', '[ref]: MIGRATION.md', 'nowhere.md'],
    ['an HTML href', '<a href="nowhere.md">a</a>', '<a href="MIGRATION.md">a</a>', 'nowhere.md'],
    ['an HTML src', '<img src="nowhere.png">', '<img src="docs/assets/feature-roundup.png">', 'nowhere.png']
  ])('collects %s and reports it when broken', (_form, broken, working, target) => {
    expect(checkLinks(fixturePath, `# Fixture\n\n${working}\n`)).toEqual([]);
    expect(checkLinks(fixturePath, `# Fixture\n\n${broken}\n`)).toEqual([`fixture.md: link ${target} does not resolve to a file`]);
  });

  it('resolves a raw.githubusercontent URL against the working tree and reports a missing file', () => {
    expect(checkLinks(fixturePath, `![s](${repoRawPrefix}docs/assets/feature-roundup.png)\n`)).toEqual([]);
    expect(checkLinks(fixturePath, `![s](${repoRawPrefix}docs/assets/nowhere.png)\n`)).toEqual([
      `fixture.md: link ${repoRawPrefix}docs/assets/nowhere.png does not resolve to a file`
    ]);
  });

  it('ignores links inside fenced code and code spans', () => {
    expect(checkLinks(fixturePath, '# F\n\n`[a](nowhere.md)`\n\n~~~html\n<a href="nowhere.md">a</a>\n~~~\n')).toEqual([]);
  });

  it('reports a link whose case differs from the file name', () => {
    expect(checkLinks(fixturePath, '[m](migration.md)\n')).toEqual(['fixture.md: link migration.md does not resolve to a file']);
  });

  it('reports an anchor into a directory and an anchor with no heading', () => {
    expect(checkLinks(fixturePath, '[t](test/)\n')).toEqual([]);
    expect(checkLinks(fixturePath, '[t](test/#x)\n')).toEqual([
      'fixture.md: link test/#x has an anchor but points at a directory'
    ]);
    expect(checkLinks(fixturePath, '[r](docs/reference.md#nope)\n')).toEqual([
      'fixture.md: link docs/reference.md#nope names an anchor with no matching heading'
    ]);
  });

  it('slugs keep underscores and hyphens', () => {
    expect(headingSlug('`snake_case` and kebab-case: Options!')).toBe('snake_case-and-kebab-case-options');
  });

  it(`README is at most ${README_MAX_LINES} lines`, () => {
    expect(checkLineLimit('README.md', read(readmePath), README_MAX_LINES)).toEqual([]);
  });

  it('reports a 221-line document', () => {
    const doc = Array.from({ length: 221 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
    expect(checkLineLimit('README.md', doc, README_MAX_LINES)).toEqual([
      'README.md has 221 lines, over the limit of 220'
    ]);
  });

  it('README opens with the pitch, the doc links and "When to use it", then the Quickstart', () => {
    expect(guideLinks).toHaveLength(4);
    expect(checkReadmeOpening(read(readmePath))).toEqual([]);
  });

  describe('README opening checker', () => {
    const pitch = 'inline-email turns HTML and CSS into email-safe templates.';
    const docsLine = `**Docs:** ${requiredDocLinks.map((link) => `[d](${link})`).join(' · ')}`;
    const opening = (...body: string[]) => ['# Inline Email', '', '[![b](x.svg)](y)', '', ...body].join('\n') + '\n';

    it('accepts the required order', () => {
      expect(checkReadmeOpening(opening(pitch, '', docsLine, '', '## When to use it', '', '## Quickstart'))).toEqual([]);
    });

    it('reports a missing pitch', () => {
      expect(checkReadmeOpening(opening('Something else.', docsLine, '## When to use it', '## Quickstart'))).toEqual([
        `README's first line after the badges is not the pitch: "Something else."`
      ]);
    });

    it('reports doc links after "When to use it"', () => {
      expect(checkReadmeOpening(opening(pitch, '## When to use it', docsLine, '## Quickstart'))).toEqual(
        requiredDocLinks.map((link) => `README does not link ${link} before "## When to use it"`)
      );
    });

    it('reports the Quickstart before "When to use it"', () => {
      expect(checkReadmeOpening(opening(pitch, docsLine, '## Quickstart', '## When to use it'))).toEqual([
        'README "## Quickstart" does not come after "## When to use it"'
      ]);
    });

    it('reports "When to use it" beyond the first 60 lines', () => {
      const filler = Array.from({ length: 60 }, () => '');
      expect(checkReadmeOpening(opening(pitch, docsLine, ...filler, '## When to use it', '## Quickstart'))).toEqual([
        'README "## When to use it" is not within the first 60 lines after the badges'
      ]);
    });
  });

  it('reference table of contents anchors match its headings in order', () => {
    const reference = read(referencePath);
    const [beforeFirstSection, ...sections] = reference.split(/^(?=## )/m);
    const tocAnchors = [...beforeFirstSection.matchAll(/^\s*- \[[^\]]+\]\(#([^)]+)\)/gm)].map((match) => match[1]);
    const headingAnchors = withoutFencedBlocks(sections.join(''))
      .split('\n')
      .filter((line) => /^#{2,3} /.test(line))
      .map((line) => headingSlug(line.replace(/^#+ /, '')));
    expect(tocAnchors.length).toBeGreaterThan(0);
    expect(tocAnchors).toEqual(headingAnchors);
  });

  it('reference CLI options block equals usage() from src/cli.ts line for line', () => {
    expect(checkCliBlock(read(cliPath), read(referencePath))).toEqual([]);
  });

  it('reports missing usage() options, a missing reference block and a drifted line', () => {
    const cliSource = read(cliPath);
    const reference = read(referencePath);
    expect(checkCliBlock('export function main() {}\n', reference)).toEqual([
      'src/cli.ts usage() options were not found (no --html or --strict line)'
    ]);
    expect(checkCliBlock(cliSource, reference.replace('Supported options:', 'Options below:'))).toEqual([
      'docs/reference.md has no "Supported options:" fenced block'
    ]);
    const drifted = reference.replace('--strict               With', '--strict               Now');
    expect(checkCliBlock(cliSource, drifted)).toHaveLength(1);
    expect(checkCliBlock(cliSource, drifted)[0]).toMatch(/^docs\/reference\.md CLI block differs from usage\(\) at line \d+/);
  });

  it(`llms.txt starts with "# inline-email", links every doc and npm, and is at most ${LLMS_MAX_LINES} lines`, () => {
    expect(checkLlms(read(llmsPath))).toEqual([]);
  });

  it('reports a wrong llms.txt H1, a missing link and too many lines', () => {
    const llms = read(llmsPath);
    expect(checkLlms(llms.replace('# inline-email', '# Inline Email'))).toEqual([
      'llms.txt first line is "# Inline Email", not "# inline-email"'
    ]);
    expect(checkLlms(llms.replace(`(${repoBlobPrefix}MIGRATION.md)`, '(MIGRATION.md)'))).toEqual([
      `llms.txt does not link ${repoBlobPrefix}MIGRATION.md`
    ]);
    expect(checkLlms(llms + '\n'.repeat(60))).toEqual([expect.stringMatching(/^llms\.txt has \d+ lines, over the limit of 60$/)]);
  });
});

describe('Commands in the docs still work', () => {
  it('every CLI flag, node path and npm script a docs command names exists', () => {
    const docs = [readmePath, referencePath, ...guidePaths];
    expect(docs.flatMap((path) => checkCommands(relative(rootDir, path), read(path), commandContext))).toEqual([]);
  });

  it('reports an unknown flag, a missing node path and a missing npm script', () => {
    const doc = [
      '```sh',
      'npx inline-email email.html --dta data.json -f',
      'node examples/guides/nowhere/send.mjs',
      'npm run exampels',
      '```'
    ].join('\n');
    expect(checkCommands('fixture.md', doc, commandContext)).toEqual([
      "fixture.md:2: --dta is not a flag in the CLI's usage()",
      'fixture.md:3: node examples/guides/nowhere/send.mjs names a file that does not exist',
      'fixture.md:4: npm script exampels is not in package.json'
    ]);
  });
});
