// ═══════════════════════════════════════════════════════════
// 🚀 MAIN SCRIPT - UPDATED PRO API KEY MANAGER
// ═══════════════════════════════════════════════════════════

// SEZNAM MODELŮ - OVĚŘENO 16.1.2026 podle oficiální dokumentace
const MODELS_TO_TRY = [
    "gemini-3-flash-preview",         // ✅ POTVRZENO: Spuštěno 12.1.2026
    //"gemini-3-pro-preview",           // ✅ POTVRZENO: Nejnovější Pro verze
    "gemini-2.5-flash",               // Stabilní Flash
    //"gemini-2.5-pro",                 // Stabilní Pro
    //"gemini-2.0-flash-exp"            // Záložní experimentální
];  

// 🔑 API KEYS - NYNÍ NAČÍTANÉ Z FIREBASE
let API_KEYS = [];
let currentKeyIndex = 0;
let failedKeys = new Set();

let chatHistory = []; 
let apiKey = "";

// ─────────────────────────────────────────────────────────
// 🔥 NOVÁ FUNKCE: Načtení klíčů z API Key Manageru
// ─────────────────────────────────────────────────────────
window.loadApiKeysFromManager = function(keysArray) {
    // Filtruj pouze aktivní klíče
    API_KEYS = keysArray
        .filter(k => k.status === 'active')
        .map(k => k.key);
    
    if (API_KEYS.length > 0) {
        apiKey = API_KEYS[0];
        currentKeyIndex = 0;
        failedKeys.clear();
        
        console.log(`✅ Načteno ${API_KEYS.length} aktivních API klíčů`);
        
        if (typeof addMessage === 'function') {
            addMessage("success", `🔑 ${API_KEYS.length} API klíčů aktivních a připravených`);
        }
        
        // Update model status
        if (workingModel) {
            showModelStatus(workingModel);
        }
    } else {
        console.warn("⚠️ Žádné aktivní API klíče!");
        if (typeof addMessage === 'function') {
            addMessage("system", "⚠️ ŽÁDNÉ AKTIVNÍ API KLÍČE. Přidej je v 🔐 SPRÁVA KLÍČŮ");
        }
    }
};

// ─────────────────────────────────────────────────────────
// 🔄 ROTACE API KLÍČŮ S DETEKCÍ ÚNIKU
// ─────────────────────────────────────────────────────────
function rotateApiKey(errorMessage) {
    if (API_KEYS.length === 0) {
        addMessage("system", "⛔ KRITICKÁ CHYBA: Flotila API klíčů je prázdná. Přidej klíče v 🔐 SPRÁVA KLÍČŮ");
        return false;
    }

    // 🔴 DETEKCE ÚNIKU (LEAKED): Pokud Google klíč zablokoval trvale
    if (errorMessage.toLowerCase().includes("leaked")) {
        addMessage("system", `⚠️ KLÍČ ${currentKeyIndex + 1} JE KOMPROMITOVÁN (LEAKED). Trvale odstraňuji z flotily.`);
        
        // Odstraň mrtvý klíč
        API_KEYS.splice(currentKeyIndex, 1);
        
        // TODO: Aktualizuj status v Firestore
        // updateKeyStatusInCloud(currentKeyIndex, 'leaked');
        
        if (API_KEYS.length === 0) {
            addMessage("system", "⛔ KATASTROFA: Všechny API klíče unikly a byly zablokovány.");
            apiKey = "";
            return false;
        }

        currentKeyIndex = 0;
        apiKey = API_KEYS[currentKeyIndex];
        addMessage("system", `🔄 Přepnuto na záložní klíč. Zbývá ${API_KEYS.length} aktivních klíčů.`);
        return true;
    }

    // 🟡 QUOTA (429): Klíč dočasně vyčerpán
    addMessage("system", `⚠️ Klíč ${currentKeyIndex + 1} vyčerpal svou kvótu.`);
    failedKeys.add(currentKeyIndex);
    
    // TODO: Zvýš usage count v Firestore
    // incrementKeyUsage(currentKeyIndex);
    
    // Hledáme další klíč
    for (let i = 0; i < API_KEYS.length; i++) {
        let nextIndex = (currentKeyIndex + 1) % API_KEYS.length;
        
        if (!failedKeys.has(nextIndex)) {
            currentKeyIndex = nextIndex;
            apiKey = API_KEYS[currentKeyIndex];
            addMessage("system", `🔄 Rotace na klíč ${currentKeyIndex + 1}/${API_KEYS.length}`);
            
            if (typeof showModelStatus === 'function') {
                showModelStatus(workingModel || "gemini-3-flash-preview");
            }
            return true;
        }
        currentKeyIndex = nextIndex;
    }
    
    // 🟠 VYČERPÁNÍ: Všechny klíče selhaly
    addMessage("system", `⚠️ Celá flotila (${API_KEYS.length} klíčů) je momentálně mimo provoz. Restart za 60 sekund.`);
    
    setTimeout(() => {
        failedKeys.clear();
        currentKeyIndex = 0;
        apiKey = API_KEYS[0];
        addMessage("system", `✅ Systém obnoven. Všechny klíče v rotaci jsou opět připraveny k akci.`);
        if (typeof showModelStatus === 'function') {
            showModelStatus(workingModel || "gemini-3-flash-preview");
        }
    }, 60000);
    
    return false;
}

