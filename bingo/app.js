import {CENTRE,IDEAS,blankCard,countFilled,cardErrors,winningLines,shuffledCells,swapCells,parseInvite,safeMarks,randomIdeas,fillWithIdeas} from './core.mjs';
import {API_URL as ENDPOINT} from './config.js';
const $=id=>document.getElementById(id);
const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','#i-'+name);svg.append(use);return svg;};
const textNode=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const storage={get(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}},remove(key){try{localStorage.removeItem(key);}catch{}}};
let token='',roomId='',cards=[],draft=blankCard(),dirty=false,selectedMove=null,activeView='editor',current=null,playing=false,marks=new Set(),toastTimer,dialogResolve,drag=null,refreshing=false,booting=false;
let saving=false,storageWarning=false,deleting=false;
const draftKey=()=>`awards-night:draft:${roomId}`;
const progressKey=()=>`awards-night:progress:${roomId}:${current.id}`;
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?6500:3800);}
function confirmDialog(title,description,confirmText='Continue',danger=false){
  if(dialogResolve)finishDialog(false);
  $('dialog-title').textContent=title;$('dialog-description').textContent=description;$('dialog-content').replaceChildren();
  $('dialog-confirm').textContent=confirmText;$('dialog-confirm').classList.toggle('danger',danger);$('dialog-cancel').hidden=false;
  $('confirm-dialog').showModal();$('dialog-cancel').focus();
  return new Promise(resolve=>dialogResolve=resolve);
}
function finishDialog(result){$('confirm-dialog').close();const resolve=dialogResolve;dialogResolve=null;resolve?.(result);}
$('dialog-confirm').addEventListener('click',()=>finishDialog(true));$('dialog-cancel').addEventListener('click',()=>finishDialog(false));$('dialog-close').addEventListener('click',()=>finishDialog(false));$('confirm-dialog').addEventListener('cancel',e=>{e.preventDefault();finishDialog(false);});
async function copyText(value,label){
  try{await navigator.clipboard.writeText(value);toast(label);}
  catch{const pending=confirmDialog('Your private link','Copy this link and send it to your people. Anyone with it can view and edit the cards.','Done');$('dialog-cancel').hidden=true;const input=document.createElement('input');input.value=value;input.readOnly=true;input.setAttribute('aria-label','Private invitation link');input.addEventListener('focus',()=>input.select());$('dialog-content').append(input);input.focus();input.select();await pending;}
}
function shareUrl(cardId){const url=new URL('./',location.href);url.hash=new URLSearchParams({invite:token,...(cardId?{card:cardId}:{})}).toString();return url.href;}
async function api(action,payload={}){
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),20000);
  try{
    const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action,payload}),signal:ctrl.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    let data;try{data=await response.json();}catch{throw Error('The room is temporarily unavailable. Please try again.');}
    if(!response.ok||data.error){const messages={invalid_invitation:'This invitation is invalid or has expired. Ask your host for a new link.',rate_limited:'A lot of activity in the room! Wait a minute and try again.',conflict:'This card was changed by someone else. Your draft is safe. Open the latest card from the collection before editing it again.',not_found:'This card has been removed from the collection.',room_full:'This room has reached its 250-card limit.',invalid_input:'Check the card details and fill every prediction square.'};const error=Error(messages[data.error]||'Could not connect to the room. Please try again.');error.code=data.error;throw error;}
    $('connection-state').classList.remove('error');return data;
  }catch(error){$('connection-state').classList.add('error');if(error.name==='AbortError')throw Error('The room took too long to respond. Your draft is still here. Try again.');if(error instanceof TypeError)throw Error('Could not reach the room. Check your connection and try again.');throw error;}
  finally{clearTimeout(timeout);}
}
function saveDraft(){
  dirty=true;$('draft-status').textContent=draft.id?'Editing saved card':'Unsaved draft';
  const ok=storage.set(draftKey(),draft);if(!ok&&!storageWarning){storageWarning=true;toast('Local storage is unavailable. Keep this tab open until you save your card.',true);}
  updateEditorMeta();
}
function updateEditorMeta(){
  $('preview-name').textContent=draft.title.trim()||'Your next winning card';$('preview-player').textContent=draft.creator.trim()?`A card by ${draft.creator.trim()}`:'A card by you';
  const filled=countFilled(draft),total=draft.free_space?24:25;$('filled-count').textContent=`${filled} / ${total}`;$('fill-progress').max=total;$('fill-progress').value=filled;
  $('save-card').replaceChildren(icon('check'),document.createTextNode(draft.id?'Save changes':'Save to collection'));
  $('delete-edit-card').hidden=!draft.id;
  for(const button of $('idea-pool').children)button.classList.toggle('used',draft.cells.includes(button.dataset.idea));
}
function createFreeCell(className){const cell=document.createElement('div');cell.className=className+' free-cell';cell.append(icon('star'),textNode('strong','FREE SPACE'),textNode('small','A little head start'));return cell;}
function renderEditGrid(focusIndex){
  selectedMove=null;$('edit-grid').replaceChildren();
  draft.cells.forEach((value,i)=>{
    if(draft.free_space&&i===CENTRE){const free=createFreeCell('edit-cell');free.setAttribute('aria-label','Free centre square');$('edit-grid').append(free);return;}
    const cell=document.createElement('div');cell.className='edit-cell';cell.dataset.index=i;
    const number=textNode('span',String(i+1).padStart(2,'0'),'cell-number');number.setAttribute('aria-hidden','true');
    const handle=document.createElement('button');handle.className='move-handle';handle.type='button';handle.dataset.index=i;handle.append(icon('grip'));handle.title='Drag to move, or select two handles to swap';handle.setAttribute('aria-label',`Move square ${i+1}. Select this handle, then another to swap.`);handle.setAttribute('aria-pressed','false');
    handle.addEventListener('click',()=>{if(handle.dataset.suppressClick){delete handle.dataset.suppressClick;return;}selectMove(i);});
    handle.addEventListener('pointerdown',e=>startDrag(e,i,handle));handle.addEventListener('pointermove',moveDrag);handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',cancelDrag);
    handle.addEventListener('keydown',e=>{if(e.key==='Escape'){clearMove();return;}const delta={ArrowRight:1,ArrowLeft:-1,ArrowUp:-5,ArrowDown:5}[e.key];if(delta){e.preventDefault();let next=i+delta;while(next>=0&&next<25){const target=$('edit-grid').querySelector(`.move-handle[data-index="${next}"]`);if(target){target.focus();break;}next+=delta;}}});
    const input=document.createElement('textarea');input.value=value;input.maxLength=120;input.placeholder='Your prediction…';input.setAttribute('aria-label',`Prediction ${i+1}, row ${Math.floor(i/5)+1}, column ${i%5+1}`);input.setAttribute('spellcheck','true');input.addEventListener('input',()=>{draft.cells[i]=input.value;saveDraft();});
    cell.append(number,handle,input);$('edit-grid').append(cell);
  });
  if(focusIndex!==undefined)$('edit-grid').querySelector(`.move-handle[data-index="${focusIndex}"]`)?.focus();
}
function clearMove(){selectedMove=null;for(const cell of $('edit-grid').children)cell.classList.remove('selected');for(const handle of $('edit-grid').querySelectorAll('.move-handle'))handle.setAttribute('aria-pressed','false');$('move-status').textContent='Anything could happen. Put it on your card.';}
function selectMove(i){if(selectedMove===i){clearMove();return;}if(selectedMove===null){selectedMove=i;const cell=$('edit-grid').children[i];cell.classList.add('selected');cell.querySelector('button').setAttribute('aria-pressed','true');$('move-status').textContent=`Square ${i+1} selected. Choose another square’s handle to swap.`;}else{const from=selectedMove;swapSquare(from,i);}}
function swapSquare(from,to){draft.cells=swapCells(draft.cells,from,to,draft.free_space);saveDraft();renderEditGrid(to);$('move-status').textContent=`Swapped squares ${from+1} and ${to+1}.`;}
function startDrag(event,i,handle){if(event.button!==0)return;drag={from:i,x:event.clientX,y:event.clientY,moved:false,target:null,handle};handle.setPointerCapture(event.pointerId);}
function moveDrag(event){if(!drag)return;if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;drag.moved=true;drag.handle.closest('.edit-cell').classList.add('dragging');for(const cell of $('edit-grid').children)cell.classList.remove('drop-target');const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.edit-cell[data-index]');drag.target=target?Number(target.dataset.index):null;if(target&&drag.target!==drag.from)target.classList.add('drop-target');}
function endDrag(){if(!drag)return;const info=drag;if(info.moved){info.handle.dataset.suppressClick='true';setTimeout(()=>delete info.handle.dataset.suppressClick,100);const target=info.target;cancelDrag();if(target!==null&&target!==info.from)swapSquare(info.from,target);}else cancelDrag();}
function cancelDrag(){for(const cell of $('edit-grid').children)cell.classList.remove('dragging','drop-target');drag=null;}
function setDraft(value,isDirty=false){draft={...value,cells:[...value.cells]};dirty=isDirty;$('card-name').value=draft.title;$('player-name').value=draft.creator;$('free-space').checked=draft.free_space;$('draft-status').textContent=isDirty?'Restored draft':draft.id?'Editing saved card':'New card';renderEditGrid();updateEditorMeta();}
function setView(view){activeView=view;for(const id of ['editor','gallery','card-view'])$(id).hidden=id!==view;$('create-tab').classList.toggle('active',view==='editor');$('gallery-tab').classList.toggle('active',view!=='editor');$('create-tab').toggleAttribute('aria-current',view==='editor');$('gallery-tab').toggleAttribute('aria-current',view!=='editor');if(view==='editor')$('create-tab').setAttribute('aria-current','page');else $('gallery-tab').setAttribute('aria-current','page');if(view==='gallery')renderGallery();if(view!=='card-view'){document.body.classList.remove('focus');$('exit-focus').hidden=true;playing=false;const url=new URL(location.href);url.hash=new URLSearchParams({invite:token});history.replaceState(null,'',url);}}
function renderIdeas(){$('idea-pool').replaceChildren();for(const idea of randomIdeas(draft,12)){const button=textNode('button',idea,'idea-chip');button.dataset.idea=idea;button.addEventListener('click',()=>{const i=draft.cells.findIndex((t,i)=>!(draft.free_space&&i===CENTRE)&&!t.trim());if(i<0){toast('Your card is full. Edit a square or shuffle your layout.');return;}draft.cells[i]=idea;saveDraft();renderEditGrid();toast('Prediction added.');});$('idea-pool').append(button);}}
function miniBoard(card){const button=document.createElement('button');button.className='mini-board';button.setAttribute('aria-label',`View ${card.title} by ${card.creator}`);button.addEventListener('click',()=>openCard(card.id));const label=textNode('span','THE GAME AWARDS','mini-title');label.append(icon('grid'));const grid=document.createElement('span');grid.className='mini-grid';card.cells.forEach((text,i)=>{const cell=textNode('span',card.free_space&&i===CENTRE?'':text,'mini-square');if(card.free_space&&i===CENTRE){cell.classList.add('free');cell.append(icon('star'));}grid.append(cell);});button.append(label,grid);return button;}
function renderGallery(){
  const search=$('card-search').value.toLocaleLowerCase().trim(),sort=$('card-sort').value;
  const visible=cards.filter(c=>`${c.title} ${c.creator}`.toLocaleLowerCase().includes(search)).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title):sort==='creator'?a.creator.localeCompare(b.creator):new Date(b.updated_at)-new Date(a.updated_at));
  $('gallery-grid').replaceChildren();$('card-count').textContent=cards.length;$('gallery-empty').hidden=visible.length>0;
  if(!visible.length){$('gallery-empty').querySelector('h3').textContent=search?'No matching cards.':'No calls on the board. Yet.';$('gallery-empty').querySelector('p').textContent=search?'Try a different card name or creator.':'Every great bingo night starts with a few bold predictions.';$('empty-create').hidden=!!search;}
  for(const card of visible){const article=document.createElement('article');article.className='gallery-card';const footer=document.createElement('div');footer.className='gallery-card-bottom';const date=textNode('span',new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(card.updated_at)),'card-date');const open=textNode('button','View card','button subtle small');open.append(icon('arrow'));open.addEventListener('click',()=>openCard(card.id));footer.append(date,open);article.append(miniBoard(card),textNode('h3',card.title),textNode('p',`By ${card.creator}`),footer);$('gallery-grid').append(article);}
}
async function refreshCards(showFeedback=false){if(refreshing)return;refreshing=true;$('refresh-cards').disabled=true;try{const data=await api('list');cards=data.cards;renderGallery();if(showFeedback)toast('Collection refreshed.');}catch(e){if(showFeedback)toast(e.message,true);}finally{refreshing=false;$('refresh-cards').disabled=false;}}
async function openCard(id){
  try{const data=await api('get',{id});current=data.card;playing=false;const saved=storage.get(progressKey());marks=safeMarks(saved?.version===current.version?saved.marks:[],current);setView('card-view');$('view-title').textContent=current.title;$('view-player').textContent=`A card by ${current.creator}`;renderPlay();const url=new URL(location.href);url.hash=new URLSearchParams({invite:token,card:current.id});history.replaceState(null,'',url);$('card-view').scrollIntoView({behavior:'smooth',block:'start'});}
  catch(e){toast(e.message,true);}
}
function renderPlay(){
  const lines=winningLines(marks),winning=new Set(lines.flat());$('play-grid').replaceChildren();$('play-grid').classList.toggle('active',playing);
  current.cells.forEach((text,i)=>{const button=document.createElement('button');button.className='play-cell';button.disabled=!playing||(current.free_space&&i===CENTRE);button.setAttribute('aria-label',`${current.free_space&&i===CENTRE?'Free space':text}${marks.has(i)?', marked':''}`);button.setAttribute('aria-pressed',String(marks.has(i)));if(marks.has(i))button.classList.add('marked');if(winning.has(i))button.classList.add('winning');if(current.free_space&&i===CENTRE){button.classList.add('free-cell');button.append(icon('star'),textNode('strong','FREE SPACE'));}else button.textContent=text;
    button.addEventListener('click',()=>{const before=winningLines(marks).length;if(marks.has(i))marks.delete(i);else marks.add(i);const ok=storage.set(progressKey(),{version:current.version,marks:[...marks]});if(!ok)toast('Your marks could not be saved on this device. Keep this tab open.',true);renderPlay();$('play-grid').children[i].focus({preventScroll:true});const after=winningLines(marks).length;if(after>before)toast(after===1?'BINGO! That’s a winning call.':`${after} bingo lines. You’re on a roll!`);});$('play-grid').append(button);});
  $('play-toggle').replaceChildren(icon(playing?'close':'play'),document.createTextNode(playing?'Leave bingo mode':'Enter bingo mode'));$('play-stats').hidden=!playing;$('marked-count').textContent=marks.size-(current.free_space?1:0);$('line-count').textContent=lines.length;$('bingo-banner').hidden=lines.length===0;
  $('play-eyebrow').textContent=playing?'03 / LET THE SHOW BEGIN':'READY WHEN YOU ARE';$('play-title').textContent=playing?'Make every moment count.':'Your front-row seat.';$('play-description').textContent=playing?'Tap a prediction when it happens. We’ll spot your bingo lines for you.':'Open bingo mode when the show starts. Tap a square as each prediction comes true.';
}
async function freshCard(){if(dirty&&!await confirmDialog('Start a fresh card?','Your current draft will be cleared. Save it to the collection first if you want to keep it.','Start fresh'))return;storage.remove(draftKey());setDraft(blankCard());setView('editor');}
async function saveCard(){
  if(saving)return;const error=cardErrors(draft);if(error){toast(error,true);if(!draft.title.trim())$('card-name').focus();else if(!draft.creator.trim())$('player-name').focus();else{const i=draft.cells.findIndex((t,i)=>!(draft.free_space&&i===CENTRE)&&!t.trim());$('edit-grid').children[i]?.querySelector('textarea')?.focus();}return;}
  saving=true;const buttons=[$('save-card'),$('new-card'),$('shuffle-card'),$('fill-ideas')];buttons.forEach(b=>b.disabled=true);$('editor').inert=true;
  try{const payload={title:draft.title.trim(),creator:draft.creator.trim(),free_space:draft.free_space,cells:draft.cells.map((t,i)=>draft.free_space&&i===CENTRE?'':t.trim()),...(draft.id?{id:draft.id,version:draft.version}:{})};const data=await api(draft.id?'update':'create',payload);dirty=false;storage.remove(draftKey());setDraft(blankCard());cards=[data.card,...cards.filter(c=>c.id!==data.card.id)];$('card-count').textContent=cards.length;toast('Card saved to your collection.');await openCard(data.card.id);}
  catch(e){toast(e.message,true);}finally{saving=false;buttons.forEach(b=>b.disabled=false);$('editor').inert=false;}
}
$('card-name').addEventListener('input',e=>{draft.title=e.target.value;saveDraft();});$('player-name').addEventListener('input',e=>{draft.creator=e.target.value;saveDraft();});
$('free-space').addEventListener('change',async e=>{const checked=e.target.checked;if(checked&&draft.cells[CENTRE].trim()&&!await confirmDialog('Make the centre a free space?','The prediction currently in your centre square will be removed.','Use free space')){e.target.checked=false;return;}draft.free_space=checked;if(checked)draft.cells[CENTRE]='';saveDraft();renderEditGrid();});
$('save-card').addEventListener('click',saveCard);$('new-card').addEventListener('click',freshCard);
$('shuffle-card').addEventListener('click',()=>{draft.cells=shuffledCells(draft.cells,draft.free_space);saveDraft();renderEditGrid();toast('Same predictions. Fresh arrangement.');});
$('fill-ideas').addEventListener('click',()=>{
  const result=fillWithIdeas(draft);
  if(!result.added){toast('Your card is full. Use Reset predictions for a fresh random card.');return;}
  draft.cells=result.cells;saveDraft();renderEditGrid();renderIdeas();toast(`${result.added} predictions added from the 200-idea pool.`);
});
$('refresh-ideas').addEventListener('click',()=>{renderIdeas();toast('Fresh predictions from the 200-idea pool.');});
$('reset-card').addEventListener('click',async()=>{
  if(!countFilled(draft)){toast('Your prediction squares are already empty.');return;}
  const description=draft.id?'This clears every prediction in the editor. Your name, creator and free-space setting stay. Save changes to update the shared card.':'This clears every prediction. Your card name, creator and free-space setting stay.';
  if(!await confirmDialog('Reset all predictions?',description,'Reset predictions'))return;
  draft.cells=Array(25).fill('');saveDraft();renderEditGrid();renderIdeas();toast('Predictions cleared. Your card details are kept.');
});
$('create-tab').addEventListener('click',()=>setView('editor'));$('gallery-tab').addEventListener('click',()=>{setView('gallery');refreshCards();});$('back-collection').addEventListener('click',()=>{setView('gallery');refreshCards();});
for(const id of ['gallery-create','empty-create'])$(id).addEventListener('click',()=>{setView('editor');$('card-name').focus();});
$('card-search').addEventListener('input',renderGallery);$('card-sort').addEventListener('change',renderGallery);$('refresh-cards').addEventListener('click',()=>refreshCards(true));
$('invite-button').addEventListener('click',()=>copyText(shareUrl(),'Private room link copied. Share it with your people.'));
$('share-card').addEventListener('click',()=>copyText(shareUrl(current.id),'Private card link copied.'));
$('print-card').addEventListener('click',()=>window.print());
$('play-toggle').addEventListener('click',()=>{playing=!playing;if(!playing){document.body.classList.remove('focus');$('exit-focus').hidden=true;}renderPlay();});
$('reset-marks').addEventListener('click',async()=>{if(await confirmDialog('Clear your marks?','This resets your play progress on this device. The saved card stays in your collection.','Reset marks')){marks=safeMarks([],current);storage.set(progressKey(),{version:current.version,marks:[...marks]});renderPlay();toast('Fresh board. Ready for another round.');}});
$('focus-mode').addEventListener('click',()=>{document.body.classList.add('focus');$('exit-focus').hidden=false;scrollTo({top:0,behavior:'smooth'});$('exit-focus').focus();});$('exit-focus').addEventListener('click',()=>{document.body.classList.remove('focus');$('exit-focus').hidden=true;$('focus-mode').focus();});
$('edit-card').addEventListener('click',async()=>{if(dirty&&!await confirmDialog('Replace your current draft?','You have another unsaved draft. Opening this card for editing will replace it.','Edit this card'))return;setDraft(current);setView('editor');toast('Editing this shared card. Saving changes resets play progress for this card.');$('card-name').focus();});
$('duplicate-card').addEventListener('click',async()=>{if(dirty&&!await confirmDialog('Replace your current draft?','Your unsaved draft will be replaced by a copy of this card.','Make a copy'))return;const copy={...current,title:(current.title+' (copy)').slice(0,60)};delete copy.id;delete copy.version;setDraft(copy,true);saveDraft();setView('editor');$('card-name').focus();toast('Your copy is ready to edit. Save it as a new card.');});
async function deleteSharedCard(card){
  if(!card?.id||saving||deleting)return;
  const unsaved=draft.id===card.id&&dirty?' Any unsaved edits to this card will also be discarded.':'';
  if(!await confirmDialog('Delete this shared card?',`“${card.title}” will be removed from everyone’s collection. This cannot be undone.${unsaved}`,'Delete card',true))return;
  deleting=true;$('delete-card').disabled=true;$('delete-edit-card').disabled=true;$('app').inert=true;
  try{
    await api('delete',{id:card.id,version:card.version});
    cards=cards.filter(c=>c.id!==card.id);
    storage.remove(`awards-night:progress:${roomId}:${card.id}`);
    if(draft.id===card.id){storage.remove(draftKey());setDraft(blankCard());}
    if(current?.id===card.id)current=null;
    setView('gallery');toast('Card deleted.');
  }catch(e){toast(e.message,true);}
  finally{deleting=false;$('delete-card').disabled=false;$('delete-edit-card').disabled=false;$('app').inert=false;}
}
$('delete-card').addEventListener('click',()=>deleteSharedCard(current));
$('delete-edit-card').addEventListener('click',()=>deleteSharedCard({...draft}));

