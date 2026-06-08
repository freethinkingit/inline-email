import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileEmailTemplate } from '../src/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const examplesDir = join(rootDir, 'examples');
const sharedCss = readFileSync(join(examplesDir, 'auth', 'shared.css'), 'utf8');

const sharedData = {
  appUrl: 'https://app.acme.example',
  brandUrl: 'https://acme.example',
  launchImageUrl: 'https://images.acme.example/launch.png?messageId=msg_launch_123&recipient=dan',
  preferencesUrl: 'https://app.acme.example/settings/email',
  welcomeImageUrl: 'https://images.acme.example/welcome.png?messageId=msg_welcome_123&recipient=dan'
};

const examples = [
  {
    file: join(examplesDir, 'auth', 'welcome-verify.html'),
    data: {
      firstName: 'Dan',
      verifyUrl: 'https://app.acme.example/auth/verify?token=welcome-token',
      expiresIn: '30 minutes'
    }
  },
  {
    file: join(examplesDir, 'auth', 'forgot-password.html'),
    data: {
      email: 'dan@example.com',
      resetCode: '482913',
      resetUrl: 'https://app.acme.example/auth/reset?token=reset-token'
    }
  },
  {
    file: join(examplesDir, 'auth', 'magic-sign-in.html'),
    data: {
      email: 'dan@example.com',
      expiresIn: '10 minutes',
      location: 'Austin, TX',
      magicUrl: 'https://app.acme.example/auth/magic?token=magic-token',
      requestedAt: 'June 8, 2026 at 9:44 AM CT'
    }
  },
  {
    file: join(examplesDir, 'marketing', 'feature-roundup.html'),
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
          description: 'Turn strong workflows into repeatable team habits.'
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
    file: join(examplesDir, 'marketing', 'usage-digest.html'),
    data: {
      completedCount: 42,
      digestUrl: 'https://app.acme.example/digest',
      workspaceName: 'Product Operations',
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
        }
      ]
    }
  }
];

describe('example templates', () => {
  it('compile and render without leaking placeholders or layout tags', async () => {
    for (const example of examples) {
      const html = readFileSync(example.file, 'utf8');
      const compiled = await compileEmailTemplate({
        subject: 'Example email',
        html,
        css: sharedCss
      });

      const email = compiled.render({
        data: { ...sharedData, ...example.data }
      });

      expect(email.html, example.file).toContain('<table');
      expect(email.html, example.file).not.toMatch(/{{[#/]?[\w.:-]+}}/);
      expect(email.html, example.file).not.toMatch(/<\/?(email|container|section|columns|column|button|spacer|divider|hero-image|alert|panel|brand|footer)\b/i);
    }
  });
});
