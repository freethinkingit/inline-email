#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { compileEmailTemplate } from './compile';

interface CliOptions {
  html?: string;
  css: string[];
  out?: string;
  noInlineImages: boolean;
  force: boolean;
  help: boolean;
}

export async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);

  if (options.help) {
    console.log(usage());
    return;
  }

  if (!options.html) {
    throw new CliError('An HTML file is required.');
  }

  assertReadable(options.html, 'HTML file path references a file that does not exist.');
  options.css.forEach((file) => assertReadable(file, 'CSS file path references a file that does not exist.'));

  if (options.out && existsSync(options.out) && !options.force) {
    throw new CliError('Out file path already exists. Use --force or -f to overwrite it.');
  }

  const html = readFileSync(options.html, 'utf8');
  const css = options.css.map((file) => readFileSync(file, 'utf8')).join('\n');
  const compiled = await compileEmailTemplate({
    html,
    css,
    juice: {
      webResources: {
        images: !options.noInlineImages
      }
    }
  });

  const output = compiled.html;

  if (options.out) {
    writeFileSync(options.out, output, 'utf8');
    return;
  }

  console.log(output);
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    css: [],
    noInlineImages: false,
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
      case '--css':
        index = readCssValues(argv, index, options);
        break;
      case '--out':
      case '-o':
        options.out = readValue(argv, index, arg);
        index += 1;
        break;
      case '--noInlineImages':
        options.noInlineImages = true;
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
    options.html = options.css.pop();
  }

  return options;
}

function readCssValues(argv: string[], index: number, options: CliOptions): number {
  let cursor = index + 1;

  if (!argv[cursor] || argv[cursor].startsWith('-')) {
    throw new CliError('--css requires at least one file.');
  }

  while (argv[cursor] && !argv[cursor].startsWith('-')) {
    options.css.push(argv[cursor]);
    cursor += 1;
  }

  return cursor - 1;
}

function readValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith('-')) {
    throw new CliError(`${option} requires a value.`);
  }

  return value;
}

function assertReadable(path: string, message: string): void {
  if (!existsSync(path)) {
    throw new CliError(message);
  }
}

function usage(): string {
  return `Inline Email

Usage:
  inline-email input.html
  inline-email input.html --out output.html
  inline-email --css style.css input.html

Options:
  --html <file>          Input HTML file. A positional input file is also supported.
  --css <files...>       CSS files to inline.
  --out, -o <file>       Write output to a file instead of stdout.
  --noInlineImages       Disable image web resource inlining.
  --force, -f            Overwrite the output file.
  --help, -h             Show this help text.`;
}

class CliError extends Error {}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error('\x1b[31m%s\x1b[0m', error.message);
    console.error(usage());
    process.exit(1);
  });
}
