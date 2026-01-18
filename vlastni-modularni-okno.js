// ═══════════════════════════════════════════════════════════
// 🔐 MODULÁRNÍ OKNO - ŠIFROVANÝ API KEY MANAGER
// Verze: 2.0 | AES-256 Encryption | Cloud Firestore Sync
// ═══════════════════════════════════════════════════════════

import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from './gemini-aplikace-firebase.js';

// ─────────────────────────────────────────────────────────
// 🔑 AES-256 ŠIFROVACÍ FUNKCE (Web Crypto API)
// ─────────────────────────────────────────────────────────
const ENCRYPTION_KEY = "USS-PROMETHEUS-MASTER-KEY-2026"; // Změň na vlastní tajný klíč!

async function deriveKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("prometheus-salt-2026"),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function encryptApiKey(apiKey) {
    const key = await deriveKey(ENCRYPTION_KEY);
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(apiKey)
    );
    
    // Kombinuj IV + šifrovaná data do Base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
}

async function decryptApiKey(encryptedBase64) {
    const key = await deriveKey(ENCRYPTION_KEY);
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
}

// ─────────────────────────────────────────────────────────
// 💾 FIRESTORE OPERACE - API KLÍČE
// ─────────────────────────────────────────────────────────
async function saveApiKeysToCloud(apiKeysArray) {
    const user = window.currentUser;
    if (!user) {
        console.error("❌ Uživatel není přihlášen!");
        return false;
    }
    
    try {
        // Zašifruj každý klíč
        const encryptedKeys = await Promise.all(
            apiKeysArray.map(async (keyObj) => ({
                id: keyObj.id,
                name: keyObj.name,
                encryptedKey: await encryptApiKey(keyObj.key),
                status: keyObj.status || "active",
                usageCount: keyObj.usageCount || 0,
                dailyLimit: keyObj.dailyLimit || 20,
                createdAt: keyObj.createdAt || Date.now(),
                lastUsed: keyObj.lastUsed || null
            }))
        );
        
        const userRef = doc(db, "users", user.uid);
        
        // 🔥 KRITICKÁ OPRAVA: Použij setDoc s merge: true místo updateDoc
        // To vytvoří dokument pokud neexistuje, nebo aktualizuje existující
        await setDoc(userRef, {
            apiKeys: encryptedKeys,
            lastKeysUpdate: serverTimestamp()
        }, { merge: true }); // 👈 TOTO JE KLÍČOVÉ!
        
        console.log("✅ API klíče uloženy do cloudu (šifrované)");
        return true;
        
    } catch (error) {
        console.error("❌ Chyba při ukládání klíčů:", error);
        return false;
    }
}

async function loadApiKeysFromCloud() {
    const user = window.currentUser;
    if (!user) {
        console.log("🔒 Uživatel není přihlášen - klíče nejsou načteny");
        return [];
    }
    
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() || !userSnap.data().apiKeys) {
            console.log("📭 Žádné uložené API klíče");
            return [];
        }
        
        const encryptedKeys = userSnap.data().apiKeys;
        
        // Dešifruj každý klíč
        const decryptedKeys = await Promise.all(
            encryptedKeys.map(async (keyObj) => ({
                id: keyObj.id,
                name: keyObj.name,
                key: await decryptApiKey(keyObj.encryptedKey),
                status: keyObj.status,
                usageCount: keyObj.usageCount,
                dailyLimit: keyObj.dailyLimit,
                createdAt: keyObj.createdAt,
                lastUsed: keyObj.lastUsed
            }))
        );
        
        console.log("✅ API klíče načteny a dešifrovány:", decryptedKeys.length);
        return decryptedKeys;
        
    } catch (error) {
        console.error("❌ Chyba při načítání klíčů:", error);
        return [];
    }
}

// ─────────────────────────────────────────────────────────
// 🎨 MODULÁRNÍ OKNO - UI
// ─────────────────────────────────────────────────────────
let apiKeysStore = []; // Lokální cache

