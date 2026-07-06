const fs = require('fs');
const pkg = require('../package.json');
fs.writeFileSync('src/app/version.ts', `export const APP_VERSION = '${pkg.version}';\n`);
