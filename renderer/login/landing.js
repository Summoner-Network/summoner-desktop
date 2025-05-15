;(function(){
  const path           = require('path');
  const { renderGrid } = require('../common/scanner');

  const featuresDir = __dirname;
  const grid        = document.getElementById('feature-grid');

  renderGrid(grid, featuresDir, {
    baseUrl: '..',
    onDir: (name) => {
        // window.location.href = `'../landing/landing.html'`;
    }
  });
})();
