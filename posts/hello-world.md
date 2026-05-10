Welcome to this blog. It runs entirely in the browser with no build step and no external dependencies — just HTML, CSS, and vanilla JavaScript.

## How it works

Posts are written in Markdown and stored in the `posts/` folder. A small custom parser converts them to HTML on the fly when you click a post in the sidebar.

To add a new post:

1. Create a new `.md` file in `posts/`
2. Add an entry to `posts/manifest.json` with the slug, title, and date

That's it.

## Running locally

Browsers block file fetches from `file://`, so you need a simple HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.
