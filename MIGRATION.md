# Migrating to v4

inline-email 4.0 renders templates with [Handlebars](https://handlebarsjs.com/).
Everything Handlebars documents applies to your templates.
This page lists each place where 4.0 behaves differently from 3.x, with a before and after example.
Most 3.x templates render the same without changes.

The last section is a prompt you can paste into an AI assistant together with your 3.x templates to convert them.

## The engine

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

## Escape modes

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

## Handlebars' entity set

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

## Strict mode

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

## Null fields in a row fall through

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

## Inverted blocks

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

## Bare blocks over `0` and `""`

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

## Malformed templates throw

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

## Standalone-tag whitespace

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

## Whitespace inside tags

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

## Object values

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

## Engine options

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

### Reserved fields

The library sets `compat`, `noEscape` and `strict` itself.
If you pass them under `handlebars`, the library's value wins and no error is thrown.
Use the `escape` and `strict` options instead.

A helper named `lookup` is replaced by Handlebars' built-in `lookup`, because `{{slot:name}}` relies on it.

## Helpers that return HTML

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

## Partials

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

## Data keys named like built-in helpers

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

## Slots

`{{slot:name}}` works as in 3.x.
It inserts the root `slots` entry raw, from any depth, and renders empty when the entry is missing, even under strict mode.

`{{{slots.name}}}` is the plain Handlebars form of the same thing.
Under strict mode it throws when the entry is missing, so strict templates use `{{slot:name}}`.

## CLI image default

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

## The CLI fails on a malformed template

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

## What stays the same

- `{{name}}` and `{{user.name}}` render strings, numbers and booleans as before, apart from the escaping changes above.
- `{{.}}` inside a block over a list of scalars renders the current item.
- A missing field renders empty unless strict mode is on.
- Without strict mode, a name the row does not define falls back to the enclosing contexts. A field present as `null` now falls back too; see "Null fields in a row fall through".
- Nested blocks with the same name pair innermost first, as in 3.0.2.
- The subject and text are rendered unescaped.
- Values are never re-read as template syntax.

## Convert your templates with an AI assistant

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
