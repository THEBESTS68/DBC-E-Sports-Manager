
// --- ADMIN SYSTEM ---
const ADMIN_PASSCODE = "DBCADMIN"; 
let isAdmin = sessionStorage.getItem('dbc_admin') === 'true';

function checkAuthUI() {
  const authContainer = document.getElementById('authContainer');
  if (!isAdmin) {
    document.body.classList.add('viewer-mode');
    authContainer.innerHTML = `<button class="btn-auth viewer" onclick="loginAdmin()">🔒 เข้าสู่ระบบกรรมการ</button>`;
  } else {
    document.body.classList.remove('viewer-mode');
    authContainer.innerHTML = `<button class="btn-auth admin" onclick="logoutAdmin()">🔓 ออกจากระบบ (Admin)</button>`;
  }
}

function loginAdmin() {
  const pass = prompt("กรุณาใส่รหัสผ่านสำหรับกรรมการ:");
  if (pass === ADMIN_PASSCODE) {
    sessionStorage.setItem('dbc_admin', 'true');
    isAdmin = true; checkAuthUI();
    if(currentGame === 'ef' || currentGame === 'rov') renderBracketDOM(currentGame);
    else if(currentGame === 'ff') renderFFTable();
  } else if (pass !== null) { alert("รหัสผ่านไม่ถูกต้อง!"); }
}

function logoutAdmin() {
  sessionStorage.removeItem('dbc_admin'); isAdmin = false; checkAuthUI();
  if(currentGame === 'ef' || currentGame === 'rov') renderBracketDOM(currentGame);
  else if(currentGame === 'ff') renderFFTable();
}

// --- STATE MANAGEMENT ---
let appState = { ef: { tournament: [], players: '' }, rov: { tournament: [], players: '' }, ff: { teamsData: [], players: '' }, profiles: {} };
let currentGame = null;

db.ref('.info/connected').on('value', function(snap) {
  const statusEl = document.getElementById('dbStatus');
  if (snap.val() === true) { statusEl.innerHTML = 'ONLINE'; statusEl.style.color = 'var(--primary)'; } 
  else { statusEl.innerHTML = 'OFFLINE'; statusEl.style.color = '#ff2a2a'; }
});

