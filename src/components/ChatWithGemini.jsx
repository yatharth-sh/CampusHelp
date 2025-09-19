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

// --- Styling ---
const styles = `
:root {
  --bg: #f7f7fb;
  --surface: #ffffff;
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
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  --code-bg: #111827;
  --code-border: #374151;
  --code-fg: #e5e7eb;
}

html { color-scheme: light dark; }

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b1220;
    --surface: #0f172a;
    --surface-container: #111827;
    --outline: #1f2937;
    --text: #e5e7eb;
    --text-muted: #94a3b8;
    --primary: #8b95ff;
    --on-primary: #0b1020;
    --ring: #60a5fa;

    --code-bg: #0b1020;
    --code-border: #1f2937;
    --code-fg: #e5e7eb;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif;
  background:
    radial-gradient(1000px 500px at 10% -10%, rgba(79,70,229,0.08), transparent 60%),
    radial-gradient(900px 450px at 100% 0%, rgba(99,102,241,0.06), transparent 60%),
    var(--bg);
  color: var(--text);
}

.app {
  max-width: 920px;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;
  gap: var(--space-2);
  padding: var(--space-3);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}
.header h1 { font-size: 18px; font-weight: 700; margin: 0; }
.badge {
  font-size: 12px;
  color: var(--on-primary);
  background: var(--primary);
  padding: 2px 10px;
  border-radius: 999px;
}

.transcript {
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  overflow-y: auto;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.message {
  margin: var(--space-2) 0 var(--space-3) 0;
  display: flex;
  gap: var(--space-3);
}

.role {
  flex: 0 0 80px;
  font-weight: 600;
  color: var(--text-muted);
}

.bubble {
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--outline);
  background: var(--surface-container);
  overflow-x: auto;
}
.user .bubble {
  background: color-mix(in srgb, var(--primary) 6%, var(--surface-container));
  border-color: color-mix(in srgb, var(--primary) 20%, var(--outline));
}
.error .bubble {
  background: color-mix(in srgb, var(--danger) 8%, var(--surface-container));
  border-color: color-mix(in srgb, var(--danger) 35%, var(--outline));
}

.markdown-container pre {
  background-color: var(--code-bg);
  border-radius: 12px;
  padding: var(--space-3);
  overflow-x: auto;
  border: 1px solid var(--code-border);
}
.markdown-container code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  color: var(--code-fg);
}

.footer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
}

.inputBox {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

/* Removed persistent dropzone; we show an overlay instead */
.adderbar {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
.adderbar .left { display: flex; gap: 8px; align-items: center; }
.filechips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--surface-container);
  border: 1px solid var(--outline);
  border-radius: 999px;
  font-size: 12px;
}
.chip button { all: unset; cursor: pointer; color: var(--text-muted); padding-left: 4px; }

.textarea {
  flex: 1;
  min-height: 48px;
  max-height: 200px;
  resize: vertical;
  border: 1px solid var(--outline);
  border-radius: 12px;
  outline: none;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text);
  background: var(--surface-container);
}

.actions { display: flex; align-items: center; gap: var(--space-2); }

button {
  appearance: none;
  border: 1px solid var(--outline);
  background: var(--primary);
  color: var(--on-primary);
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  transition: transform 0.06s ease, box-shadow 0.2s ease, background 0.2s ease;
}
button:hover { transform: translateY(-1px); }
button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
button.secondary { background: var(--surface); color: var(--text); }
button.ghost { background: transparent; border-color: var(--outline); color: var(--text); }
button:disabled { opacity: 0.6; cursor: not-allowed; }

.hint { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-align: center; }
.typing { font-size: 12px; color: var(--text-muted); }

/* Minimal intent selector + always-on contact button */
.intentbar { display: flex; align-items: center; gap: 8px; }
.intentselect {
  appearance: none;
  background: var(--surface-container);
  border: 1px solid var(--outline);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text);
}
.small { font-size: 12px; color: var(--text-muted); }

.routeBadge {
  font-size: 12px;
  color: var(--on-primary);
  background: var(--primary);
  padding: 2px 8px;
  border-radius: 999px;
}

.contact {
  border: 1px dashed var(--outline);
  border-radius: 12px;
  padding: 10px;
  background: color-mix(in srgb, var(--surface) 92%, var(--primary));
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
.contact .cta { display: flex; gap: 8px; }

/* Minimal inline contact menu for the footer actions */
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
.contactmenu button { padding: 6px 10px; font-size: 12px; }

/* Toasts */
.toastwrap {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: grid;
  gap: 8px;
  z-index: 60;
}
.toast {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--outline);
  border-left: 4px solid var(--primary);
  padding: 10px 12px;
  border-radius: 12px;
  box-shadow: var(--shadow-soft);
  font-size: 13px;
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
  padding: 28px 36px;
  border-radius: 16px;
  box-shadow: var(--shadow-soft);
  font-weight: 700;
  font-size: 16px;
}
`;

