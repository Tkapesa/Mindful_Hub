const path = require('path');
const scrape = require('website-scraper').default;

async function main() {
  const targetUrl = 'https://mindfulhubtrnc.com/';
  const outputDir = path.resolve(__dirname, 'clone');

  await scrape({
    urls: [targetUrl],
    directory: outputDir,
    recursive: true,
    maxDepth: 8,
    prettifyUrls: true,
    filenameGenerator: 'bySiteStructure',
    requestConcurrency: 10,
    urlFilter: (url) => {
      try {
        const host = new URL(url).hostname;
        return host === 'mindfulhubtrnc.com' || host === 'www.mindfulhubtrnc.com';
      } catch {
        return false;
      }
    },
  });

  console.log(`Clone completed at: ${outputDir}`);
}

main().catch((error) => {
  console.error('Clone failed:', error?.message || error);
  process.exit(1);
});
