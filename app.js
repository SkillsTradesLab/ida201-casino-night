'use strict';
const $=s=>document.querySelector(s), params=new URLSearchParams(location.search);
const isTeacher=location.pathname.endsWith('teacher.html');
let table=null, view=null, room='', transport='peer', peer=null, conn=null, channel=null, host=false, connections=new Map(), offset=0, pending=false, lastHost=0, connecting=false;
let joinRequested=false,nextRetryAt=0,peerStartedAt=0,attemptStartedAt=0,hostRegistered=false,retryBlocked=false,broadcastScheduled=false;
const money=n=>'$'+n.toLocaleString('en-US'), escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seatToken=sessionStorage.getItem('ida201-seat')||crypto.randomUUID();sessionStorage.setItem('ida201-seat',seatToken);
function notice(msg,error=false){$('#notice').textContent=msg;$('#notice').classList.toggle('error',error);}
function persist(){if(!table)return;try{localStorage.setItem('ida201-host',JSON.stringify({room,transport,state:table}));}catch(e){notice('Browser storage unavailable. Keep this tab open and export results before closing.',true);}}
function seen(){try{return JSON.parse(localStorage.getItem('ida201-seen')||'[]');}catch(e){return [];}}
function emit(c,msg){try{if(c.open)c.send(msg);}catch(e){/* next heartbeat repairs the view */}}
function broadcast(){if(!table)return;view=table.view();render();persist();for(const [token,c] of connections)emit(c,{type:'state',room,view:table.view(token)});if(channel)for(let p of table.players)channel.postMessage({type:'state',room,to:p.token,view:table.view(p.token)});}
function scheduleBroadcast(){if(broadcastScheduled)return;broadcastScheduled=true;setTimeout(()=>{broadcastScheduled=false;broadcast();},150);}
function replyState(token){if(!table)return;let c=connections.get(token),msg={type:'state',room,view:table.view(token)};if(c)emit(c,msg);else if(channel)channel.postMessage({...msg,to:token});}
function deferRetry(ms=3000){nextRetryAt=Date.now()+ms;}
function closeAttempt(){let old=conn;conn=null;connecting=false;attemptStartedAt=0;try{old?.close();}catch(e){}}
function resetStudentPeer(){let old=peer;peer=null;closeAttempt();try{if(old&&!old.destroyed)old.destroy();}catch(e){}peerStartedAt=0;}
function connectionMessage(e,teacher=false){const type=e?.type||'network';if(type==='browser-incompatible'){retryBlocked=true;notice('This browser cannot make the classroom connection. Open this same link in an updated Chrome or Microsoft Edge browser.',true);return;}
 if(type==='peer-unavailable'){notice('The teacher room is not reachable yet. Check the room code and ask the teacher to keep the live table open. This tab will retry automatically.',true);return;}
 if(type==='unavailable-id'&&teacher){notice('This room is already open in another teacher tab or is still reconnecting. Return to the original teacher tab. Retrying this room…',true);return;}
 notice((teacher?'Teacher room':'Student connection')+' could not reach the connection service ('+type+'). Retrying automatically; school network filtering or a service outage may block access.',true);
}
function action(msg,token){try{if(msg.type==='join'){let p=table.join(token,msg.name);if(msg.connection)connections.set(token,msg.connection);if(msg.connection)emit(msg.connection,{type:'joined',room,id:p.id});}
 else if(msg.type==='pledge')table.pledge(token,msg.value);
 else if(msg.type==='answer')table.answer(token,msg.index,msg.hand);
 else if(msg.type==='rescue')table.rescue(token,msg.target);
 else if(msg.type==='leave'){let p=table.players.find(p=>p.token===token);if(p)p.online=false;}
 else if(msg.type==='ping'){let p=table.players.find(p=>p.token===token);if(p){p.online=true;p.lastPing=Date.now();}return;}
 else return;
 if(msg.type==='join'||msg.type==='ping'){let p=table.players.find(p=>p.token===token);if(p)p.lastPing=Date.now();}
 replyState(token);scheduleBroadcast();
 }catch(e){if(msg.connection)emit(msg.connection,{type:'error',scope:msg.type,message:e.message});else if(connections.get(token))emit(connections.get(token),{type:'error',scope:msg.type,message:e.message});else if(channel)channel.postMessage({type:'error',to:token,scope:msg.type,message:e.message});}}