const fullRulesData = {
  ef: `
    <h3>1. รูปแบบการแข่งขัน</h3>
    <ul>
      <li>แข่งขันแบบ Single Elimination</li>
      <li>แข่งขันแบบ Best of 3 (BO3) ผู้ที่ชนะ 2 เกมก่อน ถือเป็นผู้ชนะและผ่านเข้าสู่รอบถัดไป</li>
      <li>ผู้แพ้ในรอบ Playoff จะได้รับเหรียญทองแดง</li>
      <li>ผู้ชนะในรอบชิงชนะเลิศได้รับเหรียญทอง และผู้แพ้ได้รับเหรียญเงิน</li>
    </ul>
    <h3>2. การตั้งค่าห้องและการเลือกทีม</h3>
    <ul>
      <li>ใช้ TEAM Type AUTHENTIC > Friend Match สร้างห้องแข่งขันแบบ 1 VS 1 Match Room</li>
      <li>ใช้ทีมสโมสรที่มีลิขสิทธิ์ และใช้รูปแบบ "เกลี่ยพลัง" ตามที่กำหนด</li>
      <li>ห้ามใช้ทีมจากสโมสรไทยลีก</li>
    </ul>
    <h3>3. การตั้งค่าเกม (Match Settings)</h3>
    <ul>
      <li>Match Type: Standard, เวลาการแข่งขัน 6 นาที</li>
      <li>Injuries: OFF, Extra Time: ON, Penalty Kick (PK): ON</li>
      <li>จำนวนตัวสำรอง 5 คน, จำนวนช่วงเวลาเปลี่ยนตัว 3 ครั้ง</li>
      <li>Condition: Normal (HOME & AWAY), Co-op AI Level: Top Player</li>
    </ul>
    <h3>4. กฎการหยุดเกมและการหลุดออกจากการแข่งขัน</h3>
    <ul>
      <li>ผู้เล่นสามารถหยุดเกมได้ไม่เกิน 3 ครั้ง (ไม่รวมการพักครึ่ง) เพื่อเปลี่ยนแผนและเปลี่ยนตัวเท่านั้น</li>
      <li>หากหลุดครึ่งแรก: เริ่มเกมใหม่โดยใช้สกอร์เดิม</li>
      <li>หากหลุดครึ่งหลัง: เริ่มเกมใหม่โดยนำสกอร์ครึ่งแรกมาใช้ และเล่นต่อในครึ่งหลัง</li>
      <li>หากหลุดตั้งแต่นาทีที่ 85 เป็นต้นไป: ให้ยึดผลสกอร์ ณ เวลาที่หลุดเป็นผลการแข่งขันทันที</li>
      <li>หากหลุดช่วงต่อเวลาพิเศษ: ให้ปล่อยเกมต่อจนจบ 90 นาที แล้วเริ่มแข่งใหม่เฉพาะช่วงต่อเวลา</li>
    </ul>
    <h3>5. การตัดสินใจของกรรมการ</h3>
    <ul>
      <li>แมตช์แรกให้ใช้การโยนเหรียญเพื่อเลือกฝั่ง แมตช์ถัดไปผู้แพ้ในเกมก่อนหน้าจะได้สิทธิ์เลือกฝั่งก่อน</li>
      <li>ผู้เล่นต้องปฏิบัติตามคำตัดสินของกรรมการ ดุลยพินิจของคณะกรรมการตัดสิน ถือเป็นที่สิ้นสุด</li>
    </ul>
  `,
  rov: `
    <h3>1. ข้อปฏิบัติและการตั้งค่า</h3>
    <ul>
      <li>นักกีฬาต้องใช้สมาร์ทโฟน อัปเดตเกมเวอร์ชั่นล่าสุด ไม่อนุญาตให้ใช้ IPad หรือ Tablet</li>
      <li>ห้ามใช้หูฟังบลูทูธ และต้องใช้ ID ของตนเองตามที่ระบุไว้ในใบสมัครเท่านั้น</li>
      <li>การตั้งชื่อต้องสุภาพ ห้ามใช้คำหยาบคาย ลามก ล้อเลียนการเมือง หรือจงใจตั้งชื่อคล้ายผู้อื่น</li>
      <li>สามารถสวม Skin ได้ แต่ห้ามสวม Skin ที่มีลิขสิทธิ์ หรือรบกวนการแข่งขันผู้อื่น (มีรายชื่อสกินแบนเฉพาะ)</li>
      <li>ห้ามใช้ฮีโร่ที่อัปเดตใหม่ภายใน 14 วันก่อนวันแข่งขัน</li>
      <li>สามารถเปลี่ยนตัวผู้แข่งขันได้ก่อนเริ่มเกมเท่านั้น (ต้องแจ้งกรรมการก่อนทุกครั้ง)</li>
      <li>การขอเวลานอก (Pause) ขอหยุดเกมได้ไม่เกิน 3 ครั้ง ครั้งละไม่เกิน 5 นาที</li>
    </ul>
    <h3>2. กฎข้อบังคับและบทลงโทษ</h3>
    <ul>
      <li>นักกีฬาต้องมาถึงก่อนเวลาแข่ง 15 นาที และต้องแต่งกายด้วยชุดสุภาพหรือชุดกีฬา ห้ามกางเกงขาสั้นและรองเท้าแตะ</li>
      <li>ห้ามแสดงกิริยา วาจา หยาบคาย หรือยั่วยุฝ่ายตรงข้าม (บทลงโทษ: ปรับแพ้ทันที)</li>
      <li>ห้ามให้ผู้เล่นที่ไม่มีรายชื่อหรือจากสายอื่นลงแข่งแทน (บทลงโทษ: ปรับแพ้ทันที)</li>
      <li>ห้ามใช้โปรแกรมโกงใดๆ ทั้งสิ้น (บทลงโทษ: ปรับแพ้ทันที)</li>
    </ul>
  `,
  ff: `
    <h3>1. รูปแบบการแข่งขัน</h3>
    <ul>
      <li>โหมดการแข่งขัน Battle Royale ประเภททีม 4 คน (Squad)</li>
      <li>แข่งขันเก็บคะแนนสะสม จำนวน 3 แมตช์ (Best of 3) เพื่อความกระชับรวดเร็ว</li>
      <li>แผนที่แข่งขัน: เกาะสวรรค์ (Bermuda), ทะเลทราย (Kalahari) และแดนชำระบาป (Purgatory)</li>
    </ul>
    <h3>2. กฎการใช้อุปกรณ์และการตั้งค่าห้อง (Custom Room)</h3>
    <ul>
      <li>ผู้เข้าแข่งขันต้องใช้โทรศัพท์มือถือ (Smartphone) เท่านั้น ไม่อนุญาตให้ใช้แท็บเล็ต, ไอแพด, โปรแกรมจำลอง (Emulator) ทุกชนิด และห้ามใช้หูฟังบลูทูธ</li>
      <li>เปิดใช้งาน: ค่าสถานะปืนจากสกิน, ระบบชุบชีวิต, มุมกล้องหลังถูกสังหาร, ระบบมุมมองชุดตัวละครแบบเดียวกัน</li>
      <li>ปิดใช้งาน: การแสดงชื่อตัวละครภายในเกม, การแสดงรายงานการสังหาร (Kill Feed)</li>
      <li>เปิดระบบป้องกันการใช้งานโปรแกรมจำลอง (Block Emulators) อย่างเคร่งครัด</li>
    </ul>
    <h3>3. ระบบการคิดคะแนนและ Tie-breaker</h3>
    <ul>
      <li>คะแนนอันดับ (Placement): อันดับ 1 (Booyah) = 12 แต้ม, อันดับ 2 = 9, อันดับ 3 = 8, อันดับ 4 = 7, อันดับ 5 = 6, อันดับ 6 = 5, อันดับ 7 = 4, อันดับ 8 = 3</li>
      <li>แต้มพิเศษจากการสังหาร: ทีมจะได้รับ +1 คะแนน ต่อการสังหารศัตรู 1 ครั้ง (1 Kill = 1 Point)</li>
      <li>กรณีคะแนนเท่ากัน ตัดสินตามลำดับดังนี้: 1. วัดจากจำนวน Booyah รวม 2. วัดจากจำนวน Kill รวม 3. วัดจากอันดับ (Placement) ในแมตช์สุดท้าย</li>
    </ul>
    <h3>4. กฎระเบียบและบทลงโทษ</h3>
    <ul>
      <li>หากมารายงานตัวสายเกิน 10 นาที จะถูกปรับแพ้ในแมตช์นั้นทันที (ได้รับ 0 คะแนน)</li>
      <li>หากเกิดการหลุดออกจากเกม จะไม่มีการหยุดเกม (Pause) ผู้เล่นต้องเชื่อมต่อกลับด้วยตนเอง</li>
      <li>ห้ามใช้โปรแกรมช่วยเล่น (Hack/Cheat), ห้ามสมรู้ร่วมคิดข้ามทีม (Teaming), ห้ามใช้บัค หากพบจะปรับแพ้และตัดสิทธิ์ทันที</li>
    </ul>
  `
};

