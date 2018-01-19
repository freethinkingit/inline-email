[![Build Status](https://travis-ci.org/freethinkingit/inline-email.svg?branch=master)](https://travis-ci.org/freethinkingit/inline-email)
[![dependencies Status](https://david-dm.org/freethinkingit/inline-email/status.svg)](https://david-dm.org/freethinkingit/inline-email)

# Inline Email - CLI

A CLI for converting HTML files to inline styled HTML suitable for emails.
The CLI also supports Inky HTML-based templating using `--inky` as an argument.
The CLI is designed to make working with ExactTarget, MailChimp, Emarsys, or any other email service easier if you're simply pasting the output into those systems.

## What this does not do.

`inline-email` does NOT check you're using email safe HTML tags.
It also won't replace any non-safe tags.

## Installation

```sh
npm install -g inline-email
```

## Usage

By default `inline-email` resolves `<link>` and `<style>` tags and inlines the styles found within after which it removes the `<link>` and `<style>` tags from the HTML. This process is done using [Juice](https://github.com/Automattic/juice). Currently not all of Juice's options can be passed through the CLI, though it will use the appropriate Juice function to handle your HTML input depending on if you provided css or not.

You can simple print the output to the console.

```sh
$ inline-email some.html
> your-html-to-stdout
```

Or you can send it to a file.

```sh
$ inline-email some.html --out inlined.html
```

If you wish to pass in a `.css` files (or files) on your own (if your HTML doesn't have `<link>` or `<style>` tags) you can. Note that if the file does have these tags they will be ignored and the passed in files will be used instead.

```sh
$ inline-email --css some.css --out inlined.html some.html
```

### Inky Usage

With `--inky` nothing changes, but the HTML file is pre-proccessed through [Inky](https://github.com/zurb/inky). All the other agruments operate exactly the same.

```sh
$ inline-email --inky inky.html
> your-slightly-different-inkyish-output
```

## Contributing with new features

Want to contribute? [Follow these recommendations](CONTRIBUTING.md).

## License

[MIT](LICENSE.md)
