// renderer/common/form-builder.js

async function fetchConfig() {
  let defaults, tooltips;
  try {
    defaults = await window.summoner.loadDefaults();
    tooltips = await window.summoner.loadTooltips();
  } catch (e) {
    console.warn('Could not load SDK JSON; using minimal defaults.', e);
    defaults = { version: 'rss_2', hyper_parameters: {} };
    tooltips = {};
  }
  return { defaults, tooltips };
}

// -------- simple portal tooltip -------------------------------------------
function attachTooltip(icon) {
  const txt = icon.getAttribute('data-tip');
  if (!txt) return;                       // nothing to show

  function show() {
    // 1) create
    const tip = document.createElement('div');
    tip.className = 'tooltip-box';
    tip.textContent = txt;
    document.body.appendChild(tip);

    // 2) position (centered above the icon, 6 px gap)
    const r   = icon.getBoundingClientRect();
    const tr  = tip.getBoundingClientRect();      // width after paint
    const left = Math.round(r.left + r.width/2 - tr.width/2);
    const top  = Math.round(r.top  - tr.height - 6);
    tip.style.left = `${Math.max(4, Math.min(left, window.innerWidth - tr.width - 4))}px`;
    tip.style.top  = `${Math.max(4, top)}px`;

    // 3) fade in
    requestAnimationFrame(() => tip.classList.add('show'));
    icon._tip = tip;
  }

  function hide() {
    if (icon._tip) {
      icon._tip.remove();
      icon._tip = null;
    }
  }

  icon.addEventListener('mouseenter', show);
  icon.addEventListener('mouseleave', hide);
  icon.addEventListener('blur',      hide);   // keyboard support
}


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
      // --- primitive field ---
      const label = document.createElement('label');
      label.classList.add('form-group');
      if (tip) {
        label.setAttribute('data-tip', tip);        // tooltip on the label
      }

      const span = document.createElement('span');
      span.textContent = key.replace(/_/g, ' ');
      label.appendChild(span);

    // if we have a tip, add an explicit icon with data-tip
    if (tip) {
        const icon = document.createElement('span');
        icon.classList.add('tooltip-icon');
        icon.setAttribute('data-tip', tip);
        icon.textContent = 'ℹ️';          // or any small “i” icon you like
        label.appendChild(icon);

        attachTooltip(icon);
    }

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
      if (tip) {
        input.setAttribute('data-tip', tip);        // **also** tooltip on the input
      }

      label.appendChild(input);
      container.appendChild(label);
    }
  });
}

async function initForm(formSelector) {
  const { defaults, tooltips } = await fetchConfig();
  const form = document.querySelector(formSelector);
  if (!form) {
    console.error(`Form container not found: ${formSelector}`);
    return;
  }
  buildFields(form, defaults, tooltips);
}

module.exports = { initForm };
