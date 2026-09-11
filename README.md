# Trynka Lab website

The website is built with Rspress and published through GitHub Pages. Most
contributors only need to add or edit Markdown files; they do not need to
change React components, configuration, or build scripts.

## Content contributor guide

### Where to update content

| Website section | Markdown to edit |
|---|---|
| About us | `docs/about-us/index.md` |
| Publications | One file per paper in `publications/` |
| Software overview | `docs/software/index.md` |
| sc-blipper documentation | `software/sc-blipper/docs/v0.0.4-alpha/` |
| tglow-pipeline documentation | `software/tglow-pipeline/docs/v0.0.1-beta/` |
| tglow-r documentation | `software/tglow-r/docs/v0.1.22/` |
| tglow-core documentation | `software/tglow-core/docs/v0.1.4/` |
| edit-quant documentation | `software/edit-quant/docs/v0.0.1/` |
| ProliferationAnalysis documentation | `software/proliferation-analysis/docs/v0.1.3/` |

The homepage banner and research placeholders are currently part of the site
layout. Ask a maintainer to change those rather than editing files under
`theme/`. The About us navigation link currently opens the Trynka Group page on
the Sanger website; `docs/about-us/index.md` is the local page reserved for
future content.

### Update an existing page

Open the corresponding `.md` file and edit its Markdown body. If the file has a
frontmatter block between `---` lines, keep that block at the top:

```md
---
title: About us
---

Add or update the page text here.

## Research focus

Use normal Markdown for headings, links, lists, images, and code examples.
```

For software documentation, modify files only inside the current version
folder. Existing filenames map directly to website pages, for example:

```text
software/sc-blipper/docs/v0.0.4-alpha/installation.md
software/tglow-pipeline/docs/v0.0.1-beta/running.md
```

### Add a software documentation page

Create a lowercase, hyphenated Markdown filename in the applicable current
version folder:

```text
software/<tool>/docs/<current-version>/new-page.md
```

Start the file with a descriptive heading and write the content in ordinary
Markdown:

```md
# New page title

Briefly explain what this page covers.

## First task

Add the instructions here.
```

Submit only the Markdown page. A maintainer can add it to the ordered sidebar
when reviewing the contribution.

### Add a publication

Create one Markdown file in `publications/`, named with the year and a short
paper identifier, for example `2026-tglow.md`:

```md
---
title: "Paper title"
authors:
  - "First Author"
  - "Second Author"
year: 2026
date: "2026-02-11"
type: preprint
venue: "bioRxiv"
citation: "2026.02.10.704860"
doi: "10.64898/2026.02.10.704860"
url: "https://doi.org/10.64898/2026.02.10.704860"
codeUrl: "https://github.com/TrynkaLab/example"
---

One short summary paragraph shown on the Publications page.
```

Required fields are `title`, `authors`, `year`, `date`, `type`, `venue`, and
`url`. `type` must be `article` or `preprint`, and `date` must use
`YYYY-MM-DD`. `citation`, `doi`, and `codeUrl` are optional.

The website validates and sorts publication records automatically. Do not edit
`theme/generated/`; it is recreated from the Markdown files during every
development and production build. More details are available in
`publications/README.md`.

### Add images or downloads

- Put shared website assets in `docs/public/`.
- Put tool-specific images beside the relevant versioned Markdown page.
- Use lowercase, descriptive filenames without spaces.
- Reference a shared asset from Markdown with its public path:

  ```md
  ![Description of the image](/images/example.png)
  ```

### Submit a content change

1. Create a branch or edit the file through the GitHub web interface.
2. Add or modify only the relevant Markdown and image files.
3. Open a pull request targeting `staging`.
4. After review, a maintainer merges it into `staging`.
5. Review the deployed result at <https://trynkalab.github.io/preview/>.
6. A maintainer promotes the approved change to `main` for the official site.

Content contributors do not need to install Node.js or run the website locally;
GitHub Actions builds the preview after approved changes reach `staging`.

### Files content contributors should not edit

These contain implementation or generated output and are maintained separately:

```text
theme/
scripts/
rspress.config.ts
software/software-config.ts
package.json
package-lock.json
doc_build/
node_modules/
```

## Maintainer reference

### Deployment environments

| Branch | Purpose | Published path |
|---|---|---|
| `main` | Official website | `/` |
| `staging` | Preview and acceptance testing | `/preview/` |

The deployment workflow is defined in `.github/workflows/pages.yml`. In
**Settings → Pages → Build and deployment**, keep **Source** set to
**GitHub Actions**.

The workflow builds `main` for <https://trynkalab.github.io/> and places the
`staging` build under <https://trynkalab.github.io/preview/>. Forks are detected
automatically and receive the repository-name path prefix.

### Repository structure

```text
.
├── docs/                         # Main Trynka Lab website pages
│   ├── index.md                  # Homepage route
│   ├── about-us/index.md
│   ├── publications/index.mdx    # Publications page shell
│   ├── software/index.md
│   └── public/                   # Shared static assets
├── publications/                 # One Markdown record per paper
├── software/
│   ├── software-config.ts        # Tool metadata and version registry
│   ├── sc-blipper/docs/          # Versioned sc-blipper Markdown
│   ├── tglow-pipeline/docs/      # Versioned tglow-pipeline Markdown
│   ├── tglow-r/docs/             # Versioned tglow-r Markdown
│   ├── tglow-core/docs/          # Versioned tglow-core Markdown
│   ├── edit-quant/docs/          # Versioned edit-quant Markdown
│   └── proliferation-analysis/docs/ # Versioned ProliferationAnalysis Markdown
├── theme/                        # React layout and styles
├── scripts/                      # Content build helpers
├── rspress.config.ts             # Main portal configuration
└── .github/workflows/pages.yml   # Production and preview deployment
```

`doc_build/`, `node_modules/`, and `theme/generated/` are generated locally and
must not be committed.

### Changes that require a maintainer

- Changing the homepage layout, banner, research placeholders, navigation, or
  theme.
- Adding a new software tool to the navigation and build workflow.
- Registering a new released documentation version.
- Adding a new page to a tool's ordered sidebar.
- Changing GitHub Pages or deployment behavior.

### Add a released documentation version

1. Copy the prior version under `software/<tool>/docs/<new-version>/`.
2. Update the Markdown for that release.
3. Add the release to `multiVersion.versions` in
   `software/software-config.ts`.
4. Change `currentVersion` only when the release should become the default.

### Local development

Install dependencies and run the portal development server:

```bash
npm install
npm run dev
```

Build and preview the portal and both software documentation sites together:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 51303
```

Before merging, verify the main page, publications, both software roots, all
changed version routes, navigation links, and narrow-screen text overflow.
