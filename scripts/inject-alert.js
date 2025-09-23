// File: scripts/inject-alert.js
// Run this as a build step to clear old injection and reinsert the custom-alert snippet with a relative path based on the stylesheet link.

const fs   = require('fs');
const path = require('path');
const glob = require('glob');

// Project root and paths
const ROOT        = path.resolve(__dirname, '..');
const COMMON      = path.join(ROOT, 'renderer/common/custom-alert.html');
const TARGET_GLOB = 'renderer/**/index.html';
const GIF_NAME    = 'mage_3.gif';

// Read and trim the HTML snippet once
const rawSnippet  = fs.readFileSync(COMMON, 'utf8');
const template    = rawSnippet.trim();

// For each index.html
glob.sync(TARGET_GLOB, { cwd: ROOT }).forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  let html       = fs.readFileSync(fullPath, 'utf8');

  // Remove existing injected alert block (from <!-- custom-alert.html --> to </script>)
  html = html.replace(/\n?\s*<!-- custom-alert\.html -->[\s\S]*?<\/script>/g, '').trim();

  // Extract relative path to style.css to determine depth
  const hrefMatch = html.match(/<link\s+rel=["']stylesheet["']\s+href=["']([^"']+style\.css)["']/i);
  const relCss    = hrefMatch ? hrefMatch[1] : '../../style.css';
  const upLevels  = (relCss.match(/\.\.\//g) || []).length;

  // Compute relative path to assets/icon2gif/gifs/mage_2.gif
  const assetPath = Array(upLevels + 1).fill('..').join('/') + '/assets';
  const gifUri    = `${assetPath}/${GIF_NAME}`;

  // Inject new snippet
  const snippet   = template.replace(/{{ASSET_URI}}/g, gifUri);
  const output    = html.replace(/<\/body>/i, snippet + '\n</body>');
  fs.writeFileSync(fullPath, output, 'utf8');

  console.log(`[injected] ${relPath} → ${gifUri}`);
});