function createModalWindow() {
    const modal = document.createElement('div');
    modal.id = 'api-key-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeApiKeyModal()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔐 SPRÁVA API KLÍČŮ</h2>
                <button onclick="closeApiKeyModal()" class="modal-close">✕</button>
            </div>
            
            <div class="modal-body">
                <!-- PŘIDÁNÍ NOVÉHO KLÍČE -->
                <div class="key-input-section">
                    <input type="text" id="new-key-name" placeholder="Název klíče (např. Klíč 1)" style="width: 30%; margin-right: 10px;">
                    <input type="password" id="new-key-value" placeholder="Vlož API klíč zde..." style="width: 50%; margin-right: 10px;">
                    <button onclick="addNewApiKey()" style="background: var(--lcars-orange);">➕ PŘIDAT</button>
                </div>
                
                <!-- SEZNAM KLÍČŮ -->
                <div id="keys-list" class="keys-list">
                    <div class="loading-keys">⏳ Načítám klíče...</div>
                </div>
                
                <!-- BULK OPERACE -->
                <div class="modal-footer">
                    <button onclick="exportApiKeys()" style="background: var(--lcars-blue);">📥 EXPORT JSON</button>
                    <button onclick="document.getElementById('import-file').click()" style="background: var(--lcars-purple);">📤 IMPORT JSON</button>
                    <input type="file" id="import-file" accept=".json" style="display:none;" onchange="importApiKeys(event)">
                    <button onclick="saveAllKeys()" style="background: #00ff00; color: black;">💾 ULOŽIT VŠE</button>
                    <button onclick="manualResetUsage()" style="background: #ffcc00; color: black;">🔄 RESET LIMITŮ</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Načti klíče z cloudu
    loadKeysIntoUI();
}

async function loadKeysIntoUI() {
    const keysList = document.getElementById('keys-list');
    keysList.innerHTML = '<div class="loading-keys">⏳ Načítám klíče z cloudu...</div>';
    
    apiKeysStore = await loadApiKeysFromCloud();
    
    if (apiKeysStore.length === 0) {
        keysList.innerHTML = '<div class="no-keys">📭 Zatím žádné klíče. Přidej první!</div>';
        return;
    }
    
    keysList.innerHTML = '';
    
    apiKeysStore.forEach((keyObj, index) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'key-item';
        keyDiv.innerHTML = `
            <div class="key-info">
                <span class="key-name">${keyObj.name}</span>
                <span class="key-status status-${keyObj.status}">
                    ${keyObj.status === 'active' ? '✅' : keyObj.status === 'warning' ? '🟡' : '🔴'}
                    ${keyObj.usageCount}/${keyObj.dailyLimit}
                </span>
            </div>
            <div class="key-actions">
                <input type="password" value="${keyObj.key}" id="key-${keyObj.id}" class="key-value" readonly>
                <button onclick="toggleKeyVisibility('${keyObj.id}')" class="btn-show">👁️</button>
                <button onclick="editKey('${keyObj.id}')" class="btn-edit">✏️</button>
                <button onclick="deleteKey('${keyObj.id}')" class="btn-delete">🗑️</button>
            </div>
        `;
        keysList.appendChild(keyDiv);
    });
}

