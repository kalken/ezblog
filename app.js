// Theme toggle
const root = document.documentElement;

function effectiveTheme() {
  return root.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

(function () {
  const saved = localStorage.getItem('theme');
  if (saved) root.setAttribute('data-theme', saved);

  function updateButton(btn) {
    const isDark = effectiveTheme() === 'dark';
    btn.textContent = isDark ? '☀' : '☾';
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    updateButton(btn);
    btn.addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateButton(btn);
      const iframe = document.querySelector('iframe.giscus-frame');
      if (iframe) {
        iframe.contentWindow.postMessage(
          { giscus: { setConfig: { theme: next } } },
          'https://giscus.app'
        );
      }
    });
  });
})();

// Minimal Markdown parser — no dependencies
function parseMarkdown(text) {
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Stash fenced code blocks before any other processing
  const stash = [];
  const stashPush = s => { stash.push(s); return `\x02${stash.length - 1}\x03`; };
  const stashPop = s => s.replace(/\x02(\d+)\x03/g, (_, i) => stash[+i]);

  text = text.replace(/^```(\w*)\n([\s\S]*?)^```/gm, (_, lang, code) =>
    stashPush(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escape(code.trimEnd())}</code></pre>`)
  );

  function inline(s) {
    return stashPop(s
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2"><img alt="$1" src="$2"></a>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, (_, c) => `<code>${escape(c)}</code>`)
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
    );
  }

  const lines = text.split('\n');
  const out = [];
  let i = 0;

  const isBlock = l =>
    /^#{1,6}\s/.test(l) ||
    /^[-*+]\s/.test(l) ||
    /^\d+\.\s/.test(l) ||
    /^>\s/.test(l) ||
    /^(?:---|\*\*\*|___)\s*$/.test(l) ||
    /^\x02\d+\x03$/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];

    // Stashed code block
    if (/^\x02\d+\x03$/.test(line.trim())) {
      out.push(stashPop(line.trim()));
      i++;
      continue;
    }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${inline(hm[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const bq = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bq.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${parseMarkdown(bq.join('\n'))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*+]\s/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph — collect until blank line or block element
    const p = [];
    while (i < lines.length && lines[i].trim() && !isBlock(lines[i])) {
      p.push(lines[i]);
      i++;
    }
    if (p.length) out.push(`<p>${inline(p.join(' '))}</p>`);
  }

  return out.join('\n');
}

// Format YYYY-MM-DD to readable date
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function loadGiscus() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  const container = document.getElementById('giscus-container');
  if (!container) return;
  const theme = effectiveTheme() === 'dark' ? 'dark' : 'light';
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.setAttribute('data-repo', 'kalken/ezblog');
  script.setAttribute('data-repo-id', 'R_kgDOSZbDbw');
  script.setAttribute('data-category', 'General');
  script.setAttribute('data-category-id', 'DIC_kwDOSZbDb84C8tz4');
  script.setAttribute('data-mapping', 'title');
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'bottom');
  script.setAttribute('data-theme', theme);
  script.setAttribute('data-lang', 'en');
  script.crossOrigin = 'anonymous';
  script.async = true;
  container.appendChild(script);
}

// State
let manifest = [];
let currentSlug = null;

const contentEl = document.getElementById('content');
const postListEl = document.getElementById('post-list');

async function loadManifest() {
  const res = await fetch('posts/manifest.json');
  if (!res.ok) throw new Error('Could not load posts/manifest.json');
  return res.json();
}

function renderSidebar(posts, activeSlug) {
  postListEl.innerHTML = posts.map(p => `
    <a href="#${p.slug}" class="post-link${p.slug === activeSlug ? ' active' : ''}">
      <div class="post-link-title">${p.title}</div>
      <div class="post-date">${formatDate(p.date)}</div>
    </a>
  `).join('');
}

async function loadPost(slug) {
  const post = manifest.find(p => p.slug === slug);
  if (!post) {
    contentEl.innerHTML = '<p id="error">Post not found.</p>';
    return;
  }

  renderSidebar(manifest, slug);

  try {
    const res = await fetch(`posts/${slug}.md`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status}`);
    const md = await res.text();

    contentEl.innerHTML = `
      <article>
        <div class="post-header">
          <h1>${post.title}</h1>
          <div class="post-meta">${formatDate(post.date)}</div>
        </div>
        <div class="post-body">${parseMarkdown(md)}</div>
      </article>
      <div id="giscus-container"></div>
    `;
    document.title = post.title;
    loadGiscus();
  } catch (e) {
    contentEl.innerHTML = `<p id="error">Failed to load post: ${e.message}</p>`;
  }
}


function route() {
  const slug = location.hash.slice(1).replace(/^\//, '') || null;
  if (!slug) {
    const first = manifest[0];
    if (first) loadPost(first.slug);
    else renderSidebar(manifest, null);
  } else if (slug !== currentSlug) {
    currentSlug = slug;
    loadPost(slug);
  }
}

async function init() {
  try {
    manifest = await loadManifest();
  } catch (e) {
    contentEl.innerHTML = `<p id="error">${e.message}</p>`;
    return;
  }

  renderSidebar(manifest, null);
  window.addEventListener('hashchange', route);
  route();
}

init();
