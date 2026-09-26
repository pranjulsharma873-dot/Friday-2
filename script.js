const $ = (id) => document.getElementById(id);

// >>> Apna deployed Flask backend ka URL yahan daalo (GitHub Pages khud Python nahi chala sakta) <<<
const API_BASE = "https://YOUR-BACKEND-URL.example.com";
const SESSION_ID = "session-" + Math.random().toString(36).slice(2);

const chatMessages = $("chatMessages");
const chatInput = $("chatInput");
const overlay = $("overlay");
const sideMenu = $("sideMenu");
const modal = $("modal");
const plusMenu = $("plusMenu");

/* ---------- SIDE MENU (☰) ---------- */
function openMenu() { sideMenu.classList.add("open"); overlay.classList.add("open"); }
function closeMenu() { sideMenu.classList.remove("open"); overlay.classList.remove("open"); }
$("menuButton").onclick = openMenu;
$("closeMenuButton").onclick = closeMenu;
overlay.onclick = () => { closeMenu(); modal.classList.remove("open"); };

function showModal(title, text) {
    $("modalTitle").textContent = title;
    $("modalText").textContent = text;
    modal.classList.add("open");
    overlay.classList.add("open");
}
$("modalClose").onclick = () => { modal.classList.remove("open"); overlay.classList.remove("open"); };

$("profileMenu").onclick = () => { closeMenu(); showModal("Profile", "Profile coming soon."); };
$("historyMenu").onclick = () => { closeMenu(); showModal("Chat History", "History coming soon."); };
$("settingsMenu").onclick = () => { closeMenu(); showModal("Settings", "Settings coming soon."); };
$("newChatButton").onclick = () => { chatMessages.innerHTML = ""; closeMenu(); };

/* ---------- PLUGINS (fetched from backend) ---------- */
$("pluginsMenu").onclick = async () => {
    closeMenu();
    showModal("Plugins", "Loading...");
    try {
        const res = await fetch(API_BASE + "/plugins");
        const data = await res.json();
        const list = (data.plugins || [])
            .map((p) => "• " + p.name + " — " + p.description)
            .join("\n");
        showModal("Plugins", list || "Koi plugin available nahi hai.");
    } catch (e) {
        showModal("Plugins", "Backend se connect nahi ho paya.\nAPI_BASE URL check karo.");
    }
};

/* ---------- CHAT ---------- */
function addMessage(text, who, imgSrc) {
    const div = document.createElement("div");
    div.className = "msg " + who;
    if (imgSrc) {
        const img = document.createElement("img");
        img.src = imgSrc;
        div.appendChild(img);
    }
    if (text) {
        const p = document.createElement("div");
        p.textContent = text;
        div.appendChild(p);
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function getReply(text) {
    try {
        const res = await fetch(API_BASE + "/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, session_id: SESSION_ID }),
        });
        const data = await res.json();
        return data.reply || data.error || "Kuch gadbad ho gayi.";
    } catch (e) {
        return "Backend se connect nahi ho paya. API_BASE URL check karo.";
    }
}

async function sendText(text) {
    addMessage(text, "user");
    const reply = await getReply(text);
    addMessage(reply, "ai");
    return reply;
}

async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    await sendText(text);
}
$("sendButton").onclick = handleSend;
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });

/* ---------- PLUS MENU (Camera / Photo / File / Video mode) ---------- */
$("plusButton").onclick = (e) => { e.stopPropagation(); plusMenu.classList.toggle("open"); };
document.addEventListener("click", (e) => {
    if (!plusMenu.contains(e.target)) plusMenu.classList.remove("open");
});

$("optCamera").onclick = () => { plusMenu.classList.remove("open"); $("cameraInput").click(); };
$("optPhoto").onclick = () => { plusMenu.classList.remove("open"); $("photoInput").click(); };
$("optFile").onclick = () => { plusMenu.classList.remove("open"); $("fileInput").click(); };
$("optVideoMode").onclick = () => { plusMenu.classList.remove("open"); openVideoMode(); };

async function analyzeImage(file, question) {
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    try {
        const res = await fetch(API_BASE + "/vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: question, image: base64, session_id: SESSION_ID }),
        });
        const data = await res.json();
        return data.reply || data.error || "Kuch gadbad ho gayi.";
    } catch (e) {
        return "Backend se connect nahi ho paya.";
    }
}

function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    addMessage("", "user", URL.createObjectURL(file));
    analyzeImage(file, "Is image mein kya hai?").then((reply) => addMessage(reply, "ai"));
    e.target.value = "";
}
$("cameraInput").onchange = handleImage;
$("photoInput").onchange = handleImage;
$("fileInput").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    addMessage("📎 " + file.name, "user");
    addMessage("File mil gayi.", "ai");
    e.target.value = "";
};

/* ---------- Shared speech helpers ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function speak(text) {
    return new Promise((resolve) => {
        if (!("speechSynthesis" in window)) return resolve();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
    });
}

/* ---------- VOICE MODE (audio only) ---------- */
const voiceMode = $("voiceMode");
const orb = $("voiceOrb");
const statusEl = $("voiceModeStatus");
const muteBtn = $("voiceModeMute");

let recognition = null;
let voiceOpen = false;
let muted = false;
let speaking = false;

function setStatus(text, cls) {
    statusEl.textContent = text;
    orb.classList.remove("listening", "speaking");
    if (cls) orb.classList.add(cls);
}

function startListening() {
    if (!voiceOpen || muted || speaking || !recognition) return;
    try { recognition.start(); } catch (e) { /* already started */ }
}

