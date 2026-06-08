const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');
const { compileEmailTemplate } = require('../dist');

const rootDir = join(__dirname, '..');
const examplesDir = join(rootDir, 'examples');
const outputDir = join(examplesDir, 'out');
const sharedCss = readFileSync(join(examplesDir, 'auth', 'shared.css'), 'utf8');

const sharedData = {
  brandUrl: 'https://acme.example',
  appUrl: 'https://app.acme.example',
  preferencesUrl: 'https://app.acme.example/settings/email',
  launchImageUrl: './assets/welcome-dashboard.svg?messageId=msg_launch_123&recipient=dan',
  welcomeImageUrl: './assets/welcome-dashboard.svg?messageId=msg_welcome_123&recipient=dan'
};

const style = {
  tones: {
    info: {
      accent: '#1570ef',
      background: '#eff8ff',
      border: '#b2ddff',
      text: '#1849a9'
    },
    success: {
      accent: '#12b76a',
      background: '#ecfdf3',
      border: '#abefc6',
      text: '#067647'
    },
    warning: {
      accent: '#f79009',
      background: '#fffaeb',
      border: '#fedf89',
      text: '#93370d'
    },
    danger: {
      accent: '#d92d20',
      background: '#fef3f2',
      border: '#fecdca',
      text: '#912018'
    },
    neutral: {
      accent: '#667085',
      background: '#f7f9fc',
      border: '#d8dee8',
      text: '#344054'
    }
  }
};

const examples = [
  {
    category: 'Transactional',
    dir: 'auth',
    file: 'welcome-verify.html',
    title: 'Welcome + Verify Email',
    data: {
      firstName: 'Dan',
      verifyUrl: 'https://app.acme.example/auth/verify?token=welcome-token',
      expiresIn: '30 minutes'
    }
  },
  {
    category: 'Transactional',
    dir: 'auth',
    file: 'forgot-password.html',
    title: 'Forgot Password',
    data: {
      email: 'dan@example.com',
      resetCode: '482913',
      resetUrl: 'https://app.acme.example/auth/reset?token=reset-token'
    }
  },
  {
    category: 'Transactional',
    dir: 'auth',
    file: 'password-changed.html',
    title: 'Password Changed',
    data: {
      email: 'dan@example.com',
      changedAt: 'June 8, 2026 at 9:42 AM CT',
      securityUrl: 'https://app.acme.example/settings/security'
    }
  },
  {
    category: 'Transactional',
    dir: 'auth',
    file: 'magic-sign-in.html',
    title: 'Magic Sign-In',
    data: {
      email: 'dan@example.com',
      expiresIn: '10 minutes',
      magicUrl: 'https://app.acme.example/auth/magic?token=magic-token',
      requestedAt: 'June 8, 2026 at 9:44 AM CT',
      location: 'Austin, TX'
    }
  },
  {
    category: 'Marketing',
    dir: 'marketing',
    file: 'product-launch.html',
    title: 'Product Launch',
    data: {
      launchUrl: 'https://app.acme.example/whats-new'
    }
  },
  {
    category: 'Marketing',
    dir: 'marketing',
    file: 'feature-roundup.html',
    title: 'Feature Roundup',
    data: {
      featureCount: 3,
      featuresUrl: 'https://app.acme.example/features',
      features: [
        {
          tone: 'info',
          title: 'Shared decision trails',
          description: 'Keep the context behind each decision close to the work it affects.'
        },
        {
          tone: 'success',
          title: 'Reusable handoff checklists',
          description: 'Turn your strongest workflows into repeatable team habits.'
        },
        {
          tone: 'warning',
          title: 'Attention summaries',
          description: 'Surface stalled work before it becomes a missed deadline.'
        }
      ]
    }
  },
  {
    category: 'Marketing',
    dir: 'marketing',
    file: 'usage-digest.html',
    title: 'Usage Digest',
    data: {
      workspaceName: 'Product Operations',
      completedCount: 42,
      digestUrl: 'https://app.acme.example/digest',
      highlights: [
        {
          value: '18',
          label: 'Decisions captured',
          detail: 'Your team recorded the why behind key product calls.'
        },
        {
          value: '11',
          label: 'Follow-ups closed',
          detail: 'Outstanding action items moved out of limbo.'
        },
        {
          value: '7',
          label: 'Handoffs completed',
          detail: 'Cross-functional work landed with clear next steps.'
        }
      ]
    }
  },
  {
    category: 'Marketing',
    dir: 'marketing',
    file: 'upgrade-offer.html',
    title: 'Upgrade Offer',
    data: {
      upgradeUrl: 'https://app.acme.example/billing/plans',
      benefits: [
        'Automate recurring follow-up reminders.',
        'Share reusable workflow templates across teams.',
        'Unlock longer workspace history and richer reporting.'
      ]
    }
  }
];

async function main() {
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, 'assets'), { recursive: true });
  copyFileSync(
    join(examplesDir, 'auth', 'assets', 'welcome-dashboard.svg'),
    join(outputDir, 'assets', 'welcome-dashboard.svg')
  );

  const rendered = [];

  for (const example of examples) {
    const html = readFileSync(join(examplesDir, example.dir, example.file), 'utf8');
    const compiled = await compileEmailTemplate({
      subject: example.title,
      html,
      css: sharedCss
    });
    const email = compiled.render({
      data: { ...sharedData, ...example.data },
      style
    });
    const outputFile = `${example.dir}-${basename(example.file)}`;

    writeFileSync(join(outputDir, outputFile), email.html, 'utf8');
    rendered.push({ ...example, outputFile });
  }

  writeFileSync(join(outputDir, 'index.html'), renderIndex(rendered), 'utf8');
}

function renderIndex(rendered) {
  const categories = [...new Set(rendered.map((example) => example.category))];
  const sections = categories
    .map((category) => {
      const cards = rendered
        .filter((example) => example.category === category)
        .map(
          (example) => `
            <article class="card">
              <header>
                <h3>${escapeHtml(example.title)}</h3>
                <a href="./${example.outputFile}">Open full email</a>
              </header>
              <iframe src="./${example.outputFile}" title="${escapeHtml(example.title)}"></iframe>
            </article>`
        )
        .join('\n');

      return `<section>
        <h2>${escapeHtml(category)}</h2>
        <div class="grid">${cards}</div>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Responsive Email Examples</title>
  <style>
    body {
      background: #eef2f7;
      color: #17202a;
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 32px;
    }

    h1 {
      font-size: 30px;
      margin: 0 0 8px;
    }

    .lede {
      color: #516070;
      font-size: 15px;
      margin: 0 0 28px;
    }

    section {
      margin: 0 0 36px;
    }

    h2 {
      font-size: 20px;
      margin: 0 0 14px;
    }

    .grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    }

    .card {
      background: #ffffff;
      border: 1px solid #d8dee8;
      border-radius: 8px;
      overflow: hidden;
    }

    .card header {
      align-items: center;
      border-bottom: 1px solid #e4e9f0;
      display: flex;
      justify-content: space-between;
      padding: 14px 16px;
    }

    h3 {
      font-size: 15px;
      margin: 0;
    }

    a {
      color: #246bfe;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }

    iframe {
      background: #f4f5f7;
      border: 0;
      display: block;
      height: 760px;
      width: 100%;
    }
  </style>
</head>
<body>
  <h1>Responsive Email Examples</h1>
  <p class="lede">Transactional and product marketing emails built from reusable inline-email blocks.</p>
  ${sections}
</body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
