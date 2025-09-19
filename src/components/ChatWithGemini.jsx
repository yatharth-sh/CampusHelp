import { useState, useRef, useEffect, useMemo } from "react";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// --- Student Helpdesk Persona ---
const SYSTEM_INSTRUCTION = `
You are CampusHelp, a polite, concise student-helpdesk agent.
- Answer questions about academics, deadlines, campus services, housing, fees, and student life.
- If unsure, say so and suggest the correct office or typical documentation students should check.
- Follow safety and inclusivity standards; avoid offensive or unsafe content.
- Prefer step-by-step guidance and actionable next steps.
`;

// --- Model & Safety ---
const MODEL_NAME = "gemini-2.5-flash";
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
];

// Enable Google Search grounding (SDK camelCase)
const GROUNDING_TOOL = { googleSearch: {} };

// --- Contact + Intent Routing Config ---
const CONTACT_CFG = {
  email: import.meta.env.VITE_HELPDESK_EMAIL || "",
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || "",
  webhook: import.meta.env.VITE_HELPDESK_WEBHOOK_URL || "",
};

const INTENT_DEFS = {
  fees: {
    label: "Fees",
    system:
      "Specialize in tuition/fee schedules, payment deadlines, penalties, late fees, and bursar processes. Prefer official bursar/registrar sources. Provide next steps and which office to contact if policy varies.",
    hints: ["tuition", "fee", "bursar", "invoice", "payment", "late fee", "penalty", "refund"],
  },
  scholarships: {
    label: "Scholarships",
    system:
      "Specialize in scholarships, grants, eligibility, deadlines, required documents, and how to apply or renew. Prefer financial aid office sources. Provide step-by-step next actions.",
    hints: ["scholarship", "grant", "aid", "merit", "need-based", "funding", "renewal"],
  },
  timetable: {
    label: "Timetable",
    system:
      "Specialize in academic calendars, class schedules, exam timetables, and add/drop windows. Prefer registrar and department announcements. Provide dates and procedural steps clearly.",
    hints: ["timetable", "schedule", "calendar", "exam", "slot", "add/drop", "registration"],
  },
  housing: {
    label: "Housing",
    system:
      "Specialize in campus housing, applications, waitlists, room assignments, move-in/out, and maintenance requests. Prefer residence life sources. Provide clear steps and contacts.",
    hints: ["housing", "hostel", "residence", "dorm", "move-in", "lease", "maintenance"],
  },
  unknown: {
    label: "Auto",
    system: "No specialization; respond generally as CampusHelp and ask clarifying follow-ups if needed.",
    hints: [],
  },
};

function detectIntent(text) {
  const q = (text || "").toLowerCase();
  let best = { name: "unknown", confidence: 0 };
  for (const [name, def] of Object.entries(INTENT_DEFS)) {
    if (name === "unknown") continue;
    const score = def.hints.reduce((acc, k) => acc + (q.includes(k) ? 1 : 0), 0);
    if (score > best.confidence) best = { name, confidence: score };
  }
  return best.confidence > 0 ? best : best;
}
function getSystemForIntent(intentName) {
  const base = SYSTEM_INSTRUCTION;
  const extra = INTENT_DEFS[intentName]?.system || INTENT_DEFS.unknown.system;
  return `${base}\n\n[Intent Routing]\n${extra}`;
}
function augmentUserPrompt(intentName, userText) {
  const def = INTENT_DEFS[intentName] || INTENT_DEFS.unknown;
  if (!def.hints?.length) return userText;
  const hintLine = `\n\n(Assistant note: Focus on ${def.label.toLowerCase()} context; prefer official university sources; keep steps actionable.)`;
  return `${userText}${hintLine}`;
}

