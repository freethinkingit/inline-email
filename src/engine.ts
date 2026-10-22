import Handlebars from 'handlebars';
import type { EngineOptions, EscapeMode, RenderData, RenderTemplateOptions } from './types.js';

const SLOT_PREFIX = 'slot:';
const RESERVED_ENGINE_OPTIONS = new Set(['helpers', 'partials', 'compat', 'noEscape', 'strict']);
const SLOT_HELPER = 'lookup';

export type CompiledTemplateFn = (data: RenderData) => string;

/**
 * Resolves the `escape` option to the escape mode a template compiles with.
 *
 * @param value - The `escape` option: `'html'`, `'none'`, `true`, `false` or left out.
 * @returns `'html'` for `'html'`, `true` or a left-out option, and `'none'` for `'none'` or `false`.
 * @throws When the value is none of those.
 */
export function normalizeEscapeMode(value: EscapeMode | boolean | undefined): EscapeMode {
  if (value === undefined || value === true) {
    return 'html';
  }

  if (value === false) {
    return 'none';
  }

  if (value === 'html' || value === 'none') {
    return value;
  }

  throw new Error(`Invalid escape option ${String(value)}. Expected one of 'html', 'none', true or false.`);
}

class SlotRewriter extends Handlebars.Visitor {
  override MustacheStatement(node: hbs.AST.MustacheStatement): void {
    const slotName = slotNameOf(node);

    if (slotName !== undefined) {
      const location = node.path.loc;

      node.path = {
        type: 'PathExpression',
        data: false,
        depth: 0,
        parts: [SLOT_HELPER],
        original: SLOT_HELPER,
        loc: location
      } as hbs.AST.PathExpression;
      node.params = [
        {
          type: 'PathExpression',
          data: true,
          depth: 0,
          parts: ['root', 'slots'],
          original: '@root.slots',
          loc: location
        } as hbs.AST.PathExpression,
        { type: 'StringLiteral', value: slotName, original: slotName, loc: location } as hbs.AST.StringLiteral
      ];
      node.escaped = false;
    }

    super.MustacheStatement(node);
  }
}

function slotNameOf(node: hbs.AST.MustacheStatement): string | undefined {
  if (node.params.length > 0 || node.hash || node.path.type !== 'PathExpression') {
    return undefined;
  }

  const { original } = node.path as hbs.AST.PathExpression;

  // `original` keeps the full dotted text, so `slot:a.b` yields the slot name `a.b` even though parts splits it.
  return original.startsWith(SLOT_PREFIX) ? original.slice(SLOT_PREFIX.length) : undefined;
}

/**
 * Compiles a template with an isolated Handlebars instance.
 *
 * `{{slot:name}}` is inserted raw from the root `slots` through Handlebars' built-in `lookup`
 * helper, variables are escaped with Handlebars' own escaping unless `escape` is `none`, and
 * the `handlebars` options are passed to Handlebars except `helpers`, `partials` and the
 * reserved `compat`, `noEscape` and `strict` fields and the `lookup` helper, which this module
 * sets itself. With `strict` on, the template compiles in Handlebars' strict mode without
 * enclosing-context lookup.
 *
 * @param source - The template text.
 * @param options - The escape mode, strict mode and Handlebars options to compile with.
 * @returns A function that renders the template with the data it is given.
 * @throws When the escape option is invalid, or the template or a partial is malformed.
 * The returned function throws Handlebars' `"name" not defined` error when `strict` is on and
 * a reference or bare block names a missing field, and `Strict render failed: ...` with the
 * original `TypeError` as `cause` when Handlebars or a helper throws one, which a dotted path
 * through a missing or null object does.
 */
export function compileTemplate(source: string, options: RenderTemplateOptions = {}): CompiledTemplateFn {
  const escapeMode = normalizeEscapeMode(options.escape);
  const engineOptions = options.handlebars ?? {};
  const strict = options.strict === true;
  const isolatedHandlebars = Handlebars.create();
  const builtInLookup = isolatedHandlebars.helpers[SLOT_HELPER];

  isolatedHandlebars.registerHelper(engineOptions.helpers ?? {});
  isolatedHandlebars.registerHelper(SLOT_HELPER, builtInLookup);

  const compileOptions: CompileOptions = {
    ...unreservedEngineOptions(engineOptions),
    compat: !strict,
    strict,
    noEscape: escapeMode === 'none'
  };
  const compile = (text: string) => compileThroughPipeline(isolatedHandlebars, text, compileOptions);

  // A string partial would be compiled lazily by Handlebars and skip the slot rewrite.
  for (const [name, partial] of Object.entries(engineOptions.partials ?? {})) {
    isolatedHandlebars.registerPartial(name, compile(partial));
  }

  const template = compile(source);

  return (data) => {
    const root = renderRootOf(data);

    if (!strict) {
      return template(root);
    }

    try {
      return template(root);
    } catch (error) {
      throw describeStrictFailure(error);
    }
  };
}

function unreservedEngineOptions(engineOptions: EngineOptions): Record<string, unknown> {
  const unreserved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(engineOptions)) {
    if (!RESERVED_ENGINE_OPTIONS.has(key)) {
      unreserved[key] = value;
    }
  }

  return unreserved;
}

// Callers outside TypeScript can pass null or no data; both render as empty data.
function renderRootOf(data: RenderData | null | undefined): RenderData {
  if (data === null || data === undefined) {
    return { slots: {} };
  }

  return { ...data, slots: data.slots ?? {} };
}

// Handlebars' strict lookup reads through a missing or null object with a plain property access,
// and a helper given a missing value fails the same way, so the hint names both.
function describeStrictFailure(error: unknown): unknown {
  if (!(error instanceof TypeError)) {
    return error;
  }

  return new Error(
    `Strict render failed: ${error.message}. Either a dotted path crossed a field that is missing or null, or a helper received a value it did not expect; the original error is attached as cause.`,
    { cause: error }
  );
}

function compileThroughPipeline(
  handlebars: typeof Handlebars,
  source: string,
  compileOptions: CompileOptions
): HandlebarsTemplateDelegate {
  const ast = Handlebars.parse(source);

  new SlotRewriter().accept(ast);
  // compile defers code generation to the first render; precompile surfaces compiler faults now.
  handlebars.precompile(ast, compileOptions);

  return handlebars.compile(ast, compileOptions);
}
