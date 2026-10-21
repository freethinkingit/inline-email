# inline-email reference

This page holds the full library API, template syntax, layout tags and CLI options; see the [README](../README.md) for an overview and installation.

- [Library API](#library-api)
  - [`juice.webResources`](#juicewebresources)
- [Template Syntax](#template-syntax)
  - [Escaping](#escaping)
  - [Slots](#slots)
  - [Strict Mode](#strict-mode)
  - [Helpers, Partials and Engine Options](#helpers-partials-and-engine-options)
- [Responsive Layout Tags](#responsive-layout-tags)
  - [Vanilla Tones](#vanilla-tones)
  - [Image-Based Open Analytics](#image-based-open-analytics)
- [Compile Transforms](#compile-transforms)
- [CLI](#cli)

## Library API

Compile the template once at build/deploy time or cold start:

```ts
import { compileEmailTemplate } from 'inline-email';

const compiled = await compileEmailTemplate({
  subject: 'Welcome to ACME, {{firstName}}',
  html,
  css,
  text: 'Welcome to ACME, {{firstName}}'
});
```

Render dynamic data at email-send time:

```ts
const email = compiled.render({
  data: {
    firstName: 'Dan',
    appUrl: 'https://app.acme.example',
    slots: {
      summary: '<p>Your account was approved.</p>'
    }
  }
});

// { subject, html, text }
```

`render()` also accepts template data directly, such as `compiled.render({ firstName: 'Dan' })`. A `style` key is only treated as a style object when its value is an object; `render({ style: 'casual' })` renders `style` as template data.

`compileEmailTemplate` also takes the rendering options:

```ts
const compiled = await compileEmailTemplate({
  html,
  css,
  escape: 'html',
  strict: true,
  handlebars: {
    helpers,
    partials
  }
});
```

- `escape`: how the HTML body escapes values, `'html'` (the default) or `'none'`. See [Escaping](#escaping).
- `strict`: throw from `render()` when the template names data that is missing. See [Strict Mode](#strict-mode).
- `handlebars`: helpers, partials and other Handlebars compile options. See [Helpers, Partials and Engine Options](#helpers-partials-and-engine-options).
- `juice`: options passed to juice when CSS is inlined. See [`juice.webResources`](#juicewebresources).

`renderTemplate(template, data, options)` renders a single template string and takes the same `escape`, `strict` and `handlebars` options.

### `juice.webResources`

`juice.webResources` embeds resources a template references, on both `compileEmailTemplate` and `inlineEmailHtml`:

```ts
const compiled = await compileEmailTemplate({
  html,
  css,
  juice: {
    webResources: {
      images: 50,
      relativeTo: templatesDir
    }
  }
});
```

It accepts four resource kinds, and each takes `true`, `false`, or a size cap in kilobytes above which the resource is left as a reference:

- `images`: `<img>` sources, embedded as data URIs.
- `links`: stylesheet `<link>` tags, inlined as styles.
- `scripts`: `<script src>` tags, inlined as script content.
- `svgs`: SVG `<use>` references, replaced with the referenced SVG content.

All four are off by default in the library. Once any kind is on, an element carrying a `data-inline` attribute is embedded whatever its kind's setting, so one logo can be embedded while other images stay as URLs. Other attributes that merely start with `data-inline`, such as `data-inline-note`, are left untouched (since 4.0.1); `data-inline-ignore` still tells the inliner to skip an element. Relative paths resolve against `relativeTo`. A resource that cannot be fetched is skipped: juice prints a warning to stderr, the original URL is kept, and compiling continues. Set `webResources.strict: true` to make `compileEmailTemplate` reject instead.

Resources are inlined at compile time, so a `src` that holds a `{{placeholder}}` cannot be inlined. The inliner moves an inlined `src` to the end of its tag.

One-shot rendering is also available:

```ts
import { renderEmail } from 'inline-email';

const email = await renderEmail({
  template: {
    subject: 'Welcome, {{firstName}}',
    html: '<p>Hello {{firstName}}</p>'
  },
  data: {
    firstName: 'Dan'
  }
});
```

## Template Syntax

Templates render with [Handlebars](https://handlebarsjs.com/guide/) 4.7, so everything the Handlebars guide documents applies. Outside strict mode, a name a block's item does not have is looked up in the enclosing contexts. A field present with the value `null` counts as missing for this lookup, so a row's null field shows the enclosing context's value of the same name. Strict mode does not fall through.

Normal variables are escaped by default:

```html
<p>Hello {{firstName}}</p>
```

Repeated blocks render arrays, and `{{#each items}}` does the same:

```html
<ul>
  {{#items}}<li>{{label}}</li>{{/items}}
</ul>
```

Blocks nest, including under the same key, so recursive data such as items that contain their own `items` renders innermost first.

Inverted blocks render when the value is missing, `null`, `false` or an empty list:

```html
{{^items}}<p>No items yet.</p>{{/items}}
```

A bare block over `0` or `""` renders its content, so use `{{#if}}` and `{{#unless}}` for conditions on numbers and strings:

```html
{{#if unreadCount}}<p>You have {{unreadCount}} unread messages.</p>{{/if}}
{{#unless nickname}}<p>Add a nickname to your profile.</p>{{/unless}}
```

A data key named like a built-in helper (`log`, `lookup`, `if`, `each`, `with`, `unless`, `helperMissing` or `blockHelperMissing`) resolves as the helper, so rename the key. `{{log}}` calls Handlebars' log helper, which renders nothing and writes an empty line to stdout, and a key named `helperMissing` or `blockHelperMissing` throws. `{{this.log}}` reads the key only at the level where it lives; from inside a block, an enclosing key needs `{{../log}}` or `{{@root.log}}`.

A malformed template, such as an unclosed block, makes `compileEmailTemplate` reject and `renderTemplate` throw with Handlebars' parse error. The CLI fails the same way.

### Escaping

The `escape` option sets how the HTML body escapes values:

- `'html'`, the default: Handlebars' own escaping of `&`, `<`, `>`, `"`, `'`, `=` and the backtick.
- `'none'`: values are inserted as given.
- `true` and `false` are aliases for `'html'` and `'none'`. Any other value throws.

```ts
const compiled = await compileEmailTemplate({ html, escape: 'none' });
```

Escaping applies to the HTML body only. The `subject` and `text` templates always render values as plain text, so an apostrophe or ampersand in a name stays as typed. Rendered values are never re-scanned for template syntax, so a value containing `{{...}}` is output literally.

### Slots

Trusted HTML slots must be explicit. Two forms insert HTML from `data.slots` unescaped:

```html
<section>{{slot:summary}}</section>
<section>{{{slots.summary}}}</section>
```

`{{slot:name}}` always reads the root `slots`, including inside a block, and renders empty when the slot is missing, in strict mode too. `{{{slots.name}}}` is an ordinary Handlebars raw reference, so in strict mode it throws when the slot is missing.

Slots are supplied separately via `data.slots`, which keeps trusted HTML injection intentional instead of relying on accidental unescaped variables.

### Strict Mode

`strict: true` compiles with Handlebars' strict mode. A missing variable, path segment, block or inverted block makes `render()` throw `"name" not defined in ...`:

```ts
const compiled = await compileEmailTemplate({
  html: '<p>Hello {{firstName}}</p>',
  strict: true
});

compiled.render({ firstName: 'Dan' });
```

Rendering that template with `{}` throws `"firstName" not defined`. In strict mode:

- A field set to `null` renders empty.
- Helper parameters, such as `maybe` in `{{#if maybe}}`, are not checked.
- The enclosing-context lookup is off, so inside a block reach an enclosing value with `{{../name}}` or `{{@root.name}}`.
- Use `{{slot:name}}` for slots, since `{{{slots.name}}}` throws when the slot is missing.
- For a missing two-segment path such as `{{user.name}}` the error names the leaf, `name`. A path three segments deep through a missing object, such as `{{account.owner.name}}`, throws `Strict render failed: Cannot read properties of undefined (reading 'owner')`, with a hint that either a dotted path crossed a missing or null field or a helper received a value it did not expect; the original `TypeError` is its `cause`. A helper that fails on a missing value under strict mode gets the same wrapper, since strict mode does not check helper parameters.

```html
{{#each items}}<a href="{{@root.appUrl}}/items/{{id}}">{{label}}</a>{{/each}}
```

### Helpers, Partials and Engine Options

The `handlebars` option passes `helpers`, `partials` and any other Handlebars compile option to an isolated Handlebars instance per compile, so helpers registered for one template are not seen by another:

```ts
import Handlebars from 'handlebars';
import { compileEmailTemplate } from 'inline-email';

const compiled = await compileEmailTemplate({
  html: '<p>{{shout firstName}}</p><p>{{bold plan}}</p>{{> signature}}',
  handlebars: {
    helpers: {
      shout: (text: string) => text.toUpperCase(),
      bold: (text: string) => new Handlebars.SafeString(`<b>${Handlebars.escapeExpression(text)}</b>`)
    },
    partials: {
      signature: '<p>Sent by {{company}}</p>'
    }
  }
});
```

A helper's string result is escaped like any value. A helper that returns HTML wraps it in Handlebars' `SafeString`, from the `handlebars` package your app imports itself, and escapes any data it puts inside.

Markup from a partial or a helper is inserted at render time, after layout tags are expanded and CSS is inlined, so it gets neither. Shared markup that needs the email's styles belongs in the template, or in a slot filled with already-styled HTML.

The compile options `compat`, `noEscape` and `strict`, and a helper named `lookup`, are reserved: the library sets them and its value wins. Use the top-level `escape` and `strict` options instead. With `knownHelpersOnly: true`, give each helper a `knownHelpers` entry.

## Responsive Layout Tags

The compiler includes a small Inky-like responsive layout layer. These reusable tags compile to conservative table markup before CSS is inlined:

```html
<email>
  <preview>Welcome to ACME</preview>
  <container>
    <section padding="32">
      <brand href="{{brandUrl}}" mark="A">ACME</brand>
      <hero-image src="{{heroImageUrl}}" alt="ACME preview" width="528" />
      <spacer size="24" />
      <columns>
        <column width="50%">
          <p>Hello {{firstName}}</p>
        </column>
        <column width="50%">
          <button href="{{appUrl}}">Open ACME</button>
        </column>
      </columns>
      <spacer size="24" />
      <alert tone="warning">This link expires in {{expiresIn}}.</alert>
    </section>
    <footer>Sent by Freethinking IT</footer>
  </container>
</email>
```

Supported tags:

```text
<email>       Full document wrapper with mobile media rules.
<preview>     Hidden inbox preview text.
<container>   Centered 600px email body.
<section>     Padded content block.
<columns>     Table row for columns.
<column>      Responsive column that stacks on small screens.
<button>      Table-based CTA button.
<brand>       Small wordmark/header lockup.
<image>       Responsive email-safe image.
<hero-image>  Wide responsive image with rounded corners.
<spacer>      Email-safe vertical spacing.
<divider>     Horizontal rule using table markup.
<otp>         One-time code display block.
<alert>       Inline warning/info/success/danger notice.
<panel>       Bordered content panel.
<footer>      Muted footer section.
```

Responsive layout tags are enabled by default. Disable them with `responsive: false` if you want to pass through raw HTML unchanged.

### Vanilla Tones

`<alert>` and `<panel>` include a small vanilla tone set:

```html
<alert tone="warning">This link expires soon.</alert>
<panel tone="success">Your workspace is ready.</panel>
```

Supported tones are `neutral`, `info`, `success`, `warning`, and `danger`.

You can render with only data:

```ts
compiled.render({
  data: {
    tone: 'info'
  }
});
```

Or override tone colors for a brand:

```ts
compiled.render({
  data,
  style: {
    tones: {
      info: {
        background: '#eff8ff',
        border: '#b2ddff',
        text: '#1849a9',
        accent: '#1570ef'
      }
    }
  }
});
```

### Image-Based Open Analytics

`inline-email` does not create a standalone hidden tracker. For open/load analytics, use normal images with tracking parameters or route useful image URLs through your own image proxy:

```html
<hero-image
  src="https://images.example.com/open/welcome.png?messageId={{messageId}}&recipient={{recipientId}}"
  alt="Welcome preview"
  width="528"
/>
```

That keeps analytics tied to useful email assets such as logos, hero images, and product screenshots instead of relying on a hidden request that many clients block. Your sending app owns consent, disclosure, retention, and analytics handling.

## Compile Transforms

For layout syntax or local experiments, pass a compile-stage `transform`. It runs before CSS inlining and before runtime values are rendered:

```ts
const compiled = await compileEmailTemplate({
  html,
  css,
  transform: (source) => renderResponsiveLayout(source)
});
```

This is where product-specific helpers can grow without coupling the package to Inky, MJML, React Email, or any other layout framework.

## CLI

The CLI remains available as `inline-email`:

```sh
inline-email input.html
inline-email input.html --out output.html
inline-email --css style.css input.html
```

Supported options:

```text
--html <file>          Input HTML file. A positional input file is also supported.
--css <files...>       CSS files to inline.
--out, -o <file>       Write output to a file instead of stdout.
--inlineImages         Embed referenced images as data URIs. Off by default.
--noInlineImages       Deprecated and ignored; images are no longer inlined by default.
--data <file>          Render the template with this JSON file and write the rendered HTML.
--strict               With --data, fail on a field the template names but the data does not define.
--force, -f            Overwrite the output file.
--help, -h             Show this help text.
```

`--inlineImages` resolves relative image paths against the input file's directory and turns on only `images` of the [`juice.webResources`](#juicewebresources) kinds. `--noInlineImages` prints one deprecation line to stderr and has no other effect.

To preview the finished email, pass sample data: `--data` renders the compiled template with the JSON file's contents, which may be plain template data or `{ "data": ..., "style": ... }`, and writes the rendered HTML. Add `--strict` to fail the run when the template names a field the data does not define, the same strict mode the library offers:

```sh
inline-email welcome.html --css email.css --data sample.json --strict --out preview.html
```
