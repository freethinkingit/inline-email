import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.ts';

describe('parseArgs', () => {
  it('supports legacy --css style.css input.html ordering', () => {
    expect(parseArgs(['--css', 'style.css', 'input.html'])).toMatchObject({
      css: ['style.css'],
      html: 'input.html'
    });
  });

  it('supports positional html before multiple css files', () => {
    expect(parseArgs(['input.html', '--css', 'base.css', 'theme.css'])).toMatchObject({
      css: ['base.css', 'theme.css'],
      html: 'input.html'
    });
  });
});
