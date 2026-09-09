import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

const siteBase = (process.env.SITE_BASE ?? '').replace(/\/$/, '');

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base: `${siteBase}/`,
  icon: '/brand/trynka-lab-logo.svg',
  lang: 'en',
  title: 'Trynka Lab',
  themeConfig: {
    darkMode: 'light',
    search: false,
    nav: [
      { text: 'About us', link: 'https://www.sanger.ac.uk/group/trynka-group/' },
      { text: 'Publications', link: `${siteBase}/publications/` },
      {
        text: 'Software',
        items: [
          { text: 'sc-blipper', link: `${siteBase}/software/sc-blipper/` },
          { text: 'tglow', link: `${siteBase}/software/tglow/` },
        ],
      },
    ],
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/TrynkaLab',
      },
    ],
  },
});