function setupRecognition() {
    if (!SR) return null;
    const r = new SR();
    r.lang = "hi-IN"; // English ke liye "en-US" kar do
    r.interimResults = false;
    r.continuous = false;

    r.onstart = () => setStatus("Listening...", "listening");
    r.onresult = async (e) => {
        const text = e.results[0][0].transcript;
        setStatus("Thinking...");
        const reply = await sendText(text);
        speaking = true;
        setStatus("Speaking...", "speaking");
        await speak(reply);
        speaking = false;
        setStatus("Listening...", "listening");
    };
    r.onerror = (e) => {
        if (e.error === "not-allowed") setStatus("Mic permission allow karo");
    };
    r.onend = () => { setTimeout(startListening, 300); };
    return r;
}

function openVoiceMode() {
    if (!SR) {
        showModal("Voice Mode", "Is browser me voice recognition support nahi hai. Chrome use karo.");
        return;
    }
    voiceOpen = true;
    muted = false;
    muteBtn.classList.remove("muted");
    voiceMode.classList.add("open");
    recognition = recognition || setupRecognition();
    setStatus("Listening...", "listening");
    startListening();
}

function closeVoiceMode() {
    voiceOpen = false;
    voiceMode.classList.remove("open");
    speechSynthesis.cancel();
    speaking = false;
    if (recognition) { try { recognition.abort(); } catch (e) {} }
}

$("voiceModeButton").onclick = openVoiceMode;
$("voiceModeClose").onclick = closeVoiceMode;
$("voiceModeMinimize").onclick = closeVoiceMode;
muteBtn.onclick = () => {
    muted = !muted;
    muteBtn.classList.toggle("muted", muted);
    if (muted) {
        if (recognition) { try { recognition.abort(); } catch (e) {} }
        setStatus("Muted");
    } else {
        setStatus("Listening...", "listening");
        startListening();
    }
};

/* ---------- VIDEO MODE (camera + live AI, jaise video call) ---------- */
const videoMode = $("videoMode");
const videoPreview = $("videoPreview");
const videoStatusEl = $("videoModeStatus");
const videoMuteBtn = $("videoModeMute");
const videoFlipBtn = $("videoModeFlip");

let videoStream = null;
let videoRecognition = null;
let videoOpen = false;
let videoMuted = false;
let videoSpeaking = false;
let facingMode = "user";

function setVideoStatus(text) { videoStatusEl.textContent = text; }

function captureFrame() {
    if (!videoPreview.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoPreview.videoWidth;
    canvas.height = videoPreview.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoPreview, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
}

async function startCamera() {
    if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
    videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
    });
    videoPreview.srcObject = videoStream;
}

async function sendFrameWithText(text) {
    addMessage(text, "user");
    const image = captureFrame();
    if (!image) {
        const reply = "Camera abhi ready nahi hai, dobara try karo.";
        addMessage(reply, "ai");
        return reply;
    }
    try {
        const res = await fetch(API_BASE + "/vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, image, session_id: SESSION_ID }),
        });
        const data = await res.json();
        const reply = data.reply || data.error || "Kuch gadbad ho gayi.";
        addMessage(reply, "ai");
        return reply;
    } catch (e) {
        const reply = "Backend se connect nahi ho paya.";
        addMessage(reply, "ai");
        return reply;
    }
}

function setupVideoRecognition() {
    if (!SR) return null;
    const r = new SR();
    r.lang = "hi-IN";
    r.interimResults = false;
    r.continuous = false;

    r.onstart = () => setVideoStatus("Dekh aur sun raha hoon...");
    r.onresult = async (e) => {
        const text = e.results[0][0].transcript;
        setVideoStatus("Soch raha hoon...");
        const reply = await sendFrameWithText(text);
        videoSpeaking = true;
        setVideoStatus("Bol raha hoon...");
        await speak(reply);
        videoSpeaking = false;
        setVideoStatus("Dekh aur sun raha hoon...");
    };
    r.onerror = (e) => {
        if (e.error === "not-allowed") setVideoStatus("Mic permission allow karo");
    };
    r.onend = () => { setTimeout(startVideoListening, 300); };
    return r;
}

function startVideoListening() {
    if (!videoOpen || videoMuted || videoSpeaking || !videoRecognition) return;
    try { videoRecognition.start(); } catch (e) { /* already started */ }
}

async function openVideoMode() {
    if (!SR) {
        showModal("Video Mode", "Is browser me voice recognition support nahi hai. Chrome use karo.");
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showModal("Video Mode", "Is browser/device me camera access support nahi hai.");
        return;
    }
    videoOpen = true;
    videoMuted = false;
    videoMuteBtn.classList.remove("muted");
    videoMode.classList.add("open");
    setVideoStatus("Camera khul rahi hai...");
    try {
        await startCamera();
    } catch (e) {
        setVideoStatus("Camera permission allow karo");
        return;
    }
    videoRecognition = videoRecognition || setupVideoRecognition();
    setVideoStatus("Dekh aur sun raha hoon...");
    startVideoListening();
}

function closeVideoMode() {
    videoOpen = false;
    videoMode.classList.remove("open");
    speechSynthesis.cancel();
    videoSpeaking = false;
    if (videoRecognition) { try { videoRecognition.abort(); } catch (e) {} }
    if (videoStream) { videoStream.getTracks().forEach((t) => t.stop()); videoStream = null; }
}

$("videoModeClose").onclick = closeVideoMode;
$("videoModeMinimize").onclick = closeVideoMode;
videoFlipBtn.onclick = async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    try { await startCamera(); } catch (e) {}
};
videoMuteBtn.onclick = () => {
    videoMuted = !videoMuted;
    videoMuteBtn.classList.toggle("muted", videoMuted);
    if (videoMuted) {
        if (videoRecognition) { try { videoRecognition.abort(); } catch (e) {} }
        setVideoStatus("Muted");
    } else {
        setVideoStatus("Dekh aur sun raha hoon...");
        startVideoListening();
    }
};
