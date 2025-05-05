/* agent.js – render each agent_* folder as a long vertical button
 *           in ~/.local/share/summoner/agents
 */
;(function () {
  /* ────────── imports ─────────────────────────────────────────────── */
  const fs   = require('fs');
  const path = require('path');
  const os   = require('os');
  const { shell } = require('electron');

  /* ────────── resolve workspace dir ───────────────────────────────── */
  const dataRoot   = process.env.XDG_DATA_HOME ||
                     path.join(os.homedir(), '.local', 'share');
  const AGENTS_DIR = path.join(dataRoot, 'summoner', 'agents');

  fs.mkdirSync(AGENTS_DIR, { recursive: true });

  /* ────────── discover agent_* folders ────────────────────────────── */
  const agents = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
                   .filter(e => e.isDirectory() && e.name.startsWith('agent_'));

  /* ────────── build the button list ───────────────────────────────── */
  const grid = document.getElementById('feature-grid');

  /* one column; children stretch full width */
  grid.style.display              = 'grid';   // ensure grid if CSS missing
  grid.style.gridTemplateColumns  = '1fr';
  grid.style.justifyItems         = 'stretch';

  if (agents.length === 0) {
    grid.textContent =
      `No agents found. Drop folders named “agent_<name>” into ${AGENTS_DIR}`;
  } else {
    agents.forEach(dirent => {
  const fullPath = path.join(AGENTS_DIR, dirent.name);
  const stat     = fs.statSync(fullPath);        // ↤ read metadata
  const created  = stat.birthtime;               // JS Date object

  const btn = document.createElement('button');

  /* visual */
  btn.style.padding   = '16px 200px';
  btn.style.textAlign = 'left';
  btn.style.fontSize  = '1rem';

  /* label: Agent name + creation date */
  const name   = dirent.name.replace(/^agent_/, '');
  const time   = created.toLocaleDateString();   // e.g. 5/6/2025
  btn.textContent = `${name} — ${time}`;

  /* tooltip with full timestamp (optional) */
  btn.title = `Created: ${created.toLocaleString()}`;

  btn.addEventListener('click', () => shell.openPath(fullPath));
  grid.appendChild(btn);
});
  }

  /* flag intro layout so global flex pushes content to top */
  document.body.classList.add('has-intro');
})();
