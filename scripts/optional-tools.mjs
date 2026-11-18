import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);

async function loadTool(name,environmentVariable){
 const override=process.env[environmentVariable]?.trim();
 try{
  const specifier=override
   ? override.startsWith('file:')?override:pathToFileURL(require.resolve(resolve(override))).href
   : name;
  return await import(specifier);
 }catch(cause){
  throw new Error(`Unable to load optional tool "${name}". Install it in this project with npm install --no-save ${name}, or set ${environmentVariable} to an existing module file or package directory.`,{cause});
 }
}

export function loadPlaywright(){return loadTool('playwright','PLAYWRIGHT_MODULE_PATH');}

export async function loadSharp(){
 const module=await loadTool('sharp','SHARP_MODULE_PATH');
 return module.default??module;
}