// --- Component ---
const initialWelcome = [
  {
    role: "assistant",
    text:
      "Hi! I’m CampusHelp. Attach PDFs or images with the Add files button, or just start asking questions.",
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

  // Intent routing state
  const [activeIntent, setActiveIntent] = useState("auto");
  const [lastDetectedIntent, setLastDetectedIntent] = useState("unknown");
  const [intentConfidence, setIntentConfidence] = useState(0);

  // Contact + toast UI
  const [showContact, setShowContact] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [toasts, setToasts] = useState([]);

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

  // Global drag-and-drop listeners to show/hide overlay
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
      // When leaving window bounds
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

      const toContents = (history) =>
        history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text || "" }] }));

      const contents = [...toContents(nextMessages.slice(0, -1)), createUserContent([...fileParts, "\n\n", userAugmented])];

      const response = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents,
        config: { systemInstruction, safetySettings: SAFETY_SETTINGS, tools: [GROUNDING_TOOL] },
      });

      let full = "";
      for await (const chunk of response) {
        if (!streamingRef.current) break;
        const piece = (() => {
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
        })();
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
          {
            role: "error",
            text: "The model returned empty text for this request. Try rephrasing or asking a more specific question.",
          },
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 12%, var(--surface))", borderRadius: 12, padding: 6 }}
            >
              <path d="M12 20.5c-5.523 0-10-4.477-10-10s4.477-10 10-10 10 4.477 10 10-4.477 10-10 10z"></path>
              <path d="M12 2a5 5 0 0 0-5 5v1a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path>
              <path d="M12 12a5 5 0 0 0 5-5H7a5 5 0 0 0 5 5z"></path>
            </svg>
            <h1>CampusHelp</h1>
          </div>
          <div>
            <span className="badge">2.5 Flash + Search</span>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span className="routeBadge">
              {activeIntent !== "auto" ? INTENT_DEFS[activeIntent].label : INTENT_DEFS[lastDetectedIntent]?.label || "Auto"}
            </span>
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
          <div className="inputBox">
            {/* Minimal intent selector */}
            <div className="intentbar">
              <select
                className="intentselect"
                value={activeIntent}
                onChange={(e) => setActiveIntent(e.target.value)}
                disabled={isStreaming || isUploading}
                aria-label="Intent"
              >
                <option value="auto">Auto</option>
                <option value="fees">Fees</option>
                <option value="scholarships">Scholarships</option>
                <option value="timetable">Timetable</option>
                <option value="housing">Housing</option>
              </select>
              <span className="small">{activeIntent === "auto" ? (intentConfidence > 0 ? "Auto" : "Auto…") : "Manual"}</span>
            </div>

            {/* Add files + Reset + file chips */}
            <div className="adderbar">
              <div className="left">
                <button type="button" className="secondary" onClick={onChooseFiles} disabled={isUploading || isStreaming}>
                  {isUploading ? "Adding…" : "Add files"}
                </button>
                <button type="button" className="secondary" onClick={resetChat} disabled={isStreaming} title="Clear messages">
                  Reset
                </button>
              </div>
            </div>

            <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*" onChange={onFileChange} style={{ display: "none" }} />

            {!!uploads.length && (
              <div className="filechips">
                {uploads.map((f) => (
                  <span key={f.uri} className="chip">
                    {f.name}
                    <button onClick={() => removeUpload(f.uri)} aria-label="Remove">
                      ×
                    </button>
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
                    <button type="button" className="secondary" onClick={copyHelpdeskEmail}>
                      Email helpdesk
                    </button>
                  )}
                  {!!CONTACT_CFG.whatsapp && (
                    <button
                      type="button"
                      className="secondary"
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

            <textarea
              className="textarea"
              placeholder="Ask CampusHelp"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowContact(false);
              }}
              onKeyDown={onKeyDown}
              disabled={isStreaming || isUploading}
            />
          </div>

          <div className="actions">
            {isStreaming ? (
              <button
                type="button"
                onClick={() => {
                  streamingRef.current = false;
                  setIsStreaming(false);
                  setTyping(false);
                }}
              >
                Stop
              </button>
            ) : (
              <button type="button" onClick={sendMessage} disabled={!input.trim() || isUploading}>
                Send
              </button>
            )}

            {/* Minimal always-available Contact staff */}
            <div className="contact-mini">
              <button type="button" className="secondary ghost" onClick={() => setShowContactMenu((v) => !v)} title="Contact staff">
                Contact staff
              </button>
              {showContactMenu && (
                <div className="contactmenu">
                  {!!CONTACT_CFG.email && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        copyHelpdeskEmail();
                        setShowContactMenu(false);
                      }}
                    >
                      Email
                    </button>
                  )}
                  {!!CONTACT_CFG.whatsapp && (
                    <button
                      type="button"
                      className="secondary"
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

        <div className="hint">Uses Google Search grounding with Gemini 2.5 Flash for fresher, more reliable answers.</div>
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
