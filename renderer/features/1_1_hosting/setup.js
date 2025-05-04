;(function(){
  const fs   = require('fs');
  const path = require('path');

  // Determine the SDK's desktop_data directory
  const projectRoot = process.cwd();
  const sdkDataDir  = path.join(projectRoot, 'working_space', 'summoner-src', 'desktop_data');

  // Load defaults and tooltips (with fallback)
  let defaults = {};
  let tooltips = {};
  try {
    defaults = JSON.parse(
      fs.readFileSync(
        path.join(sdkDataDir, 'default_config.json'),
        'utf-8'
      )
    );
    tooltips = JSON.parse(
      fs.readFileSync(
        path.join(sdkDataDir, 'tooltips.json'),
        'utf-8'
      )
    );
  } catch (err) {
    console.warn(
      'Could not load SDK default_config.json or tooltips.json; falling back to minimal defaults.',
      err
    );
    // Minimal fallback defaults
    defaults = {
      version: 'rss_2',
      hyper_parameters: {}
    };
    tooltips = {};
  }

  // Recursively build form fields
  function buildFields(container, obj, tipObj, prefix = '') {
    Object.entries(obj).forEach(([key, val]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      const tip  = tipObj && tipObj[key];

      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        // nested group
        const fieldset = document.createElement('fieldset');
        const legend   = document.createElement('legend');
        legend.textContent = key.replace(/_/g, ' ');
        fieldset.appendChild(legend);
        buildFields(fieldset, val, tipObj ? tipObj[key] : {}, name);
        container.appendChild(fieldset);
      } else {
        // primitive field
        const label = document.createElement('label');
        label.classList.add('form-group');
        if (tip) label.title = tip;  // tooltip on hover

        const span = document.createElement('span');
        span.textContent = key.replace(/_/g, ' ');
        label.appendChild(span);

        let input;
        if (typeof val === 'boolean') {
          input = document.createElement('input');
          input.type    = 'checkbox';
          input.checked = val;
        } else {
          input = document.createElement('input');
          input.type  = typeof val === 'number' ? 'number' : 'text';
          input.value = val;
        }
        input.name = name;
        label.appendChild(input);
        container.appendChild(label);
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('server-form');
    buildFields(form, defaults, tooltips);
  });
})();

