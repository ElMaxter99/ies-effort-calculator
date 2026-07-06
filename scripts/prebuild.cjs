const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
fs.writeFileSync('src/app/version.ts', `export const APP_VERSION = '${pkg.version}';\n`);

const workerSrc = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const workerDest = path.resolve(__dirname, '../public/pdf.worker.min.mjs');
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
}