// ─────────────────────────────────────────────────────────
// ZBYTEK KÓDU - BEZ ZMĚN
// ─────────────────────────────────────────────────────────
let workingModel = localStorage.getItem("working_model") || null;
let attachedFiles = [];
let canvasContent = "";
let canvasMode = "code";
let isEditMode = false;

if (workingModel) {
    showModelStatus(workingModel);
}

function toggleApiKey() {
    // Starý systém - otevři nový modal místo toho
    window.openApiKeyModal();
}

function saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (key) {
        // Staré API Key pole - přidej to do nového systému
        alert("💡 TIP: Použij 🔐 SPRÁVA KLÍČŮ pro lepší správu API klíčů!");
        
        // Fallback pro single key
        API_KEYS = [key];
        apiKey = key;
        currentKeyIndex = 0;
        
        document.getElementById('api-key-container').style.display = 'none';
        addMessage("system", "API Klíč uložen. Komunikační kanál otevřen.");
        
        workingModel = null;
        localStorage.removeItem("working_model");
    }
}

function showModelStatus(model) {
    const status = document.getElementById('model-status');
    const keyInfo = API_KEYS.length > 0 ? ` | 🔑 ${currentKeyIndex + 1}/${API_KEYS.length}` : '';
    status.textContent = `✓ AKTIVNÍ MODEL: ${model}${keyInfo}`;
    status.style.display = 'block';
}

function addMessage(role, text) {
    const chatWindow = document.getElementById('chat-window');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    // Detekce code bloků - vylepšená regex
    let formattedText = text;
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)\n```/g;
    let codeBlocks = [];
    
    formattedText = formattedText.replace(codeBlockRegex, (match, lang, code) => {
        const blockId = 'code-' + Math.random().toString(36).substr(2, 9);
        codeBlocks.push({ lang: lang || 'code', code: code.trim() });
        
        return `
            <div class="code-block">
                <div class="code-block-header">
                    <span class="code-block-lang">${lang || 'code'}</span>
                    <div style="display: flex; gap: 5px;">
                        <button class="copy-btn" onclick="copyCodeBlock('${blockId}', this)">KOPÍROVAT</button>
                        <button class="copy-btn" onclick="addToCanvas('${blockId}', this)" style="background: var(--lcars-orange);">➕ CANVAS</button>
                    </div>
                </div>
                <pre id="${blockId}"><code>${escapeHtml(code.trim())}</code></pre>
            </div>
        `;
    });
    
    // Pokud je to AI zpráva s code bloky, automaticky je přidej do canvas
    if (role === 'ai' && codeBlocks.length > 0) {
        codeBlocks.forEach((block, index) => {
            if (canvasContent === '') {
                canvasContent = `// ${block.lang.toUpperCase()}\n${block.code}`;
            } else {
                canvasContent += `\n\n// ───────────────────────────────────\n// ${block.lang.toUpperCase()}\n// ───────────────────────────────────\n\n${block.code}`;
            }
        });
        updateCanvas();
        
        if (document.getElementById('canvas-container').style.display === 'none' || 
            document.getElementById('canvas-container').style.display === '') {
            toggleCanvas();
        }
    }
    
    formattedText = formattedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    msgDiv.innerHTML = formattedText;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function copyCodeBlock(blockId, button) {
    const codeElement = document.getElementById(blockId);
    const code = codeElement.textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        button.textContent = '✓ ZKOPÍROVÁNO';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = 'KOPÍROVAT';
            button.classList.remove('copied');
        }, 2000);
    });
}

