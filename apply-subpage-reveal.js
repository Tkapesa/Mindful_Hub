const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE_ROOT = path.join(ROOT, 'clone', 'mindfulhubtrnc.com');

const STYLE_BLOCK = String.raw`<style id="premium-subpage-reveal-style">
.premium-scroll-section .premium-scroll-card {
  opacity: 0;
  transform: translate3d(var(--premium-shift, 0), 0, 0) scale(0.94);
  transition-property: transform, opacity;
  transition-duration: 1720ms, 1620ms;
  transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1), cubic-bezier(0.19, 1, 0.22, 1);
  transition-delay: var(--premium-delay, 0ms);
  will-change: transform, opacity;
}

.premium-scroll-section .premium-scroll-card[data-premium-side="left"] {
  --premium-shift: -132px;
}

.premium-scroll-section .premium-scroll-card[data-premium-side="right"] {
  --premium-shift: 132px;
}

.premium-scroll-section.is-premium-revealed .premium-scroll-card {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

@media (max-width: 1024px) {
  .premium-scroll-section .premium-scroll-card[data-premium-side="left"] {
    --premium-shift: -104px;
  }

  .premium-scroll-section .premium-scroll-card[data-premium-side="right"] {
    --premium-shift: 104px;
  }
}

@media (max-width: 767px) {
  .premium-scroll-section .premium-scroll-card[data-premium-side="left"] {
    --premium-shift: -84px;
  }

  .premium-scroll-section .premium-scroll-card[data-premium-side="right"] {
    --premium-shift: 84px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .premium-scroll-section .premium-scroll-card {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    will-change: auto;
  }
}
</style>`;

const SCRIPT_BLOCK = String.raw`<script id="premium-subpage-reveal-script">
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var contentRoots = document.querySelectorAll(
    '[data-elementor-type="wp-page"], [data-elementor-type="templately-page"], [data-elementor-type="templately-single"], [data-elementor-type="templately-archive"]'
  );

  if (!contentRoots.length) {
    return;
  }

  function getTopSections(root) {
    return Array.prototype.slice.call(root.querySelectorAll(':scope > .elementor-section.elementor-top-section'));
  }

  function getSectionCards(section) {
    return Array.prototype.slice.call(
      section.querySelectorAll(
        '.elementor-element.elementor-widget-image:not(.elementor-absolute), .elementor-element.elementor-widget-eael-team-member'
      )
    ).filter(function (el) {
      return !!el.querySelector('img');
    });
  }

  var targetSections = [];

  contentRoots.forEach(function (root) {
    var topSections = getTopSections(root);

    if (topSections.length <= 1) {
      return;
    }

    topSections.slice(1).forEach(function (section) {
      var cards = getSectionCards(section);

      if (!cards.length) {
        return;
      }

      section.classList.add('premium-scroll-section');

      cards.forEach(function (card, index) {
        card.classList.remove('elementor-invisible');
        card.classList.add('premium-scroll-card');
        card.setAttribute('data-premium-side', index % 2 === 0 ? 'left' : 'right');
        card.style.setProperty('--premium-delay', String(Math.min(index * 260, 1820)) + 'ms');
      });

      targetSections.push(section);
    });
  });

  if (!targetSections.length) {
    return;
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targetSections.forEach(function (section) {
      section.classList.add('is-premium-revealed');
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('is-premium-revealed');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: '0px 0px -10% 0px'
    }
  );

  targetSections.forEach(function (section) {
    observer.observe(section);
  });
})();
</script>`;

function walkHtmlFiles(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath, list);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
      list.push(fullPath);
    }
  }
  return list;
}

function injectBlocks(html) {
  let next = html;

  next = next.replace(
    /<style id="premium-subpage-reveal-style">[\s\S]*?<\/style>/i,
    STYLE_BLOCK
  );

  next = next.replace(
    /<script id="premium-subpage-reveal-script">[\s\S]*?<\/script>/i,
    SCRIPT_BLOCK
  );

  if (!next.includes('premium-subpage-reveal-style') && /<\/head>/i.test(next)) {
    next = next.replace(/<\/head>/i, STYLE_BLOCK + '\n</head>');
  }

  if (!next.includes('premium-subpage-reveal-script') && /<\/body>/i.test(next)) {
    next = next.replace(/<\/body>/i, SCRIPT_BLOCK + '\n</body>');
  }

  return next;
}

function run() {
  if (!fs.existsSync(SITE_ROOT)) {
    throw new Error('Clone directory not found: ' + SITE_ROOT);
  }

  const files = walkHtmlFiles(SITE_ROOT);
  const rootIndex = path.join(SITE_ROOT, 'index.html');
  let changed = 0;

  for (const filePath of files) {
    if (path.resolve(filePath) === path.resolve(rootIndex)) {
      continue;
    }

    const before = fs.readFileSync(filePath, 'utf8');
    const after = injectBlocks(before);

    if (after !== before) {
      fs.writeFileSync(filePath, after, 'utf8');
      changed += 1;
    }
  }

  console.log('Subpage reveal enhancement applied to', changed, 'files.');
}

try {
  run();
} catch (error) {
  console.error('Failed to apply subpage reveal enhancement:', error && error.message ? error.message : error);
  process.exit(1);
}
