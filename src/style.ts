import { BUILT_IN_TONES } from './layout.js';
import type { EmailStyle, EmailStyleVariant } from './types.js';

type StyleTarget = 'container' | 'content';

const CONTAINER_PATTERN =
  /(<table\b(?=[^>]*\bdata-ie-component="([^"]+)")(?=[^>]*\bdata-ie-variant="([^"]+)")[^>]*\bstyle=")([^"]*)(")/g;
const CONTENT_PATTERN =
  /(<td\b(?=[^>]*\bdata-ie-component-content="([^"]+)")(?=[^>]*\bdata-ie-variant="([^"]+)")[^>]*\bstyle=")([^"]*)(")/g;

/**
 * Restyles the alert and panel components in rendered HTML with the colours of their tone.
 *
 * Each component's tone is looked up in the built-in palette and in `style.tones`, the caller's
 * colours winning over the built-in ones. A component whose tone is in neither keeps its style.
 *
 * @param html - The rendered email HTML.
 * @param style - The caller's colours for each tone.
 * @returns The HTML with each styled component's `style` attribute rewritten.
 */
export function applyEmailStyle(html: string, style: EmailStyle = {}): string {
  const htmlWithContainersStyled = restyleComponents(html, CONTAINER_PATTERN, 'container', style);
  return restyleComponents(htmlWithContainersStyled, CONTENT_PATTERN, 'content', style);
}

function restyleComponents(html: string, pattern: RegExp, target: StyleTarget, style: EmailStyle): string {
  return html.replace(
    pattern,
    (match: string, prefix: string, component: string, variant: string, fallbackStyle: string, suffix: string) => {
      const declaration = resolveVariantStyle(style, decodeHtmlAttribute(variant));
      const nextStyle = renderComponentStyle(decodeHtmlAttribute(component), target, declaration, fallbackStyle);

      return nextStyle ? `${prefix}${nextStyle}${suffix}` : match;
    }
  );
}

// A tone that comes from data is still the literal {{tone}} when the layout picks colours at compile time,
// so the built-in palette has to be applied here, at render, under whatever the caller's style overrides.
function resolveVariantStyle(style: EmailStyle, variant: string): EmailStyleVariant | undefined {
  const builtIn = Object.hasOwn(BUILT_IN_TONES, variant) ? BUILT_IN_TONES[variant] : undefined;
  const override = style.tones?.[variant];

  if (!builtIn && !override) {
    return undefined;
  }

  return { ...builtIn, ...override };
}

function renderComponentStyle(
  component: string,
  target: StyleTarget,
  declaration: EmailStyleVariant | undefined,
  fallbackStyle: string
): string | undefined {
  if (!declaration) {
    return undefined;
  }

  if (target === 'container') {
    return renderContainerStyle(component, declaration, fallbackStyle);
  }

  return renderContentStyle(component, declaration, fallbackStyle);
}

function renderContainerStyle(
  component: string,
  declaration: EmailStyleVariant,
  fallbackStyle: string
): string {
  const background = declaration.background;
  const accent = declaration.accent;
  const border = declaration.border;

  if (component === 'alert' && (background || accent)) {
    const alertBackground = background ?? readStyleValue(fallbackStyle, 'background', '#fff7e8');
    const accentColour = accent ?? '#f2a900';

    return `background:${escapeStyleValue(alertBackground)};border-left:4px solid ${escapeStyleValue(accentColour)};`;
  }

  if (background || border) {
    const borderedBackground = background ?? readStyleValue(fallbackStyle, 'background', '#f7f9fc');
    const borderColour = border ?? '#d8dee8';

    return `background:${escapeStyleValue(borderedBackground)};border:1px solid ${escapeStyleValue(borderColour)};border-radius:8px;`;
  }

  return fallbackStyle;
}

function renderContentStyle(
  component: string,
  declaration: EmailStyleVariant,
  fallbackStyle: string
): string {
  if (!declaration.text) {
    return fallbackStyle;
  }

  const padding = component === 'alert' ? '14px 16px' : '16px';
  const fontSize = component === 'alert' ? '14px' : '15px';

  return `padding:${padding};color:${escapeStyleValue(declaration.text)};font-family:Arial,Helvetica,sans-serif;font-size:${fontSize};line-height:1.5;`;
}

function readStyleValue(style: string, property: string, fallback: string): string {
  const pattern = new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i');
  const found = style.match(pattern);

  if (found === null) {
    return fallback;
  }

  return found[1].trim();
}

function escapeStyleValue(value: string): string {
  return String(value).replace(/[;"'<>]/g, '');
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&#x3D;', '=')
    .replaceAll('&#x60;', '`')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}
