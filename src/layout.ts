const RESPONSIVE_STYLE = `<style data-inline-email-preserve-style>
@media only screen and (max-width: 600px) {
  .ie-container { width: 100% !important; }
  .ie-section { padding-left: 20px !important; padding-right: 20px !important; }
  .ie-column { display: block !important; width: 100% !important; max-width: 100% !important; }
  .ie-button table { width: 100% !important; }
  .ie-button a { display: block !important; }
}
</style>`;

export function renderResponsiveLayout(source: string): string {
  let html = source;

  html = html.replace(/<preview\b[^>]*>([\s\S]*?)<\/preview>/gi, (_match, content: string) => {
    return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${content}</div>`;
  });

  html = replacePairedTag(html, 'spacer', (_attrs, content) => renderSpacer(parseSize(content.trim() || '24')));
  html = replaceSelfClosingTag(html, 'spacer', (attrs) => renderSpacer(readNumberAttribute(attrs, 'size', 24)));
  html = replaceSelfClosingTag(html, 'divider', (attrs) => renderDivider(attrs));
  html = replaceSelfClosingTag(html, 'image', (attrs) => renderImage(attrs));
  html = replaceSelfClosingTag(html, 'hero-image', (attrs) => renderHeroImage(attrs));
  html = replacePairedTag(html, 'otp', (attrs, content) => renderOtp(attrs, content));
  html = replacePairedTag(html, 'alert', (attrs, content) => renderAlert(attrs, content));
  html = replacePairedTag(html, 'panel', (attrs, content) => renderPanel(attrs, content));
  html = replacePairedTag(html, 'brand', (attrs, content) => renderBrand(attrs, content));
  html = replacePairedTag(html, 'button', (attrs, content) => renderButton(attrs, content));
  html = replacePairedTag(html, 'column', (attrs, content) => renderColumn(attrs, content));
  html = replacePairedTag(html, 'columns', (_attrs, content) => renderColumns(content));
  html = replacePairedTag(html, 'section', (attrs, content) => renderSection(attrs, content));
  html = replacePairedTag(html, 'footer', (attrs, content) => renderFooter(attrs, content));
  html = replacePairedTag(html, 'container', (_attrs, content) => renderContainer(content));
  html = replacePairedTag(html, 'email', (_attrs, content) => renderEmail(content));

  return ensureResponsiveStyle(html);
}

function renderEmail(content: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${RESPONSIVE_STYLE}
</head>
<body style="margin:0;padding:0;width:100%;background:#f4f5f7;">
  ${content}
</body>
</html>`;
}

function renderContainer(content: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td align="center">
      <table role="presentation" class="ie-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td>${content}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function renderSection(attrs: string, content: string): string {
  const padding = readNumberAttribute(attrs, 'padding', 32);
  const background = readAttribute(attrs, 'background') ?? '#ffffff';

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${escapeAttribute(background)};">
  <tr>
    <td class="ie-section" style="padding:${padding}px;">${content}</td>
  </tr>
</table>`;
}

function renderColumns(content: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>${content}</tr>
</table>`;
}

function renderColumn(attrs: string, content: string): string {
  const width = readAttribute(attrs, 'width') ?? '50%';
  const padding = readNumberAttribute(attrs, 'padding', 0);

  return `<td class="ie-column" valign="top" width="${escapeAttribute(width)}" style="width:${escapeAttribute(width)};padding:${padding}px;">${content}</td>`;
}

function renderButton(attrs: string, content: string): string {
  const href = readAttribute(attrs, 'href') ?? '#';
  const background = readAttribute(attrs, 'background') ?? '#1f6feb';
  const color = readAttribute(attrs, 'color') ?? '#ffffff';
  const radius = readNumberAttribute(attrs, 'radius', 6);

  return `<table role="presentation" class="ie-button" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="border-radius:${radius}px;background:${escapeAttribute(background)};">
            <a href="${escapeAttribute(href)}" style="display:inline-block;padding:14px 20px;color:${escapeAttribute(color)};text-decoration:none;font-weight:700;border-radius:${radius}px;">${content}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function renderBrand(attrs: string, content: string): string {
  const href = readAttribute(attrs, 'href');
  const mark = readAttribute(attrs, 'mark') ?? 'I';
  const text = href
    ? `<a href="${escapeAttribute(href)}" style="color:#17202a;text-decoration:none;">${content}</a>`
    : content;

  return `<table role="presentation" class="ie-brand" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding:0 0 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" width="36" height="36" style="width:36px;height:36px;border-radius:10px;background:#17202a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;line-height:36px;">${escapeAttribute(mark)}</td>
          <td style="padding-left:10px;color:#17202a;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;line-height:1.2;">${text}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function renderImage(attrs: string): string {
  const src = requiredAttribute(attrs, 'src', 'image');
  const alt = readAttribute(attrs, 'alt') ?? '';
  const href = readAttribute(attrs, 'href');
  const width = readNumberAttribute(attrs, 'width', 600);
  const height = readAttribute(attrs, 'height');
  const align = readAttribute(attrs, 'align') ?? 'center';
  const radius = readNumberAttribute(attrs, 'radius', 0);
  const img = `<img src="${escapeAttribute(src)}" width="${width}"${height ? ` height="${escapeAttribute(height)}"` : ''} alt="${escapeAttribute(alt)}" border="0" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px;">`;

  return `<table role="presentation" class="ie-image" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td align="${escapeAttribute(align)}">${href ? `<a href="${escapeAttribute(href)}" style="text-decoration:none;">${img}</a>` : img}</td>
  </tr>
</table>`;
}

function renderHeroImage(attrs: string): string {
  const mergedAttrs = attrs.includes('width=') ? attrs : `${attrs} width="600"`;
  return renderImage(`${mergedAttrs} radius="${readNumberAttribute(attrs, 'radius', 12)}"`);
}

function renderOtp(attrs: string, content: string): string {
  const background = readAttribute(attrs, 'background') ?? '#f3f7fb';
  const border = readAttribute(attrs, 'border') ?? '#d7e3ee';

  return `<table role="presentation" class="ie-otp" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${escapeAttribute(background)};border:1px solid ${escapeAttribute(border)};border-radius:8px;">
  <tr>
    <td align="center" style="padding:18px 20px;color:#17202a;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:800;letter-spacing:6px;line-height:1;">${content}</td>
  </tr>
</table>`;
}

function renderAlert(attrs: string, content: string): string {
  const variant = readAttribute(attrs, 'variant') ?? readAttribute(attrs, 'tone') ?? 'warning';
  const colors = toneColors(variant);

  return `<table role="presentation" class="ie-alert" data-ie-component="alert" data-ie-variant="${escapeAttribute(variant)}" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.background};border-left:4px solid ${colors.accent};">
  <tr>
    <td data-ie-component-content="alert" data-ie-variant="${escapeAttribute(variant)}" style="padding:14px 16px;color:${colors.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">${content}</td>
  </tr>
</table>`;
}

function renderPanel(attrs: string, content: string): string {
  const variant = readAttribute(attrs, 'variant') ?? readAttribute(attrs, 'tone') ?? 'neutral';
  const colors = toneColors(variant);

  return `<table role="presentation" class="ie-panel" data-ie-component="panel" data-ie-variant="${escapeAttribute(variant)}" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.background};border:1px solid ${colors.border};border-radius:8px;">
  <tr>
    <td data-ie-component-content="panel" data-ie-variant="${escapeAttribute(variant)}" style="padding:16px;color:${colors.text};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;">${content}</td>
  </tr>
</table>`;
}

function renderDivider(attrs: string): string {
  const color = readAttribute(attrs, 'color') ?? '#e4e9f0';
  const size = readNumberAttribute(attrs, 'size', 1);

  return `<table role="presentation" class="ie-divider" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td height="${size}" style="height:${size}px;font-size:0;line-height:0;background:${escapeAttribute(color)};">&nbsp;</td>
  </tr>
</table>`;
}

function renderFooter(attrs: string, content: string): string {
  const padding = readNumberAttribute(attrs, 'padding', 24);
  const background = readAttribute(attrs, 'background') ?? '#f7f9fc';

  return renderSection(` padding="${padding}" background="${background}"`, content);
}

function renderSpacer(size: number): string {
  return `<table role="presentation" class="ie-spacer" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td height="${size}" style="height:${size}px;font-size:${size}px;line-height:${size}px;">&nbsp;</td>
  </tr>
</table>`;
}

function toneColors(tone: string): { accent: string; background: string; border: string; text: string } {
  switch (tone) {
    case 'success':
      return { accent: '#16a34a', background: '#ecfdf3', border: '#b8edc9', text: '#17643a' };
    case 'danger':
      return { accent: '#b42318', background: '#fef3f2', border: '#fecdca', text: '#7a271a' };
    case 'info':
      return { accent: '#1570ef', background: '#eff8ff', border: '#b2ddff', text: '#1849a9' };
    case 'warning':
      return { accent: '#f2a900', background: '#fff7e8', border: '#fedf89', text: '#4f3a0b' };
    default:
      return { accent: '#667085', background: '#f7f9fc', border: '#d8dee8', text: '#344054' };
  }
}

function ensureResponsiveStyle(html: string): string {
  if (html.includes('data-inline-email-preserve-style')) {
    return html;
  }

  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${RESPONSIVE_STYLE}`);
  }

  return `${RESPONSIVE_STYLE}${html}`;
}

function replacePairedTag(
  html: string,
  tagName: string,
  render: (attrs: string, content: string) => string
): string {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let previous: string;
  let next = html;

  do {
    previous = next;
    next = previous.replace(pattern, (_match, attrs: string, content: string) => render(attrs, content));
  } while (next !== previous);

  return next;
}

function replaceSelfClosingTag(html: string, tagName: string, render: (attrs: string) => string): string {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)\\s*\\/?>`, 'gi');
  return html.replace(pattern, (_match, attrs: string) => render(attrs));
}

function readNumberAttribute(attrs: string, name: string, fallback: number): number {
  return parseSize(readAttribute(attrs, name) ?? String(fallback));
}

function parseSize(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function readAttribute(attrs: string, name: string): string | undefined {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const match = attrs.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function requiredAttribute(attrs: string, name: string, tagName: string): string {
  const value = readAttribute(attrs, name);

  if (!value) {
    throw new Error(`<${tagName}> requires a ${name} attribute.`);
  }

  return value;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
