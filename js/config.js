// =====================================================================
//  APP CONFIG
//  เปลี่ยน backend เป็น 'supabase' เมื่อตั้งค่า Supabase เสร็จแล้ว
//  (ดูขั้นตอนใน README.md หัวข้อ "ย้ายไป Supabase")
// =====================================================================
window.APP_CONFIG = {
  backend: 'supabase', // 'firebase' | 'supabase'

  firebase: {
    apiKey: "AIzaSyDicQAMvKGEeWdUIROvPRkBbjjzipmGM7M",
    authDomain: "dbc-nextgen-e-sport-manager.firebaseapp.com",
    databaseURL: "https://dbc-nextgen-e-sport-manager-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dbc-nextgen-e-sport-manager",
    storageBucket: "dbc-nextgen-e-sport-manager.firebasestorage.app",
    messagingSenderId: "961994253204",
    appId: "1:961994253204:web:ecb3a1518eaf4686946581",
    measurementId: "G-9ZRYXF7QJR",
    rootPath: 'dbc_tournament_data',
    // SHA-256 ของรหัสกรรมการ (ใช้เฉพาะโหมด Firebase ชั่วคราว)
    // สร้างค่าใหม่: node -e "console.log(require('crypto').createHash('sha256').update('รหัสใหม่').digest('hex'))"
    adminPasscodeSha256: '088dff79a4ae34b73dfbf674f5fc800ff0136992a24e5ad03e20f2e37cfb6f93'
  },

  supabase: {
    url: 'https://wlejrrxuwkyozecvfnnz.supabase.co',
    // anon public key — ใส่ในหน้าเว็บได้ (ห้ามใส่ service_role key ที่นี่)
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZWpycnh1d2t5b3plY3Zmbm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3OTE3MjQsImV4cCI6MjEwOTM2NzcyNH0.YmbHG2thhysamCdokWg066oy5lXnYmpKMmcpseZ85nw'
  }
};
