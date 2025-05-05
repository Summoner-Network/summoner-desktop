// renderer/features/hosting/setup.js
;(async function(){
  const { initForm } = require('../../common/form-builder');

  // Initialize the dynamic form based on SDK defaults & tooltips
  window.addEventListener('DOMContentLoaded', () => {
    initForm('#server-form');
  });
})();
