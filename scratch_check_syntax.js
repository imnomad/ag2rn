import fs from 'fs';
import vm from 'vm';

const code = fs.readFileSync('./public/js/app.js', 'utf-8');

try {
  new vm.Script(code);
  console.log('app.js syntax is 100% VALID!');
} catch (e) {
  console.error('app.js syntax ERROR:', e);
}
