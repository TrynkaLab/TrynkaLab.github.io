import { defineConfig } from '@rspress/core';

type SoftwareSlug =
  | 'sc-blipper'
  | 'tglow-pipeline'
  | 'tglow-r'
  | 'tglow-core'
  | 'edit-quant'
  | 'proliferation-analysis';

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
  'tglow-r': {
    title: 'tglow-r',
    description: 'R package for downstream analysis of tglow-pipeline outputs',
    repository: 'https://github.com/TrynkaLab/tglow-r',
    currentVersion: 'v0.1.22',
  },
  'tglow-core': {
    title: 'tglow-core',
    description: 'Core Python library for TGlow image processing',
    repository: 'https://github.com/TrynkaLab/tglow-core',
    currentVersion: 'v0.1.4',
  },
  'edit-quant': {
    title: 'edit-quant',
    description: 'Nextflow pipeline for mapping guides/amplicons and running crispresso2 ',
    repository: 'https://github.com/TrynkaLab/edit-quant',
    currentVersion: 'v0.0.1',
  },
  'proliferation-analysis': {
    title: 'ProliferationAnalysis',
    description: 'R package for performing proliferation analysis CTV/CSFE traces',
    repository: 'https://github.com/TrynkaLab/ProliferationAnalysis',
    currentVersion: 'v0.1.3',
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
