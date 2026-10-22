#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileEmailTemplate } from './compile.js';
import type { EmailRenderContext, RenderData } from './types.js';

interface CliOptions {
  html?: string;
  css: string[];
  out?: string;
  data?: string;
  strict: boolean;
  inlineImages: boolean;
  deprecatedFlag: boolean;
  force: boolean;
  help: boolean;
}

/**
 * Runs the `inline-email` command: inlines the CSS into the HTML file and, with `--data`,
 * renders the result, then writes it to `--out` or prints it to stdout.
 *
 * @param argv - The command-line arguments after the Node and script paths.
 * @returns Resolves once the output is written or printed, or the help text is printed.
 * @rejects With a `CliError` when the arguments are invalid, an input file is missing, the out file
 * exists without `--force`, or the data file cannot be read as a JSON object; compile and render errors
 * pass through unchanged.
 */
export async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);

  if (options.deprecatedFlag) {
    console.error('--noInlineImages is deprecated and has no effect: images are no longer inlined by default. Use --inlineImages to inline them.');
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  if (!options.html) {
    throw new CliError('An HTML file is required.');
  }

  assertReadable(options.html, 'HTML file path references a file that does not exist.');
  options.css.forEach((file) => assertReadable(file, 'CSS file path references a file that does not exist.'));

  if (options.data) {
    assertReadable(options.data, `Data file ${options.data} does not exist.`);
  }

  if (options.out && existsSync(options.out) && !options.force) {
    throw new CliError('Out file path already exists. Use --force or -f to overwrite it.');
  }

  const html = readFileSync(options.html, 'utf8');
  const css = options.css.map((file) => readFileSync(file, 'utf8')).join('\n');
  const compiled = await compileEmailTemplate({
    html,
    css,
    strict: options.strict,
    juice: {
      webResources: {
        images: options.inlineImages,
        relativeTo: dirname(resolve(options.html))
      }
    }
  });

  let output = compiled.html;

  if (options.data) {
    const data = readData(options.data);
    output = compiled.render(data).html;
  }

  if (options.out) {
    writeFileSync(options.out, output, 'utf8');
    return;
  }

  console.log(output);
}

/**
 * Parses the command-line arguments into CLI options without touching the file system.
 *
 * @param argv - The command-line arguments after the Node and script paths.
 * @returns The options, with the first positional argument as the HTML file and the rest as CSS
 * files; when only `--css` lists files, the last of two or more is taken as the HTML file.
 * @throws A `CliError` for an unknown option or an option missing its value.
 */
export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    css: [],
    strict: false,
    inlineImages: false,
    deprecatedFlag: false,
    force: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--html':
        options.html = readValue(argv, index, arg);
        index += 1;
        break;
      case '--css': {
        const cssFiles = readCssValues(argv, index);
        options.css.push(...cssFiles);
        index += cssFiles.length;
        break;
      }
      case '--out':
      case '-o':
        options.out = readValue(argv, index, arg);
        index += 1;
        break;
      case '--data':
        options.data = readValue(argv, index, arg);
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--inlineImages':
        options.inlineImages = true;
        break;
      case '--noInlineImages':
        options.deprecatedFlag = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new CliError(`Unknown option: ${arg}`);
        }

        if (!options.html) {
          options.html = arg;
        } else {
          options.css.push(arg);
        }
    }
  }

  if (!options.html && options.css.length > 1) {
    // `--css` takes every argument up to the next option, so in `--css base.css input.html` the HTML file arrives last.
    const lastIndex = options.css.length - 1;
    options.html = options.css[lastIndex];
    options.css = options.css.slice(0, lastIndex);
  }

  return options;
}

function readCssValues(argv: string[], index: number): string[] {
  const cssFiles: string[] = [];

  for (let cursor = index + 1; isOptionValue(argv[cursor]); cursor += 1) {
    cssFiles.push(argv[cursor]);
  }

  if (cssFiles.length === 0) {
    throw new CliError('--css requires at least one file.');
  }

  return cssFiles;
}

function isOptionValue(arg: string | undefined): arg is string {
  if (arg === undefined || arg === '') {
    return false;
  }

  return !arg.startsWith('-');
}

function readValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];

  if (!isOptionValue(value)) {
    throw new CliError(`${option} requires a value.`);
  }

  return value;
}

function assertReadable(path: string, message: string): void {
  if (!existsSync(path)) {
    throw new CliError(message);
  }
}

function readData(path: string): RenderData | EmailRenderContext {
  let parsed: unknown;

  try {
    const text = readFileSync(path, 'utf8');
    // Some editors save JSON with a leading byte order mark, which JSON.parse rejects.
    const textWithoutByteOrderMark = text.replace(/^\uFEFF/, '');
    parsed = JSON.parse(textWithoutByteOrderMark);
  } catch (error) {
    throw new CliError(`Data file ${path} could not be read as JSON: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError(`Data file ${path} must contain a JSON object.`);
  }

  return parsed as RenderData | EmailRenderContext;
}

function usage(): string {
  return `Inline Email

Usage:
  inline-email input.html
  inline-email input.html --out output.html
  inline-email --css style.css input.html

Options:
  --html <file>          Input HTML file. A positional input file is also supported.
  --css <files...>       CSS files to inline. The HTML's <style> blocks are then left in place, unless the files hold only whitespace; without CSS, they are inlined instead.
  --out, -o <file>       Write output to a file instead of stdout.
  --inlineImages         Embed referenced images as data URIs. Off by default.
  --noInlineImages       Deprecated and ignored; images are no longer inlined by default.
  --data <file>          Render the template with this JSON file and write the rendered HTML.
  --strict               With --data, fail on a field the template names but the data does not define.
  --force, -f            Overwrite the output file.
  --help, -h             Show this help text.`;
}

class CliError extends Error {}

// npm starts the CLI through a symlinked bin entry, while import.meta.url is always the resolved file.
/* v8 ignore next -- runs only when Node starts this file as its own process, which in-process tests cannot reach */
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error('\x1b[31m%s\x1b[0m', error.message);
    console.error(usage());
    process.exit(1);
  });
}