window.onload = () => {
  checkAuthUI(); loadState();
  window.addEventListener('resize', () => { if(currentGame === 'ef' || currentGame === 'rov') renderLines(currentGame); });
};

function openRulesModal(gameId) {
  const titles = { 'ef': 'กติกาการแข่งขัน eFootball', 'rov': 'กติกาการแข่งขัน Garena RoV', 'ff': 'กติกาการแข่งขัน Garena Free Fire' };
  document.getElementById('modalTitle').innerText = titles[gameId];
  document.getElementById('modalContent').innerHTML = fullRulesData[gameId];
  document.getElementById('rulesModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeRulesModal(event) {
  if(event && event.target.id !== 'rulesModal' && !event.target.classList.contains('modal-close')) return;
  document.getElementById('rulesModal').classList.remove('active');
  document.body.style.overflow = '';
}

function openGame(gameId) {
  document.body.classList.add('page-fade-out');
  setTimeout(() => {
    currentGame = gameId; document.body.setAttribute('data-theme', gameId);
    document.getElementById('homeMenu').style.display = 'none'; document.getElementById('profileHub').style.display = 'none'; document.getElementById('btnBack').style.display = 'block';
    document.querySelectorAll('.module').forEach(m => { m.classList.remove('active'); m.classList.remove('page-fade-in'); });
    
    const activeModule = document.getElementById(`module-${gameId}`);
    activeModule.classList.add('active');
    
    const titles = { 'ef': ['eFootball Playoff', 'สายการแข่งขันแบบ Single Elimination • BO3'], 'rov': ['Garena RoV Playoff', 'สายการแข่งขันแบบ Single Elimination • BO3'], 'ff': ['Free Fire Scoreboard', 'ระบบคำนวณคะแนน 3 แมตช์สะสม (Squad)'] };
    document.getElementById('mainTitle').innerText = titles[gameId][0]; document.getElementById('mainSubtitle').innerText = titles[gameId][1];
    
    if(gameId === 'ef' || gameId === 'rov') { if(appState[gameId].tournament && appState[gameId].tournament.length > 0) renderBracketDOM(gameId); } 
    else if (gameId === 'ff') { if(appState.ff.teamsData && appState.ff.teamsData.length > 0) renderFFTable(); }
    
    renderSelectedList(gameId);
    
    document.body.classList.remove('page-fade-out');
    activeModule.classList.add('page-fade-in');
  }, 300);
}

function goHome() {
  document.body.classList.add('page-fade-out');
  setTimeout(() => {
    currentGame = null; document.body.setAttribute('data-theme', 'default');
    document.querySelectorAll('.module').forEach(m => { m.classList.remove('active'); m.classList.remove('page-fade-in'); });
    
    const homeMenu = document.getElementById('homeMenu');
    const profileHub = document.getElementById('profileHub');
    homeMenu.style.display = 'flex'; profileHub.style.display = 'block';
    
    renderProfiles(); document.getElementById('btnBack').style.display = 'none';
    document.getElementById('mainTitle').innerText = 'Tournament Manager'; document.getElementById('mainSubtitle').innerText = 'เลือกระบบจัดการการแข่งขันที่ต้องการ';
    
    document.body.classList.remove('page-fade-out');
    homeMenu.classList.add('page-fade-in');
    profileHub.classList.add('page-fade-in');
  }, 300);
}

function saveState() {
  if(!isAdmin) return; 
  if(currentGame) appState[currentGame].players = document.getElementById(`input-${currentGame}`).value;
  db.ref('dbc_tournament_data').set(appState).then(() => showSaveIndicator()).catch(err => alert("เกิดข้อผิดพลาด: " + err.message));
}

function loadState() {
  db.ref('dbc_tournament_data').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      appState.ef = data.ef || { tournament: [], players: '' };
      appState.rov = data.rov || { tournament: [], players: '' };
      appState.ff = data.ff || { teamsData: [], players: '' };
      appState.profiles = data.profiles || {};
      
      setTimeout(() => { renderProfiles(); refreshProfilePickers(); }, 0);
      if(document.activeElement && document.activeElement.tagName !== "TEXTAREA") {
        document.getElementById('input-ef').value = appState.ef.players || '';
        document.getElementById('input-rov').value = appState.rov.players || '';
        document.getElementById('input-ff').value = appState.ff.players || '';
        renderSelectedList('ef'); renderSelectedList('rov'); renderSelectedList('ff');
      }
      if(currentGame === 'ef' || currentGame === 'rov') {
        if(appState[currentGame].tournament && appState[currentGame].tournament.length > 0) renderBracketDOM(currentGame);
        else { document.getElementById(`wrapper-${currentGame}`).innerHTML = `<svg class="connector-svg" id="svg-${currentGame}"></svg>`; document.getElementById(`podium-${currentGame}`).style.display = 'none'; }
      } else if (currentGame === 'ff') {
        if(appState.ff.teamsData && appState.ff.teamsData.length > 0) renderFFTable();
        else document.getElementById('tbody-ff').innerHTML = '';
      }
    }
  });
}

function showSaveIndicator() {
  const ind = document.getElementById('saveStatus'); 
  ind.style.display = 'block'; 
  ind.style.animation = 'none';
  ind.offsetHeight; 
  ind.style.animation = 'savePop 0.6s var(--ease-spring) forwards';
  setTimeout(() => ind.style.display = 'none', 2500);
}

