import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
import fs from 'node:fs';
const round=process.argv[2]||'round2';
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome'});
for(const width of [1440,390]){
 const p=await b.newPage({viewport:{width,height:width===390?844:1000}});const errors=[];const screenAudits=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.QA_ORIGIN || 'http://127.0.0.1:3000') + '/shindan');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);
 const snap=async(name,locator)=>{await p.waitForTimeout(250);screenAudits.push({screen:name,...await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),textOutside:[...document.querySelectorAll('h1,h2,p,button,a')].filter(e=>e.getClientRects().length && (e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > innerWidth+1)).map(e=>e.textContent.slice(0,50))}))});await (locator||p).screenshot({path:`${process.env.QA_OUTPUT || '../../outputs'}/${round}-${name}-${width}.png`});};
 await snap('title');await p.getByRole('button',{name:'16タイプを知る'}).click();await snap('types');await p.locator('.rpg-archive').screenshot({path:`${process.env.QA_OUTPUT || '../../outputs'}/${round}-types-full-${width}.png`});
 const links=await p.locator('.rpg-type').evaluateAll(els=>els.map(x=>x.getAttribute('href')));
 await p.getByRole('button',{name:'自分のタイプを診断する'}).click();await snap('quiz');
 await p.evaluate(()=>{window.dataLayer=window.dataLayer||[];});
 for(let q=0;q<19;q++){await p.getByRole('button',{name:'はい',exact:true}).click();await p.waitForTimeout(230);}
 await p.getByRole('button',{name:'はい',exact:true}).click();await p.locator('.rpg-matching').waitFor();await p.screenshot({path:`${process.env.QA_OUTPUT || '../../outputs'}/${round}-matching-${width}.png`});
 await p.locator('.result-title').waitFor();await snap('result');await p.locator('.rpg-status').scrollIntoViewIfNeeded();await snap('status',p.locator('.rpg-status'));
 await p.getByRole('tab',{name:'特徴',exact:true}).focus();await p.keyboard.press('ArrowRight');const tabWorks=await p.getByRole('tab',{name:'強み',exact:true}).getAttribute('aria-selected');
 const audit=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),events:window.dataLayer}));
 fs.writeFileSync(`${process.env.QA_OUTPUT || '../../outputs'}/${round}-audit-${width}.json`,JSON.stringify({width,errors,links,tabWorks,screenAudits,...audit},null,2));
 await p.close();
} await b.close();})();
