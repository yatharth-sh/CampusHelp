```markdown
# CampusHelp · Student Helpdesk Chat

A lightweight, responsive student helpdesk built on Gemini 2.5 Flash with Google Search grounding, intent routing for common topics, and file‑aware Q&A. 

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

## Overview

CampusHelp answers questions about academics, scholarships, fees, housing, timetables, and student life in a conversational interface that scales cleanly across devices.   
The UI centers the brand, uses a minimal pill composer with icon actions, and adds comfortable transcript gutters for readability. 

## Features

- Minimal pill composer with auto‑resizing textarea and icon buttons for attach and send.   
- Drag‑and‑drop overlay appears only while dragging files to keep the interface clean.   
- File‑aware Q&A: upload PDFs or images and ask targeted questions about them using the SDK Files API.   
- Intent routing: Auto detect or manually choose Fees, Scholarships, Timetable, Housing to bias responses.   
- Human handoff: always‑available Contact menu plus a fallback card on low‑confidence or empty/error responses.   
- Email action copies the helpdesk address to clipboard with a theme‑matching toast; WhatsApp and optional ticket webhook included.   
- Google Search grounding and safety settings enabled for fresher, safer answers.   
- Centered branding, responsive spacing via clamp, and consistent gutters across the transcript. 

## Demo

- Local preview: run the dev server, upload a PDF or image, and ask follow‑up questions about specific sections or visuals.   
- Try switching intent from Auto to Fees or Timetable to see routing steer the reply style and guidance.   
- Use the Contact menu to copy the helpdesk email or open WhatsApp with a prefilled transcript snippet. 

## Quick Start

Prerequisites: Node.js 16+ and a Google Gemini API key. 

1. Install 
```
npm install
```

2. Configure environment (see “Environment Variables”).  
  
3. Run in development. 
```
npm run dev
```

4. Build for production. 
```
npm run build
```

5. Preview production build. 
```
npm run preview
```

## Environment Variables

Create a .env (or .env.local) in the project root. 

- VITE_GEMINI_API_KEY=your_api_key_here   
- VITE_HELPDESK_EMAIL=helpdesk@university.edu  (used for copy‑to‑clipboard Email)   
- VITE_WHATSAPP_NUMBER=15551234567  (international format without plus)   
- VITE_HELPDESK_WEBHOOK_URL=https://your.ticket.endpoint  (optional POST endpoint for creating tickets) 

## Usage

- Composer: type to auto‑expand, Enter to send, Shift+Enter for newline; attach with the clip icon.   
- Drag and drop: drag files anywhere to reveal the overlay; drop to upload and ask questions about them.   
- Intent routing: leave on Auto or select a route to focus guidance and next steps for that domain.  
- Contact staff: use the header Contact menu or the fallback card when detection confidence is low. 

## Architecture

- React + Vite frontend with a single main component handling streaming, intents, files, and contact actions.  
- Google GenAI SDK with gemini‑2.5‑flash and Search grounding; Files API for PDF/image ingestion.  
- Lightweight router swaps system instructions and softly augments the user prompt per intent.  
- Fallback logic shows a human‑handoff card on low‑confidence, empty, or errored responses.

## Folder Structure

```
.
├─ src/
│  ├─ ChatWithGemini.jsx      # Main UI, streaming, intents, files, contact, toasts
│  └─ ...                     # Other modules/assets
├─ public/                    # Static assets
├─ .env.example               # Add this file to document env vars (optional)
├─ index.html
├─ package.json
└─ README.md
```
[attached_file:1]

## Roadmap

- Optional authentication and role‑based content access.   
- Persistent transcripts with export and search.   
- Departmental knowledge connectors and richer intent models.   - Theming and accessibility refinements. 

## Contributing

Issues and PRs are welcome; include before/after screenshots for UI changes and describe intent or accessibility impacts

## License

Add a LICENSE file (e.g., MIT or Apache‑2.0) and update this section accordingly
```