function confirmReset(gameId) {
  if(!isAdmin) return;
  if (confirm('⚠️ ยืนยันการล้างข้อมูลของเกมนี้?')) {
    if (gameId === 'ff') { appState.ff = { teamsData: [], players: '' }; document.getElementById('podium-ff').style.display = 'none'; } 
    else { appState[gameId] = { tournament: [], players: '' }; }
    document.getElementById(`input-${gameId}`).value = ''; 
    renderSelectedList(gameId);
    refreshProfilePickers();
    saveState();
  }
}

// --- BRACKET ENGINE ---
function generateBracket(gameId) {
  if(!isAdmin) return;
  const raw = document.getElementById(`input-${gameId}`).value.trim();
  let players = raw.split('\n').map(p => p.trim()).filter(p => p !== '');
  if (players.length < 2) return alert('กรุณากรอกชื่ออย่างน้อย 2 คน/ทีม');
  for (let i = players.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [players[i], players[j]] = [players[j], players[i]]; }
  let size = 2; while (size < players.length) size *= 2;
  let bracketSlots = new Array(size).fill(null);
  let byesNeeded = size - players.length;
  let matchIndices = []; let left = 0, right = (size / 2) - 1;
  while(left <= right) { matchIndices.push(left); if (left !== right) matchIndices.push(right); left++; right--; }
  let byePositions = []; for (let i = 0; i < byesNeeded; i++) byePositions.push(matchIndices[i] * 2 + 1); 
  for (let i = 0; i < byesNeeded; i++) bracketSlots[byePositions[i]] = 'BYE (ชนะผ่าน)';
  let pIdx = 0; for (let i = 0; i < size; i++) if (!bracketSlots[i]) bracketSlots[i] = players[pIdx++];
  let tournament = []; const numRounds = Math.log2(size); let r1 = [];
  for (let i = 0; i < size; i += 2) {
    let p1 = bracketSlots[i], p2 = bracketSlots[i+1], winner = null, s1 = 0, s2 = 0;
    if (p2 === 'BYE (ชนะผ่าน)' && p1 !== 'BYE (ชนะผ่าน)') { winner = p1; s1 = 2; }
    if (p1 === 'BYE (ชนะผ่าน)' && p2 !== 'BYE (ชนะผ่าน)') { winner = p2; s2 = 2; }
    r1.push({ p1, p2, s1, s2, winner, loser: null });
  }
  tournament.push(r1);
  for (let r = 1; r < numRounds; r++) {
    let rMatches = []; for (let m = 0; m < tournament[r-1].length / 2; m++) rMatches.push({ p1: '---', p2: '---', s1: 0, s2: 0, winner: null, loser: null });
    tournament.push(rMatches);
  }
  appState[gameId].tournament = tournament;
  r1.forEach((match, idx) => { if (match.winner) pushWinnerBracket(gameId, 0, idx, match.winner); });
  document.getElementById(`podium-${gameId}`).style.display = 'none'; saveState(); 
}

function renderBracketDOM(gameId) {
  if(!appState[gameId].tournament || appState[gameId].tournament.length === 0) return;
  const tournament = appState[gameId].tournament;
  const wrapper = document.getElementById(`wrapper-${gameId}`); wrapper.querySelectorAll('.round-column').forEach(r => r.remove());
  tournament.forEach((round, rIdx) => {
    const col = document.createElement('div'); col.className = 'round-column';
    let title = 'รอบคัดเลือก (BO3)';
    if (rIdx === tournament.length - 1) title = '🏆 ชิงเหรียญทอง (BO3)';
    else if (rIdx === tournament.length - 2) title = 'รอบรองชนะเลิศ (BO3)';
    col.innerHTML = `<div class="round-header">${title}</div>`;
    round.forEach((match, mIdx) => {
      const box = document.createElement('div'); box.className = 'match-box'; box.id = `match-${gameId}-${rIdx}-${mIdx}`;
      const isPlayable = match.p1 !== '---' && match.p2 !== '---' && !match.p1.includes('BYE') && !match.p2.includes('BYE');
      box.innerHTML = `<div class="match-meta"><span>Match ${mIdx + 1}</span><span>BO3</span></div>`;
      box.appendChild(createSlotDOM(gameId, match.p1, match.s1, match.winner === match.p1, isPlayable, () => addScoreBracket(gameId, rIdx, mIdx, 1)));
      box.appendChild(createSlotDOM(gameId, match.p2, match.s2, match.winner === match.p2, isPlayable, () => addScoreBracket(gameId, rIdx, mIdx, 2)));
      col.appendChild(box);
    });
    wrapper.appendChild(col);
  });
  setTimeout(() => renderLines(gameId), 100); checkPodium(gameId);
}

function createSlotDOM(gameId, name, score, isWinner, isPlayable, onScoreClick) {
  const slot = document.createElement('div'); slot.className = 'slot';
  if (isWinner) slot.classList.add('won');
  if (name === '---') { slot.classList.add('empty'); slot.textContent = name; return slot; }
  if (name.includes('BYE')) { slot.classList.add('bye'); slot.textContent = name; return slot; }
  slot.innerHTML = `<span>${name}</span><div class="score-badge"><span style="font-family:'Chakra Petch';font-size:1.15rem;">${score}</span>
    ${isPlayable && !isWinner && isAdmin ? `<button class="score-btn">+</button>` : ''}</div>`;
  if (isPlayable && !isWinner && isAdmin) { slot.querySelector('.score-btn').onclick = (e) => { e.stopPropagation(); onScoreClick(); }; }
  return slot;
}

