import { readFileSync, writeFileSync } from 'fs';
const file = 'src/app/main/company_create/page.tsx';
let content = readFileSync(file, 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('showOnlyLatest'));
console.log('Before:', lines[idx]);
