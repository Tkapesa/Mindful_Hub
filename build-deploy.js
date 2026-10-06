const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'clone', 'mindfulhubtrnc.com');
const DIST = path.join(ROOT, 'dist');

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  mkdirp(dir);
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function existsFile(absPath) {
  return fs.existsSync(absPath) && fs.statSync(absPath).isFile();
}

function toAbs(relPosix) {
  return path.join(SRC, ...relPosix.split('/'));
}

function stripQueryAndHash(value) {
  return value.split('#')[0].split('?')[0];
}

function isExternal(value) {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('//') ||
    v.startsWith('mailto:') ||
    v.startsWith('tel:') ||
    v.startsWith('javascript:') ||
    v === '' ||
    v.startsWith('#')
  );
}

function normalizeRel(raw, fromDirPosix) {
  if (isExternal(raw)) return null;
  let value = stripQueryAndHash(raw.trim());
  if (!value) return null;

  if (value.startsWith('/')) {
    value = value.replace(/^\/+/, '');
  } else {
    value = path.posix.normalize(path.posix.join(fromDirPosix, value));
  }

  if (value.startsWith('../')) return null;
  if (value === '.') return null;
  return value;
}

function parseAttrValues(html, attrName) {
  const re = new RegExp(`${attrName}=["']([^"']+)["']`, 'g');
  return [...html.matchAll(re)].map((m) => m[1]);
}

function parseSrcsetValues(srcset) {
  const out = [];
  const parts = srcset.split(',');
  for (const part of parts) {
    const seg = part.trim().split(/\s+/)[0];
    if (seg) out.push(seg);
  }
  return out;
}

function isAssetPath(relPosix) {
  const ext = path.posix.extname(relPosix).toLowerCase();
  if (!ext) return false;
  return ext !== '.html' && ext !== '.php';
}

function enqueuePageIfExists(relPosix, pagesQueue, pagesSet) {
  const abs = toAbs(relPosix);
  if (!existsFile(abs)) return;
  if (pagesSet.has(relPosix)) return;
  pagesSet.add(relPosix);
  pagesQueue.push(relPosix);
}

function discoverSiteGraph() {
  const pagesQueue = [];
  const pagesSet = new Set();
  const assetsSet = new Set();

  enqueuePageIfExists('index.html', pagesQueue, pagesSet);

  while (pagesQueue.length > 0) {
    const pageRel = pagesQueue.shift();
    const pageAbs = toAbs(pageRel);
    const pageDir = path.posix.dirname(pageRel);
    const html = fs.readFileSync(pageAbs, 'utf8');

    const srcValues = parseAttrValues(html, 'src');
    const hrefValues = parseAttrValues(html, 'href');
    const posterValues = parseAttrValues(html, 'poster');
    const srcsetValues = parseAttrValues(html, 'srcset').flatMap(parseSrcsetValues);

    const allRefs = [...srcValues, ...hrefValues, ...posterValues, ...srcsetValues];

    for (const raw of allRefs) {
      const rel = normalizeRel(raw, pageDir);
      if (!rel) continue;

      const ext = path.posix.extname(rel).toLowerCase();

      if (isAssetPath(rel)) {
        if (existsFile(toAbs(rel))) assetsSet.add(rel);
        continue;
      }

      if (ext === '.html') {
        enqueuePageIfExists(rel, pagesQueue, pagesSet);
        continue;
      }

      // Handle folder-style links like about/ or blog
      if (!ext) {
        enqueuePageIfExists(path.posix.join(rel, 'index.html'), pagesQueue, pagesSet);
      }
    }
  }

  return {
    pages: [...pagesSet].sort(),
    assets: [...assetsSet].sort(),
  };
}

function dirSizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(full) : fs.statSync(full).size;
  }
  return total;
}

function run() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Missing source clone at ${SRC}. Run \"npm run clone\" first.`);
  }

  console.log('Building landing page...');
  cp.execFileSync(process.execPath, ['build-landing.js'], { cwd: ROOT, stdio: 'inherit' });

  console.log('Enhancing subpage image sections with premium scroll reveal...');
  cp.execFileSync(process.execPath, ['apply-subpage-reveal.js'], { cwd: ROOT, stdio: 'inherit' });

  console.log('\nPreparing clean dist folder...');
  cleanDir(DIST);

  console.log('Discovering linked pages and assets...');
  const graph = discoverSiteGraph();

  if (graph.pages.length === 0) {
    throw new Error(`No HTML pages discovered in ${SRC}. Verify the clone output.`);
  }

  console.log(`Found ${graph.pages.length} HTML pages and ${graph.assets.length} local assets.`);

  for (const rel of graph.pages) {
    copyFile(toAbs(rel), path.join(DIST, ...rel.split('/')));
  }

  for (const rel of graph.assets) {
    copyFile(toAbs(rel), path.join(DIST, ...rel.split('/')));
  }

  // Ensure hero image exists even if changed late.
  const heroRel = 'images/converted_image.webp';
  if (existsFile(toAbs(heroRel))) {
    copyFile(toAbs(heroRel), path.join(DIST, 'images', 'converted_image.webp'));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    pages: graph.pages,
    assets: graph.assets,
  };
  fs.writeFileSync(path.join(DIST, 'build-manifest.json'), JSON.stringify(manifest, null, 2));

  const mb = (dirSizeBytes(DIST) / 1024 / 1024).toFixed(2);
  console.log(`\nBuild complete: ${DIST} (${mb} MB)`);
  console.log('Ready to deploy: upload contents of dist/ to your hosting root.');
}

try {
  run();
} catch (error) {
  console.error('\nBuild failed:', error && error.message ? error.message : error);
  process.exit(1);
}
