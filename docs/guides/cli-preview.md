# Preview a template with the CLI

This guide shows you how to write a template and sample data, render them to a preview file with `inline-email`, and iterate on the design; it takes about 10 minutes.

You can follow it in your own project or in a checkout of this repository.

## The template

The template is an order confirmation built from layout tags and Handlebars.
`{{#each items}}` writes one table row per item.
`{{#if discount}}` shows the discount line only when the data has a discount.

```html file=examples/guides/cli-preview/email.html
<email>
  <preview>Order {{orderNumber}} is confirmed.</preview>
  <container>
    <section padding="36" background="#ffffff">
      <p class="eyebrow">Order {{orderNumber}}</p>
      <h1 class="headline">Thanks for your order, {{firstName}}</h1>
      <spacer size="18" />
      <p class="body-copy">Here is what you ordered. We will email you again when it ships.</p>
      <spacer size="24" />
      <table class="items" width="100%" cellpadding="0" cellspacing="0" role="presentation">
        {{#each items}}
        <tr>
          <td class="item-name">{{name}} &times; {{quantity}}</td>
          <td class="item-price" align="right">{{price}}</td>
        </tr>
        {{/each}}
      </table>
      <divider />
      <p class="summary-line">Subtotal: {{subtotal}}</p>
      {{#if discount}}
      <p class="summary-line discount">{{discount.label}}: -{{discount.amount}}</p>
      {{/if}}
      <p class="summary-total">Total: {{total}}</p>
      <spacer size="28" />
      <button href="{{orderUrl}}" background="#17202a">View your order</button>
    </section>
  </container>
</email>
```

## The CSS

The CLI inlines this CSS into `style` attributes on the matching elements.

```css file=examples/guides/cli-preview/email.css
body {
  font-family: Arial, Helvetica, sans-serif;
}

.eyebrow {
  color: #516070;
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 10px;
  text-transform: uppercase;
}

.headline {
  color: #17202a;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.16;
  margin: 0;
}

.body-copy {
  color: #344054;
  font-size: 16px;
  line-height: 1.58;
  margin: 0;
}

.item-name,
.item-price {
  border-bottom: 1px solid #eaecf0;
  color: #344054;
  font-size: 15px;
  padding: 10px 0;
}

.summary-line {
  color: #667085;
  font-size: 15px;
  margin: 0 0 6px;
  text-align: right;
}

.discount {
  color: #027a48;
}

.summary-total {
  color: #17202a;
  font-size: 18px;
  font-weight: 800;
  margin: 8px 0 0;
  text-align: right;
}
```

## The sample data

The data has every field the template names, three items and a discount.

```json file=examples/guides/cli-preview/data.json
{
  "orderNumber": "A-10423",
  "firstName": "Maya",
  "orderUrl": "https://example.com/orders/A-10423",
  "items": [
    { "name": "Linen notebook", "quantity": 2, "price": "$24.00" },
    { "name": "Brass pen", "quantity": 1, "price": "$38.00" },
    { "name": "Desk tray", "quantity": 1, "price": "$19.50" }
  ],
  "subtotal": "$81.50",
  "discount": { "label": "WELCOME10", "amount": "$8.15" },
  "total": "$73.35"
}
```

`--data` accepts plain template data like this, or `{ "data": ..., "style": ... }`.
A data file that is missing, is not valid JSON, or is not a JSON object fails the run with an error naming the file.

## Render the preview

In your own project, run `npm install inline-email`.
Save the three files above as `email.html`, `email.css` and `data.json` in one folder.
From that folder, run:

```sh
npx inline-email email.html --css email.css --data data.json --strict --out preview.html
```

In a checkout of this repository, run `npm run build`, then:

```sh
node dist/cli.js examples/guides/cli-preview/email.html --css examples/guides/cli-preview/email.css --data examples/guides/cli-preview/data.json --strict --out preview.html
```

The command prints nothing when it succeeds.
`preview.html` now holds the finished email: CSS inlined, layout tags expanded, data filled in.
The item rows and totals look like this:

```html
<td class="item-name" style="border-bottom: 1px solid #eaecf0; color: #344054; font-size: 15px; padding: 10px 0;">Linen notebook &times; 2</td>
<p class="summary-line discount" style="font-size: 15px; margin: 0 0 6px; text-align: right; color: #027a48;">WELCOME10: -$8.15</p>
<p class="summary-total" style="color: #17202a; font-size: 18px; font-weight: 800; margin: 8px 0 0; text-align: right;">Total: $73.35</p>
```

Leave out `--out` to print the HTML to the terminal instead.

To see it, run `open preview.html` on macOS, or open the file in any browser.

## Iterate

Change `email.html`, `email.css` or `data.json`, then run the command again.
`--out` refuses to overwrite an existing file and fails with this error:

```text
Out file path already exists. Use --force or -f to overwrite it.
```

So add `--force` to the end of the same command when you re-run it.

Then refresh the browser tab to see the change.

## What `--strict` catches

`--strict` fails the run when the template names a field the data does not define.
Without it, a missing field renders as empty text, so `Total: {{total}}` would quietly become `Total: `.
Remove `total` from a copy of `data.json` and run the command again, and it fails with:

```text
"total" not defined in [object Object] - 58:135
```

After this error, and after the overwrite error above, the CLI also prints its full usage text; that does not mean the arguments were wrong.

Read the field name in quotes, then search your template for it.
The line and column point into the compiled HTML, after layout tags are expanded and CSS is inlined, not into `email.html`.

`--strict` only works together with `--data`.
Without `--data` nothing is rendered, so there is nothing for `--strict` to check.

Next: learn helpers, partials and images in [the marketing guide](marketing.md), or read every CLI option in the [reference](../reference.md#cli).
