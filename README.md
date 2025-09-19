Here is a clean, project-accurate README you can drop in as README.md.[1][2]

### Overview
CampusHelp is a lightweight student helpdesk chat app built on Gemini 2.5 Flash with Google Search grounding, responsive UI, intent routing, and human handoff options.[2]
It supports drag-and-drop or picker-based file uploads so students can ask questions about their own PDFs and images.[1][2]

### Features
- Minimal pill-style composer with auto-resizing textarea and icon buttons for attach and send.[2]
- Files: add via picker or drag-and-drop overlay; ask questions grounded in uploaded PDFs/images.[1][2]
- Intent routing: auto-detect or manually select Fees, Scholarships, Timetable, Housing to steer responses.[2]
- Human handoff: always-available “Contact staff” menu plus fallback card with Email copy-to-clipboard, WhatsApp open, and optional ticket webhook.[2]
- Google Search grounding enabled for fresher answers, with safety settings applied.[2]
- Polished, responsive layout with centered branding and comfortable transcript gutters.[2]

### Tech stack
- React with Vite for the frontend.[1]
- Google GenAI SDK using the gemini-2.5-flash model.[1][2]
- In-browser Files API from the SDK for media/PDF handling.[2]

### Quick start
- Prerequisites: Node.js 16+ and a Gemini API key.[1]
- Install dependencies: run npm install in the project root.[1]
- Create an .env file and add required variables shown below.[1][2]
- Start the dev server with your usual Vite script and open the printed local address.[1]

### Environment variables
Place the following in .env (or .env.local) at the project root.[2]
- VITE_GEMINI_API_KEY=your_api_key_here.[1]
- VITE_HELPDESK_EMAIL=helpdesk@university.edu (used for copy-to-clipboard Email in “Contact staff”).[2]
- VITE_WHATSAPP_NUMBER=15551234567 (international format without plus; opens a WhatsApp thread with context).[2]
- VITE_HELPDESK_WEBHOOK_URL=https://your.ticket.endpoint (optional; POSTs JSON with last message, transcript, and intent).[2]

### Scripts
- npm install to install dependencies.[1]
- npm run dev to start development mode.[1]
- npm run build to generate a production bundle if you have the default Vite setup.[2]

### How it works
- Each turn can include uploaded file parts, enabling the model to reference student-provided content directly.[2]
- The router selects a specialized system instruction per intent and softly augments the user prompt for domain relevance.[2]
- Manual intent selection overrides auto-detection for predictable routing.[2]
- If routing confidence is low or responses are empty/errored, a fallback card offers staff contact options.[2]

### UI highlights
- Header: CampusHelp logo/title is centered regardless of right-side controls and wraps neatly on small screens.[2]
- Transcript: generous container padding and per-message gutters prevent bubbles from hugging edges.[2]
- Composer: compact, icon-forward layout with accessible labels and keyboard send on Enter.[2]
- Drag-and-drop: a clean full-window overlay appears only while dragging files.[2]
- Toasts: theme-matching confirmations for actions like copying helpdesk email or submitting a ticket.[2]

### Configuration notes
- Email action copies VITE_HELPDESK_EMAIL to clipboard for reliability across environments without a mail client.[2]
- WhatsApp action opens a prefilled chat using VITE_WHATSAPP_NUMBER if configured.[2]
- Ticket creation posts a JSON payload with lastMessage, transcript preview, intent selection/detection, and timestamp.[2]

### Troubleshooting
- Email button shows “not configured”: set VITE_HELPDESK_EMAIL and restart the dev server.[2]
- Attachments not appearing: ensure file types are among the accepted set (PDF and common image formats).[2]
- No response or empty output: rephrase the query, select a manual intent, or use the handoff card to contact staff.[2]

### Security and privacy
- Avoid putting secrets or sensitive PII in chat prompts or uploaded files when not necessary.[2]
- Review institution policies before enabling webhook-based ticket creation and ensure HTTPS endpoints.[2]

### Project structure (high level)
- src/ChatWithGemini.jsx: main UI, model streaming, intent router, files, contact actions, and toasts.[2]
- Public and config files as per a typical Vite React project.[1]

### License
Include your institution’s preferred license or an open-source license of choice.[1]

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/6334607/6219396d-c413-43fe-a8b3-fa3d0345a103/README.md)
[2](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/6334607/b9714b7f-a65b-4132-888a-58646067b515/ChatWithGemini.jsx)