// The review uses the game's actual motion functions, not an unrelated sine demo.
import {readFile,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile('src/lib/aqua3d/anatomy.ts','utf8');
await writeFile('design/aqua3d-review/runtime-swim.mjs','// Generated from src/lib/aqua3d/anatomy.ts by build-swim-preview.mjs\n'+stripTypeScriptTypes(source).replace(/[^\S\r\n]+$/gm,''));