function send(msg){pending=true;if(channel){channel.postMessage({...msg,from:seatToken,room});return;}if(conn&&conn.open){conn.send(msg);return;}pending=false;notice('Connection lost. Reconnecting to your teacher; no answer has been accepted yet.',true);}
function accept(msg){if(msg.type==='error'){pending=false;if(msg.scope==='join')retryBlocked=true;notice(msg.message,true);return;}if(msg.type==='state'){lastHost=Date.now();pending=false;view=msg.view;offset=view.serverNow-Date.now();$('#entrance').classList.add('hidden');$('#game').classList.remove('hidden');notice('Connected to the teacher table. Your teacher controls the deal.');render();} }
function showGame(){ updateStudentShare();$('#entrance').classList.add('hidden');$('#game').classList.remove('hidden');$('#teacher-controls').classList.toggle('hidden',!host);$('#copy-link').classList.toggle('hidden',!host);}
async function loadBank(){if(window.QUESTION_BANK)return window.QUESTION_BANK;await new Promise((resolve,reject)=>{let s=document.createElement('script');s.src='bank.js';s.onload=resolve;s.onerror=()=>reject(Error('Question bank could not load. Upload bank.js alongside the other game files.'));document.head.append(s);});return window.QUESTION_BANK;}
function options(){return {rounds:Number($('#round-count').value),capacity:Number($('#seat-capacity').value),pool:$('#question-source').value,chapterMix:$('#chapter-mix').value,chapters:[...document.querySelectorAll('[name=chapter]:checked')].map(x=>Number(x.value)),levels:[...document.querySelectorAll('[name=level]:checked')].map(x=>x.value),wagerMode:$('#wager-mode').value,rescues:Number($('#rescue-limit').value)};}
function roomCode(){return Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');}
function createHostPeer(){
 if(typeof Peer==='undefined')throw Error('Connection library unavailable. Reload the teacher page and check that vendor/peerjs.min.js was uploaded.');
 const p=new Peer('skills-ida201-v1-'+room,{debug:0});peer=p;peerStartedAt=Date.now();hostRegistered=false;
 p.on('open',()=>{if(peer!==p)return;hostRegistered=true;peerStartedAt=0;nextRetryAt=0;showGame();broadcast();notice('Live room ready. Copy the student link and wait for your intended roster to show Connected. Keep this teacher tab open.');});
 p.on('connection',c=>{let token=null;c.on('data',m=>{if(peer!==p||!m||typeof m!=='object')return;if(m.type==='join'){if(typeof m.token!=='string')return;token=m.token;action({...m,connection:c},token);}else if(token&&connections.get(token)===c)action(m,token);});c.on('close',()=>{if(token&&connections.get(token)===c){connections.delete(token);let student=table.players.find(x=>x.token===token);if(student)student.online=false;scheduleBroadcast();}});c.on('error',()=>{});});
 p.on('error',e=>{if(peer!==p)return;if(p.destroyed||['network','server-error','socket-error','socket-closed','unavailable-id'].includes(e.type))hostRegistered=false;connectionMessage(e,true);deferRetry(5000);});
 p.on('disconnected',()=>{if(peer!==p)return;hostRegistered=false;deferRetry();notice('Teacher connection service disconnected. Your room and progress remain in this tab. Reconnecting automatically…',true);});
}
function recoverHost(){
 if(transport!=='peer'||retryBlocked||Date.now()<nextRetryAt)return;
 if(!peer||peer.destroyed){createHostPeer();return;}
 if(peer.disconnected){try{peer.reconnect();peerStartedAt=Date.now();deferRetry();}catch(e){deferRetry(5000);}return;}
 if(!hostRegistered&&peerStartedAt&&Date.now()-peerStartedAt>=30000&&connections.size===0){let old=peer;peer=null;old.destroy();deferRetry();notice('Still waiting for the connection service. Retrying the same room automatically; check school network access if this continues.',true);}
}
function startHostNetwork(){if(transport==='local'){channel=new BroadcastChannel('ida201-'+room);channel.onmessage=e=>{let m=e.data;if(m.room!==room||!m.from)return;action(m,m.from);};showGame();broadcast();notice('Same-computer test table open. Students must choose the tab-test connection.');return;}
 persist();createHostPeer();
}
async function openHost(saved){try{if(table)return;host=true;transport=saved?saved.transport:$('#teacher-transport').value;room=saved?saved.room:roomCode();let bank=await loadBank();table=new HVAC.Table(bank,options());if(saved)Object.assign(table,saved.state,{bank});notice('Opening teacher table…');startHostNetwork();}catch(e){table=null;host=false;notice(e.message,true);}}
function createStudentPeer(){
 if(typeof Peer==='undefined'){retryBlocked=true;notice('Connection library unavailable. Reload the student page or ask the teacher to check the published game files.',true);return;}
 // A locally generated broker ID avoids a separate ID-allocation request; seat identity remains the saved token.
 const p=new Peer('ida201-student-'+crypto.randomUUID(),{debug:0});peer=p;peerStartedAt=Date.now();
 p.on('open',()=>{if(peer!==p)return;peerStartedAt=0;nextRetryAt=0;connectStudent();});
 p.on('error',e=>{if(peer!==p)return;connectionMessage(e);if(e.type==='peer-unavailable')closeAttempt();if(p.destroyed||['server-error','socket-error','socket-closed','unavailable-id'].includes(e.type))resetStudentPeer();deferRetry(5000);});
 p.on('disconnected',()=>{if(peer!==p)return;deferRetry();notice('Student connection service disconnected. Keep this tab open; your seat will reconnect automatically.',true);});
}
function connectStudent(forceJoin=false){
 if(!joinRequested||!room||retryBlocked)return;
 if(transport==='local'){if(!channel){channel=new BroadcastChannel('ida201-'+room);channel.onmessage=e=>{if(e.data.to===seatToken)accept(e.data);};}channel.postMessage({type:'join',name:$('#student-name').value,from:seatToken,room});return;}
 if(forceJoin&&conn?.open){conn.send({type:'join',name:$('#student-name').value,token:seatToken});return;}
 if(Date.now()<nextRetryAt)return;
 if(!peer||peer.destroyed){resetStudentPeer();createStudentPeer();return;}
 if(peer.disconnected){try{peer.reconnect();peerStartedAt=Date.now();deferRetry();}catch(e){deferRetry(5000);}return;}
 if(!peer.open){if(peerStartedAt&&Date.now()-peerStartedAt>=30000){resetStudentPeer();deferRetry();notice('Still waiting for the connection service. Starting a fresh attempt automatically; your name and room code are kept.',true);}return;}
 if(conn?.open)return;
 if(connecting){if(Date.now()-attemptStartedAt>=45000){closeAttempt();deferRetry();notice('The browser connection has not completed. Retrying automatically. A blocked school network may require a different connection method.',true);}return;}
 connecting=true;attemptStartedAt=Date.now();const c=peer.connect('skills-ida201-v1-'+room,{reliable:true});conn=c;
 c.on('open',()=>{if(conn!==c)return;connecting=false;attemptStartedAt=0;c.send({type:'join',name:$('#student-name').value,token:seatToken});});
 c.on('data',m=>{if(conn===c)accept(m);});
 c.on('close',()=>{if(conn!==c)return;closeAttempt();deferRetry();notice('Teacher connection lost. Keep this tab open; your saved seat will reconnect automatically.',true);});
 c.on('error',e=>{if(conn!==c)return;closeAttempt();deferRetry();connectionMessage(e);});
}
$('#join').onclick=()=>{if(!$('#student-name').value.trim()){notice('Enter your name or initials.',true);return;}const enteredRoom=$('#room-input').value.trim().toUpperCase();if(!/^[A-Z2-9]{8}$/.test(enteredRoom)){notice('Enter the eight-character room code.',true);return;}
 const selectedTransport=$('#student-transport').value;if(room&&(enteredRoom!==room||selectedTransport!==transport)){resetStudentPeer();channel?.close();channel=null;view=null;lastHost=0;}room=enteredRoom;transport=selectedTransport;joinRequested=true;retryBlocked=false;nextRetryAt=0;
 sessionStorage.setItem('ida201-name',$('#student-name').value);sessionStorage.setItem('ida201-room',room);sessionStorage.setItem('ida201-transport',transport);notice('Connecting to your teacher. Your details are kept while this tab retries automatically…');connectStudent(true);};
$('#host').onclick=()=>openHost();
function teacherAction(fn){try{fn();broadcast();}catch(e){notice(e.message,true);}}
$('#start').onclick=()=>teacherAction(()=>table.start(seen()));
$('#deal').onclick=()=>teacherAction(()=>table.deal());
$('#next').onclick=()=>teacherAction(()=>table.next());
$('#end').onclick=()=>teacherAction(()=>table.end());
$('#pledge').onclick=()=>send({type:'pledge',value:Number($('#wager').value)});
function studentLink(){let u=new URL('index.html',location.href);if(room){u.searchParams.set('room',room);u.searchParams.set('connection',transport);}return u.href;}
function updateStudentShare(){if(!isTeacher||!$('#student-share'))return;let url=studentLink(),field=$('#student-share-url');if(field.value!==url){field.value=url;$('#student-share-status').textContent='';}$('#open-student-bottom').href=url;const ready=host&&table&&(transport==='local'||hostRegistered)&&table.phase!=='ended';$('#copy-student-bottom').disabled=!ready;$('#student-share-hint').textContent=!host||!table?'Open your teacher table above. Your room code will be included here automatically when the room is ready.':table.phase==='ended'?'This game has finished. Open a new teacher table to issue a new room link.':!ready?'Your room is connecting. Wait for Live room ready before sharing this link.':transport==='local'?'Same-computer test link: this connects browser tabs on this computer, not separate student devices.':table.phase==='lobby'?'Share this exact link. Students only enter their name or initials; the room code is already included.':'This is the current room link. Existing students can reconnect; new students must join before you start the game.';}
async function copyStudentLink(){const url=studentLink();try{await navigator.clipboard.writeText(url);notice('Student link copied.');if($('#student-share-status'))$('#student-share-status').textContent='Copied! Paste this link into your class message or learning platform.';}catch(e){const field=$('#student-share-url');if(field){field.focus();field.select();$('#student-share-status').textContent='The link is selected. Press Ctrl+C (or Command+C) to copy it.';}notice('Student link: '+url);}}
$('#copy-link').onclick=copyStudentLink;
if($('#copy-student-bottom'))$('#copy-student-bottom').onclick=copyStudentLink;
$('#fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
$('#export').onclick=()=>{if(!table)return;let rows=[['Hand','Question ID','Chapter','Skill','Student','Wager','Chosen answer','Correct answer','Correct','Timeout','Bonus','Net change','Balance']];for(let h of table.history)for(let r of h.rows)rows.push([h.hand,h.question,h.chapter,h.level,r.name,r.wager,r.choice===null?'No answer':h.choices[r.choice],h.choices[h.answer],r.correct,r.timeout,r.bonus,r.net,r.balance]);rows.push([],['FINAL STANDINGS','Student','Balance','Correct','Hands played','Rescues received','Rescues given']);for(let p of [...table.players].sort((a,b)=>b.balance-a.balance))rows.push(['',p.name,p.balance,p.correct,p.attempts,p.rescues,p.rescuedOthers]);let csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');let blob=new Blob(['\ufeff'+csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='IDA201-Casino-Night-'+room+'-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function render(){if(!view)return;showGame();let v=view,me=v.me? v.players.find(p=>p.id===v.me.id):null;$('#room-code').textContent=room;$('#phase-name').textContent={lobby:'Seats are open',betting:'Wagers open',question:'Hand in play',reveal:'Answer & rescue window',ended:'Table closed'}[v.phase];$('#hand-count').textContent=`Hand ${v.hand} of ${v.rounds} · ${v.players.length}/${v.capacity} seats`;
 for(let [id,show] of [['start',v.phase==='lobby'],['deal',v.phase==='betting'],['next',v.phase==='reveal'],['end',!['question','ended'].includes(v.phase)]])$('#'+id).classList.toggle('hidden',!show);
 if(host){const ready=transport==='local'||hostRegistered;$('#copy-link').disabled=!ready;$('#start').disabled=!ready;}
 $('#wallet-title').textContent=host?'Dealer overview':'Your chips';$('#wallet').textContent=host?`${v.players.filter(p=>p.balance>=100||p.playing).length} active`:me?money(me.balance):'—';$('#wallet-note').textContent=host?`${v.players.filter(p=>p.online).length} connected · ${v.players.filter(p=>p.answered).length} answers locked`:me?`${me.correct}/${me.attempts} correct · ${me.rescues}/${v.rescueLimit} rescues used`:'Waiting for your seat…';
 $('#ledger').innerHTML=v.log.map(x=>'<li>'+escape(x)+'</li>').join('');
 $('#seats').innerHTML=v.players.map(p=>`<div class="seat ${me?.id===p.id?'mine':''} ${p.balance<100&&!p.playing?'out':''}"><b>${escape(p.name)}</b><span class="money">${money(p.balance)}</span><small>${p.online?'● Connected':'○ Disconnected'} · ${p.playing?(p.answered?'Answer locked':'In hand'):p.balance<100?'Out · rescue needed':p.ready?'Wager locked':'At the table'}<br>${p.correct}/${p.attempts} correct${p.last?'<br>'+(p.last.win?'Won ':'Lost ')+money(Math.abs(p.last.delta))+(p.last.timeout?' · timeout':''):''}</small>${host&&v.phase==='lobby'?`<button class="secondary tiny remove" data-id="${p.id}">Remove seat</button>`:''}</div>`).join('');
 document.querySelectorAll('.remove').forEach(b=>b.onclick=()=>teacherAction(()=>table.remove(b.dataset.id)));
 let canBet=v.phase==='betting'&&me&&me.balance>=100;$('#wager-panel').classList.toggle('hidden',!canBet);$('#wager').disabled=v.wagerMode==='fixed'||v.me?.ready;$('#wager').max=me?.balance??1500;if(v.wagerMode==='fixed')$('#wager').value=100;$('#pledge').disabled=Boolean(v.me?.ready)||pending;$('#pledge').textContent=v.me?.ready?'Wager locked':v.wagerMode==='fixed'?'Put up $100':'Lock my wager';
 let rescues=['betting','reveal'].includes(v.phase)&&me&&me.balance>=100?v.players.filter(p=>p.id!==me.id&&p.balance<100&&p.rescues<v.rescueLimit&&p.balance+me.gift>=100&&me.balance-me.gift>=Math.max(100,v.me.ready?v.me.bet:100)):[];
 $('#rescue-panel').innerHTML=rescues.length?'<h3>OFFER A RESCUE</h3>'+rescues.map(p=>`<button class="secondary rescue" data-id="${p.id}" style="margin:5px">Give ${escape(p.name)} ${money(me.gift)}</button>`).join('')+'<p class="tiny muted">This transfers half your current net winnings. The transfer is final for this game.</p>':'';
 document.querySelectorAll('.rescue').forEach(b=>b.onclick=()=>{let target=v.players.find(p=>p.id===b.dataset.id);if(confirm('Give '+target.name+' '+money(me.gift)+' from your winnings?'))send({type:'rescue',target:b.dataset.id});});
 $('#summary').classList.toggle('hidden',v.phase!=='ended');if(v.phase==='ended'){let ps=[...v.players].sort((a,b)=>b.balance-a.balance||b.correct-a.correct);let winners=ps.filter(p=>p.balance===ps[0]?.balance&&p.correct===ps[0]?.correct);$('#summary').innerHTML='<div class="eyebrow">Final standings</div><h2>'+escape(winners.map(p=>p.name).join(' & '))+' take'+(winners.length===1?'s':'')+' the table</h2><p>'+escape(v.result)+' Highest balance wins; correct answers break a chip tie. A remaining tie is shared.</p><div class="table-scroll"><table><thead><tr><th>Rank</th><th>Student</th><th>Final chips</th><th>Correct / played</th><th>Rescues</th></tr></thead><tbody>'+ps.map((p,i)=>`<tr><td>${i+1}</td><td>${escape(p.name)}</td><td>${money(p.balance)}</td><td>${p.correct}/${p.attempts}</td><td>${p.rescues}</td></tr>`).join('')+'</tbody></table></div><p class="tiny muted">Chip results include wagering and gifts; use the exported accuracy results for learning review.</p>';}
 renderQuestion();}
function renderQuestion(){if(!view)return;let v=view,q=v.question,now=Date.now()+offset,started=now>=v.opensAt,phase=v.phase;$('#question-note').classList.add('hidden');$('#answers').innerHTML='';let timer=$('#timer');timer.classList.remove('urgent');timer.textContent='♠';
 if(q&&phase==='question'&&!started){$('#question-meta').innerHTML='<span class="badge">Get ready</span>';$('#question-title').textContent='Cards on the table. Question opens in '+Math.max(1,Math.ceil((v.opensAt-now)/1000))+'…';timer.textContent=Math.max(1,Math.ceil((v.opensAt-now)/1000));return;}
 if(q&&['question','reveal','ended'].includes(phase)){$('#question-meta').innerHTML=`<span class="badge">Chapter ${q.chapter}</span><span class="badge">${q.level}</span><span class="badge">Bonus ${money(q.bonus)}</span>`;$('#question-title').textContent=q.prompt;let locked=host||phase!=='question'||!v.me?.bet||v.me.choice!==null||now>=v.deadline||pending;
 $('#answers').innerHTML=q.choices.map((c,i)=>`<button class="answer ${v.me?.choice===i?'selected':''} ${q.answer===i?'correct':''}" data-choice="${i}" ${locked?'disabled':''}><b>${'ABCD'[i]}</b><span>${escape(c)}</span></button>`).join('');document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{send({type:'answer',index:Number(b.dataset.choice),hand:v.hand});renderQuestion();});
 if(phase==='question'){let secs=Math.max(0,Math.ceil((v.deadline-now)/1000));timer.textContent=secs;timer.classList.toggle('urgent',secs<=5);if(v.me?.choice!==null&&v.me){$('#question-note').textContent='Answer locked. Results appear when the shared clock ends.';$('#question-note').classList.remove('hidden');}}else{timer.textContent='✓';$('#question-note').innerHTML=`<b>Correct: ${'ABCD'[q.answer]}. ${escape(q.choices[q.answer])}</b><br>${escape(q.explanation)}<br><small>${escape(q.source)}</small>`;$('#question-note').classList.remove('hidden');}return;}
 $('#question-meta').innerHTML='<span class="badge">'+(host?'Dealer view':'Student seat')+'</span>';
 $('#question-title').textContent=phase==='lobby'?(host?'Start when all students are connected.':'The table is filling. Your teacher will start the game.'):phase==='betting'?host?'Wagers are open. Deal when your class is ready.':v.me?.ready?'Your chips are committed. Wait for the dealer.':'Put up your chips before the next question.':phase==='ended'?'The table is closed. Review your results below.':'Waiting for the dealer.';
 if(phase==='betting'&&!host&&v.me){let p=v.players.find(p=>p.id===v.me.id);if(p.balance<100){$('#question-note').textContent='You are out of chips for the next wager. Watch for a voluntary rescue from a student with winnings.';$('#question-note').classList.remove('hidden');}}
}
setInterval(()=>{if(host&&table){if(table.settle()){try{localStorage.setItem('ida201-seen',JSON.stringify([...new Set([...seen(),...table.used])].slice(-350)));}catch(e){}broadcast();}else{let changed=false;for(let p of table.players)if(p.online&&Date.now()-(p.lastPing||0)>10000){p.online=false;changed=true;}if(changed)broadcast();}view=table.view();offset=0;}renderQuestion();},250);
setInterval(()=>{if(host&&table){recoverHost();broadcast();}else if(joinRequested&&room&&!retryBlocked){if(channel){channel.postMessage({type:view?'ping':'join',from:seatToken,name:$('#student-name').value,room});}else if(conn?.open){if(lastHost&&Date.now()-lastHost>15000){closeAttempt();deferRetry();notice('No response from the teacher. Reconnecting your saved seat; ask the teacher to keep the original table open.',true);}else conn.send({type:'ping'});}else connectStudent();if(lastHost&&Date.now()-lastHost>7000&&conn?.open)notice('Waiting for the teacher response. Your seat is saved; answers must reach the teacher before the question deadline.',true);}},2000);
window.addEventListener('beforeunload',()=>{if(table)persist();else if(conn?.open)conn.send({type:'leave'});});
$('#student-name').value=sessionStorage.getItem('ida201-name')||'';$('#room-input').value=params.get('room')||sessionStorage.getItem('ida201-room')||'';$('#student-transport').value=params.get('connection')||sessionStorage.getItem('ida201-transport')||'peer';
if(isTeacher){$('#student-entry').classList.add('hidden');$('#teacher-entry').classList.remove('hidden');document.title='Teacher Table | IDA201 Casino Night';try{let saved=JSON.parse(localStorage.getItem('ida201-host'));if(saved&&saved.state.phase!=='ended'){let b=document.createElement('button');b.textContent='Resume table '+saved.room;b.className='secondary';b.style='width:100%;margin-top:12px';b.onclick=()=>openHost(saved);$('#teacher-entry').append(b);}}catch(e){}}



updateStudentShare();
