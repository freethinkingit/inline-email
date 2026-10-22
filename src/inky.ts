const INKY_PACKAGE = 'inky';

const MISSING_INKY_MESSAGE = "responsive: 'inky' needs the inky package. Install it with npm install inky.";
const BROKEN_INKY_MESSAGE = "responsive: 'inky' could not load the inky package.";
const UNKNOWN_INKY_MESSAGE =
  "responsive: 'inky' supports Inky 1 and Inky 2; the installed inky package exports neither.";
const INKY_2_PARTIAL_MESSAGE =
  'Inky 2 escapes Handlebars partials ({{> name}}); Inky 1 keeps them. Use Inky 1 (npm install inky@1), or inline the partial.';

// Handlebars opens a partial with `{{>` or `{{~>` and a partial block with `{{#>` or `{{~#>`;
// its lexer allows no whitespace inside these openers.
const HANDLEBARS_PARTIAL_PATTERN = /\{\{~?#?>/;

type Inky1Module = { Inky: new () => { releaseTheKraken(html: string): string } };
type Inky2Module = { transform(html: string): string };
type InkyModule = Record<string, unknown> & { default?: unknown };

let inkyModule: Promise<InkyModule> | undefined;

/**
 * Renders Inky markup to table HTML with the Inky the caller installed, version 1 or 2.
 *
 * @param html - The HTML with Inky markup.
 * @returns The table HTML the installed Inky produces.
 * @rejects When the `inky` package is not installed or fails to load, when it exports neither
 * Inky 1's `Inky` class nor Inky 2's `transform`, when Inky 2 is installed and the HTML contains a
 * Handlebars partial (`{{>`, `{{~>`, `{{#>` or `{{~#>`), or with Inky's own error when Inky throws.
 */
export async function renderInky(html: string): Promise<string> {
  const inky = await loadInky();
  // Inky 1 never exports `transform`, so a module that has it is Inky 2 even if it also has `Inky`.
  const inky2 = findExport(inky, isInky2);

  if (inky2 !== undefined) {
    if (HANDLEBARS_PARTIAL_PATTERN.test(html)) {
      throw new Error(INKY_2_PARTIAL_MESSAGE);
    }

    return inky2.transform(html);
  }

  const inky1 = findExport(inky, isInky1);

  if (inky1 === undefined) {
    throw new Error(UNKNOWN_INKY_MESSAGE);
  }

  return new inky1.Inky().releaseTheKraken(html);
}

function loadInky(): Promise<InkyModule> {
  inkyModule ??= (import(INKY_PACKAGE) as Promise<InkyModule>).catch((error: unknown) => {
    // Forget the failure so an install made later in the same process is picked up.
    inkyModule = undefined;
    const message = isModuleNotFound(error) ? MISSING_INKY_MESSAGE : BROKEN_INKY_MESSAGE;
    throw new Error(message, { cause: error });
  });

  return inkyModule;
}

function isModuleNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null | undefined)?.code === 'ERR_MODULE_NOT_FOUND';
}

function findExport<T>(inky: InkyModule, matches: (value: unknown) => value is T): T | undefined {
  return [inky, inky.default].find(matches);
}

function isInky1(value: unknown): value is Inky1Module {
  return typeof (value as Partial<Inky1Module> | null | undefined)?.Inky === 'function';
}

function isInky2(value: unknown): value is Inky2Module {
  return typeof (value as Partial<Inky2Module> | null | undefined)?.transform === 'function';
}