function toggleKeyVisibility(keyId) {
    const input = document.getElementById(`key-${keyId}`);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function editKey(keyId) {
    const keyObj = apiKeysStore.find(k => k.id === keyId);
    if (!keyObj) return;
    
    const newName = prompt("Nový název klíče:", keyObj.name);
    if (newName) {
        keyObj.name = newName;
        loadKeysIntoUI();
    }
}

function deleteKey(keyId) {
    if (confirm("Opravdu smazat tento klíč?")) {
        apiKeysStore = apiKeysStore.filter(k => k.id !== keyId);
        loadKeysIntoUI();
        saveAllKeys();
    }
}

async function addNewApiKey() {
    const name = document.getElementById('new-key-name').value.trim();
    const key = document.getElementById('new-key-value').value.trim();
    
    if (!name || !key) {
        alert("⚠️ Vyplň název i klíč!");
        return;
    }
    
    const newKey = {
        id: 'key-' + Date.now(),
        name: name,
        key: key,
        status: 'active',
        usageCount: 0,
        dailyLimit: 20,
        createdAt: Date.now(),
        lastUsed: null
    };
    
    apiKeysStore.push(newKey);
    
    document.getElementById('new-key-name').value = '';
    document.getElementById('new-key-value').value = '';
    
    await saveAllKeys();
    loadKeysIntoUI();
}

async function saveAllKeys() {
    const success = await saveApiKeysToCloud(apiKeysStore);
    if (success) {
        if (typeof addMessage === 'function') {
            addMessage("success", "✅ API klíče uloženy do cloudu (šifrované)");
        }
    }
}

function exportApiKeys() {
    const dataStr = JSON.stringify(apiKeysStore, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-keys-backup-${Date.now()}.json`;
    a.click();
}

function importApiKeys(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                apiKeysStore = imported;
                await saveAllKeys();
                loadKeysIntoUI();
                alert("✅ Klíče importovány!");
            }
        } catch (error) {
            alert("❌ Neplatný JSON soubor!");
        }
    };
    reader.readAsText(file);
}

// ─────────────────────────────────────────────────────────
// 🌍 GLOBÁLNÍ FUNKCE
// ─────────────────────────────────────────────────────────
window.openApiKeyModal = function() {
    if (!window.currentUser) {
        alert("⚠️ Nejprve se přihlas!");
        return;
    }
    
    if (!document.getElementById('api-key-modal')) {
        createModalWindow();
    } else {
        document.getElementById('api-key-modal').style.display = 'flex';
        loadKeysIntoUI();
    }
};

window.closeApiKeyModal = function() {
    const modal = document.getElementById('api-key-modal');
    if (modal) modal.style.display = 'none';
};

window.addNewApiKey = addNewApiKey;
window.saveAllKeys = saveAllKeys;
window.exportApiKeys = exportApiKeys;
window.importApiKeys = importApiKeys;
window.toggleKeyVisibility = toggleKeyVisibility;
window.editKey = editKey;
window.deleteKey = deleteKey;

// ─────────────────────────────────────────────────────────
// 🚀 AUTO-NAČTENÍ KLÍČŮ PO PŘIHLÁŠENÍ
// ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    // Počkej na přihlášení
    const checkUser = setInterval(async () => {
        if (window.currentUser) {
            clearInterval(checkUser);
            apiKeysStore = await loadApiKeysFromCloud();
            
            // Pokud existují klíče, načti je do script.js
            if (apiKeysStore.length > 0 && typeof window.loadApiKeysFromManager === 'function') {
                window.loadApiKeysFromManager(apiKeysStore);
            }
        }
    }, 500);
});

// ═══════════════════════════════════════════════════════════
// ✅ MODULÁRNÍ OKNO AKTIVNÍ
// ═══════════════════════════════════════════════════════════
console.log("🔐 Modulární API Key Manager načten");

// ═══════════════════════════════════════════════════════════
// 🔄 AUTO-RESET DAILY LIMIT
// Přidej tento kód na konec vlastni-modularni-okno.js
// ═══════════════════════════════════════════════════════════

// Funkce pro reset usage counters
async function resetDailyUsage() {
    const user = window.currentUser;
    if (!user) return;
    
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return;
        
        const userData = userSnap.data();
        const apiKeys = userData.apiKeys || [];
        
        // Reset všech usage countů
        const resetKeys = apiKeys.map(key => ({
            ...key,
            usageCount: 0,
            status: 'active',
            lastReset: Date.now()
        }));
        
        await setDoc(userRef, {
            apiKeys: resetKeys,
            lastKeysUpdate: serverTimestamp()
        }, { merge: true });
        
        console.log("✅ Daily usage reset dokončen");
        
        if (typeof addMessage === 'function') {
            addMessage("success", "✅ Denní limity všech klíčů byly resetovány!");
        }
        
        // Reload UI
        if (document.getElementById('api-key-modal')?.style.display !== 'none') {
            loadKeysIntoUI();
        }
        
    } catch (error) {
        console.error("❌ Chyba při resetu:", error);
    }
}

// Kontrola a auto-reset při půlnoci
function scheduleNextReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Půlnoc
    
    const timeUntilMidnight = tomorrow - now;
    
    console.log(`⏰ Příští reset za: ${Math.round(timeUntilMidnight / 1000 / 60 / 60)} hodin`);
    
    setTimeout(async () => {
        await resetDailyUsage();
        scheduleNextReset(); // Naplánuj další
    }, timeUntilMidnight);
}

// Spusť scheduler po přihlášení
window.addEventListener('DOMContentLoaded', () => {
    const checkUser = setInterval(() => {
        if (window.currentUser) {
            clearInterval(checkUser);
            scheduleNextReset();
            console.log("✅ Auto-reset scheduler aktivní");
        }
    }, 500);
});

// Manuální reset button (přidej do modálního okna)
window.manualResetUsage = resetDailyUsage;