import {SAMPLE_CARD} from '../sample-card.mjs';
import {CENTRE,winningLines,safeMarks,swapCells,shuffledCells,fillWithIdeas} from '../core.mjs';
const $=id=>document.getElementById(id),clone=()=>({...SAMPLE_CARD,cells:[...SAMPLE_CARD.cells]});
let card=clone(),playing=false,marks=safeMarks([],card),selected=null,drag=null,resolveConfirm;
const say=text=>$('demo-status').textContent=text;
function confirmAction(title,text){$('demo-confirm-title').textContent=title;$('demo-confirm-text').textContent=text;$('demo-confirm').showModal();$('demo-cancel').focus();return new Promise(resolve=>resolveConfirm=resolve);}
function answer(value){$('demo-confirm').close();resolveConfirm?.(value);resolveConfirm=null;}
$('demo-confirm-button').addEventListener('click',()=>answer(true));$('demo-cancel').addEventListener('click',()=>answer(false));$('demo-confirm').addEventListener('cancel',event=>{event.preventDefault();answer(false);});
function resetProgress(){marks=safeMarks([],card);}
function swap(a,b){card.cells=swapCells(card.cells,a,b,true);selected=null;resetProgress();render();say(`Swapped squares ${a+1} and ${b+1}.`);}
function select(index){if(selected===index){selected=null;render();return;}if(selected!==null){swap(selected,index);return;}selected=index;render();say(`Square ${index+1} selected. Choose a second handle.`);}
function render(){
  $('demo-board-title').textContent=card.title||'Your bingo card';$('demo-board-creator').textContent=`A card by ${card.creator||'you'}`;
  $('edit-tools').hidden=playing;$('play-tools').hidden=!playing;$('demo-title').disabled=playing;$('demo-creator').disabled=playing;
  $('demo-edit').classList.toggle('active',!playing);$('demo-play').classList.toggle('active',playing);
  $('demo-edit').setAttribute('aria-current',playing?'false':'page');$('demo-play').setAttribute('aria-current',playing?'page':'false');
  $('demo-mode-label').textContent=playing?'PLAY MODE':'EDIT MODE';$('demo-mode-title').textContent=playing?'Make your calls.':'Make it your own.';
  $('demo-help').textContent=playing?'Tap squares as predictions happen. Tap again to unmark.':'Type in the squares. Drag a handle, or select two handles to swap them.';
  const lines=winningLines(marks),winning=new Set(lines.flat());$('demo-lines').textContent=lines.length;$('demo-marks').textContent=marks.size-1;
  $('demo-grid').replaceChildren();$('demo-grid').classList.toggle('active',playing);
  card.cells.forEach((text,index)=>{
    const free=index===CENTRE;
    if(playing){const button=document.createElement('button');button.className='play-cell';button.disabled=free;button.textContent=free?'★ FREE SPACE':text||'Empty prediction';button.setAttribute('aria-label',free?'Free space':text||`Empty square ${index+1}`);button.setAttribute('aria-pressed',String(marks.has(index)));button.classList.toggle('marked',marks.has(index));button.classList.toggle('winning',winning.has(index));button.addEventListener('click',()=>{marks.has(index)?marks.delete(index):marks.add(index);render();$('demo-grid').children[index].focus();say(winningLines(marks).length?'BINGO! A winning line.':'Demo progress stays in this tab.');});$('demo-grid').append(button);return;}
    const cell=document.createElement('div');cell.className='edit-cell';cell.dataset.index=index;
    if(free){cell.classList.add('free-cell');const star=document.createElement('span');star.className='demo-star';star.textContent='☆';const label=document.createElement('strong');label.textContent='FREE SPACE';cell.append(star,label);$('demo-grid').append(cell);return;}
    cell.classList.toggle('selected',selected===index);
    const number=document.createElement('span');number.className='cell-number';number.textContent=String(index+1).padStart(2,'0');
    const handle=document.createElement('button');handle.className='move-handle';handle.textContent='⠿';handle.setAttribute('aria-label',`Move demo square ${index+1}`);handle.setAttribute('aria-pressed',String(selected===index));handle.title='Drag, or select two handles to swap';
    handle.addEventListener('click',()=>{if(handle.dataset.suppress)return;select(index);});
    handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={index,x:event.clientX,y:event.clientY,handle,moved:false,target:null};handle.setPointerCapture(event.pointerId);});
    handle.addEventListener('pointermove',event=>{if(!drag)return;if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;drag.moved=true;cell.classList.add('dragging');for(const item of $('demo-grid').children)item.classList.remove('drop-target');const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.edit-cell[data-index]');drag.target=target&&Number(target.dataset.index)!==CENTRE?Number(target.dataset.index):null;if(drag.target!==null)target.classList.add('drop-target');});
    handle.addEventListener('pointerup',()=>{if(!drag)return;const previous=drag;drag=null;if(previous.moved){handle.dataset.suppress='true';setTimeout(()=>delete handle.dataset.suppress,100);if(previous.target!==null&&previous.target!==index){swap(index,previous.target);return;}}for(const item of $('demo-grid').children)item.classList.remove('drop-target','dragging');});
    handle.addEventListener('pointercancel',()=>{drag=null;for(const item of $('demo-grid').children)item.classList.remove('drop-target','dragging');});
    const input=document.createElement('textarea');input.value=text;input.maxLength=120;input.placeholder='Your prediction…';input.setAttribute('aria-label',`Demo prediction ${index+1}`);input.addEventListener('input',()=>{card.cells[index]=input.value;resetProgress();});cell.append(number,handle,input);$('demo-grid').append(cell);
  });
}
$('demo-edit').addEventListener('click',()=>{playing=false;render();});$('demo-play').addEventListener('click',()=>{playing=true;selected=null;render();});
$('demo-title').addEventListener('input',event=>{card.title=event.target.value;$('demo-board-title').textContent=card.title||'Your bingo card';});$('demo-creator').addEventListener('input',event=>{card.creator=event.target.value;$('demo-board-creator').textContent=`A card by ${card.creator||'you'}`;});
$('demo-fill').addEventListener('click',()=>{const result=fillWithIdeas(card);if(!result.added){say('Your card is full. Reset predictions first to generate a new card.');return;}card.cells=result.cells;resetProgress();render();say(`${result.added} predictions added from the 200-idea pool.`);});
$('demo-shuffle').addEventListener('click',()=>{card.cells=shuffledCells(card.cells,true);resetProgress();render();say('Your predictions, in a new arrangement.');});
$('demo-clear').addEventListener('click',async()=>{if(!await confirmAction('Reset predictions?','This clears all demo predictions while keeping the card name and creator.'))return;card.cells=Array(25).fill('');resetProgress();render();say('Predictions cleared. Try Fill with ideas.');});
$('demo-reset').addEventListener('click',async()=>{if(!await confirmAction('Reset marks?','Your predictions stay. Only demo play progress will reset.'))return;resetProgress();render();say('Marks reset. Ready for a fresh round.');});
$('demo-restore').addEventListener('click',async()=>{if(!await confirmAction('Restore Jojo sample?','This replaces your demo edits and marks with the original sample.'))return;card=clone();$('demo-title').value=card.title;$('demo-creator').value=card.creator;resetProgress();render();say('Jojo’s sample restored.');});
render();
