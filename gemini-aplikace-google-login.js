// ═══════════════════════════════════════════════════════════
// 🔐 GOOGLE AUTH & USER MANAGEMENT - USS PROMETHEUS
// Verze: 2.0 | OAuth 2.0 | Firestore Sync
// ═══════════════════════════════════════════════════════════

import {
    auth,
    db,
    googleProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from './gemini-aplikace-firebase.js';

// ─────────────────────────────────────────────────────────
// 🌍 GLOBÁLNÍ PROMĚNNÉ
// ─────────────────────────────────────────────────────────
let currentUser = null;
window.currentUser = null; // Export pro script.js

// ─────────────────────────────────────────────────────────
// 🔐 GOOGLE LOGIN FUNKCE
// ─────────────────────────────────────────────────────────
export async function loginWithGoogle() {
    try {
        console.log("🔄 Spouštím Google OAuth...");
        
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        console.log("✅ Přihlášení úspěšné:", user.displayName);
        
        // Ulož uživatele do Firestore
        await saveUserToFirestore(user);
        
        // Update UI
        updateLoginUI(user);
        
        // Systémová zpráva do chatu
        if (typeof addMessage === 'function') {
            addMessage("success", `🖖 VÍTEJ, ${user.displayName.toUpperCase()}! Systém aktivován.`);
        }
        
        return user;
        
    } catch (error) {
        console.error("❌ Chyba při přihlášení:", error);
        
        if (typeof addMessage === 'function') {
            addMessage("system", `⚠️ CHYBA AUTENTIZACE: ${error.message}`);
        }
        
        throw error;
    }
}

// ─────────────────────────────────────────────────────────
// 🚪 LOGOUT FUNKCE
// ─────────────────────────────────────────────────────────
export async function logout() {
    try {
        await signOut(auth);
        console.log("✅ Odhlášení úspěšné");
        
        currentUser = null;
        window.currentUser = null;
        
        updateLoginUI(null);
        
        if (typeof addMessage === 'function') {
            addMessage("system", "🔒 SESIÓN UKONČENA. Systém v režimu offline.");
        }
        
    } catch (error) {
        console.error("❌ Chyba při odhlášení:", error);
    }
}

// ─────────────────────────────────────────────────────────
// 💾 ULOŽENÍ UŽIVATELE DO FIRESTORE
// ─────────────────────────────────────────────────────────
async function saveUserToFirestore(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // Nový uživatel
            await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                apiKeys: [], // Prázdné pole pro API klíče
                chatHistory: []
            });
            console.log("✅ Nový uživatel vytvořen v DB");
        } else {
            // Existující uživatel - update lastLogin
            await setDoc(userRef, {
                lastLogin: serverTimestamp()
            }, { merge: true });
            console.log("✅ Poslední přihlášení aktualizováno");
        }
        
    } catch (error) {
        console.error("❌ Chyba při ukládání uživatele:", error);
    }
}

// ─────────────────────────────────────────────────────────
// 🎨 UPDATE UI PO PŘIHLÁŠENÍ/ODHLÁŠENÍ
// ─────────────────────────────────────────────────────────
function updateLoginUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (user) {
        // Přihlášen
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        userName.textContent = user.displayName || user.email;
        
    } else {
        // Odhlášen
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
    }
}

// ─────────────────────────────────────────────────────────
// 👂 AUTH STATE LISTENER (Auto-login při refreshi)
// ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("🔄 Uživatel detekován:", user.displayName);
        currentUser = user;
        window.currentUser = user;
        
        updateLoginUI(user);
        
        // Načti data z Firestore
        await loadUserData(user.uid);
        
    } else {
        console.log("🔒 Žádný přihlášený uživatel");
        currentUser = null;
        window.currentUser = null;
        updateLoginUI(null);
    }
});

// ─────────────────────────────────────────────────────────
// 📥 NAČTENÍ DAT UŽIVATELE Z FIRESTORE
// ─────────────────────────────────────────────────────────
async function loadUserData(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("✅ Data uživatele načtena:", userData);
            
            // Pokud má uložené API klíče, načti je
            if (userData.apiKeys && userData.apiKeys.length > 0) {
                // TODO: Dešifrování a načtení klíčů (MODUL B)
                console.log("🔑 Nalezeny uložené API klíče:", userData.apiKeys.length);
            }
            
            // Pokud má uložený chat history
            if (userData.chatHistory && userData.chatHistory.length > 0) {
                console.log("💬 Nalezena chat historie:", userData.chatHistory.length);
                // TODO: Načtení historie do UI
            }
            
            return userData;
        }
        
    } catch (error) {
        console.error("❌ Chyba při načítání dat:", error);
    }
}

// ─────────────────────────────────────────────────────────
// 🌍 EXPORT PRO GLOBÁLNÍ POUŽITÍ
// ─────────────────────────────────────────────────────────
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.getCurrentUser = () => currentUser;

// ═══════════════════════════════════════════════════════════
// ✅ AUTH MODUL AKTIVNÍ
// ═══════════════════════════════════════════════════════════
console.log("🔐 Google Auth modul načten a připraven");