// --- Styling (includes centered header brand + safer transcript gutters) ---
const styles = `
:root {
  --bg: #f7f7fb;
  --surface: #ffffff;
  --surface-2: #fafafc;
  --surface-container: #f3f4f6;
  --outline: #e5e7eb;
  --text: #0b1220;
  --text-muted: #64748b;
  --primary: #4f46e5;
  --on-primary: #ffffff;
  --danger: #ef4444;
  --ring: #93c5fd;
  --shadow-soft: 0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(31,41,55,0.08);

  --radius-lg: 16px;
  --radius-md: 12px;

  --space-1: clamp(4px, 0.6vw, 8px);
  --space-2: clamp(8px, 0.9vw, 12px);
  --space-3: clamp(12px, 1.2vw, 16px);
  --space-4: clamp(16px, 1.6vw, 20px);

  --fs-12: clamp(11px, 1.1vw, 12px);
  --fs-13: clamp(12px, 1.2vw, 13px);
  --fs-14: clamp(13px, 1.4vw, 14px);
  --fs-16: clamp(14px, 1.6vw, 16px);
  --fs-18: clamp(16px, 2.0vw, 18px);
  --fs-20: clamp(18px, 2.2vw, 20px);

  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b1220;
    --surface: #0f172a;
    --surface-2: #0d1222;
    --surface-container: #111827;
    --outline: #1f2937;
    --text: #e5e7eb;
    --text-muted: #94a3b8;
    --primary: #8b95ff;
    --on-primary: #0b1020;
    --ring: #60a5fa;
  }
}

* { box-sizing: border-box; }
html { color-scheme: light dark; }
body {
  margin: 0;
  font-family: Inter, Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif;
  background:
    radial-gradient(1000px 500px at 10% -10%, rgba(79,70,229,0.08), transparent 60%),
    radial-gradient(900px 450px at 100% 0%, rgba(99,102,241,0.06), transparent 60%),
    var(--bg);
  color: var(--text);
}

.app {
  width: min(1100px, 92vw);
  margin-inline: auto;
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;
  gap: var(--space-2);
  padding: var(--space-3);
  padding-top: calc(var(--space-3) + var(--safe-top));
}

/* Header (brand truly centered with absolute placement) */
.header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  position: relative;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}
.brand h1 {
  font-size: var(--fs-18);
  font-weight: 700;
  margin: 0;
}
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: end;
}
.badge {
  font-size: var(--fs-12);
  color: var(--on-primary);
  background: var(--primary);
  padding: 2px 10px;
  border-radius: 999px;
}
.routeBadge {
  font-size: var(--fs-12);
  color: var(--on-primary);
  background: var(--primary);
  padding: 2px 8px;
  border-radius: 999px;
}
@media (max-width: 640px) {
  .header { grid-template-columns: 1fr; row-gap: var(--space-1); }
  .header-right { justify-content: center; }
  .brand { position: static; transform: none; }
}

/* Transcript (larger container padding + per-message gutters) */
.transcript {
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  padding: clamp(20px, 3vw, 32px);
  overflow-y: auto;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  scroll-padding-bottom: 120px;
  overscroll-behavior: contain;
}
.message {
  margin: var(--space-2) 0 var(--space-3) 0;
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: var(--space-2);
  padding-inline: clamp(8px, 2vw, 28px);
  align-items: start;
}
.role { font-weight: 600; color: var(--text-muted); font-size: var(--fs-14); }
.bubble {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--outline);
  background: var(--surface-container);
  overflow-x: auto;
  font-size: var(--fs-14);
  line-height: 1.55;
}
.user .bubble {
  background: color-mix(in srgb, var(--primary) 6%, var(--surface-container));
  border-color: color-mix(in srgb, var(--primary) 20%, var(--outline));
}
.error .bubble {
  background: color-mix(in srgb, var(--danger) 8%, var(--surface-container));
  border-color: color-mix(in srgb, var(--danger) 35%, var(--outline));
}
@media (max-width: 720px) {
  .message { grid-template-columns: 1fr; gap: var(--space-1); }
  .role { display: none; }
}

/* Markdown */
.markdown-container pre {
  background-color: var(--surface-2);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  overflow-x: auto;
  border: 1px solid var(--outline);
}
.markdown-container code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: var(--fs-13);
}

/* Footer Composer (minimal pill with icons) */
.footer {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}
.composer {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--outline);
  border-radius: 999px;
  padding: 6px 8px;
  box-shadow: var(--shadow-soft);
}
.textinput {
  width: 100%;
  max-height: 30vh;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--text);
  font-size: var(--fs-14);
  line-height: 1.45;
  padding: 6px 8px;
}
.textinput::placeholder { color: var(--text-muted); }
.iconbtn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  border: 1px solid transparent;
  cursor: pointer;
}
.iconbtn:hover { background: var(--surface-container); border-color: var(--outline); }
.iconbtn:disabled { opacity: 0.6; cursor: not-allowed; }
.sendbtn {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}
.sendbtn:hover { filter: brightness(0.98); }

/* Chips */
.filechips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--surface-container);
  border: 1px solid var(--outline);
  border-radius: 999px;
  font-size: var(--fs-12);
}
.chip button { all: unset; cursor: pointer; color: var(--text-muted); padding-left: 4px; }

/* Contact fallback */
.contact {
  border: 1px dashed var(--outline);
  border-radius: 12px;
  padding: var(--space-2);
  background: color-mix(in srgb, var(--surface) 92%, var(--primary));
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.contact .cta { display: flex; gap: var(--space-2); }
.small { font-size: var(--fs-12); color: var(--text-muted); }

/* Minimal inline contact menu */
button.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--outline);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: var(--fs-12);
}
.contact-mini { position: relative; }
.contactmenu {
  position: absolute;
  right: 0;
  top: 110%;
  background: var(--surface);
  border: 1px solid var(--outline);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  gap: 6px;
  box-shadow: var(--shadow-soft);
  z-index: 10;
}
.contactmenu button { padding: 6px 10px; font-size: var(--fs-12); }

/* Toasts */
.toastwrap {
  position: fixed;
  bottom: calc(16px + var(--safe-bottom));
  right: 16px;
  display: grid;
  gap: 8px;
  z-index: 60;
}
@media (max-width: 640px) {
  .toastwrap { right: 50%; transform: translateX(50%); }
}
.toast {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--outline);
  border-left: 4px solid var(--primary);
  padding: 10px 12px;
  border-radius: 12px;
  box-shadow: var(--shadow-soft);
  font-size: var(--fs-13);
}
.toast.error { border-left-color: var(--danger); }

/* Global drag-and-drop overlay */
.dropOverlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 60%, rgba(0,0,0,0%));
  backdrop-filter: blur(2px);
  z-index: 70;
}
.dropOverlay.show { display: flex; }
.dropCard {
  border: 2px dashed color-mix(in srgb, var(--primary) 60%, var(--outline));
  background: color-mix(in srgb, var(--surface) 75%, var(--primary));
  color: var(--text);
  padding: 24px 28px;
  border-radius: 16px;
  box-shadow: var(--shadow-soft);
  font-weight: 700;
  font-size: var(--fs-16);
}
`;

