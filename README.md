# 🌸 Shreshtha AI — Complete Setup Guide

## Project Structure

```
shreshtha-ai/
├── backend/
│   ├── server.js          ← Single-file backend (all-in-one)
│   ├── package.json
│   └── .env.example       ← Copy to .env and add API keys
└── frontend/
    └── index.html         ← Complete UI (just open in browser)
```

---

## ⚡ Quick Start (3 steps)

### Step 1 — Install backend dependencies

```bash
cd backend
npm install
```

### Step 2 — Create .env file and add your API key

```bash
# In the backend folder:
cp .env.example .env
```

Then open `.env` in any text editor and replace the placeholder:

```
GEMINI_API_KEY=AIzaSy_your_actual_key_here
```

**Get a FREE Gemini key:**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy the key (starts with `AIza...`)
4. Paste it in `.env`

### Step 3 — Start the backend

```bash
cd backend
node server.js
```

You should see:
```
╔══════════════════════════════════════════════╗
║    🌸  Shreshtha AI Backend  — RUNNING  🌸    ║
╚══════════════════════════════════════════════╝

  URL      : http://localhost:5000
  Gemini   : ✅  Key configured (gemini-2.0-flash)
```

### Step 4 — Open the frontend

Simply open `frontend/index.html` in your browser.

The green "Backend Online" indicator in the topbar confirms the connection.

---

## 🔑 API Keys

| Model | Provider | Cost | Where to get |
|-------|----------|------|--------------|
| `gemini-2.0-flash` | Google | **FREE** | aistudio.google.com/app/apikey |
| `claude-sonnet-4-6` | Anthropic | Paid | console.anthropic.com |

You only need **one key** to use the app. Gemini is free.

---

## 🔧 Common Problems & Fixes

### "Backend Offline" / "Cannot reach backend"

The backend server is not running. Fix:
```bash
cd backend
npm install          # make sure packages are installed
node server.js       # start the server
```

### "GEMINI_API_KEY not configured"

You haven't created the `.env` file or the key is wrong.

Fix:
```bash
cd backend
cp .env.example .env
# Now open .env and paste your real key
```

Make sure `.env` looks like:
```
GEMINI_API_KEY=AIzaSyABCDEF...
```
No quotes, no spaces around `=`.

### "Invalid API key" error

Your Gemini key is wrong or expired. Get a new one at:
https://aistudio.google.com/app/apikey

### Port 5000 already in use

```bash
# Kill whatever is using port 5000:
# Mac/Linux:
kill $(lsof -t -i:5000)
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```
Or change the port in `.env`:
```
PORT=5001
```
And update `API_BASE` in `frontend/index.html`:
```js
const API_BASE = 'http://localhost:5001';
```

### CORS error in browser console

This is already handled — the backend allows all localhost ports and file:// origins.

If you still see a CORS error, make sure the backend is actually running and
you're not accidentally calling the wrong port.

### Frontend opened from file:// vs localhost

Both work. The backend accepts both `null` origin (file://) and `localhost`.

---

## 🚀 Development Workflow

```bash
# Install nodemon for auto-restart on file changes:
npm install -g nodemon

# Run with auto-restart:
cd backend
npx nodemon server.js
```

---

## 🌐 Deployment

### Backend (Railway / Render / Fly.io)

1. Push `backend/` folder to GitHub
2. Create new service on Railway/Render
3. Set environment variables:
   - `GEMINI_API_KEY` = your key
   - `NODE_ENV` = production
   - `FRONTEND_URL` = your Vercel/Netlify URL
4. Deploy

### Frontend (Vercel / Netlify / GitHub Pages)

1. Update `API_BASE` in `index.html` to your backend URL:
   ```js
   const API_BASE = 'https://your-backend.railway.app';
   ```
2. Deploy `frontend/` folder
3. Done!

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health + which models are configured |
| POST | `/api/chat` | Send message, get AI response |
| GET | `/api/models` | List available models and their status |

### POST /api/chat

Request body:
```json
{
  "message": "Hello Shreshtha!",
  "model": "gemini",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}
```

Response:
```json
{
  "success": true,
  "response": "Hello Shreshtha! 🌸 How can I help you today?",
  "model": "gemini"
}
```

---

Made with ❤️ by Nitin — Only for Shreshtha
