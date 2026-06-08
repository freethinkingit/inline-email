import type { EmailStyle, EmailStyleVariant } from './types';

type StyleTarget = 'container' | 'content';

export function applyEmailStyle(html: string, style: EmailStyle = {}): string {
  return html
    .replace(
      /(<table\b(?=[^>]*\bdata-ie-component="([^"]+)")(?=[^>]*\bdata-ie-variant="([^"]+)")[^>]*\bstyle=")([^"]*)(")/g,
      (match: string, prefix: string, component: string, variant: string, fallbackStyle: string, suffix: string) => {
        const declaration = resolveVariantStyle(style, decodeHtmlAttribute(variant));
        const nextStyle = renderComponentStyle(decodeHtmlAttribute(component), 'container', declaration, fallbackStyle);

        return nextStyle ? `${prefix}${nextStyle}${suffix}` : match;
      }
    )
    .replace(
      /(<td\b(?=[^>]*\bdata-ie-component-content="([^"]+)")(?=[^>]*\bdata-ie-variant="([^"]+)")[^>]*\bstyle=")([^"]*)(")/g,
      (match: string, prefix: string, component: string, variant: string, fallbackStyle: string, suffix: string) => {
        const declaration = resolveVariantStyle(style, decodeHtmlAttribute(variant));
        const nextStyle = renderComponentStyle(decodeHtmlAttribute(component), 'content', declaration, fallbackStyle);

        return nextStyle ? `${prefix}${nextStyle}${suffix}` : match;
      }
    );
}

function resolveVariantStyle(style: EmailStyle, variant: string): EmailStyleVariant | undefined {
  return style.tones?.[variant];
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
    return `background:${escapeStyleValue(background ?? readStyleValue(fallbackStyle, 'background', '#fff7e8'))};border-left:4px solid ${escapeStyleValue(accent ?? '#f2a900')};`;
  }

  if (background || border) {
    return `background:${escapeStyleValue(background ?? readStyleValue(fallbackStyle, 'background', '#f7f9fc'))};border:1px solid ${escapeStyleValue(border ?? '#d8dee8')};border-radius:8px;`;
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
  return style.match(pattern)?.[1]?.trim() ?? fallback;
}

function escapeStyleValue(value: string): string {
  return String(value).replace(/[;"'<>]/g, '');
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}
