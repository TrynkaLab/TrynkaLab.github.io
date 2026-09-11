import { defineConfig } from '@rspress/core';

type SoftwareSlug = 'sc-blipper' | 'tglow';

const software = {
  'sc-blipper': {
    title: 'sc-blipper',
    description: 'Single-cell analysis workflows',
    repository: 'https://github.com/TrynkaLab/sc-blipper',
    currentVersion: 'v0.0.4-alpha',
  },
  'tglow-pipeline': {
    title: 'tglow-pipeline',
    description: 'High-content imaging workflows',
    repository: 'https://github.com/TrynkaLab/tglow-pipeline',
    currentVersion: 'v0.0.1-beta',
  },
} as const;

export function defineSoftwareConfig(slug: SoftwareSlug) {
  const softwarePackage = software[slug];
  const siteBase = (process.env.SITE_BASE ?? '').replace(/\/$/, '');

  return defineConfig({
    root: new URL(`./${slug}/docs`, import.meta.url).pathname,
    outDir: new URL(`../doc_build/software/${slug}`, import.meta.url).pathname,
    base: `${siteBase}/software/${slug}/`,
    lang: 'en',
    title: softwarePackage.title,
    description: softwarePackage.description,
    multiVersion: {
      default: softwarePackage.currentVersion,
      versions: [softwarePackage.currentVersion],
    },
    themeConfig: {
      darkMode: 'light',
      socialLinks: [
        {
          icon: 'github',
          mode: 'link',
          content: softwarePackage.repository,
        },
      ],
    },
  });
}