function addScoreBracket(gameId, rIdx, mIdx, playerSlot) {
  if(!isAdmin) return;
  const match = appState[gameId].tournament[rIdx][mIdx]; if (match.winner) return;
  if (playerSlot === 1) match.s1 += 1; if (playerSlot === 2) match.s2 += 1;
  if (match.s1 >= 2) { match.winner = match.p1; match.loser = match.p2; } 
  else if (match.s2 >= 2) { match.winner = match.p2; match.loser = match.p1; }
  if (match.winner && rIdx < appState[gameId].tournament.length - 1) pushWinnerBracket(gameId, rIdx, mIdx, match.winner);
  saveState(); 
}

function pushWinnerBracket(gameId, rIdx, mIdx, winner) {
  const nextMatch = Math.floor(mIdx / 2);
  if (mIdx % 2 === 0) appState[gameId].tournament[rIdx + 1][nextMatch].p1 = winner;
  else appState[gameId].tournament[rIdx + 1][nextMatch].p2 = winner;
}

function checkPodium(gameId) {
  const tournament = appState[gameId].tournament;
  if(!tournament || tournament.length === 0) { document.getElementById(`podium-${gameId}`).style.display = 'none'; return; }
  const finalMatch = tournament[tournament.length - 1][0];
  if (finalMatch && finalMatch.winner) {
    let bronze = [];
    if (tournament.length >= 2) { const semiRound = tournament[tournament.length - 2]; semiRound.forEach(m => { if (m.loser && !m.loser.includes('BYE')) bronze.push(m.loser); }); }
    document.getElementById(`gold-${gameId}`).textContent = finalMatch.winner;
    document.getElementById(`silver-${gameId}`).textContent = finalMatch.loser || '-';
    document.getElementById(`bronze-${gameId}`).textContent = bronze.length > 0 ? bronze.join(', ') : '-';
    document.getElementById(`podium-${gameId}`).style.display = 'block';
  } else { document.getElementById(`podium-${gameId}`).style.display = 'none'; }
}

function renderLines(gameId) {
  const tournament = appState[gameId].tournament; const svg = document.getElementById(`svg-${gameId}`);
  if(!svg || !tournament || tournament.length === 0) return; svg.innerHTML = '';
  const wrapper = document.getElementById(`wrapper-${gameId}`); if(!wrapper) return;
  const wrapperRect = wrapper.getBoundingClientRect();
  for (let r = 0; r < tournament.length - 1; r++) {
    for (let m = 0; m < tournament[r].length; m++) {
      const el1 = document.getElementById(`match-${gameId}-${r}-${m}`); const el2 = document.getElementById(`match-${gameId}-${r+1}-${Math.floor(m/2)}`);
      if (!el1 || !el2) continue;
      const r1 = el1.getBoundingClientRect(), r2 = el2.getBoundingClientRect();
      const startX = r1.right - wrapperRect.left, startY = (r1.top + r1.height / 2) - wrapperRect.top;
      const endX = r2.left - wrapperRect.left; const targetOffset = (m % 2 === 0) ? (r2.height * 0.3) : (r2.height * 0.7);
      const endY = r2.top + targetOffset - wrapperRect.top; const midX = startX + (endX - startX) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); let d = `M ${startX} ${startY} `; const radius = 10;
      if (Math.abs(startY - endY) > 12) {
        const dirY = startY < endY ? 1 : -1;
        d += `L ${midX - radius} ${startY} Q ${midX} ${startY} ${midX} ${startY + radius * dirY} L ${midX} ${endY - radius * dirY} Q ${midX} ${endY} ${midX + radius} ${endY} `;
      } else { d += `L ${midX} ${startY} L ${midX} ${endY} `; }
      d += `L ${endX} ${endY}`;
      path.setAttribute('d', d); path.setAttribute('class', 'tree-line' + (tournament[r][m].winner ? ' active' : ''));
      svg.appendChild(path);
    }
  }
}

// --- FREE FIRE ENGINE ---
function generateFFTable() {
  if(!isAdmin) return;
  const raw = document.getElementById('input-ff').value.trim(); const names = raw.split('\n').map(n => n.trim()).filter(n => n !== '');
  if(names.length === 0) return alert('กรุณาใส่ชื่อทีม');
  appState.ff.teamsData = names.map(name => ({ name: name, m1R:'', m1K:'', m2R:'', m2K:'', m3R:'', m3K:'', booyah:0, kills:0, pts:0 }));
  saveState();
}

function calculateFFScores() {
  const ffPtsMap = { 1:12, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3 }; 
  appState.ff.teamsData.forEach(t => {
    let pts = 0, booyahs = 0, totalKills = 0;
    let r1 = parseInt(t.m1R), k1 = parseInt(t.m1K) || 0; if(r1 === 1) booyahs++; if(ffPtsMap[r1]) pts += ffPtsMap[r1]; pts += k1; totalKills += k1;
    let r2 = parseInt(t.m2R), k2 = parseInt(t.m2K) || 0; if(r2 === 1) booyahs++; if(ffPtsMap[r2]) pts += ffPtsMap[r2]; pts += k2; totalKills += k2;
    let r3 = parseInt(t.m3R), k3 = parseInt(t.m3K) || 0; if(r3 === 1) booyahs++; if(ffPtsMap[r3]) pts += ffPtsMap[r3]; pts += k3; totalKills += k3;
    t.booyah = booyahs; t.kills = totalKills; t.pts = pts;
  });
  appState.ff.teamsData.sort((a, b) => {
    if(b.pts !== a.pts) return b.pts - a.pts; if(b.booyah !== a.booyah) return b.booyah - a.booyah; if(b.kills !== a.kills) return b.kills - a.kills;
    let aR3 = parseInt(a.m3R) || 999; let bR3 = parseInt(b.m3R) || 999; return aR3 - bR3;
  });
}

