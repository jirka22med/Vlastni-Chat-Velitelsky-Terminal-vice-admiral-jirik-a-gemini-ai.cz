// ═══════════════════════════════════════════════════════════
// 🔥 FIREBASE CORE INITIALIZATION - USS PROMETHEUS
// Verze: 2.0 | Firebase SDK 10.x | Modulární API
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// 📦 IMPORT FIREBASE MODULŮ (CDN verze)
// ─────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    getDocs,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────
// 🔐 FIREBASE CONFIG (Z TVÉHO MODULU)
// ─────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyAl8nar2dLrqh3Rj-6-kmBBcDoffWrhV8E",
    authDomain: "gemini-aplikace-uss-prometheus.firebaseapp.com",
    projectId: "gemini-aplikace-uss-prometheus",
    storageBucket: "gemini-aplikace-uss-prometheus.firebasestorage.app",
    messagingSenderId: "929013573928",
    appId: "1:929013573928:web:13c258e1af62bad882c81d",
    measurementId: "G-RTSE7J4EQW"
};

// ─────────────────────────────────────────────────────────
// 🚀 INICIALIZACE FIREBASE
// ─────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────
// 🌍 GLOBÁLNÍ EXPORT PRO OSTATNÍ MODULY
// ─────────────────────────────────────────────────────────
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;
window.googleProvider = googleProvider;

// ─────────────────────────────────────────────────────────
// 📊 STATUS LOG
// ─────────────────────────────────────────────────────────
console.log("🔥 Firebase inicializován:", app.name);
console.log("🔐 Auth modul připraven:", auth.app.name);
console.log("💾 Firestore databáze aktivní:", db.type);

// ─────────────────────────────────────────────────────────
// 🎯 EXPORT FUNKCÍ PRO OSTATNÍ MODULY
// ─────────────────────────────────────────────────────────
export {
    app,
    auth,
    db,
    googleProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    serverTimestamp
};

// ═══════════════════════════════════════════════════════════
// ✅ MODUL ÚSPĚŠNĚ NAČTEN
// ═══════════════════════════════════════════════════════════