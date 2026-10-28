// Content validation tool (Phase 5): node tools/validate-content.mjs
// Loads the pure data modules (no browser needed) and prints missing references, invalid ids and
// rule violations. Exit code 1 when there are errors, so it can gate a build.
import { validateContent } from '../src/data/registry.js';

const r = validateContent();
console.log('CONTENT COUNTS');
for (const [k, v] of Object.entries(r.counts)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(`\nERRORS (${r.errors.length})`);
for (const e of r.errors) console.log(`  x ${e}`);
console.log(`\nWARNINGS (${r.warnings.length})`);
for (const w of r.warnings) console.log(`  ! ${w}`);
console.log(r.ok ? '\nVALID' : '\nINVALID');
process.exit(r.ok ? 0 : 1);