function updateFFData(index, field, value) {
  if(!isAdmin) return; appState.ff.teamsData[index][field] = value; calculateFFScores(); saveState();
}

function renderFFTable() {
  const tbody = document.getElementById('tbody-ff'); tbody.innerHTML = '';
  appState.ff.teamsData.forEach((t, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b style="color:${i===0?'var(--primary)':'#fff'}; font-size:1.1rem;">#${i+1}</b></td>
      <td class="team-name">${t.name}</td>
      <td><input type="number" min="1" value="${t.m1R}" onchange="updateFFData(${i}, 'm1R', this.value)" ${isAdmin ? '' : 'disabled'}></td>
      <td><input type="number" min="0" value="${t.m1K}" onchange="updateFFData(${i}, 'm1K', this.value)" ${isAdmin ? '' : 'disabled'}></td>
      <td><input type="number" min="1" value="${t.m2R}" onchange="updateFFData(${i}, 'm2R', this.value)" ${isAdmin ? '' : 'disabled'}></td>
      <td><input type="number" min="0" value="${t.m2K}" onchange="updateFFData(${i}, 'm2K', this.value)" ${isAdmin ? '' : 'disabled'}></td>
      <td><input type="number" min="1" value="${t.m3R}" onchange="updateFFData(${i}, 'm3R', this.value)" ${isAdmin ? '' : 'disabled'}></td>
      <td><input type="number" min="0" value="${t.m3K}" onchange="updateFFData(${i}, 'm3K', this.value)" ${isAdmin ? '' : 'disabled'}></td>
      <td>${t.booyah > 0 ? `<span class="booyah-badge">${t.booyah}</span>` : '0'}</td>
      <td>${t.kills}</td><td class="total-pts">${t.pts}</td>
    `; tbody.appendChild(tr);
  });
  checkPodiumFF();
}

function checkPodiumFF() {
  const teams = appState.ff.teamsData || []; const podium = document.getElementById('podium-ff'); const hasPoints = teams.some(t => t.pts > 0);
  if (teams.length >= 1 && hasPoints) {
    document.getElementById('gold-ff').innerHTML = teams[0] ? `${escapeHTML(teams[0].name)}<br><span style="font-size:1rem;color:var(--primary)">${teams[0].pts} PTS</span>` : '-';
    document.getElementById('silver-ff').innerHTML = teams[1] ? `${escapeHTML(teams[1].name)}<br><span style="font-size:1rem;color:#a1aab3">${teams[1].pts} PTS</span>` : '-';
    document.getElementById('bronze-ff').innerHTML = teams[2] ? `${escapeHTML(teams[2].name)}<br><span style="font-size:1rem;color:#cd7f32">${teams[2].pts} PTS</span>` : '-';
    podium.style.display = 'block';
  } else { podium.style.display = 'none'; }
}

// --- SMART TAG UI FOR TOURNAMENTS ---
function refreshProfilePickers(){
  const profiles = getProfiles();
  const configs = { ef:{type:'player',label:'👤 ค้นหาผู้เล่น...'}, rov:{type:'team',label:'🛡️ ค้นหาทีม...'}, ff:{type:'team',label:'🪂 ค้นหาทีม...'} };
  Object.keys(configs).forEach(game=>{
    const sel=document.getElementById('profilePicker-'+game); if(!sel)return;
    const input=document.getElementById('input-'+game);
    const selectedNames = input ? input.value.split('\n').map(x=>x.trim()).filter(Boolean) : [];
    const cfg=configs[game]; const current=sel.value;
    
    // กรองเอาเฉพาะคนที่ยังไม่ได้เลือก
    const items=Object.values(profiles).filter(p=>p.game===game && p.type===cfg.type && !selectedNames.includes(p.name.trim()));
    
    sel.innerHTML='<option value="">— '+cfg.label+' —</option>'+items.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}${p.team && cfg.type==='player' ? ' • '+escapeHTML(p.team):''}</option>`).join('');
    if(items.some(p=>p.id===current))sel.value=current;
  });
}

function renderSelectedList(game) {
  const input = document.getElementById('input-'+game);
  const container = document.getElementById('selected-list-'+game);
  if(!input || !container) return;
  const names = input.value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(names.length === 0) {
    container.innerHTML = '<span style="color:#64748b; font-size:0.9rem; font-style:italic;">ยังไม่มีผู้เข้าแข่งขัน... เลือกลงสนามจากกล่องด้านบน</span>';
    return;
  }
  container.innerHTML = names.map((name, idx) => `
    <div class="selected-item">${escapeHTML(name)} 
      ${isAdmin ? `<span class="remove" onclick="removeSelected('${game}', ${idx})">&times;</span>` : ''}
    </div>
  `).join('');
}

function removeSelected(game, idx) {
  if(!isAdmin) return;
  const input = document.getElementById('input-'+game);
  let names = input.value.split('\n').map(x=>x.trim()).filter(Boolean);
  names.splice(idx, 1);
  input.value = names.join('\n');
  renderSelectedList(game);
  refreshProfilePickers();
  saveState();
}

function addProfileToGame(game,id){
  if(!id)return; const p=getProfiles()[id]; if(!p)return;
  const input=document.getElementById('input-'+game); if(!input)return;
  const name=(p.name||'').trim(); const names=input.value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!names.includes(name)) names.push(name);
  input.value=names.join('\n');
  const sel=document.getElementById('profilePicker-'+game); if(sel)sel.value='';
  renderSelectedList(game);
  refreshProfilePickers();
  saveState();
}

// --- GOOGLE DRIVE IMAGE PARSER ---
function processImageUrl(url) {
  if (!url) return '';
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  return url;
}

