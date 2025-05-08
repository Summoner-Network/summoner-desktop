// list_agents.js — renders the agent_* folders as checkbox list
;(function(){
  const fs   = require('fs');
  const path = require('path');
  const os   = require('os');
  const dataRoot   = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const AGENTS_DIR = path.join(dataRoot, 'summoner', 'agents');
  fs.mkdirSync(AGENTS_DIR, { recursive: true });

  const dirs = fs.readdirSync(AGENTS_DIR, { withFileTypes:true })
    .filter(d=>d.isDirectory() && d.name.startsWith('agent_'))
    .map(d=>d.name);
  const listEl = document.getElementById('agent-list');

  if (dirs.length === 0) {
    listEl.innerHTML = `<p style="margin-left: 1em;">No agents found. Use <b>Import Agent</b> to add some.</p>`;
    document.body.classList.add('has-intro');
    return;
  }

  dirs.forEach(folder => {
    const name    = folder.replace(/^agent_/, '');
    const created = fs.statSync(path.join(AGENTS_DIR, folder)).birthtime
      .toLocaleString();

    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';

    const chk = document.createElement('input');
    chk.type  = 'checkbox';
    chk.id    = `chk_${name}`;
    chk.value = name;

    const lbl = document.createElement('label');
    lbl.htmlFor = chk.id;
    lbl.textContent = `${name} — ${created}`;

    wrapper.appendChild(chk);
    wrapper.appendChild(lbl);
    listEl.appendChild(wrapper);
  });

  document.body.classList.add('has-intro');
})();