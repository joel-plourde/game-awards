export const SIZE = 5;
export const CENTRE = 12;
export const IDEAS = [
  'A surprise world premiere', 'Someone says “world premiere” twice', 'A trailer with no release date',
  'A game gets a surprise release', 'A very unexpected celebrity cameo', 'A sequel nobody saw coming',
  'An indie game steals the spotlight', 'A remake gets announced', 'The orchestra goes all out',
  'A speech gets wonderfully emotional', 'Someone thanks their dog', 'A trailer opens with a mysterious voice',
  'An audience reaction becomes a meme', 'A game gets delayed', 'A familiar franchise makes a comeback',
  'A “one more thing” moment', 'A developer wears a great jacket', 'A musical performance gives you chills',
  'Someone forgets to thank someone', 'An acceptance speech goes off script', 'A studio reveals a brand-new IP',
  'A trailer includes a giant monster', 'The host makes a self-aware joke', 'Your GOTY pick takes the trophy',
  'A release date is finally revealed', 'A crossover nobody predicted', 'A teaser leaves everyone confused',
  'An expansion gets announced', 'The crowd gives a standing ovation', 'A game is coming “next year”',
  'An adorable creature appears', 'A developer says “passion project”', 'A trailer features a dramatic sword',
  'A new co-op adventure is revealed', 'A surprise guest walks on stage', 'A soundtrack wins you over'
];
export function blankCard(){ return { title:'', creator:'', free_space:true, cells:Array(25).fill('') }; }
export function countFilled(card){ return card.cells.filter((text,i)=>(!card.free_space||i!==CENTRE)&&text.trim()).length; }
export function cardErrors(card){
  if(typeof card.title!=='string'||!card.title.trim()||card.title.trim().length>60) return 'Give your card a name (up to 60 characters).';
  if(typeof card.creator!=='string'||!card.creator.trim()||card.creator.trim().length>40) return 'Add your name or nickname (up to 40 characters).';
  if(typeof card.free_space!=='boolean'||!Array.isArray(card.cells)||card.cells.length!==25) return 'Your card needs 25 squares.';
  if(card.cells.some((t,i)=>typeof t!=='string'||t.length>120||(!t.trim()&&!(card.free_space&&i===CENTRE)))) return 'Fill every prediction square before saving (up to 120 characters each).';
  return '';
}
export function winningLines(marked){
  const lines=[];
  for(let row=0;row<5;row++) lines.push(Array.from({length:5},(_,col)=>row*5+col));
  for(let col=0;col<5;col++) lines.push(Array.from({length:5},(_,row)=>row*5+col));
  lines.push([0,6,12,18,24],[4,8,12,16,20]);
  return lines.filter(line=>line.every(i=>marked.has(i)));
}
export function shuffledCells(cells,freeSpace,random=Math.random){
  const pool=cells.filter((_,i)=>!freeSpace||i!==CENTRE);
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  let next=0;return cells.map((_,i)=>freeSpace&&i===CENTRE?'':pool[next++]);
}
export function swapCells(cells,a,b,freeSpace){
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>24||b>24||(freeSpace&&(a===CENTRE||b===CENTRE))) return [...cells];
  const copy=[...cells]; [copy[a],copy[b]]=[copy[b],copy[a]]; return copy;
}
export function parseInvite(value){
  const text=String(value).trim();
  if(/^(?:[A-Za-z0-9_-]{22}|[a-f0-9]{64})$/.test(text)) return text;
  try { const hash=new URL(text).hash;const code=new URLSearchParams(hash.slice(1)).get('invite')||'';return /^(?:[A-Za-z0-9_-]{22}|[a-f0-9]{64})$/.test(code)?code:''; }catch{return '';}
}
export function safeMarks(value,card){
  const marks=new Set(Array.isArray(value)?value.filter(n=>Number.isInteger(n)&&n>=0&&n<25):[]);
  if(card.free_space) marks.add(CENTRE);return marks;
}