function addToCanvas(blockId, button) {
    const codeElement = document.getElementById(blockId);
    const code = codeElement.innerText;
    
    if (canvasContent === '') {
        canvasContent = code;
    } else {
        canvasContent += `\n\n// ───────────────────────────────────\n\n${code}`;
    }
    
    updateCanvas();
    
    if (document.getElementById('canvas-container').style.display === 'none' || 
        document.getElementById('canvas-container').style.display === '') {
        toggleCanvas();
    }
    
    button.textContent = '✓ PŘIDÁNO';
    button.style.background = '#00ff00';
    button.style.color = 'black';
    setTimeout(() => {
        button.textContent = '➕ CANVAS';
        button.style.background = '';
        button.style.color = '';
    }, 2000);
}

function toggleCanvas() {
    const canvas = document.getElementById('canvas-container');
    const chatWindow = document.getElementById('chat-window');
    
    if (canvas.style.display === 'none' || canvas.style.display === '') {
        canvas.style.display = 'flex';
        chatWindow.style.width = '50%';
    } else {
        canvas.style.display = 'none';
        chatWindow.style.width = '100%';
    }
}

function switchCanvasTab(tab) {
    const tabs = document.querySelectorAll('.canvas-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    const editor = document.getElementById('canvas-editor');
    const preview = document.getElementById('canvas-preview');
    
    if (tab === 'code') {
        editor.style.display = 'block';
        preview.style.display = 'none';
        canvasMode = 'code';
    } else {
        editor.style.display = 'none';
        preview.style.display = 'block';
        canvasMode = 'preview';
        updatePreview();
    }
}

function updateCanvas() {
    const editor = document.getElementById('canvas-editor');
    editor.innerText = canvasContent;
}

function toggleEditMode() {
    const editor = document.getElementById('canvas-editor');
    const btn = document.getElementById('edit-toggle');
    
    isEditMode = !isEditMode;
    
    if (isEditMode) {
        editor.setAttribute('contenteditable', 'true');
        editor.focus();
        btn.textContent = '💾 ULOŽIT';
        btn.style.background = '#00ff00';
        btn.style.color = 'black';
        addMessage("system", "✏️ Canvas editor je v režimu úprav. Klikni 💾 ULOŽIT pro uložení změn.");
    } else {
        canvasContent = editor.innerText;
        editor.setAttribute('contenteditable', 'false');
        btn.textContent = '✏️ UPRAVIT';
        btn.style.background = '';
        btn.style.color = '';
        addMessage("system", "✅ Změny v canvas uloženy.");
    }
}

function sendCanvasToGemini() {
    if (!canvasContent) {
        alert('Canvas je prázdný! Není co poslat.');
        return;
    }
    
    const input = document.getElementById('user-input');
    input.value = `Analyzuj a vylepši tento kód:\n\n${canvasContent}`;
    
    sendMessage();
}

function updatePreview() {
    const preview = document.getElementById('canvas-preview');
    const blob = new Blob([canvasContent], { type: 'text/html' });
    preview.src = URL.createObjectURL(blob);
}

function clearCanvas() {
    if (confirm('Opravdu chceš vyčistit canvas?')) {
        canvasContent = '';
        updateCanvas();
        document.getElementById('canvas-preview').src = '';
    }
}

function copyCanvas() {
    if (!canvasContent) {
        alert('Canvas je prázdný!');
        return;
    }
    
    navigator.clipboard.writeText(canvasContent).then(() => {
        const btn = event.target;
        const original = btn.textContent;
        btn.textContent = '✓ ZKOPÍROVÁNO';
        btn.style.background = '#00ff00';
        btn.style.color = 'black';
        setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
            btn.style.color = '';
        }, 2000);
    });
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    const preview = document.getElementById('file-preview');
    
    files.forEach(file => {
        if (file.size > 100 * 1024 * 1024) {
            addMessage("system", `⚠️ Soubor ${file.name} je příliš velký (max 100 MB)`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const isTextFile = file.type.includes('text') || 
                             file.name.match(/\.(html|css|js|json|txt|md|xml|csv|php|py|java|cpp|c|h|hpp|ts|tsx|jsx|yaml|yml|sql|sh|bat)$/i);
            
            let fileData;
            
            if (isTextFile) {
                fileData = e.target.result;
                
                if (canvasContent === '') {
                    canvasContent = `// ${file.name}\n${fileData}`;
                } else {
                    canvasContent += `\n\n// ───────────────────────────────────\n// ${file.name}\n// ───────────────────────────────────\n\n${fileData}`;
                }
                updateCanvas();
                
                if (document.getElementById('canvas-container').style.display === 'none' || 
                    document.getElementById('canvas-container').style.display === '') {
                    toggleCanvas();
                }
                
                addMessage("system", `✅ ${file.name} načten do canvas editoru`);
            } else {
                fileData = e.target.result.split(',')[1];
            }
            
            const mimeType = file.type || 'application/octet-stream';
            
            attachedFiles.push({
                name: file.name,
                mimeType: mimeType,
                data: isTextFile ? fileData : fileData,
                isText: isTextFile
            });

            const previewItem = document.createElement('div');
            previewItem.style.cssText = 'display:flex; align-items:center; gap:5px; padding:5px 10px; background:#333; border-radius:5px;';
            previewItem.innerHTML = `
                <span style="color:#00d4ff;">📎 ${file.name}</span>
                <button onclick="removeFile('${file.name}')" style="padding:2px 8px; font-size:0.8em;">✕</button>
            `;
            preview.appendChild(previewItem);
            preview.style.display = 'flex';
        };
        
        if (file.type.includes('text') || 
            file.name.match(/\.(html|css|js|json|txt|md|xml|csv|php|py|java|cpp|c|h|hpp|ts|tsx|jsx|yaml|yml|sql|sh|bat)$/i)) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    });

    event.target.value = '';
}

