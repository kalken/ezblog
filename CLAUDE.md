# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

Browsers block `fetch()` from `file://`, so a local HTTP server is required:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. There is no build step, bundler, or package manager.

## Architecture

A fully static blog — no framework, no dependencies. Three files do everything:

- **`index.html`** — single HTML shell, never changes per-post
- **`style.css`** — all styling including both dark and light themes via CSS custom properties
- **`app.js`** — markdown parser, hash-based router, and theme toggle

### Routing

Hash-based: `#slug` loads `posts/{slug}.md`. The `hashchange` event drives navigation. `currentSlug` prevents redundant fetches.

### Posts

Posts are loaded from `posts/manifest.json` (array of `{ slug, title, date }`), then each post is fetched as `posts/{slug}.md` with `cache: 'no-cache'`. The manifest must be updated manually when adding a post.

### Markdown parser

Custom parser in `parseMarkdown()` in `app.js`. Fenced code blocks are stashed before inline processing using `\x02index\x03` sentinel tokens to avoid double-processing. Supported syntax: headings (h1–h6), bold, italic, bold-italic, strikethrough, inline code, fenced code blocks, links, images (wrapped in `<a>`), unordered/ordered lists, blockquotes (recursive), horizontal rules (`---`, `***`, `___`). Not supported: nested lists, tables, task lists, footnotes.

### Theming

CSS custom properties on `:root` define the dark theme by default. Light theme overrides are applied via `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) }` and `:root[data-theme="light"]`. Manual toggle stores preference in `localStorage` and sets `data-theme` on `<html>`. The `[data-theme="dark"]` block explicitly re-asserts dark vars to override a light OS preference.

### Fonts

Local woff2 files in `fonts/` — no external font requests. Inter (UI/headings) and Lora (body) are variable fonts, one file per style covers the full weight range.
