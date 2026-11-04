// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyDicQAMvKGEeWdUIROvPRkBbjjzipmGM7M",
  authDomain: "dbc-nextgen-e-sport-manager.firebaseapp.com",
  databaseURL: "https://dbc-nextgen-e-sport-manager-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dbc-nextgen-e-sport-manager",
  storageBucket: "dbc-nextgen-e-sport-manager.firebasestorage.app",
  messagingSenderId: "961994253204",
  appId: "1:961994253204:web:ecb3a1518eaf4686946581",
  measurementId: "G-9ZRYXF7QJR"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
