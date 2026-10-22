import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const guidesDir = join(rootDir, 'docs', 'guides');
const readmePath = join(rootDir, 'README.md');
const referencePath = join(rootDir, 'docs', 'reference.md');
const llmsPath = join(rootDir, 'llms.txt');
const migrationPath = join(rootDir, 'MIGRATION.md');
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
const fileFenceLine = /^\s*(`{3,}|~{3,}).*\bfile=/;

// CommonMark: the info string of a backtick fence cannot contain a backtick, so such a line opens no block.
function opensFence(opener: RegExpExecArray): boolean {
  const [, , fence, info] = opener;
  return !(fence.startsWith('`') && info.includes('`'));
}

function readFencedBlock(sourceLines: string[], openerIndex: number, opener: RegExpExecArray): FencedBlock {
  const [, indent, fence, info] = opener;
  const closingFence = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
  const openerIndent = new RegExp(`^ {0,${indent.length}}`);
  const body: string[] = [];
  let index = openerIndex + 1;
  while (index < sourceLines.length && !closingFence.test(sourceLines[index])) {
    body.push(sourceLines[index].replace(openerIndent, ''));
    index++;
  }
  return { info: info.trim(), body: body.join('\n'), line: openerIndex + 1, endLine: index + 1 };
}

function fencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const sourceLines = markdown.split('\n');
  let index = 0;
  while (index < sourceLines.length) {
    const opener = fenceOpener.exec(sourceLines[index]);
    if (opener === null || !opensFence(opener)) {
      index++;
      continue;
    }
    const block = readFencedBlock(sourceLines, index, opener);
    blocks.push(block);
    index = block.endLine;
  }
  return blocks;
}

function withoutFencedBlocks(markdown: string): string {
  const sourceLines = markdown.split('\n');
  for (const block of fencedBlocks(markdown)) {
    const endIndex = Math.min(block.endLine, sourceLines.length);
    for (let index = block.line - 1; index < endIndex; index++) {
      sourceLines[index] = '';
    }
  }
  return sourceLines.join('\n');
}

function quotedFilePath(block: FencedBlock): string | undefined {
  const marker = fileMarker.exec(block.info);
  if (marker === null) return undefined;
  return marker[1];
}

function firstDifferingLine(expected: string[], actual: string[]): number | undefined {
  const longest = Math.max(expected.length, actual.length);
  for (let index = 0; index < longest; index++) {
    if (expected[index] !== actual[index]) return index;
  }
  return undefined;
}

function unparsedFileFences(docName: string, markdown: string, blocks: FencedBlock[]): string[] {
  const openerLines = new Set(blocks.map((block) => block.line));
  const sourceLines = markdown.split('\n');
  const problems: string[] = [];
  for (let index = 0; index < sourceLines.length; index++) {
    const lineNumber = index + 1;
    if (fileFenceLine.test(sourceLines[index]) && !openerLines.has(lineNumber)) {
      problems.push(`${docName}:${lineNumber}: fence with file= was not parsed as a fenced block`);
    }
  }
  return problems;
}

function checkFileBlocks(docName: string, markdown: string, readRepoFile: (path: string) => string | undefined): string[] {
  const blocks = fencedBlocks(markdown);
  const problems = unparsedFileFences(docName, markdown, blocks);
  for (const block of blocks) {
    const path = quotedFilePath(block);
    if (path === undefined) continue;
    const content = readRepoFile(path);
    if (content === undefined) {
      problems.push(`${docName}:${block.line}: file=${path} does not exist`);
      continue;
    }
    const fileLines = lines(content);
    const blockLines = lines(block.body);
    const differingIndex = firstDifferingLine(fileLines, blockLines);
    if (differingIndex !== undefined) {
      problems.push(
        `${docName}:${block.line}: block differs from ${path} at line ${differingIndex + 1}: ` +
          `doc has ${JSON.stringify(blockLines[differingIndex])}, file has ${JSON.stringify(fileLines[differingIndex])}`
      );
    }
  }
  return problems;
}

function checkFileBlockPresence(docName: string, markdown: string, requiredPaths: string[] = []): string[] {
  const quotedPaths = fencedBlocks(markdown)
    .map(quotedFilePath)
    .filter((path): path is string => path !== undefined);
  if (quotedPaths.length === 0) return [`${docName} has no file= block`];
  const missingPaths = requiredPaths.filter((path) => !quotedPaths.includes(path));
  return missingPaths.map((path) => `${docName} does not quote ${path}`);
}

function checkLineLimit(docName: string, text: string, max: number): string[] {
  const count = lines(text).length;
  return count > max ? [`${docName} has ${count} lines, over the limit of ${max}`] : [];
}

const readRepoFile = (path: string) => {
  const absolutePath = join(rootDir, path);
  return existsSync(absolutePath) ? read(absolutePath) : undefined;
};

const headingLine = /^#{1,6}\s+(.*)$/;

function headingSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
}

function headingSlugs(markdown: string): string[] {
  const slugs: string[] = [];
  for (const line of withoutFencedBlocks(markdown).split('\n')) {
    const heading = headingLine.exec(line);
    if (heading !== null) slugs.push(headingSlug(heading[1]));
  }
  return slugs;
}

const inlineLink = /\]\(\s*(?:<([^>\n]*)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const referenceDefinition = /^ {0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]*)>|(\S+))/gm;
const htmlAttribute = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const codeSpan = /`[^`\n]*`/g;
const urlScheme = /^[a-z][a-z0-9+.-]*:/i;

function linkTargets(markdown: string): string[] {
  const prose = withoutFencedBlocks(markdown).replace(codeSpan, '');
  const targets: string[] = [];
  for (const pattern of [inlineLink, referenceDefinition, htmlAttribute]) {
    for (const match of prose.matchAll(pattern)) {
      targets.push(match[1] ?? match[2]);
    }
  }
  return targets;
}

// existsSync ignores case on macOS and Windows, so each segment is compared with the real directory listing as Linux CI would.
function existsWithExactCase(path: string): boolean {
  const fromRoot = relative(rootDir, path);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) return false;
  let directory = rootDir;
  for (const segment of fromRoot.split(sep).filter((part) => part !== '')) {
    if (!statSync(directory).isDirectory() || !readdirSync(directory).includes(segment)) return false;
    directory = join(directory, segment);
  }
  return true;
}

function splitAnchor(target: string): { path: string; anchor: string | undefined } {
  const hashIndex = target.indexOf('#');
  if (hashIndex < 0) return { path: target, anchor: undefined };
  return { path: target.slice(0, hashIndex), anchor: target.slice(hashIndex + 1) };
}

function repoFileForLink(docPath: string, target: string, path: string): string | undefined {
  const repoPrefix = [repoBlobPrefix, repoRawPrefix].find((prefix) => target.startsWith(prefix));
  if (repoPrefix !== undefined) return join(rootDir, decodeURI(path.slice(repoPrefix.length)));
  if (urlScheme.test(target)) return undefined;
  if (path === '') return docPath;
  return resolve(dirname(docPath), decodeURI(path));
}

function linkProblem(docPath: string, markdown: string, target: string): string | undefined {
  const { path, anchor } = splitAnchor(target);
  const file = repoFileForLink(docPath, target, path);
  if (file === undefined) return undefined;
  const linksToSameDoc = path === '';
  if (!linksToSameDoc && !existsWithExactCase(file)) return 'does not resolve to a file';
  if (anchor === undefined) return undefined;
  if (!linksToSameDoc && statSync(file).isDirectory()) return 'has an anchor but points at a directory';
  const linkedMarkdown = linksToSameDoc ? markdown : read(file);
  if (!headingSlugs(linkedMarkdown).includes(anchor)) return 'names an anchor with no matching heading';
  return undefined;
}

function checkLinks(docPath: string, markdown: string): string[] {
  const docName = relative(rootDir, docPath);
  const problems: string[] = [];
  for (const target of linkTargets(markdown)) {
    const problem = linkProblem(docPath, markdown, target);
    if (problem !== undefined) problems.push(`${docName}: link ${target} ${problem}`);
  }
  return problems;
}

function lastBadgeIndex(readmeLines: string[]): number {
  let index = readmeLines.length - 1;
  while (index >= 0 && !readmeLines[index].startsWith('[![')) index--;
  return index;
}

function checkReadmeOpening(readme: string): string[] {
  const readmeLines = lines(readme);
  const lastBadge = lastBadgeIndex(readmeLines);
  if (lastBadge < 0) return ['README has no badge line'];
  const problems: string[] = [];
  const opening = readmeLines.slice(lastBadge + 1);
  const pitch = opening.find((line) => line.trim() !== '');
  if (pitch === undefined || !pitch.startsWith('inline-email turns HTML and CSS')) {
    problems.push(`README's first line after the badges is not the pitch: ${JSON.stringify(pitch)}`);
  }
  const whenToUse = opening.indexOf('## When to use it');
  const quickstart = opening.indexOf('## Quickstart');
  if (whenToUse < 0 || whenToUse >= README_OPENING_LINES) {
    problems.push(`README "## When to use it" is not within the first ${README_OPENING_LINES} lines after the badges`);
  }
  if (quickstart <= whenToUse) problems.push('README "## Quickstart" does not come after "## When to use it"');
  let linkWindowEnd = README_OPENING_LINES;
  if (whenToUse >= 0) linkWindowEnd = Math.min(whenToUse, README_OPENING_LINES);
  const linkWindow = opening.slice(0, linkWindowEnd).join('\n');
  const linkedPaths = new Set(linkTargets(linkWindow).map((target) => splitAnchor(target).path));
  for (const link of requiredDocLinks) {
    if (!linkedPaths.has(link)) problems.push(`README does not link ${link} before "## When to use it"`);
  }
  return problems;
}

function checkLlms(llms: string): string[] {
  const problems: string[] = [];
  const firstLine = lines(llms)[0];
  if (firstLine !== '# inline-email') {
    problems.push(`llms.txt first line is ${JSON.stringify(firstLine)}, not "# inline-email"`);
  }
  const linked = new Set(linkTargets(llms));
  const docUrls = ['README.md', ...requiredDocLinks].map((path) => repoBlobPrefix + path);
  for (const url of [...docUrls, npmPackageUrl]) {
    if (!linked.has(url)) problems.push(`llms.txt does not link ${url}`);
  }
  return [...problems, ...checkLineLimit('llms.txt', llms, LLMS_MAX_LINES)];
}

const usageFunction = /function usage\(\): string \{\s*return `([\s\S]*?)`;/;

function usageOptions(cliSource: string): string[] {
  const usage = usageFunction.exec(cliSource);
  if (usage === null) return [];
  const sections = usage[1].split('\nOptions:\n');
  if (sections.length < 2) return [];
  return sections[1].split('\n').map((line) => line.replace(/^ {2}/, ''));
}

function referenceCliBlock(reference: string): string[] | undefined {
  const optionsIndex = reference.indexOf('Supported options:\n');
  if (optionsIndex < 0) return undefined;
  const block = fencedBlocks(reference.slice(optionsIndex))[0];
  if (block === undefined) return undefined;
  return lines(block.body);
}

function checkCliBlock(cliSource: string, reference: string): string[] {
  const options = usageOptions(cliSource);
  const hasHtmlOption = options.some((line) => line.startsWith('--html'));
  const hasStrictOption = options.some((line) => line.startsWith('--strict'));
  if (!hasHtmlOption || !hasStrictOption) {
    return ['src/cli.ts usage() options were not found (no --html or --strict line)'];
  }
  const block = referenceCliBlock(reference);
  if (block === undefined) return ['docs/reference.md has no "Supported options:" fenced block'];
  const differingIndex = firstDifferingLine(options, block);
  if (differingIndex === undefined) return [];
  return [
    `docs/reference.md CLI block differs from usage() at line ${differingIndex + 1}: ` +
      `reference has ${JSON.stringify(block[differingIndex])}, usage() has ${JSON.stringify(options[differingIndex])}`
  ];
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

const shellInfo = /^(sh|bash|shell)\b/;
const flagName = /-{1,2}[A-Za-z]+/g;

function shellCommands(markdown: string): ShellCommand[] {
  const commands: ShellCommand[] = [];
  for (const block of fencedBlocks(markdown)) {
    if (!shellInfo.test(block.info)) continue;
    const bodyLines = block.body.split('\n');
    for (let index = 0; index < bodyLines.length; index++) {
      const words = bodyLines[index].trim().split(/\s+/);
      if (words[0] === '' || words[0].startsWith('#')) continue;
      commands.push({ line: block.line + 1 + index, words });
    }
  }
  return commands;
}

function cliFlags(cliSource: string): Set<string> {
  const flags = new Set<string>();
  for (const optionLine of usageOptions(cliSource)) {
    const [flagColumn] = optionLine.split(/\s{2,}/);
    const flagsInColumn = flagColumn.match(flagName);
    if (flagsInColumn === null) continue;
    for (const flag of flagsInColumn) flags.add(flag);
  }
  return flags;
}

function isCliCommand(words: string[]): boolean {
  const [program, firstArgument] = words;
  if (program === 'inline-email') return true;
  if (program === 'npx') return firstArgument === 'inline-email';
  if (program === 'node') return firstArgument === 'dist/cli.js';
  return false;
}

function nodeScriptPath(words: string[]): string | undefined {
  const [program, scriptPath] = words;
  if (program !== 'node' || scriptPath === undefined || !scriptPath.includes('/')) return undefined;
  return scriptPath;
}

function npmScriptName(words: string[]): string | undefined {
  const [program, subcommand, scriptName] = words;
  if (program !== 'npm') return undefined;
  if (subcommand === 'run') return scriptName;
  if (subcommand === 'test') return 'test';
  return undefined;
}

function checkCommands(docName: string, markdown: string, context: CommandContext): string[] {
  const problems: string[] = [];
  for (const { line, words } of shellCommands(markdown)) {
    if (isCliCommand(words)) {
      for (const flag of words.filter((word) => word.startsWith('-'))) {
        if (!context.flags.has(flag)) problems.push(`${docName}:${line}: ${flag} is not a flag in the CLI's usage()`);
      }
    }
    const scriptPath = nodeScriptPath(words);
    if (scriptPath !== undefined && !context.fileExists(scriptPath)) {
      problems.push(`${docName}:${line}: node ${scriptPath} names a file that does not exist`);
    }
    const scriptName = npmScriptName(words);
    if (scriptName !== undefined && !context.scripts.has(scriptName)) {
      problems.push(`${docName}:${line}: npm script ${scriptName} is not in package.json`);
    }
  }
  return problems;
}

const packageJson = JSON.parse(read(packagePath)) as { scripts: Record<string, string> };

const commandContext: CommandContext = {
  flags: cliFlags(read(cliPath)),
  scripts: new Set(Object.keys(packageJson.scripts)),
  // dist/ is build output, so a command naming it is checked against the source file it is built from.
  fileExists: (path) => existsWithExactCase(join(rootDir, path.replace(/^dist\/(.*)\.js$/, 'src/$1.ts')))
};

describe('Guides show real files', () => {
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

  it('the file= check reports an altered block with the file and its first differing line', () => {
    const doc = ['# Doc', '', '```html file=a.html', '<p>one</p>', '<p>TWO</p>', '```', ''].join('\n');
    const files: Record<string, string> = { 'a.html': '<p>one</p>\n<p>two</p>\n' };
    expect(checkFileBlocks('doc.md', doc, (path) => files[path])).toEqual([
      'doc.md:3: block differs from a.html at line 2: doc has "<p>TWO</p>", file has "<p>two</p>"'
    ]);
  });

  it('the file= check ignores a single trailing newline the block does not show', () => {
    const doc = ['```html file=a.html', '<p>one</p>', '```'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n')).toEqual([]);
  });

  it('the file= check reports a file= path that does not exist', () => {
    const doc = ['```js file=examples/guides/nowhere/send.mjs', 'run();', '```'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => undefined)).toEqual([
      'doc.md:1: file=examples/guides/nowhere/send.mjs does not exist'
    ]);
  });

  it('the file= check reads indented and tilde fences, closing only on the same character and at least the same length', () => {
    const doc = ['   ~~~~html file=a.html', '   <p>one</p>', '```', '~~~', '~~~~'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n```\n~~~\n')).toEqual([]);
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n')).toEqual([
      'doc.md:1: block differs from a.html at line 2: doc has "```", file has undefined'
    ]);
  });

  it('the file= check reports a file= fence the parser did not handle', () => {
    const doc = ['    ```html file=a.html', '    <p>one</p>', '    ```'].join('\n');
    expect(checkFileBlocks('doc.md', doc, () => '<p>one</p>\n')).toEqual([
      'doc.md:1: fence with file= was not parsed as a fenced block'
    ]);
  });

  it('the presence check reports a document with no file= block and a README missing a quickstart file', () => {
    expect(checkFileBlockPresence('guide.md', '# Guide\n\n```html\n<p></p>\n```\n')).toEqual(['guide.md has no file= block']);
    const readme = '```html file=examples/guides/quickstart/welcome.html\n<p></p>\n```\n';
    expect(checkFileBlockPresence('README.md', readme, quickstartFiles)).toEqual([
      'README.md does not quote examples/guides/quickstart/send.mjs'
    ]);
  });
});

describe('Documentation links resolve and pages keep their shape', () => {
  it.each([readmePath, ...guidePaths, referencePath, llmsPath, migrationPath].map((path) => [relative(rootDir, path), path]))(
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
  ])('the link check collects %s and reports it when broken', (_form, broken, working, target) => {
    expect(checkLinks(fixturePath, `# Fixture\n\n${working}\n`)).toEqual([]);
    expect(checkLinks(fixturePath, `# Fixture\n\n${broken}\n`)).toEqual([`fixture.md: link ${target} does not resolve to a file`]);
  });

  it('the link check resolves a raw.githubusercontent URL against the working tree and reports a missing file', () => {
    expect(checkLinks(fixturePath, `![s](${repoRawPrefix}docs/assets/feature-roundup.png)\n`)).toEqual([]);
    expect(checkLinks(fixturePath, `![s](${repoRawPrefix}docs/assets/nowhere.png)\n`)).toEqual([
      `fixture.md: link ${repoRawPrefix}docs/assets/nowhere.png does not resolve to a file`
    ]);
  });

  it('the link check ignores links inside fenced code and code spans', () => {
    expect(checkLinks(fixturePath, '# F\n\n`[a](nowhere.md)`\n\n~~~html\n<a href="nowhere.md">a</a>\n~~~\n')).toEqual([]);
  });

  it('the link check reports a link whose case differs from the file name', () => {
    expect(checkLinks(fixturePath, '[m](migration.md)\n')).toEqual(['fixture.md: link migration.md does not resolve to a file']);
  });

  it('the link check reports an anchor into a directory and an anchor with no heading', () => {
    expect(checkLinks(fixturePath, '[t](test/)\n')).toEqual([]);
    expect(checkLinks(fixturePath, '[t](test/#x)\n')).toEqual([
      'fixture.md: link test/#x has an anchor but points at a directory'
    ]);
    expect(checkLinks(fixturePath, '[r](docs/reference.md#nope)\n')).toEqual([
      'fixture.md: link docs/reference.md#nope names an anchor with no matching heading'
    ]);
  });

  it('heading slugs keep underscores and hyphens', () => {
    expect(headingSlug('`snake_case` and kebab-case: Options!')).toBe('snake_case-and-kebab-case-options');
  });

  it(`README is at most ${README_MAX_LINES} lines`, () => {
    expect(checkLineLimit('README.md', read(readmePath), README_MAX_LINES)).toEqual([]);
  });

  it('the line limit check reports a 221-line document', () => {
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

  it('the CLI block check reports missing usage() options, a missing reference block and a drifted line', () => {
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

  it('the llms.txt check reports a wrong H1, a missing link and too many lines', () => {
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

  it('the command check reports an unknown flag, a missing node path and a missing npm script', () => {
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
