

### Overview
CampusHelp is a lightweight student helpdesk chat app built on Gemini 2.5 Flash with Google Search grounding, responsive UI, intent routing, and human handoff options.
It supports drag-and-drop or picker-based file uploads so students can ask questions about their own PDFs and images.

### Features
- Minimal pill-style composer with auto-resizing textarea and icon buttons for attach and send.
- Files: add via picker or drag-and-drop overlay; ask questions grounded in uploaded PDFs/images.
- Intent routing: auto-detect or manually select Fees, Scholarships, Timetable, Housing to steer responses.
- Human handoff: always-available “Contact staff” menu plus fallback card with Email copy-to-clipboard, WhatsApp open, and optional ticket webhook.
- Google Search grounding enabled for fresher answers, with safety settings applied.
- Polished, responsive layout with centered branding and comfortable transcript gutters.

### Tech stack
- React with Vite for the frontend.
- Google GenAI SDK using the gemini-2.5-flash model.
- In-browser Files API from the SDK for media/PDF handling.

### Quick start
- Prerequisites: Node.js 16+ and a Gemini API key.
- Install dependencies: run npm install in the project root.
- Create an .env file and add required variables shown below.
- Start the dev server with your usual Vite script and open the printed local address.

### Environment variables
Place the following in .env (or .env.local) at the project root.[2]
- VITE_GEMINI_API_KEY=your_api_key_here.[1]
- VITE_HELPDESK_EMAIL=helpdesk@university.edu (used for copy-to-clipboard Email in “Contact staff”).
- VITE_WHATSAPP_NUMBER=15551234567 (international format without plus; opens a WhatsApp thread with context).
- VITE_HELPDESK_WEBHOOK_URL=https://your.ticket.endpoint (optional; POSTs JSON with last message, transcript, and intent).

### Scripts
- npm install to install dependencies.
- npm run dev to start development mode.
- npm run build to generate a production bundle if you have the default Vite setup.

### How it works
- Each turn can include uploaded file parts, enabling the model to reference student-provided content directly.
- The router selects a specialized system instruction per intent and softly augments the user prompt for domain relevance.
- Manual intent selection overrides auto-detection for predictable routing.
- If routing confidence is low or responses are empty/errored, a fallback card offers staff contact options.

### UI highlights
- Header: CampusHelp logo/title is centered regardless of right-side controls and wraps neatly on small screens.
- Transcript: generous container padding and per-message gutters prevent bubbles from hugging edges.
- Composer: compact, icon-forward layout with accessible labels and keyboard send on Enter.
- Drag-and-drop: a clean full-window overlay appears only while dragging files.
- Toasts: theme-matching confirmations for actions like copying helpdesk email or submitting a ticket.

### Configuration notes
- Email action copies VITE_HELPDESK_EMAIL to clipboard for reliability across environments without a mail client.
- WhatsApp action opens a prefilled chat using VITE_WHATSAPP_NUMBER if configured.
- Ticket creation posts a JSON payload with lastMessage, transcript preview, intent selection/detection, and timestamp.

### Troubleshooting
- Email button shows “not configured”: set VITE_HELPDESK_EMAIL and restart the dev server.
- Attachments not appearing: ensure file types are among the accepted set (PDF and common image formats).
- No response or empty output: rephrase the query, select a manual intent, or use the handoff card to contact staff.

### Security and privacy
- Avoid putting secrets or sensitive PII in chat prompts or uploaded files when not necessary.
- Review institution policies before enabling webhook-based ticket creation and ensure HTTPS endpoints.

### Project structure (high level)
- src/ChatWithGemini.jsx: main UI, model streaming, intent router, files, contact actions, and toasts.
- Public and config files as per a typical Vite React project.

### License

