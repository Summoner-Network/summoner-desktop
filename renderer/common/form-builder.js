// renderer/common/form-builder.js
// Shared form builder: fetches JSON defaults/tooltips and populates a form container.

/**
 * Fetch configuration JSON from the main process via IPC.
 * Returns an object with { defaults, tooltips }.
 */
async function fetchConfig() {
  let defaults, tooltips;
  try {
    defaults = await window.api.loadDefaults();
    tooltips = await window.api.loadTooltips();
  } catch (e) {
    console.warn('Could not load SDK JSON, using minimal defaults', e);
    defaults = { version: 'rss_2', hyper_parameters: {} };
    tooltips = {};
  }
  return { defaults, tooltips };
}

/**
 * Recursively build form fields based on a defaults object and tooltips.
 * @param {HTMLElement} container - The <form> or container element
 * @param {object} obj - The defaults object hierarchy
 * @param {object} tipObj - The tooltips hierarchy
 * @param {string} prefix - Internal: dot-prefixed path for nested keys
 */
function buildFields(container, obj, tipObj, prefix = '') {
  Object.entries(obj).forEach(([key, val]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    const tip  = tipObj && tipObj[key];

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const fieldset = document.createElement('fieldset');
      const legend   = document.createElement('legend');
      legend.textContent = key.replace(/_/g, ' ');
      fieldset.appendChild(legend);
      buildFields(fieldset, val, tipObj ? tipObj[key] : {}, name);
      container.appendChild(fieldset);
    } else {
      const label = document.createElement('label');
      label.classList.add('form-group');
      if (tip) label.title = tip;

      const span = document.createElement('span');
      span.textContent = key.replace(/_/g, ' ');
      label.appendChild(span);

      const input = document.createElement('input');
      if (typeof val === 'boolean') {
        input.type    = 'checkbox';
        input.checked = val;
      } else if (typeof val === 'number') {
        input.type  = 'number';
        input.value = val;
      } else {
        input.type  = 'text';
        input.value = val;
      }
      input.name = name;
      label.appendChild(input);
      container.appendChild(label);
    }
  });
}

/**
 * Initialize and render a form in the given selector.
 * @param {string} formSelector - CSS selector for the form container (e.g., '#server-form')
 */
export async function initForm(formSelector) {
  const { defaults, tooltips } = await fetchConfig();
  const form = document.querySelector(formSelector);
  if (!form) {
    console.error(`Form container not found: ${formSelector}`);
    return;
  }
  buildFields(form, defaults, tooltips);
}
