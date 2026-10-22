# Migrating to v4

inline-email 4.x renders templates with [Handlebars](https://handlebarsjs.com/).
Everything Handlebars documents applies to your templates.
If your `package.json` names inline-email 3.x, follow [Upgrading from 3.x](#upgrading-from-3x).
It lists each place where 4.x behaves differently from 3.x, with a before and after example.
Most 3.x templates render the same without changes.
[AI prompt for 3.x templates](#ai-prompt-for-3x-templates) is a prompt you can paste into an AI assistant together with your 3.x templates to convert them.

If your `package.json` names inline-email 2.x or an older version, follow [Upgrading from 2.x](#upgrading-from-2x).
2.x was often installed globally with `npm install -g inline-email`, which leaves no entry in `package.json`; `npm ls -g inline-email` prints the version of a global install.
[AI prompt for 2.x code](#ai-prompt-for-2x-code) is a prompt you can paste into an AI assistant together with your code and the HTML it reads to convert them.

## AI prompt for 3.x templates

Copy the block below into an AI assistant, then paste your 3.x templates after it, each with sample data it renders with.

```text
I am upgrading inline-email from 3.x to 4.0. Below are my templates and,
for each, sample data it renders with. Convert the templates.

4.0 renders with Handlebars, and everything Handlebars documents applies.
3.x printed any tag it did not recognise as text.

Apply these rules:

1. A bare block {{#name}}...{{/name}} now renders when name is 0 or "".
   If the sample data shows name is a number or a string, use
   {{#if name}}...{{else}}...{{/if}} or {{#unless name}}...{{/unless}}.
   Leave blocks over arrays, objects and booleans alone. When you cannot
   tell a name's type, leave the block alone and list it as a question.
2. A block tag alone on its line is now removed with its line. Change
   nothing for this unless the output must match a stored copy exactly.
3. Every {{#name}} needs a matching {{/name}}. Report an unclosed block or
   a stray close tag; 4.0 throws on both.
4. Remove a space between {{ and #, / or ^, as in {{ #items}}. Remove a
   space between slot: and its name, as in {{slot: x}}. Write a numeric
   path segment in brackets: {{items.[0]}}, not {{items.0}}. Report any
   tag with a space inside a name, such as {{first name}}.
5. A data key named log, lookup, if, unless, each, with, helperMissing or
   blockHelperMissing now resolves as a Handlebars helper. Recommend
   renaming the key. Otherwise use {{this.log}} at the key's own level and
   {{../log}} or {{@root.log}} from inside a block.
6. A variable holding an object now prints [object Object], and one
   holding an array prints its items joined with commas. Report each.
7. {{{name}}} was escaped inside literal braces in 3.x and is inserted raw
   in 4.0. Flag every triple-brace reference as a possible HTML injection
   and ask whether its value is trusted.
8. Syntax 3.x printed as text now runs: {{> name}}, {{! comment }},
   {{else}} and \{{. Report each occurrence and ask whether it was meant
   literally.
9. If the template is used with strict: true, write {{slot:x}}, not
   {{{slots.x}}}, and inside a block reach an enclosing context's field
   with ../name or @root.name.
10. HTML passed through a slot can stay a slot. A helper that returns HTML
    must return new Handlebars.SafeString(html) and escape any data inside
    it with Handlebars.escapeExpression.

Leave a template that already works under these rules unchanged.
Do not reformat, rename or restyle anything else.
Return each converted template in full. After each one, list every change
you made with the rule number and a one-line reason, then your questions.
```

## AI prompt for 2.x code

Copy the block below into an AI assistant.
Then paste after it every CLI call from your scripts and every file that requires `inline-email` or `inline-email/lib/render`.
Paste too each HTML file those calls read.

```text
I am upgrading inline-email from 2.x to 4.x. Below are every CLI call from
my scripts, every file that requires inline-email or
inline-email/lib/render, and the HTML files they read. Convert the calls
and the code. If a rule needs HTML I did not give you, ask for it.

2.x was a CommonJS command-line tool that inlined CSS with juice and could
preprocess Inky markup. 4.x is an ES module library with a CLI on top.

Apply these rules:

1. 4.x needs Node.js 22 or later and is an ES module. Replace
   require('inline-email/lib/render') with
   import { inlineEmailHtml } from 'inline-email'. A file that uses import
   must be an ES module: a .mjs file, or "type": "module" in package.json.
   Report that change rather than make it. Only an ES module can use
   top-level await. A CommonJS file that cannot move to import loads the
   package with import('inline-email').then(...). require('inline-email')
   ran the CLI in 2.x and now fails; report each.
2. render(html, css, options) becomes inlineEmailHtml(html, css, options),
   which also returns a promise of the inlined HTML. Its options are
   responsive, transform and juice. Drop the inky option (rule 3) and
   juice.linkCss (rule 5). A call with no options ran Inky in 2.x; treat
   its HTML under rule 3. A call with no CSS and linkCss off now inlines
   the HTML's <style> blocks, where 2.x left them in place; list each as a
   question. Use inlineEmailHtml, not compileEmailTemplate or renderEmail,
   which also read the HTML as a template (rule 7).
3. 4.x has no built-in Inky step; Inky runs in a transform instead.
   Remove --inky and -i from CLI calls; 4.x rejects both. Before you touch
   Inky markup, ask whether I want to keep writing Inky or move to 4.x's
   built-in layout tags. To keep Inky, keep the markup and add the stable
   Inky 1 transform: npm install inky@1, add import { Inky } from 'inky',
   set responsive: false, and pass
   transform: (source) => new Inky(settings).releaseTheKraken(source),
   where settings are the call's 2.x options.inky, if any. The CLI has no
   transform option, so a CLI call that used --inky needs a short script.
   To move to built-in tags, list each Inky tag, such as <row>, with its
   nearest 4.x layout tag from rule 4, and ask before replacing it. Inky
   tags named like layout tags, such as <container>, <columns>, <button>
   and <spacer>, render as 4.x layout tags without a transform, not as
   Inky rendered them. Inky 2 is in beta; mention it only as an option I
   can choose, never as a required step.
4. 4.x turns tags named email, preview, container, section, columns,
   column, button, spacer, divider, image, hero-image, otp, alert, panel,
   brand or footer into a table layout with a <style> block of ie-* media
   rules, in the CLI and the library. Plain <section>, <footer> and
   <button> are among them. In the library, add responsive: false where
   such HTML must pass through unchanged. The CLI has no switch; for a CLI
   call whose HTML holds such a tag, offer a short script that calls
   inlineEmailHtml with responsive: false.
5. Without --css, the 2.x CLI read each <link rel="stylesheet"> file,
   inlined its styles and removed the <link> tag; the 4.x CLI reads no
   linked files. Pass each linked stylesheet with --css, and remove its
   <link rel="stylesheet"> tag from the HTML. --css reads local files only,
   so a link to an http or https URL needs its file downloaded first. The
   4.x CLI cannot embed <script src> files or SVG <use> references, as 2.x
   did in that mode; where the HTML has them, offer a short script that
   calls inlineEmailHtml with juice.webResources.scripts or svgs set to
   true. In the library, remove linkCss and add links: true inside
   juice.webResources, merged with the keys already there. Keep the call's
   own webResources.relativeTo; without one, add relativeTo: '.', since 2.x
   read links relative to the current directory. Add scripts: true or
   svgs: true the same way where the code relied on 2.x embedding
   <script src> files or SVG <use> references. 2.x ignored the css
   argument when linkCss was true; 4.x inlines it and leaves the linked
   rules in a <style> block, not inlined. Report each such call that
   passes CSS.
6. 4.x embeds images only when asked. Add --inlineImages to a CLI call
   that ran without --css and without --noInlineImages. Remove
   --noInlineImages, which does nothing in 4.x. 4.x reads images relative
   to the HTML file's folder, and 2.x read them relative to the current
   directory; ask about each call whose HTML file is not in the current
   directory and has relative image paths. In the library, where
   juice.linkCss was true and juice.webResources.images was not false,
   add images inside juice.webResources, merged with the keys already
   there: keep the value the call set, or else use images: 8, the 2.x
   cap of 8 KB.
7. 4.x compiles the HTML as a Handlebars template, and the CLI fails on
   any {{ it cannot parse, such as {{ name | upcase }}. Treat any {{ in
   the HTML as a question and ask whether it is meant as text. The CLI
   cannot pass such braces through; the nearest alternative is
   inlineEmailHtml in the library, which does not read braces.
8. With --css, 4.x inlines only the given files and leaves the HTML's
   <style> blocks in place, not inlined, as 2.x did. Without --css, both
   CLIs inline and remove them. So a call that gains --css under rule 5
   changes how its <style> blocks are handled: report each such call whose
   HTML has a <style> block, and offer to move those rules into a CSS file
   passed with --css. If every --css file holds only whitespace, 4.x
   inlines the <style> blocks instead; report such a call.

Leave a call or file that already works under these rules unchanged.
Do not reformat, rename or restyle anything else.
Return each converted file in full, and each converted CLI call as a line,
or the whole script it came from when you were given it. After each one,
list every change you made with the rule number and a one-line reason,
then your questions.
```

## Upgrading from 3.x

### The engine

3.x used its own small renderer.
It understood variables, blocks and slots, and printed any other tag as plain text.
4.0 compiles every template with Handlebars, so Handlebars syntax now works:

- `{{#if}}`, `{{else}}` and `{{#unless}}` for conditions
- `{{#each}}` with `@index`, `@first` and `@last`
- `{{#with}}` to change the context
- `{{../name}}` and `{{@root.name}}` to reach an enclosing context
- `{{! comment }}` for comments that do not reach the output
- `{{~name~}}` to trim whitespace around a tag
- `\{{name}}` to print literal braces
- `{{{name}}}` to insert a value without escaping

Template:

```handlebars
{{! internal note }}<p>{{#each items}}{{@index}}:{{this}} {{/each}}</p>
```

Before, with `{ items: ['a', 'b'] }`:

```html
{{! internal note }}<p>{{#each items}}{{@index}}: {{/each}}</p>
```

After:

```html
<p>0:a 1:b </p>
```

Triple braces changed too.
3.x read `{{{name}}}` as a variable inside a pair of literal braces.
4.0 inserts the value raw, as Handlebars does.

Before, with `{ name: '<b>' }`:

```html
{&lt;b&gt;}
```

After:

```html
<b>
```

### Escape modes

The `escape` option now takes a name: `'html'` or `'none'`.
`'html'` is the default.
The 3.x booleans still work: `true` means `'html'` and `false` means `'none'`.
Any other value throws an error that names the accepted values.

Before:

```ts
renderTemplate('Hi {{name}}', { name: "O'Brien" }, { escape: false });
```

After:

```ts
renderTemplate('Hi {{name}}', { name: "O'Brien" }, { escape: 'none' });
```

Both return `Hi O'Brien`.

`compileEmailTemplate` takes the same `escape` option for the HTML part.
The subject and text are rendered unescaped, as they have been since 3.0.2.

### Handlebars' entity set

In `'html'` mode, 4.0 escapes with Handlebars' own function.
It escapes seven characters: `&`, `<`, `>`, `"`, `'`, `=` and the backtick.
The apostrophe is now `&#x27;` instead of `&#39;`.
The `=` sign and the backtick are now escaped; 3.x left them alone.
Email clients show both forms the same way.
Only tests that compare the exact HTML need updating.

Template:

```handlebars
<p>{{name}}</p>
```

Data:

```ts
{ name: "O'Brien = `x`" }
```

Before:

```html
<p>O&#39;Brien = `x`</p>
```

After:

```html
<p>O&#x27;Brien &#x3D; &#x60;x&#x60;</p>
```

### Strict mode

`strict: true` is new.
It makes a reference to a missing field throw instead of rendering an empty string.
It is Handlebars' own `strict` compile option.
It works on `renderTemplate` and `compileEmailTemplate`.
With `compileEmailTemplate`, the error is thrown by `render`.

Before, 3.x had no strict mode, and a typo rendered nothing:

```ts
renderTemplate('Hi {{firstNmae}}', { firstName: 'Dan' });
```

```html
Hi 
```

After:

```ts
renderTemplate('Hi {{firstNmae}}', { firstName: 'Dan' }, { strict: true });
```

This throws:

```text
"firstNmae" not defined in [object Object] - 1:5
```

Rules under strict mode:

- A field that is present with the value `null` renders empty.
- Names passed to a helper, including `{{#if}}` and `{{#each}}`, are not checked.
- For a missing object in a path, such as `{{custmer.name}}`, Handlebars names the last segment: `"name" not defined`.
- A path three segments deep through a missing object, such as `{{a.b.c}}`, throws `Strict render failed: Cannot read properties of undefined (reading 'b')`, with a hint that either a dotted path crossed a missing or null field or a helper received a value it did not expect; the original `TypeError` is its `cause`.
- A block does not fall through to the enclosing context. Use `../name` or `@root.name`.
- `{{{slots.x}}}` is checked like any other variable. Use `{{slot:x}}`, which never throws.

Without strict mode, a name inside a block still falls through to the enclosing context, as it did in 3.x.

Before (works in 3.x and in 4.0 without strict mode):

```handlebars
{{#items}}{{label}} for {{owner}}{{/items}}
```

After (works in 4.0 with strict mode):

```handlebars
{{#items}}{{label}} for {{../owner}}{{/items}}
```

With `{ owner: 'Dan', items: [{ label: 'One' }] }`, both render `One for Dan`.
The first form throws `"owner" not defined` under strict mode.

### Null fields in a row fall through

Without strict mode, Handlebars looks outward for a name the current row does not define.
It treats a field present with the value `null` as missing and keeps looking.
3.x stopped at the row and rendered the `null` field empty.

Template:

```handlebars
{{#items}}[{{name}}]{{/items}}
```

With `{ name: 'ROOT', items: [{ name: null }] }`, before:

```html
[]
```

After:

```html
[ROOT]
```

Blocks behave the same way.
`{{#items}}[{{#flag}}F{{/flag}}]{{/items}}` with `{ flag: true, items: [{ flag: null }] }` rendered `[]` in 3.x and renders `[F]` in 4.0.

Do not give a root field the same name as a row field that can be `null`.
Or render with `strict: true`, where the lookup does not fall through: both examples render `[]`.

### Inverted blocks

`{{^name}}...{{/name}}` now renders exactly when `{{#name}}...{{/name}}` would render nothing.
3.x printed it as text.

Template:

```handlebars
{{^items}}No items{{/items}}
```

With `{ items: [] }`, before:

```html
{{^items}}No items{{/items}}
```

After:

```html
No items
```

### Bare blocks over `0` and `""`

A bare block, `{{#name}}...{{/name}}`, now follows Handlebars.
It skips only `false`, `null`, `undefined` and an empty array.
It renders for `0` and for an empty string.
3.x skipped those too.

Use `{{#if}}` and `{{#unless}}` for conditions on numbers and strings.

Before:

```handlebars
{{#count}}{{count}} new messages{{/count}}
```

With `{ count: 0 }`, 3.x rendered nothing.
4.0 renders `0 new messages`.

After:

```handlebars
{{#if count}}{{count}} new messages{{else}}No new messages{{/if}}
```

With `{ count: 0 }`, this renders `No new messages`.
With `{ count: 2 }`, it renders `2 new messages`.
`{{#unless count}}No new messages{{/unless}}` renders the empty case on its own.

### Malformed templates throw

3.x printed an unclosed block or a stray close tag as text.
4.0 throws at compile time.
The error gives the line of the fault and a marker at its position.
`renderTemplate` throws, and the promise from `compileEmailTemplate` rejects.

Template:

```handlebars
<p>{{#items}}{{name}}</p>
```

Before, with `{ items: [{ name: 'A' }] }`:

```html
<p>{{#items}}</p>
```

After, this throws:

```text
Parse error on line 1:
...#items}}{{name}}</p>
-----------------------^
Expecting 'OPEN_INVERSE_CHAIN', 'INVERSE', 'OPEN_ENDBLOCK', got 'EOF'
```

Close every block, or remove the stray tag.

### Standalone-tag whitespace

A block tag alone on its line is now removed together with its line, as Handlebars does.
3.x left the indentation and the line break in the output.
The HTML means the same; only exact-string comparisons change.

Template:

```handlebars
<ul>
  {{#items}}
  <li>{{label}}</li>
  {{/items}}
</ul>
```

With `{ items: [{ label: 'One' }] }`, before:

```html
<ul>
  
  <li>One</li>
  
</ul>
```

After:

```html
<ul>
  <li>One</li>
</ul>
```

### Whitespace inside tags

Handlebars reads a space inside a tag as a separator.
3.x printed a tag it did not recognise as text.
4.0 parses it, which usually fails.

`{{ name }}`, `{{# items }}`, `{{^ items}}`, `{{/ items }}` and `{{ slot:footer }}` work.
These now throw:

| Template | 3.x output | 4.0 |
| --- | --- | --- |
| `{{ #items}}x{{ /items}}` | the tags as text | parse error |
| `{{first name}}` | the tag as text | treated as a call to a helper named `first`, which fails |
| `{{slot: footer}}` | the tag as text | `Missing helper: "slot:"` |

Put `#`, `/` and `^` directly after `{{`.
A space after the sigil is fine.
Put `slot:` directly against the slot name.
Do not put spaces inside a name.

Before:

```handlebars
{{ #items}}{{slot: badge}}{{ /items}}
```

After:

```handlebars
{{# items}}{{slot:badge}}{{/ items}}
```

A numeric path segment now needs square brackets.
`{{items.0}}` rendered empty in 3.x and is a parse error in 4.0.
Write `{{items.[0]}}`.

### Object values

A variable whose value is an object now renders `[object Object]`.
A variable whose value is an array now renders its items joined with commas: `{ tags: ['x', 'y'] }` gives `x,y` for `{{tags}}`.
3.x rendered an empty string for both.

Template:

```handlebars
<p>{{user}}</p>
```

With `{ user: { name: 'Dan' } }`, before:

```html
<p></p>
```

After:

```html
<p>[object Object]</p>
```

Reference the field you want instead, such as `{{user.name}}`, or loop over the array with `{{#each tags}}`.

`{{.}}` inside a bare block over a single value changed too.
Over a string, `{{.}}` is now the string: `{{#s}}[{{.}}]{{/s}}` with `{ s: 'str' }` renders `[str]`, where 3.x rendered `[]`.
Over `true`, the context stays the enclosing object, so `{{.}}` renders `[object Object]`.

### Engine options

`renderTemplate` and `compileEmailTemplate` take a new `handlebars` option.
It holds `helpers`, `partials` and any other Handlebars compile option.
Each compile gets its own Handlebars instance, so helpers and partials do not leak between templates.

```ts
compileEmailTemplate({
  html: '<p>{{shout name}}</p>',
  handlebars: {
    helpers: { shout: (text: string) => text.toUpperCase() },
    knownHelpersOnly: true,
    knownHelpers: { shout: true }
  }
});
```

`knownHelpersOnly` needs a `knownHelpers` entry for each helper the template uses.
Without the entry, `renderTemplate` throws and the promise from `compileEmailTemplate` rejects with `You specified knownHelpersOnly, but used the unknown helper shout - 1:3`.

#### Reserved fields

The library sets `compat`, `noEscape` and `strict` itself.
If you pass them under `handlebars`, the library's value wins and no error is thrown.
Use the `escape` and `strict` options instead.

A helper named `lookup` is replaced by Handlebars' built-in `lookup`, because `{{slot:name}}` relies on it.

### Helpers that return HTML

3.x had no helpers.
HTML built in code went into a slot.
That still works.

Before:

```ts
const name = 'Dan';

renderTemplate('<p>{{slot:greeting}}</p>', { slots: { greeting: `<b>${name}</b>` } });
```

In 4.0 a helper can build the HTML.
A helper's result is escaped in `'html'` mode, like any variable.
To insert HTML, return a Handlebars `SafeString`, as Handlebars documents.
Escape any data you put inside it with `Handlebars.escapeExpression`.

After:

```ts
import Handlebars from 'handlebars';

renderTemplate('<p>{{bold name}}</p>', { name: 'Dan' }, {
  handlebars: {
    helpers: {
      bold: (text: string) => new Handlebars.SafeString(`<b>${Handlebars.escapeExpression(text)}</b>`)
    }
  }
});
```

Both return `<p><b>Dan</b></p>`.
If `bold` returned a plain string, the output would be `<p>&lt;b&gt;Dan&lt;/b&gt;</p>`.

To import `handlebars`, list it in your own app's dependencies.
inline-email depends on it, but your app cannot rely on that for its own imports.

HTML that a helper returns is inserted at render time.
That is after the layout tags are expanded and the CSS is inlined, so the HTML gets neither.
Markup that needs the email's CSS belongs in the template itself, or in a slot filled with HTML that is already styled.

### Partials

3.x printed `{{> name}}` as text.
4.0 renders partials passed as strings in `handlebars.partials`.
`{{slot:name}}` works inside a partial.

Before:

```ts
const signature = '<p>Thanks, {{name}}</p>';

renderTemplate(`<p>Hello</p>${signature}`, { name: 'Dan' });
```

After:

```ts
renderTemplate('<p>Hello</p>{{> signature}}', { name: 'Dan' }, {
  handlebars: { partials: { signature: '<p>Thanks, {{name}}</p>' } }
});
```

Both return `<p>Hello</p><p>Thanks, Dan</p>`.
A partial that is referenced but not passed throws `The partial signature could not be found`.

A partial is also inserted at render time, after the layout tags are expanded and the CSS is inlined.
Its markup gets neither: with `css: 'p { color: red; }'`, the template's own `<p>` gets `style="color: red;"`, but the partial's `<p>` does not.
Markup that needs the email's CSS belongs in the template itself, or in a slot filled with HTML that is already styled.

### Data keys named like built-in helpers

A data key with the same name as a Handlebars built-in helper now resolves as the helper.
The built-ins are `log`, `lookup`, `if`, `unless`, `each`, `with`, `helperMissing` and `blockHelperMissing`.
`{{log}}` calls Handlebars' log helper, which calls `console.info`.
It renders nothing in its place and writes an empty line to stdout on each render.
`{{helperMissing}}`, `{{blockHelperMissing}}` and `{{lookup}}` throw.
`{{if}}`, `{{unless}}`, `{{each}}` and `{{with}}` throw an error from the helper.

Template:

```handlebars
<p>{{log}}</p>
```

With `{ log: 'Saved' }`, before:

```html
<p>Saved</p>
```

After:

```html
<p></p>
```

Rename the key.

If you cannot rename it, write `{{this.log}}` at the level where the key lives.
`{{this.log}}` does not fall back to an enclosing context.
From inside a block, write `{{../log}}` or `{{@root.log}}`.

Before, with `{ log: 'Saved', items: [{}] }`:

```handlebars
<p>{{log}}</p>{{#items}}<p>{{log}}</p>{{/items}}
```

After:

```handlebars
<p>{{this.log}}</p>{{#items}}<p>{{@root.log}}</p>{{/items}}
```

Both render `<p>Saved</p><p>Saved</p>`.
Inside the block, `{{this.log}}` would render empty.

### Slots

`{{slot:name}}` works as in 3.x.
It inserts the root `slots` entry raw, from any depth, and renders empty when the entry is missing, even under strict mode.

`{{{slots.name}}}` is the plain Handlebars form of the same thing.
Under strict mode it throws when the entry is missing, so strict templates use `{{slot:name}}`.

### CLI image default

The 3.x CLI asked for images to be inlined by default, and `--noInlineImages` turned that off.
The request had no effect: 3.x never inlined images, from the CLI or the library.

4.0 inlines images only when asked.
`--inlineImages` embeds local images as data URIs, relative to the HTML file's folder.
`--noInlineImages` is accepted, does nothing, and prints one deprecation line.

Before:

```sh
inline-email in.html --noInlineImages
```

After:

```sh
inline-email in.html
inline-email in.html --inlineImages
```

The first leaves `<img src="pic.png">` as it is.
The second embeds `pic.png` as a `data:image/png;base64` URI.

In the library, `juice: { webResources: { images: true } }` now inlines images in `compileEmailTemplate` and `inlineEmailHtml`.
Inlining happens at compile time, so an image whose `src` is a placeholder such as `{{logoUrl}}` cannot be inlined.

`webResources` also takes `links`, `scripts` and `svgs`.
Each of the four is `true`, `false` or a size cap in kilobytes.
All four are off by default in the library.
An unreachable resource is skipped with juice's warning on stderr and keeps its URL.
Set `webResources.strict: true` to make the compile fail instead.

### The CLI fails on a malformed template

The CLI now compiles its input with Handlebars.
A malformed template, such as a stray `{{/items}}`, makes it print the parse error and the usage text, then exit with status 1.
The 3.x CLI passed such a file through.

Before:

```sh
inline-email in.html
```

```html
<p>{{/items}}</p>
```

After:

```text
Parse error on line 1:
<p>{{/items}}</p>
---^
Expecting 'EOF', got 'OPEN_ENDBLOCK'
```

Fix the template, then run the CLI again.

### What stays the same from 3.x

- `{{name}}` and `{{user.name}}` render strings, numbers and booleans as before, apart from the escaping changes above.
- `{{.}}` inside a block over a list of scalars renders the current item.
- A missing field renders empty unless strict mode is on.
- Without strict mode, a name the row does not define falls back to the enclosing contexts. A field present as `null` now falls back too; see "Null fields in a row fall through".
- Nested blocks with the same name pair innermost first, as in 3.0.2.
- The subject and text are rendered unescaped.
- Values are never re-read as template syntax.

## Upgrading from 2.x

2.x was a CommonJS command-line tool that inlined CSS with juice and could preprocess Inky markup.
4.x is an ES module library with a CLI on top.
Install 4.x with `npm install inline-email` in your project, or with `npm install -g inline-email` for the CLI.
Each section below names one change a 2.x project must act on, apart from the last two, which say what has not changed.
Each example shows 2.x as the 2.0.1 source accepts it and 4.x as the current build runs it.

### Node.js 22 and ESM

2.x declared Node.js 8 or later and was loaded with `require`.
4.x needs Node.js 22 or later and is an ES module.
Its `exports` field has an `import` entry only, so `require('inline-email')` and `require('inline-email/lib/render')` both fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

2.x's `main` was `bin/inline-email`, so `require('inline-email')` ran the CLI.
Library code required `inline-email/lib/render`.

Before:

```js
const render = require('inline-email/lib/render');
```

After:

```js
import { inlineEmailHtml } from 'inline-email';
```

A file that uses `import` must be an ES module, named `.mjs` or covered by `"type": "module"` in `package.json`, and only an ES module can use top-level `await`, as the examples here do.
A CommonJS file that cannot move to `import` can load the package with a dynamic `import()`:

```js
import('inline-email').then(async ({ inlineEmailHtml }) => {
  console.log(await inlineEmailHtml('<p class="note">Hi</p>', '.note { color: red; }'));
});
```

This prints:

```html
<p class="note" style="color: red;">Hi</p>
```

### lib/render becomes inlineEmailHtml

2.x exported one function from `lib/render`: `render(html, css, options)`, returning a promise of the inlined HTML.
4.x exports `inlineEmailHtml(html, css, options)` from `inline-email`, which also returns a promise of the inlined HTML.
Its options are `responsive`, `transform` and `juice`.
The `inky` option is gone, since Inky now runs through `transform`, and so is `juice.linkCss`; see [The --inky flag and Inky markup](#the---inky-flag-and-inky-markup) and [Linked stylesheets are no longer read](#linked-stylesheets-are-no-longer-read).

Before:

```js
const render = require('inline-email/lib/render');

render('<p class="note">Hi</p>', '.note { color: red; }', { inky: { enabled: false }, juice: {} })
  .then((html) => console.log(html));
```

After:

```js
import { inlineEmailHtml } from 'inline-email';

console.log(await inlineEmailHtml('<p class="note">Hi</p>', '.note { color: red; }'));
```

This prints:

```html
<p class="note" style="color: red;">Hi</p>
```

Two defaults differ for a 2.x caller:

- Called with no options, 2.x used `{ inky: { enabled: true }, juice: { linkCss: false, webResources: { images: false } } }` and so ran Inky over the HTML, a step 4.x leaves to a `transform`.
- With no CSS and `linkCss` off, 2.x passed an empty stylesheet to juice and left `<style>` blocks alone, while 4.x inlines the HTML's `<style>` blocks when `css` is empty or left out.

Before, this left the `<style>` block in place and the paragraph without a `style` attribute:

```js
render('<style>p { color: red; }</style><p>Hi</p>', null, { inky: { enabled: false }, juice: {} });
```

After:

```js
console.log(await inlineEmailHtml('<style>p { color: red; }</style><p>Hi</p>'));
```

This prints:

```html
<p style="color: red;">Hi</p>
```

Options without an `inky` key or without a `juice` key made the 2.x promise reject with a `TypeError`, from reading `options.inky.enabled` or `options.juice.linkCss`.
4.x takes any subset of its options.

`compileEmailTemplate` and `renderEmail` are new since 2.x.
They also compile and render the HTML as a Handlebars template; see [Double braces are template syntax](#double-braces-are-template-syntax).

### The --inky flag and Inky markup

2.x preprocessed the HTML with Inky 1.3.7 when the CLI got `--inky` or `-i`, and in the library by default.
4.x has no built-in Inky step, and the CLI rejects both flags.
Inky still works with 4.x as one flavor of layout markup, run through the `transform` option.

Before:

```sh
inline-email --inky inky.html
```

After, the same command prints `Unknown option: --inky` and the usage text, then exits with status 1.
`-i` prints `Unknown option: -i` the same way.

Without a `transform`, Inky markup is not converted.
A tag such as `<row>` is passed through as it is.
Inky tags that share a name with a 4.x layout tag, such as `<container>`, `<columns>`, `<button>` and `<spacer>`, are rendered as 4.x layout tags instead, and the result is not what Inky produced.

4.x compiles, renders and inlines the HTML whichever layout markup it is written in: Inky, 4.x's built-in layout tags, or plain HTML.
Pick the flavor you want to write:

- Keep writing Inky, and run stable Inky 1 in a `transform`.
  Install it with `npm install inky@1`.
  Set `responsive: false` so 4.x does not read Inky's tags as its own layout tags first.
  2.x passed the library's `inky` options to `new Inky(options.inky)`, so pass the same settings to `new Inky()`.
  The CLI has no `transform` option, so a CLI call that used `--inky` needs a short script instead.
- Switch to 4.x's built-in layout tags, listed in [Responsive Layout Tags](docs/reference.md#responsive-layout-tags).

Before, the 2.0.1 tests render `<row>thing</row>` with Inky on:

```js
render('<row>thing</row>', null, { inky: { enabled: true }, juice: {} });
```

After:

```js
import { inlineEmailHtml } from 'inline-email';
import { Inky } from 'inky';

const inky = new Inky();
const html = await inlineEmailHtml('<row>thing</row>', '', {
  responsive: false,
  transform: (source) => inky.releaseTheKraken(source)
});
console.log(html);
```

Both give:

```html
<table class="row"><tbody><tr>thing</tr></tbody></table>
```

The After example was run with Inky 1.5.0, the current Inky 1 release.
On Node.js 24, Inky 1 also prints a `DEP0060` deprecation warning about `util._extend` to stderr, in 1.3.7 and 1.5.0 alike.
`compileEmailTemplate` takes the same `responsive` and `transform` options.

Inky's output uses class names such as `container`, `row` and `columns`, which get their look from Inky's CSS.
Include Inky's CSS as well, or the layout is unstyled.

Inky 2 is in beta, and you do not need it.
If you choose to try it, its `transform` plugs into the same option:

```js
import { inlineEmailHtml } from 'inline-email';
import inky from 'inky';

const html = await inlineEmailHtml('<row>thing</row>', '', {
  responsive: false,
  transform: (source) => inky.transform(source)
});
console.log(html);
```

With `inky@2.0.0-beta.10`, this prints:

```html
<table role="presentation" class="row"><tbody><tr>thing</tr></tbody></table>
```

Inky 2's `inky.migrate()` rewrites Inky 1 markup in Inky 2 syntax, such as `<columns small="12" large="6">` to `<column sm="12" lg="6">`.

### HTML tags named like layout tags

Without Inky, 2.x passed every HTML tag through to juice unchanged.
4.x applies its responsive layout when the HTML holds a tag named like one of its layout tags, in the CLI and the library.
Those names are `email`, `preview`, `container`, `section`, `columns`, `column`, `button`, `spacer`, `divider`, `image`, `hero-image`, `otp`, `alert`, `panel`, `brand` and `footer`.
Plain HTML5 tags such as `<section>`, `<footer>` and `<button>` are among them.
The layout adds a `<style>` block of `ie-*` media rules and turns those tags into tables.

With `footer.html`:

```html
<footer>Bye</footer>
```

Before, this printed the file unchanged:

```sh
inline-email footer.html
```

After, the same command prints, trimmed here:

```html
<style data-ie-preserve-style>
@media only screen and (max-width: 600px) {
 ...
</style><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f9fc;">
  <tr>
    <td class="ie-section" style="padding:24px;">Bye</td>
  </tr>
</table>
```

In the library, `responsive: false` turns the layout off:

```js
import { inlineEmailHtml } from 'inline-email';

console.log(await inlineEmailHtml('<footer>Bye</footer>', '', { responsive: false }));
```

This prints:

```html
<footer>Bye</footer>
```

The CLI has no switch to turn the layout off.
The nearest alternative is `inlineEmailHtml` with `responsive: false` in a short script.

### Linked stylesheets are no longer read

Run without `--css`, the 2.x CLI read each `<link rel="stylesheet">` file, relative to the current directory, and inlined its styles.
In that mode juice also embedded `<script src>` files and small SVG `<use>` references.
The 4.x CLI reads no linked files: the `<link>` tag is left as it is and its styles are not applied.
No CLI flag turns link reading back on.
No CLI flag embeds `<script src>` files or SVG `<use>` references either; the nearest alternative is a short script that calls `inlineEmailHtml` with `juice.webResources.scripts` or `juice.webResources.svgs` set to `true`.
2.x also fetched a `<link>` whose `href` is an `http` or `https` URL; `--css` reads local files only, so download the file and pass it with `--css`, or use `juice.webResources.links` in the library, which fetches remote links too.

With `style.css`:

```css
.note { color: red; }
```

and `linked.html`:

```html
<html><head><link rel="stylesheet" href="style.css"></head><body><p class="note">Hi</p></body></html>
```

Before:

```sh
inline-email linked.html
```

After, the same command prints:

```html
<html><head><link rel="stylesheet" href="style.css"></head><body><p class="note">Hi</p></body></html>
```

The nearest alternative in the CLI is to pass the stylesheet with `--css`:

```sh
inline-email --css style.css linked.html
```

This inlines the styles and leaves the `<link>` tag in place:

```html
<html><head><link rel="stylesheet" href="style.css"></head><body><p class="note" style="color: red;">Hi</p></body></html>
```

The 2.x CLI removed the `<link>` tag after inlining its styles, so remove it from the HTML when its file moves to `--css`.

In the library, 2.x read links when `juice.linkCss` was `true`.
4.x reads them when `juice.webResources.links` is `true`, relative to `juice.webResources.relativeTo`.
2.x read them relative to the current directory unless `juice.webResources.relativeTo` was set.
`scripts` and `svgs` turn on the other two kinds.

Before:

```js
render(html, null, { inky: { enabled: false }, juice: { linkCss: true } });
```

After, run from the folder that holds `style.css`:

```js
import { inlineEmailHtml } from 'inline-email';

const html = '<html><head><link rel="stylesheet" href="style.css"></head><body><p class="note">Hi</p></body></html>';
console.log(await inlineEmailHtml(html, '', { juice: { webResources: { links: true, relativeTo: '.' } } }));
```

This prints, with the `<link>` tag removed:

```html
<html><head></head><body><p class="note" style="color: red;">Hi</p></body></html>
```

2.x ignored the `css` argument when `juice.linkCss` was `true`; 4.x inlines it, and then leaves the linked stylesheet as a `<style>` block whose rules are not inlined.

### Images are not inlined by default

Run without `--css`, the 2.x CLI embedded local images as data URIs, relative to the current directory, unless `--noInlineImages` was given.
Run with `--css`, it did not embed images.
The 4.x CLI embeds images only with `--inlineImages`, with or without `--css`, relative to the HTML file's folder.
`--noInlineImages` is accepted, does nothing, and prints one deprecation line.

With `img.html`:

```html
<img src="pic.png">
```

Before, this embedded `pic.png`:

```sh
inline-email img.html
```

After:

```sh
inline-email img.html --inlineImages
```

This prints:

```html
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">
```

Without `--inlineImages`, the 4.x CLI prints `<img src="pic.png">` unchanged.
In the library, 2.x embedded images only with `juice.linkCss` on, and then it embedded images up to 8 KB unless `juice.webResources.images` set another value: `false` for none, `true` for any size, or a cap in kilobytes.
4.x embeds them with `juice: { webResources: { images: 8 } }` up to 8 KB, as 2.x did by default, or with `images: true` at any size, with or without `css`.

### Double braces are template syntax

2.x never read `{{` and `}}`: they passed through as text.
4.x compiles the HTML as a Handlebars template.
In the CLI, a template Handlebars cannot parse makes it print the parse error and the usage text, then exit with status 1.
This catches merge tags of other template languages, such as a Liquid filter, that an email service would fill in later.

With `liquid.html`:

```html
<p>Hi {{ name | upcase }}</p>
```

Before, this printed the file unchanged:

```sh
inline-email liquid.html
```

After, the same command fails with:

```text
Parse error on line 1:
<p>Hi {{ name | upcase }}</p>
--------------^
Expecting 'CLOSE_RAW_BLOCK', 'CLOSE', 'CLOSE_UNESCAPED', 'OPEN_SEXPR', 'CLOSE_SEXPR', 'ID', 'OPEN_BLOCK_PARAMS', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'NULL', 'DATA', 'SEP', got 'CLOSE_BLOCK_PARAMS'
```

A tag Handlebars can parse, such as `{{name}}`, still passes through unchanged when the CLI runs without `--data`.
With `--data`, the CLI renders it; see [Upgrading from 3.x](#upgrading-from-3x) for Handlebars' rules.

The CLI has no way to pass unparsable braces through untouched.
`\{{` stops the parse error, but without `--data` the backslash stays in the output.
The nearest alternative is `inlineEmailHtml` in the library, which inlines CSS without reading braces, as 2.x did:

```js
import { inlineEmailHtml } from 'inline-email';

console.log(await inlineEmailHtml('<p>Hi {{ name | upcase }}</p>'));
```

This prints:

```html
<p>Hi {{ name | upcase }}</p>
```

`compileEmailTemplate` and `renderEmail` compile the HTML and reject the same template.

### Styles in the HTML when --css is given

This has not changed.
With `--css`, 2.x inlined only the given files and left the HTML's `<style>` blocks in place, with their rules not inlined.
4.x does the same.

With `red.css`:

```css
p { color: red; }
```

and `styled.html`:

```html
<style>p { font-weight: bold; }</style>
<p>Hi</p>
```

Before and after:

```sh
inline-email styled.html --css red.css
```

4.x prints:

```html
<style>p { font-weight: bold; }</style>
<p style="color: red;">Hi</p>
```

One edge differs.
If every `--css` file holds only whitespace, 4.x treats it as no CSS and inlines the `<style>` blocks; 2.x left them in place.
To inline both, move the `<style>` rules into a CSS file and pass it with `--css`.

### What stays the same from 2.x

- The input HTML is the first argument, or `--html <file>`.
- `--css` takes one or more files and joins them in order.
- Putting the HTML file first, before `--css`, works in both; 2.x read a file after the `--css` files as another CSS file.
- `--out` and `-o` write to a file; without them the result goes to stdout.
- An existing out file is refused unless `--force` or `-f` is given.
- `--help` and `-h` print the usage text.
- In the CLI, without `--css`, the HTML's `<style>` blocks are inlined and removed.
- CSS is inlined by juice into `style` attributes.
