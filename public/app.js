const $ = (s) => document.querySelector(s);
const DB_NAME = "filehub-offline";
let db;
let allFiles = [];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
}
function saveOffline(file, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put({ id: file.id, name: file.name, type: file.type, blob, savedAt: Date.now() });
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
function getOffline(id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction("files").objectStore("files").get(id);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
function formatSize(n) { return n < 1024*1024 ? `${(n/1024).toFixed(0)} KB` : `${(n/1024/1024).toFixed(1)} MB`; }

async function cacheAll(files) {
  if (!navigator.onLine || !db) return;
  const status = $("#status");
  let saved = 0, skipped = 0;
  status.textContent = "Saving files for offline viewing…";
  for (const file of files) {
    try {
      if (await getOffline(file.id)) { saved++; continue; }
      const response = await fetch(file.url);
      if (!response.ok) throw new Error("Fetch failed");
      await saveOffline(file, await response.blob());
      saved++;
      status.textContent = `Saving offline files… ${saved}/${files.length}`;
    } catch (_) { skipped++; }
  }
  status.textContent = `Offline save complete: ${saved} available here${skipped ? `, ${skipped} could not be saved` : ""}.`;
}

function renderFiles() {
  const q = $("#search").value.toLowerCase();
  const visible = allFiles.filter(f => f.name.toLowerCase().includes(q));
  $("#count").textContent = `${allFiles.length} file(s) shared`;
  $("#fileList").innerHTML = "";
  if (!visible.length) { $("#fileList").textContent = "No files found."; return; }
  visible.forEach(f => {
    const card = document.createElement("article"); card.className = "file-card";
    const name = document.createElement("div"); name.className = "file-name"; name.textContent = f.name;
    const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = `${formatSize(f.size)} · ${new Date(f.uploadedAt).toLocaleDateString()}`;
    const actions = document.createElement("div"); actions.className = "actions";
    const view = document.createElement("button"); view.textContent = "View"; view.onclick = () => showFile(f);
    const state = document.createElement("button"); state.className = "secondary"; state.textContent = "Offline status"; state.onclick = async () => {
      const item = await getOffline(f.id);
      alert(item ? "Saved in this browser for offline viewing." : "Not saved offline yet. Connect to internet and refresh.");
    };
    actions.append(view, state); card.append(name, meta, actions); $("#fileList").append(card);
  });
}

async function showFile(file) {
  $("#viewer").classList.remove("hidden");
  $("#viewerTitle").textContent = file.name;
  $("#preview").replaceChildren();
  $("#previewNote").textContent = "";
  let blob;
  try {
    const offline = await getOffline(file.id);
    if (offline) blob = offline.blob;
    else if (navigator.onLine) {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error("Could not load file");
      blob = await response.blob();
      await saveOffline(file, blob);
    } else throw new Error("This file was not saved offline on this device.");
    const url = URL.createObjectURL(blob);
    const type = (file.type || blob.type || "").toLowerCase();
    let element;
    if (type === "application/pdf" || type.startsWith("text/")) {
      element = document.createElement("iframe"); element.src = url;
    } else if (type.startsWith("image/")) {
      element = document.createElement("img"); element.src = url; element.alt = file.name;
    } else if (type.startsWith("video/")) {
      element = document.createElement("video"); element.src = url; element.controls = true;
    } else if (type.startsWith("audio/")) {
      element = document.createElement("audio"); element.src = url; element.controls = true;
    } else {
      element = document.createElement("div");
      element.textContent = "Your browser cannot preview this file type. It is stored offline in this browser, but you may need a compatible app to open it.";
    }
    $("#preview").append(element);
    $("#previewNote").textContent = navigator.onLine ? "This file is now saved in this browser for offline viewing." : "Opened from this browser's offline storage.";
  } catch (err) {
    $("#preview").textContent = err.message;
  }
  $("#viewer").scrollIntoView({ behavior: "smooth" });
}

async function loadFiles() {
  try {
    const response = await fetch("/api/files");
    if (!response.ok) throw new Error();
    allFiles = await response.json();
    renderFiles();
    await cacheAll(allFiles);
  } catch (_) {
    $("#count").textContent = "Could not connect to the file server.";
    $("#fileList").textContent = "Connect to the internet once to load the public file list. Previously saved files remain in this browser's storage.";
  }
}

$("#uploadForm").addEventListener("submit", async e => {
  e.preventDefault();
  const file = $("#fileInput").files[0];
  if (!file) return;
  const data = new FormData(); data.append("file", file);
  $("#status").textContent = "Uploading…";
  try {
    const response = await fetch("/api/upload", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed");
    $("#status").textContent = "Upload successful. The public library is updated.";
    $("#fileInput").value = "";
    await loadFiles();
  } catch (err) { $("#status").textContent = err.message; }
});
$("#search").addEventListener("input", renderFiles);
$("#closeViewer").onclick = () => $("#viewer").classList.add("hidden");

(async function init() {
  try { await openDB(); } catch (_) { $("#status").textContent = "Offline storage is unavailable in this browser."; }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  await loadFiles();
  window.addEventListener("online", loadFiles);
})();
