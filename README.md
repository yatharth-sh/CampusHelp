```markdown
# CampusHelp · Student Helpdesk Chat

A lightweight, responsive student helpdesk built on Gemini 2.5 Flash with Google Search grounding, intent routing for common topics, file‑aware Q&A, and a clean minimal composer UI.  

![Vite](https://img.shields.io/badge/Vite-React-646CFF?logo=vite&logoColor=white) ![Gemini](https://img.shields.io/badge/Google%20GenAI-Gemini%202.5%20Flash-1a73e8?logo=google) ![License](https://img.shields.io/badge/License-Choose%20one-informational) ![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## Table of Contents
- Overview
- Features
- Demo
- Quick Start
- Environment Variables
- Usage
- Architecture
- Folder Structure
- Roadmap
- Contributing
- License
- Acknowledgements

## Overview
CampusHelp answers questions about academics, housing, fees, scholarships, calendars, and student life, with a minimal interface that scales cleanly across devices and supports file‑grounded questions on PDFs and images.  

## Features
- Minimal pill composer with auto‑resizing textarea and icon buttons for attach and send.  
- Drag‑and‑drop overlay appears only while dragging; otherwise the UI stays clutter‑free.  
- File‑aware Q&A using the SDK Files API for PDFs and common image formats.  
- Intent routing with lightweight keyword detection and manual override for Fees, Scholarships, Timetable, Housing.  
- Human handoff: always‑available “Contact staff” menu, plus a fallback card on low‑confidence or empty/error responses.  
- Email action copies the helpdesk address to the clipboard for maximum reliability, with theme‑matching toasts.  
- WhatsApp action opens a prefilled thread, and an optional webhook can create tickets with transcript context.  
- Google Search grounding enabled for fresher, more reliable answers with safety settings applied.  
- Centered branding, comfortable transcript gutters, and responsive spacing via clamp for a balanced look.  

## Demo
- Local preview: run, open the app, and try uploading a PDF or image, then ask follow‑up questions about the content.  
- Add or drag a file to see the overlay; use the intent selector or leave it on Auto; try the Contact menu.  

> Add screenshots/GIFs here (e.g., /docs/screenshot-*.png).  

## Quick Start
Prerequisites: Node.js 16+ and a Google Gemini API key.  

1. Install
   ```
   npm install
   ```
2. Configure environment (see “Environment Variables”).  
3. Run in development
   ```
   npm run dev
   ```
4. Build for production
   ```
   npm run build
   ```
5. Preview production build
   ```
   npm run preview
   ```

## Environment Variables
Create a .env (or .env.local) in the project root:  
- VITE_GEMINI_API_KEY=your_api_key_here  
- VITE_HELPDESK_EMAIL=helpdesk@university.edu  
- VITE_WHATSAPP_NUMBER=15551234567  (international format, no plus)  
- VITE_HELPDESK_WEBHOOK_URL=https://your.ticket.endpoint  (optional)  

Notes:  
- Email action copies VITE_HELPDESK_EMAIL to clipboard and shows a toast.  
- WhatsApp opens a thread with the last message and recent transcript.  
- Webhook receives JSON: lastMessage, transcript preview, selected/detected intent and confidence, timestamp.  

## Usage
- Composer: type to auto‑expand, Enter to send, Shift+Enter for newline.  
- Attach: click the clip icon to browse; drag files anywhere to reveal the overlay and drop to upload.  
- Intent routing: leave on Auto or choose Fees, Scholarships, Timetable, Housing to bias answers.  
- Contact staff: use the header “Contact” or fallback card for Email/WhatsApp/Ticket.  

## Architecture
- React + Vite frontend, single‑file chat UI (ChatWithGemini.jsx) managing stream, intent routing, files, and toasts.  
- Google GenAI SDK with gemini‑2.5‑flash and Search grounding, plus Files API for media/PDF handling.  
- Lightweight router that swaps system instructions per intent and softly augments the user prompt.  
- Error/empty response handling triggers a human‑handoff card with configured actions.  

## Folder Structure
Adjust as needed for your project layout.  
```
.
├─ src/
│  ├─ ChatWithGemini.jsx      # Main UI, streaming, intents, files, contact, toasts
│  └─ ...                     # Your other modules/assets
├─ public/                    # Static assets
├─ .env.example               # Copy of env variables (add one)
├─ index.html
├─ package.json
└─ README.md
```

## Roadmap
- Optional authentication and role‑based content.  
- Persistent transcripts with export.  
- Departmental knowledge connectors and richer intent models.  
- Theming and accessibility refinements.  

## Contributing
Issues and pull requests are welcome; please propose UI/UX changes with before/after screenshots for clarity.  

## License
Choose and add a license (e.g., MIT, Apache‑2.0) and include the LICENSE file in the repo.  

## Acknowledgements
- Google GenAI SDK & Gemini 2.5 Flash  
- Vite + React  
- Everyone improving student support and accessibility . 
```