// --- PLAYER / TEAM PROFILE SYSTEM ---
function getProfiles(){ return appState.profiles || {}; }
function escapeHTML(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

function avatarHTML(p) {
  const safeUrl = escapeHTML(processImageUrl(p.avatar));
  return p.avatar ? `<img src="${safeUrl}" onerror="this.style.display='none'">` : (p.type==='team' ? '🛡️' : '👤');
}

function renderProfiles(){
  const pGrid = document.getElementById('playerGrid'); const tGrid = document.getElementById('teamGrid');
  if(!pGrid || !tGrid) return;
  const list = Object.values(getProfiles());
  let pHTML = '', tHTML = '';

  list.sort((a,b) => b.id.localeCompare(a.id)).forEach((p, i) => {
    const card = `<article class="profile-card" style="animation-delay: ${Math.min(i*50, 400)}ms" onclick="openProfileDetail('${p.id}')"><div class="profile-avatar">${avatarHTML(p)}</div><div class="profile-name">${escapeHTML(p.name)}</div><div class="profile-sub">${p.type==='team'?'🛡️ ทีม':'👤 ผู้เล่น'} • ${escapeHTML(p.gameLabel||'')}</div><div class="profile-clear"></div></article>`;
    if (p.type === 'player') pHTML += card; else if (p.type === 'team') tHTML += card;
  });
  pGrid.innerHTML = pHTML || '<div class="profile-empty">ยังไม่มีข้อมูลผู้เล่นในระบบ</div>';
  tGrid.innerHTML = tHTML || '<div class="profile-empty">ยังไม่มีข้อมูลทีมในระบบ</div>';
}

function openPlayerForm(id=null) {
  if(!isAdmin){alert('ใช้ได้เฉพาะกรรมการ');return;}
  document.getElementById('playerForm').reset(); document.getElementById('playerId').value = id || '';
  document.getElementById('playerFormTitle').textContent = id ? '✏️ แก้ไขข้อมูลผู้เล่น' : '👤 เพิ่มผู้เล่นใหม่';
  if(id && appState.profiles[id]) {
    const p = appState.profiles[id];
    document.getElementById('playerGame').value = p.game || 'ef';
    document.getElementById('playerName').value = p.name || '';
    document.getElementById('playerRealName').value = p.realname || '';
    document.getElementById('playerRole').value = p.role || '';
    document.getElementById('playerTeam').value = p.team || '';
    document.getElementById('playerAvatar').value = p.avatar || '';
    document.getElementById('playerBio').value = p.bio || '';
  }
  document.getElementById('playerFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePlayerForm(e) { 
  if(e && e.target.id !== 'playerFormModal' && !e.target.classList.contains('modal-close')) return; 
  document.getElementById('playerFormModal').classList.remove('active'); 
  document.body.style.overflow = '';
}

function submitPlayer(e) {
  e.preventDefault(); if(!isAdmin) return;
  const id = document.getElementById('playerId').value || ('p_'+Date.now());
  const game = document.getElementById('playerGame').value; const labels = {ef:'eFootball', rov:'Garena RoV', ff:'Free Fire'};
  appState.profiles[id] = { id, type: 'player', game, gameLabel: labels[game],
    name: document.getElementById('playerName').value.trim(), realname: document.getElementById('playerRealName').value.trim(),
    role: document.getElementById('playerRole').value.trim(), team: document.getElementById('playerTeam').value.trim(),
    avatar: document.getElementById('playerAvatar').value.trim(), bio: document.getElementById('playerBio').value.trim(), members: ''
  };
  saveState(); renderProfiles(); refreshProfilePickers(); closePlayerForm();
}

function openTeamForm(id=null) {
  if(!isAdmin){alert('ใช้ได้เฉพาะกรรมการ');return;}
  document.getElementById('teamForm').reset(); document.getElementById('teamId').value = id || '';
  document.getElementById('teamFormTitle').textContent = id ? '✏️ แก้ไขข้อมูลทีม' : '🛡️ เพิ่มทีมใหม่';
  if(id && appState.profiles[id]) {
    const p = appState.profiles[id];
    document.getElementById('teamGame').value = p.game || 'rov';
    document.getElementById('teamName').value = p.name || '';
    document.getElementById('teamRealName').value = p.realname || '';
    document.getElementById('teamMembers').value = p.members || '';
    document.getElementById('teamAvatar').value = p.avatar || '';
    document.getElementById('teamBio').value = p.bio || '';
  }
  document.getElementById('teamFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeTeamForm(e) { 
  if(e && e.target.id !== 'teamFormModal' && !e.target.classList.contains('modal-close')) return; 
  document.getElementById('teamFormModal').classList.remove('active'); 
  document.body.style.overflow = '';
}

function submitTeam(e) {
  e.preventDefault(); if(!isAdmin) return;
  const id = document.getElementById('teamId').value || ('t_'+Date.now());
  const game = document.getElementById('teamGame').value; const labels = {ef:'eFootball', rov:'Garena RoV', ff:'Free Fire'};
  appState.profiles[id] = { id, type: 'team', game, gameLabel: labels[game],
    name: document.getElementById('teamName').value.trim(), realname: document.getElementById('teamRealName').value.trim(),
    members: document.getElementById('teamMembers').value.trim(), role: '', team: '',
    avatar: document.getElementById('teamAvatar').value.trim(), bio: document.getElementById('teamBio').value.trim()
  };
  saveState(); renderProfiles(); refreshProfilePickers(); closeTeamForm();
}

function openProfileDetail(id){
  const p=getProfiles()[id];if(!p)return;
  let membersHTML = '';
  let linkedPlayersHTML = '';
  
  if(p.type === 'team') {
    const linkedPlayers = Object.values(getProfiles()).filter(x => x.type === 'player' && x.team && x.team.trim() === p.name.trim());
    if(linkedPlayers.length > 0) {
      linkedPlayersHTML = `<div style="margin-top:20px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:20px;">
        <div style="color:var(--primary); font-size:1rem; font-weight:700; margin-bottom:12px; letter-spacing:1px; text-transform:uppercase;">👤 สมาชิกในทีม</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px;">
          ${linkedPlayers.map(lp => `
             <div class="member-tag" style="cursor:pointer; display:flex; gap:10px; width:100%;" onclick="event.stopPropagation(); closeProfileDetail(); setTimeout(()=>openProfileDetail('${lp.id}'), 300)">
                <div style="width:24px; height:24px; border-radius:50%; overflow:hidden; background:rgba(0,0,0,0.5); display:grid; place-items:center; font-size:0.7rem; flex-shrink:0; border:1px solid rgba(255,255,255,0.2);">
                   ${lp.avatar ? `<img src="${escapeHTML(processImageUrl(lp.avatar))}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
                </div>
                <div style="font-size:0.95rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">${escapeHTML(lp.name)}</div>
             </div>
          `).join('')}
        </div>
      </div>`;
    }
  }

  if (p.type === 'team' && p.members) {
    const mList = p.members.split('\n').map(m => m.trim()).filter(Boolean);
    if (mList.length > 0) {
      membersHTML = `<div style="margin-top:20px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:20px;">
        <div style="color:var(--secondary); font-size:1rem; font-weight:700; margin-bottom:12px; letter-spacing:1px; text-transform:uppercase;">📋 รายชื่อสมาชิกเสริม</div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          ${mList.map(m => `<span class="member-tag">${escapeHTML(m)}</span>`).join('')}
        </div>
      </div>`;
    }
  }

  let privateDetailsHTML = '';
  if (isAdmin) {
    privateDetailsHTML = `
      ${p.realname?`<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">👤</span> <span>${escapeHTML(p.realname)}</span></div>`:''}
      ${p.team?`<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">🛡️</span> <span>สังกัด: <b style="color:var(--primary);">${escapeHTML(p.team)}</b></span></div>`:''}
      ${p.role?`<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">🎯</span> <span>ตำแหน่ง: <b>${escapeHTML(p.role)}</b></span></div>`:''}
      ${p.bio?`<div style="margin-top:10px; color:#cbd5e1; line-height:1.7; background:rgba(0,0,0,0.3); padding:15px; border-radius:12px; border-left:3px solid var(--primary); font-weight:300;">${escapeHTML(p.bio).replace(/\n/g, '<br>')}</div>`:''}
    `;
  } else {
    privateDetailsHTML = `
      ${p.team?`<div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;"><span style="font-size:1.2rem;">🛡️</span> <span>สังกัด: <b style="color:var(--primary);">${escapeHTML(p.team)}</b></span></div>`:''}
      <div style="padding:15px; background:linear-gradient(135deg, rgba(250, 204, 21, 0.1), rgba(250, 204, 21, 0.05)); border:1px solid rgba(250, 204, 21, 0.3); border-radius:12px; color:var(--neon-gold, #facc15); font-size:0.9rem; text-align:center; box-shadow: 0 5px 15px rgba(250, 204, 21, 0.1);">
        🔒 ข้อมูลผู้เล่นเชิงลึกสงวนสิทธิ์เฉพาะคณะกรรมการ
      </div>
    `;
  }

  document.getElementById('profileDetailContent').innerHTML=
    `<div class="profile-detail-head">
       <div class="profile-avatar" style="box-shadow: 0 10px 30px rgba(0,0,0,0.8); border-color:var(--primary);">${avatarHTML(p)}</div>
       <div class="profile-detail-meta">
         <h3 style="margin:0; font-size: 2.2rem; color:#fff;">${escapeHTML(p.name)}</h3>
         <p style="margin:0; color:var(--primary);">${p.type==='team'?'🛡️ Team':'👤 Player'} <span style="color:#8492a6; margin:0 5px;">|</span> <span style="color:#fff;">${escapeHTML(p.gameLabel||'')}</span></p>
       </div>
     </div>
     <div style="display:grid; gap:12px; color:#f8fafc; font-size:1.05rem;">
       ${privateDetailsHTML}
     </div>
     ${linkedPlayersHTML}
     ${membersHTML}
     ${isAdmin?`<div style="display:flex; gap:12px; margin-top:25px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
        <button class="profile-btn" style="flex:1; justify-content:center;" onclick="closeProfileDetail(); setTimeout(()=>${p.type==='player' ? `openPlayerForm('${id}')` : `openTeamForm('${id}')`}, 300)">✏️ แก้ไขข้อมูล</button>
        <button class="profile-btn" style="color:#ff2a2a; border-color:rgba(255,42,42,0.4); background:rgba(255,42,42,0.1);" onclick="deleteProfile('${id}')">🗑️ ลบ</button>
     </div>`:''}`;
  document.getElementById('profileDetailModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProfileDetail(event){
  if(event&&event.target.id!=='profileDetailModal'&&!event.target.classList.contains('modal-close'))return;
  document.getElementById('profileDetailModal').classList.remove('active');
  document.body.style.overflow = '';
}

function deleteProfile(id){
  if(!isAdmin)return;
  if(confirm('ยืนยันการลบ Profile นี้? ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร')){
    delete appState.profiles[id];
    saveState();
    renderProfiles();
    closeProfileDetail();
  }
}