const initialWelcome = [
  {
    role: "assistant",
    text:
      "Hi! I’m CampusHelp. Attach PDFs or images with the clip icon, or just start asking questions.",
  },
];

function AIStudentHelpdesk() {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem("campushelp.chat.v1");
      return raw ? JSON.parse(raw) : initialWelcome;
    } catch {
      return initialWelcome;
    }
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [typing, setTyping] = useState(false);

  // Files
  const [uploads, setUploads] = useState([]); // [{name, uri, mimeType, size}]
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Global drag overlay
  const [dragOver, setDragOver] = useState(false);

  // Transcript + stream refs
  const transcriptRef = useRef(null);
  const streamingRef = useRef(false);

  // Intent routing
  const [activeIntent, setActiveIntent] = useState("auto");
  const [lastDetectedIntent, setLastDetectedIntent] = useState("unknown");
  const [intentConfidence, setIntentConfidence] = useState(0);

  // Contact + toast UI
  const [showContact, setShowContact] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Auto-resize textarea
  const inputRef = useRef(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(280, Math.max(40, el.scrollHeight));
    el.style.height = next + "px";
  }, [input]);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem("campushelp.chat.v1", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming, typing]);

  // SDK client
  const ai = useMemo(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    return new GoogleGenAI({ apiKey });
  }, []);

  const resetChat = () => {
    setMessages(initialWelcome);
    setInput("");
    setUploads([]);
    setShowContact(false);
    setShowContactMenu(false);
    setActiveIntent("auto");
    setIntentConfidence(0);
  };

  const pushToast = (msg, type = "success", ttl = 2200) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, msg, type }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  };

  // Global drag-and-drop listeners
  useEffect(() => {
    const hasFiles = (e) => {
      const t = e?.dataTransfer?.types;
      if (!t) return false;
      return (typeof t.includes === "function" && t.includes("Files")) || (typeof t.indexOf === "function" && t.indexOf("Files") !== -1);
    };
    const onDragOver = (e) => {
      if (hasFiles(e)) {
        e.preventDefault();
        setDragOver(true);
      }
    };
    const onDrop = async (e) => {
      if (hasFiles(e)) {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) {
          await uploadFiles(e.dataTransfer.files);
        }
      }
    };
    const onDragLeave = (e) => {
      const { clientX, clientY } = e;
      if (clientX <= 0 || clientY <= 0 || clientX >= window.innerWidth || clientY >= window.innerHeight) {
        setDragOver(false);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragleave", onDragLeave);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragleave", onDragLeave);
    };
  }, []);

  // Accepted file types
  const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];

  const toFileRef = (f) => ({
    uri: f?.uri || f?.file?.uri,
    mimeType: f?.mimeType || f?.file?.mimeType,
    name: f?.name || f?.file?.name,
  });

  const uploadFiles = async (files) => {
    const pick = Array.from(files).filter((f) => ACCEPT.includes(f.type));
    if (!pick.length) {
      pushToast("Unsupported file type.", "error");
      return;
    }
    setIsUploading(true);
    try {
      const newRefs = [];
      for (const f of pick) {
        const res = await ai.files.upload({ file: f, config: { mimeType: f.type || undefined } });
        const ref = toFileRef(res);
        if (ref?.uri && ref?.mimeType) newRefs.push({ ...ref, size: f.size });
      }
      if (newRefs.length) {
        setUploads((prev) => {
          const map = new Map(prev.map((x) => [x.uri, x]));
          newRefs.forEach((r) => map.set(r.uri, r));
          return Array.from(map.values());
        });
        pushToast("Files added.");
      }
    } catch {
      pushToast("Could not upload files.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const onChooseFiles = () => fileInputRef.current?.click();
  const onFileChange = async (e) => {
    if (e.target.files?.length) await uploadFiles(e.target.files);
    e.target.value = "";
  };
  const removeUpload = (uri) => setUploads((prev) => prev.filter((f) => f.uri !== uri));

  // Contact helpers (email copies to clipboard)
  const copyHelpdeskEmail = async () => {
    const email = CONTACT_CFG.email;
    if (!email) {
      pushToast("Helpdesk email is not configured.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
      pushToast("Helpdesk email copied to clipboard.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = email;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        ta.remove();
        pushToast("Helpdesk email copied to clipboard.");
      } catch {
        pushToast("Could not copy email to clipboard.", "error");
      }
    }
  };

  const openWhatsApp = (text) => {
    const num = CONTACT_CFG.whatsapp;
    if (!num) {
      pushToast("WhatsApp number is not configured.", "error");
      return;
    }
    const u = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
    window.open(u, "_blank", "noopener,noreferrer");
  };

  const postHelpdesk = async (payload) => {
    if (!CONTACT_CFG.webhook) {
      pushToast("Helpdesk ticket endpoint is not configured.", "error");
      return { ok: false };
    }
    try {
      const res = await fetch(CONTACT_CFG.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const ok = res.ok;
      pushToast(ok ? "Ticket submitted." : "Could not submit ticket.", ok ? "success" : "error");
      return { ok };
    } catch {
      pushToast("Could not submit ticket.", "error");
      return { ok: false };
    }
  };

  const buildTranscriptPreview = () => {
    const recent = messages.slice(-6).map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
    return recent.slice(0, 1800);
  };

  const toContents = (history) =>
    history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text || "" }] }));

  const extractText = (chunk) => {
    try {
      if (!chunk) return "";
      if (typeof chunk.text === "string" && chunk.text.length) return chunk.text;
      const cands = Array.isArray(chunk.candidates) ? chunk.candidates : [];
      if (cands.length) {
        const parts = cands?.content?.parts;
        if (Array.isArray(parts)) return parts.map((p) => p?.text || "").join("");
      }
      return "";
    } catch {
      return "";
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    setTyping(true);

    const nextMessages = [...messages, { role: "user", text: trimmed }, { role: "assistant", text: "" }];
    setMessages(nextMessages);
    setIsStreaming(true);
    streamingRef.current = true;

    try {
      const autoResult = detectIntent(trimmed);
      const selected = activeIntent !== "auto" ? activeIntent : autoResult.name;
      const confidence = activeIntent !== "auto" ? 2 : autoResult.confidence;
      setLastDetectedIntent(selected);
      setIntentConfidence(confidence);
      setShowContact(confidence === 0);

      const fileParts = uploads.map((f) => createPartFromUri(f.uri, f.mimeType));
      const systemInstruction = getSystemForIntent(selected);
      const userAugmented = augmentUserPrompt(selected, trimmed);

      const contents = [
        ...toContents(nextMessages.slice(0, -1)),
        createUserContent([...fileParts, "\n\n", userAugmented]),
      ];

      const response = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents,
        config: { systemInstruction, safetySettings: SAFETY_SETTINGS, tools: [GROUNDING_TOOL] },
      });

      let full = "";
      for await (const chunk of response) {
        if (!streamingRef.current) break;
        const piece = extractText(chunk);
        if (!piece) continue;
        full += piece;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", text: full };
          return copy;
        });
      }

      setTyping(false);
      setIsStreaming(false);
      streamingRef.current = false;

      if (!full) {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: "The model returned empty text for this request. Try rephrasing or asking a more specific question." },
        ]);
        setShowContact(true);
      }
    } catch {
      setTyping(false);
      setIsStreaming(false);
      streamingRef.current = false;
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "A connection or API error occurred. Please try again or rephrase the question." },
      ]);
      setShowContact(true);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <style>{styles}</style>

      {/* Global drag overlay */}
      <div
        className={`dropOverlay ${dragOver ? "show" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="dropCard">Drop files here</div>
      </div>

      <div className="app">
        <div className="header">
          <div className="brand">
            <svg
              width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 12%, var(--surface))", borderRadius: 12, padding: 6 }}
            >
              <path d="M12 20.5c-5.523 0-10-4.477-10-10s4.477-10 10-10 10 4.477 10 10-4.477 10-10 10z"></path>
              <path d="M12 2a5 5 0 0 0-5 5v1a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path>
              <path d="M12 12a5 5 0 0 0 5-5H7a5 5 0 0 0 5 5z"></path>
            </svg>
            <h1>CampusHelp</h1>
          </div>
          <div className="header-right">
            <button type="button" className="ghost" onClick={resetChat} title="Reset">
              Reset
            </button>
            <span className="badge">2.5 Flash + Search</span>
            <span className="routeBadge">
              {activeIntent !== "auto" ? INTENT_DEFS[activeIntent].label : INTENT_DEFS[lastDetectedIntent]?.label || "Auto"}
            </span>
            <div className="contact-mini">
              <button type="button" className="ghost" onClick={() => setShowContactMenu((v) => !v)} title="Contact staff">
                Contact
              </button>
              {showContactMenu && (
                <div className="contactmenu">
                  {!!CONTACT_CFG.email && (
                    <button type="button" className="ghost" onClick={() => { copyHelpdeskEmail(); setShowContactMenu(false); }}>
                      Email
                    </button>
                  )}
                  {!!CONTACT_CFG.whatsapp && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        const text = `Student query:\n${messages[messages.length - 1]?.text || ""}\n\nTranscript:\n${buildTranscriptPreview()}`;
                        openWhatsApp(text);
                        setShowContactMenu(false);
                      }}
                    >
                      WhatsApp
                    </button>
                  )}
                  {!!CONTACT_CFG.webhook && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        const payload = {
                          source: "CampusHelp",
                          lastMessage: messages[messages.length - 1]?.text || "",
                          transcript: buildTranscriptPreview(),
                          intent: { selected: activeIntent, detected: lastDetectedIntent, confidence: intentConfidence },
                          timestamp: new Date().toISOString(),
                        };
                        await postHelpdesk(payload);
                        setShowContactMenu(false);
                      }}
                    >
                      Create ticket
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={transcriptRef} className="transcript">
          {messages.map((m, idx) => (
            <div key={idx} className={`message ${m.role}`}>
              <div className="role">{m.role === "assistant" ? "Assistant" : m.role === "user" ? "User" : m.role === "error" ? "Error" : m.role}</div>
              <div className="bubble">
                {m.role === "assistant" ? (
                  <div className="markdown-container">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word" }}>{m.text}</pre>
                )}
              </div>
            </div>
          ))}
          {typing && <div className="typing">Assistant is typing…</div>}
        </div>

        <div className="footer">
          {/* Minimal pill composer */}
          <div className="composer">
            <textarea
              ref={inputRef}
              className="textinput"
              placeholder="Message CampusHelp"
              value={input}
              onChange={(e) => { setInput(e.target.value); setShowContact(false); }}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={isStreaming || isUploading}
            />
            {/* Attach icon */}
            <button
              type="button"
              className="iconbtn"
              onClick={onChooseFiles}
              disabled={isUploading || isStreaming}
              aria-label="Add files"
              title="Add files"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 1 1-2.83-2.83l8.49-8.49"/>
              </svg>
            </button>
            {/* Send icon */}
            {isStreaming ? (
              <button
                type="button"
                className="iconbtn sendbtn"
                onClick={() => { streamingRef.current = false; setIsStreaming(false); setTyping(false); }}
                aria-label="Stop"
                title="Stop"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="iconbtn sendbtn"
                onClick={sendMessage}
                disabled={!input.trim() || isUploading}
                aria-label="Send"
                title="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*"
            onChange={onFileChange}
            style={{ display: "none" }}
          />

          {!!uploads.length && (
            <div className="filechips">
              {uploads.map((f) => (
                <span key={f.uri} className="chip">
                  {f.name}
                  <button onClick={() => removeUpload(f.uri)} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Contact fallback (only on low-confidence/empty/error) */}
          {showContact && (
            <div className="contact">
              <div className="small">Need a human? Contact staff with your last message and a short transcript.</div>
              <div className="cta">
                {!!CONTACT_CFG.email && (
                  <button type="button" className="ghost" onClick={copyHelpdeskEmail}>
                    Email helpdesk
                  </button>
                )}
                {!!CONTACT_CFG.whatsapp && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const text = `Student query:\n${messages[messages.length - 1]?.text || ""}\n\nTranscript:\n${buildTranscriptPreview()}`;
                      openWhatsApp(text);
                    }}
                  >
                    WhatsApp
                  </button>
                )}
                {!!CONTACT_CFG.webhook && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={async () => {
                      const payload = {
                        source: "CampusHelp",
                        lastMessage: messages[messages.length - 1]?.text || "",
                        transcript: buildTranscriptPreview(),
                        intent: { selected: activeIntent, detected: lastDetectedIntent, confidence: intentConfidence },
                        timestamp: new Date().toISOString(),
                      };
                      await postHelpdesk(payload);
                    }}
                    disabled={isStreaming || isUploading}
                  >
                    Create ticket
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div className="toastwrap" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}

export default AIStudentHelpdesk;
