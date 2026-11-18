import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('story.html')
  .replace('<!-- STORY_STYLE -->',()=>'<style>'+read('story.css')+'</style>')
  .replace('<!-- STORY_DATA -->',()=>'<script>'+read('story-data.js')+'</script>')
  .replace('<!-- STORY_SCRIPT -->',()=>'<script>'+read('application-art.js')+'</script>\n<script>'+read('story.js')+'</script>');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/index.html'),html);
console.log('Built standalone preview:',path.join(root,'dist/index.html'));
