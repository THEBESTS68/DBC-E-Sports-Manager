#!/usr/bin/env node
// =====================================================================
//  ย้ายข้อมูลจาก Firebase -> Supabase (รันครั้งเดียว ไม่ต้อง npm install)
//
//  ใช้งาน (PowerShell):
//    $env:SUPABASE_URL="https://xxxx.supabase.co"
//    $env:SUPABASE_SERVICE_ROLE_KEY="..."      # Project Settings > API > service_role (เก็บเป็นความลับ)
//    node scripts/migrate-firebase-to-supabase.mjs              # ดึงจาก Firebase โดยตรง
//    node scripts/migrate-firebase-to-supabase.mjs backup.json  # หรือใช้ไฟล์ที่กด "ส่งออกข้อมูล" ในเว็บ
//
//  เพิ่ม --dry-run เพื่อดูว่าจะย้ายอะไรบ้างโดยไม่เขียนข้อมูล
// =====================================================================
import { readFile } from 'node:fs/promises';

const FIREBASE_URL = 'https://dbc-nextgen-e-sport-manager-default-rtdb.asia-southeast1.firebasedatabase.app/dbc_tournament_data.json';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find(a => !a.startsWith('--'));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('ต้องตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อน (หรือใช้ --dry-run)');
  process.exit(1);
}

async function loadSource() {
  if (file) {
    console.log('อ่านข้อมูลจากไฟล์', file);
    const json = JSON.parse(await readFile(file, 'utf8'));
    return json.data ?? json; // รองรับไฟล์ส่งออกจากเว็บ { exportedAt, data }
  }
  console.log('ดึงข้อมูลจาก Firebase...');
  const res = await fetch(FIREBASE_URL);
  if (!res.ok) throw new Error(`Firebase ตอบกลับ ${res.status}`);
  return (await res.json()) || {};
}

async function upsert(table, rows) {
  if (rows.length === 0) return;
  if (dryRun) { console.log(`  [dry-run] ${table}: ${rows.length} แถว`); return; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  console.log(`  ✓ ${table}: ${rows.length} แถว`);
}

const src = await loadSource();
const asArray = v => (Array.isArray(v) ? v : Object.values(v || {}));

const games = ['ef', 'rov', 'ff'].map(id => {
  const g = src[id] || {};
  const data = id === 'ff'
    ? { players: g.players || '', teamsData: asArray(g.teamsData).filter(Boolean) }
    : { players: g.players || '', tournament: asArray(g.tournament).map(asArray) };
  return { id, data };
});

const profiles = [], privates = [];
for (const [key, p] of Object.entries(src.profiles || {})) {
  if (!p || !p.name) continue;
  const id = p.id || key;
  profiles.push({
    id, type: p.type === 'team' ? 'team' : 'player', game: ['ef', 'rov', 'ff'].includes(p.game) ? p.game : 'ef',
    name: p.name, team: p.team || '', members: p.members || '', avatar: p.avatar || ''
  });
  privates.push({ profile_id: id, realname: p.realname || '', role: p.role || '', bio: p.bio || '' });
}

console.log(`พบ: ${profiles.length} โปรไฟล์, เกม ${games.map(g => g.id).join('/')}`);
await upsert('games', games);
await upsert('profiles', profiles);
await upsert('profile_private', privates);
console.log(dryRun ? 'จบ dry-run (ยังไม่ได้เขียนข้อมูล)' : 'ย้ายข้อมูลเสร็จแล้ว');
