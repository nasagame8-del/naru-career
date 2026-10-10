import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
import fs from 'node:fs';import ts from 'typescript';
import Module from 'node:module';
function load(file){const m=new Module(file);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);return m.exports;}
const {MATCH_QUESTIONS,diagnose}=load('./src/app/shindan/_lib/matching.ts');const {TYPES16}=load('./src/app/shindan/_lib/data.ts');
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome'});const results=[];let cls=0;
const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
await p.addInitScript(()=>{window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
for(let profile=0;profile<16;profile++){
 await p.goto((process.env.QA_ORIGIN || 'http://127.0.0.1:3000') + '/shindan');await p.evaluate(()=>document.fonts.ready);await p.getByRole('button',{name:'冒険をはじめる'}).click();
 const axes=['initiative','focus','judgment','pace'];const answers=MATCH_QUESTIONS.map(q=>Boolean(profile&(1<<(3-axes.indexOf(q.axis))))?q.yesIsPositive:!q.yesIsPositive);
 for(const value of answers)await p.getByRole('button',{name:value?'はい':'いいえ',exact:true}).click();
 await p.locator('.result-title').waitFor();const expected=TYPES16[diagnose(answers)];const actual=await p.locator('.result-title').innerText();
 if(actual!==expected.name.split('（')[0])throw Error(`profile ${profile}: ${actual}`);
 const link=p.locator(`.type-hub-btn[href="/types/${expected.slug}"]`).first();await link.click();await p.waitForURL(`**/types/${expected.slug}`);
 const status=await p.request.get(p.url());if(status.status()!==200)throw Error(`type ${expected.slug} HTTP ${status.status()}`);
 results.push({profile,type:expected.name,url:p.url(),status:status.status()});
 cls=Math.max(cls,await p.evaluate(()=>window.__cls||0));
}
await p.goto((process.env.QA_ORIGIN || 'http://127.0.0.1:3000') + '/shindan');await p.getByRole('button',{name:'冒険をはじめる'}).focus();await p.keyboard.press('Enter');await p.getByRole('heading',{name:MATCH_QUESTIONS[0].text}).waitFor();
const keyboardStart=await p.locator('.rpg-question h1').evaluate(e=>e===document.activeElement);
await p.getByRole('button',{name:'はい',exact:true}).focus();await p.keyboard.press('Enter');await p.getByRole('heading',{name:MATCH_QUESTIONS[1].text}).waitFor();
const reducedMotion=await p.locator('.rpg-question').evaluate(e=>getComputedStyle(e).animationName);
fs.writeFileSync((process.env.QA_OUTPUT || '../../outputs') + '/e2e-all-types.json',JSON.stringify({results,errors,keyboardStart,reducedMotion,maxObservedCLS:cls},null,2));
await b.close();})();
