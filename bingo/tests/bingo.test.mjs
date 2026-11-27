import test from 'node:test';
import assert from 'node:assert/strict';
import {blankCard,cardErrors,countFilled,winningLines,shuffledCells,swapCells,parseInvite,safeMarks} from '../core.mjs';
const complete=()=>({...blankCard(),title:'Test',creator:'Jojo',cells:Array.from({length:25},(_,i)=>i===12?'':`Prediction ${i+1}`)});
test('requires name, creator and every non-free prediction',()=>{const card=complete();assert.equal(cardErrors(card),'');card.cells[5]=' ';assert.match(cardErrors(card),/Fill every/);card.cells[5]='fine';card.title=' ';assert.match(cardErrors(card),/name/);card.title='Fine';card.creator='';assert.match(cardErrors(card),/nickname/);});
test('centre is optional only with free square enabled',()=>{const card=complete();assert.equal(countFilled(card),24);card.free_space=false;assert.match(cardErrors(card),/Fill every/);card.cells[12]='Another prediction';assert.equal(cardErrors(card),'');assert.equal(countFilled(card),25);});
test('finds rows, columns and both diagonals, but no false bingo',()=>{assert.equal(winningLines(new Set([0,1,2,3])).length,0);assert.equal(winningLines(new Set([5,6,7,8,9])).length,1);assert.equal(winningLines(new Set([2,7,12,17,22])).length,1);assert.equal(winningLines(new Set([0,6,12,18,24])).length,1);assert.equal(winningLines(new Set([4,8,12,16,20])).length,1);assert.equal(winningLines(new Set(Array.from({length:25},(_,i)=>i))).length,12);});
test('shuffle keeps the free centre fixed and preserves all predictions',()=>{const original=complete().cells;const mixed=shuffledCells(original,true,()=>0);assert.equal(mixed[12],'');assert.deepEqual([...mixed].sort(),[...original].sort());assert.notDeepEqual(mixed,original);assert.deepEqual(original,complete().cells);});
test('swapping preserves values and protects free square',()=>{const cells=complete().cells;const moved=swapCells(cells,1,24,true);assert.equal(moved[1],cells[24]);assert.equal(moved[24],cells[1]);assert.deepEqual(swapCells(cells,0,12,true),cells);assert.equal(swapCells(cells,0,12,false)[12],cells[0]);assert.deepEqual(swapCells(cells,-1,5,false),cells);});
test('invites accept fragment links and short or long tokens only',()=>{const short='abcdefghijklmnopqrstuv',long='a'.repeat(64);assert.equal(parseInvite(short),short);assert.equal(parseInvite(`https://joel-plourde.github.io/game-awards/bingo/#invite=${short}&card=123`),short);assert.equal(parseInvite(long),long);assert.equal(parseInvite('short'),'');assert.equal(parseInvite(`https://example.com/?invite=${short}`),'');});
test('restored progress rejects invalid indices and includes free square',()=>{const card=complete();assert.deepEqual([...safeMarks([0,4,99,-1,'3',3.2],card)],[0,4,12]);card.free_space=false;assert.deepEqual([...safeMarks(null,card)],[]);});

import {IDEA_POOL,randomIdeas,fillWithIdeas} from '../core.mjs';
test('2026 pool has exactly 200 unique, bounded, attributed predictions',()=>{
  assert.equal(IDEA_POOL.length,200);assert.equal(new Set(IDEA_POOL.map(i=>i.text.toLowerCase())).size,200);
  assert.ok(IDEA_POOL.every(i=>i.text.length<=120&&i.source&&i.id));
});
test('fill preserves manual entries and the free centre, without conflicting award winners',()=>{
  const card=blankCard();card.cells[0]='My personal prediction';
  const first=IDEA_POOL.find(i=>i.group==='award:indie');card.cells[3]=first.text;
  const {cells,added}=fillWithIdeas(card,()=>0.42);
  assert.equal(added,22);assert.equal(cells[0],'My personal prediction');assert.equal(cells[3],first.text);assert.equal(cells[12],'');
  const groups=cells.map(text=>IDEA_POOL.find(i=>i.text===text)?.group).filter(Boolean);
  assert.equal(groups.length,new Set(groups).size);assert.equal(new Set(cells.filter(Boolean)).size,24);
});
test('filling a full card leaves every prediction intact',()=>{
  const card=complete();assert.deepEqual(fillWithIdeas(card),{cells:card.cells,added:0});
});
test('suggestions draw from the full pool and fill 25 squares when centre is not free',()=>{
  const card=blankCard();card.free_space=false;
  const {cells,added}=fillWithIdeas(card,()=>0.1);assert.equal(added,25);assert.equal(new Set(cells).size,25);
  const a=randomIdeas(blankCard(),12,()=>0),b=randomIdeas(blankCard(),12,()=>.99);assert.notDeepEqual(a,b);
});
