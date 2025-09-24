// 1_1_button_generate_and_run.js
const fs            = require('fs');
const path          = require('path');

module.exports = function() {
  // 1) Gather all form values into a nested `config` object
  const config = {};
  document.querySelectorAll('#server-form [name]').forEach(el => {
    const parts = el.name.split('.');
    let ptr = config;
    parts.forEach((key, i) => {
      if (i === parts.length - 1) {
        ptr[key] = (el.type === 'checkbox')
          ? el.checked
          : (el.type === 'number')
            ? Number(el.value)
            : el.value;
      } else {
        ptr[key] = ptr[key] || {};
        ptr = ptr[key];
      }
    });
  });

  // 2) Send it to main.js for venv/install/write/run
  window.summoner.generateAndRun(config)
    .catch(err => console.error('Failed to start server:', err));
};