document.querySelector('.brand').addEventListener('click',e=>{if(!token||!roomId)return;e.preventDefault();setView('gallery');});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('focus')){$('exit-focus').click();}});
function showGate(message,error=false){$('app').hidden=true;$('gate').hidden=false;$('gate-message').textContent=message;$('invite-form').hidden=false;$('invite-error').textContent=error?message:'';$('invite-button').disabled=true;}
async function boot(code){if(booting)return;booting=true;token=code;$('invite-form').hidden=true;$('gate-message').textContent='Opening your private room…';try{const data=await api('list');roomId=data.room.id;cards=data.cards;$('gate').hidden=true;$('app').hidden=false;$('invite-button').disabled=false;const requested=new URLSearchParams(location.hash.slice(1)).get('card');const stored=storage.get(draftKey());if(stored&&Array.isArray(stored.cells)&&stored.cells.length===25&&stored.cells.every(t=>typeof t==='string')&&typeof stored.title==='string'&&typeof stored.creator==='string'&&typeof stored.free_space==='boolean'){setDraft(stored,true);}else setDraft(blankCard());renderGallery();if(requested&&/^[0-9a-f-]{36}$/i.test(requested)){setView('gallery');await openCard(requested);}else setView('editor');}catch(e){showGate(e.message,true);}finally{booting=false;}}
$('invite-form').addEventListener('submit',e=>{e.preventDefault();const code=parseInvite($('invite-input').value);if(!code){$('invite-error').textContent='Paste the full invitation link or its 22-character invite code.';return;}const url=new URL(location.href);url.hash=new URLSearchParams({invite:code});history.replaceState(null,'',url);boot(code);});
window.addEventListener('hashchange',()=>{const code=new URLSearchParams(location.hash.slice(1)).get('invite');if(code&&parseInvite(code)&&code!==token){if(dirty){toast('Save your draft before opening a different room.',true);history.replaceState(null,'',shareUrl());return;}boot(code);}});
setInterval(()=>{if(roomId&&activeView==='gallery'&&!document.hidden)refreshCards();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&roomId&&activeView==='gallery')refreshCards();});
renderIdeas();const initial=new URLSearchParams(location.hash.slice(1)).get('invite');if(initial&&parseInvite(initial))boot(initial);else showGate('This is an invite-only watch party. Use the private link from your host, or paste it below.');