function removeFile(fileName) {
    attachedFiles = attachedFiles.filter(f => f.name !== fileName);
    const preview = document.getElementById('file-preview');
    preview.innerHTML = '';
    
    if (attachedFiles.length > 0) {
        attachedFiles.forEach(file => {
            const previewItem = document.createElement('div');
            previewItem.style.cssText = 'display:flex; align-items:center; gap:5px; padding:5px 10px; background:#333; border-radius:5px;';
            previewItem.innerHTML = `
                <span style="color:#00d4ff;">📎 ${file.name}</span>
                <button onclick="removeFile('${file.name}')" style="padding:2px 8px; font-size:0.8em;">✕</button>
            `;
            preview.appendChild(previewItem);
        });
    } else {
        preview.style.display = 'none';
    }
}

async function testModel(modelName, userMessage) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65536,
        }
    };

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.candidates[0].content.parts[0].text;
}

async function findWorkingModel(userMessage) {
    for (let model of MODELS_TO_TRY) {
        try {
            addMessage("system", `🔍 Testování modelu: ${model}...`);
            const response = await testModel(model, userMessage);
            
            workingModel = model;
            localStorage.setItem("working_model", model);
            showModelStatus(model);
            addMessage("success", `✅ Model ${model} úspěšně aktivován!`);
            return response;
            
        } catch (error) {
            addMessage("system", `⛔ ${model} nefunguje: ${error.message}`);
            continue;
        }
    }
    
    throw new Error("Žádný dostupný model nenalezen. Zkontroluj API klíč.");
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    
    if (!text && attachedFiles.length === 0) return;
    
    if (!apiKey && API_KEYS.length === 0) {
        alert("Admirále, chybí API klíč! Přidej ho v 🔐 SPRÁVA KLÍČŮ");
        return;
    }

    if (text) addMessage("user", text);
    if (attachedFiles.length > 0) {
        addMessage("user", `📎 Připojeno: ${attachedFiles.map(f => f.name).join(', ')}`);
    }
    
    input.value = "";
    
    const parts = [];
    
    attachedFiles.forEach(file => {
        parts.push({
            inline_data: {
                mime_type: file.mimeType,
                data: file.data
            }
        });
    });
    
    if (text) {
        parts.push({ text: text });
    }
    
    chatHistory.push({ role: "user", parts: parts });
    
    attachedFiles = [];
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('file-preview').innerHTML = '';
    
    document.getElementById('typing-indicator').style.display = 'block';

    try {
        let aiText;

        if (!workingModel) {
            aiText = await findWorkingModel(text || "Analyzuj tento soubor");
        } else {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${workingModel}:generateContent?key=${apiKey}`;

            const requestBody = {
                contents: chatHistory,
                systemInstruction: {
                    parts: [{ text: SYSTEM_INSTRUCTION }]
                },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 65536,
                }
            };

            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.error) {
                workingModel = null;
                localStorage.removeItem("working_model");
                throw new Error("Model přestal fungovat, hledám náhradu...");
            }

            aiText = data.candidates[0].content.parts[0].text;
        }
        
        addMessage("ai", aiText);
        chatHistory.push({ role: "model", parts: [{ text: aiText }] });
          
        // Po úspěšné odpovědi od Gemini (uvnitř try bloku):
async function updateKeyUsageInCloud() {
    const user = window.currentUser;
    if (!user || API_KEYS.length === 0) return;
    
    try {
        // Načti aktuální data z Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return;
        
        const userData = userSnap.data();
        const apiKeys = userData.apiKeys || [];
        
        // Najdi aktuálně použitý klíč
        const currentKey = apiKeys.find((k, index) => index === currentKeyIndex);
        
        if (currentKey) {
            // Zvýš usage count
            currentKey.usageCount = (currentKey.usageCount || 0) + 1;
            currentKey.lastUsed = Date.now();
            
            // Aktualizuj status podle usage
            if (currentKey.usageCount >= currentKey.dailyLimit) {
                currentKey.status = 'depleted';
            } else if (currentKey.usageCount >= (currentKey.dailyLimit * 0.8)) {
                currentKey.status = 'warning';
            } else {
                currentKey.status = 'active';
            }
            
            // Ulož zpět do Firestore
            await setDoc(userRef, {
                apiKeys: apiKeys,
                lastKeysUpdate: serverTimestamp()
            }, { merge: true });
            
            console.log(`📊 Usage updated: ${currentKey.usageCount}/${currentKey.dailyLimit}`);
            
            // Pokud je vyčerpán, notifikuj
            if (currentKey.status === 'depleted') {
                addMessage("system", `🔴 VAROVÁNÍ: Klíč "${currentKey.name}" vyčerpal denní limit!`);
            } else if (currentKey.status === 'warning') {
                addMessage("system", `🟡 POZOR: Klíč "${currentKey.name}" blízko limitu (${currentKey.usageCount}/${currentKey.dailyLimit})`);
            }
        }
        
    } catch (error) {
        console.error("❌ Chyba při updatu usage:", error);
    }
}
        
    } catch (error) {
        if (error.message.includes("quota") || error.message.includes("429") || error.message.includes("Překročili jste")) {
            if (rotateApiKey(error.message)) {
                try {
                    const retryText = await findWorkingModel(text || "Analyzuj tento soubor");
                    addMessage("ai", retryText);
                    chatHistory.push({ role: "model", parts: [{ text: retryText }] });
                } catch (retryError) {
                    addMessage("system", `⛔ Ani po rotaci klíče to nefunguje: ${retryError.message}`);
                }
            }
        } else {
            addMessage("system", `⚠️ CHYBA SPOJENÍ: ${error.message}`);
        }
        console.error("Detaily chyby:", error);
        
        if (workingModel && error.message.includes("fungovat")) {
            try {
                const aiText = await findWorkingModel(text || "Analyzuj tento soubor");
                addMessage("ai", aiText);
                chatHistory.push({ role: "model", parts: [{ text: aiText }] });
            } catch (retryError) {
                addMessage("system", `⛔ Nepodařilo se najít fungující model: ${retryError.message}`);
            }
        }
    } finally {
        document.getElementById('typing-indicator').style.display = 'none';
    }

}
