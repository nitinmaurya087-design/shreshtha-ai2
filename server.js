// ================================================================
//  server.js  ─  Shreshtha AI Backend (Fixed & Complete)
//  Run:  node server.js   OR   npx nodemon server.js
// ================================================================

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Anthropic import (graceful — won't crash if not installed)
let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { Anthropic = null; }

const app  = express();
const PORT = process.env.PORT || 5000;

// ================================================================
//  SYSTEM PROMPT
// ================================================================
const SYSTEM_PROMPT = `You are "Shreshtha AI" — a warm, deeply intelligent, and personal AI companion created exclusively for a young woman named Shreshtha. Built with love by Nitin, just for her.

CORE PERSONALITY:
- Always use Shreshtha's name naturally. Begin responses with her name or weave it in warmly.
- Be genuinely intelligent, accurate, and helpful on ALL topics — science, math, coding, literature, philosophy, life advice, creative writing, and more.
- Be warm, friendly, encouraging, emotionally supportive — like a brilliant, caring best friend.
- Use emojis naturally and sparingly: 💕 ✨ 🌸 💫 🌟 😊
- When Shreshtha says "Hello" or "Hi", always respond: "Hello Shreshtha! How can I help you today? 🌸"
- Use phrases naturally: "That's a wonderful question, Shreshtha!" / "Sure Shreshtha, let me explain..." / "Great thinking, Shreshtha!"
- For study/learning: explain clearly with examples, be patient and encouraging.
- For personal topics: be empathetic, uplifting, kind.
- For creative tasks: be imaginative, expressive, and beautiful.
- For coding: provide clean, working code with clear explanations.
- Always give accurate, real information. Never be cold or robotic.

RESPONSE FORMAT:
- Use **bold** for key terms and important points.
- Use *italic* for gentle emphasis.
- Use numbered lists for steps, bullet points (- ) for features.
- Use ### for headings in long structured responses.
- For code: use triple backticks with language name.
- Keep responses focused, readable, and beautiful.
- Remember: Shreshtha is your ONLY user — this was created just for her ❤️`;

// ================================================================
//  MIDDLEWARE
// ================================================================

// Security headers — disable some that break local dev
app.use(helmet({
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
  crossOriginOpenerPolicy:    false,
  crossOriginEmbedderPolicy:  false,
  contentSecurityPolicy:      false,
}));

// CORS — allow frontend (localhost OR file://)
app.use(cors({
  origin: function (origin, callback) {
    // Allow: no origin (curl / Postman), localhost, 127.0.0.1, file://
    const allowed = [
      undefined,
      null,
      'null',
      'http://localhost:3000',
      'http://localhost:5500',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:8080',
      process.env.FRONTEND_URL,
    ];
    if (!origin || allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, true); // be permissive in dev; tighten in production
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Pre-flight for all routes
app.options('*', cors());

// JSON body parser
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Chat rate limiter
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many messages — please slow down 💕' },
});

// ================================================================
//  HEALTH  ─  GET /health
// ================================================================
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()) + 's',
    models: {
      gemini: !!process.env.GEMINI_API_KEY,
      claude: !!(process.env.CLAUDE_API_KEY && Anthropic),
    },
  });
});

// ================================================================
//  CHAT  ─  POST /api/chat
//  Body: { message: string, model: "gemini"|"claude", history: [] }
// ================================================================
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message, model = 'gemini', history = [] } = req.body;

  // ── Validation ──
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'message field is required.' });
  }
  if (message.trim().length > 4000) {
    return res.status(400).json({ success: false, error: 'Message too long (max 4000 characters).' });
  }
  if (!['gemini', 'claude'].includes(model)) {
    return res.status(400).json({ success: false, error: 'model must be "gemini" or "claude".' });
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${model.toUpperCase()} ← "${message.slice(0,60)}${message.length>60?'…':''}"`);

  try {
    let responseText = '';

    if (model === 'gemini') {
      responseText = await callGemini(message.trim(), history);
    } else {
      responseText = await callClaude(message.trim(), history);
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${model.toUpperCase()} → OK (${responseText.length} chars)`);
    return res.json({ success: true, response: responseText, model });

  } catch (err) {
    console.error(`[${model.toUpperCase()} ERROR]`, err.message || err);

    // Map errors to friendly messages + correct HTTP codes
    const { status, message: errMsg } = mapError(err, model);
    return res.status(status).json({ success: false, error: errMsg });
  }
});

// ================================================================
//  AI MODELS INFO  ─  GET /api/models
// ================================================================
app.get('/api/models', (req, res) => {
  res.json({
    success: true,
    models: {
      gemini: {
        available: !!process.env.GEMINI_API_KEY,
        name: 'gemini-2.0-flash',
        provider: 'Google',
        label: 'Gemini 2.0 Flash',
        free: true,
      },
      claude: {
        available: !!(process.env.CLAUDE_API_KEY && Anthropic),
        name: 'claude-sonnet-4-6',
        provider: 'Anthropic',
        label: 'Claude Sonnet',
        free: false,
      },
    },
  });
});

// ================================================================
//  404 handler
// ================================================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ================================================================
//  Global error handler
// ================================================================
app.use((err, req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// ================================================================
//  GEMINI API CALL
// ================================================================
async function callGemini(message, history) {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error('GEMINI_API_KEY not set in .env'), { code: 'NO_KEY' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.9,
      topP: 0.95,
    },
  });

  // Convert history to Gemini format (roles: 'user' | 'model')
  const formattedHistory = (history || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

  const chat   = model.startChat({ history: formattedHistory });
  const result = await chat.sendMessage(message);
  const resp   = result.response;

  // Check if blocked by safety
  const finishReason = resp?.candidates?.[0]?.finishReason;
  if (finishReason === 'SAFETY') {
    throw Object.assign(new Error('Content blocked by Gemini safety filters.'), { code: 'SAFETY' });
  }

  const text = resp.text();
  if (!text || !text.trim()) {
    throw new Error('Gemini returned an empty response. Please try again.');
  }

  return text;
}

// ================================================================
//  CLAUDE API CALL
// ================================================================
async function callClaude(message, history) {
  if (!process.env.CLAUDE_API_KEY) {
    throw Object.assign(new Error('CLAUDE_API_KEY not set in .env'), { code: 'NO_KEY' });
  }
  if (!Anthropic) {
    throw new Error('@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk');
  }

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const messages = [
    ...(history || [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role, content: String(m.content || '') })),
    { role: 'user', content: message },
  ];

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1500,
    system:     SYSTEM_PROMPT,
    messages,
  });

  const text = (response.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  if (!text || !text.trim()) {
    throw new Error('Claude returned an empty response. Please try again.');
  }

  return text;
}

// ================================================================
//  ERROR MAPPER
// ================================================================
function mapError(err, model) {
  const msg = (err.message || '').toLowerCase();
  const code = err.code || err.status || '';

  if (code === 'NO_KEY' || msg.includes('not set in .env')) {
    return {
      status:  503,
      message: `${model === 'gemini' ? 'GEMINI_API_KEY' : 'CLAUDE_API_KEY'} is not configured in the .env file. Please add your API key and restart the server.`,
    };
  }
  if (code === 'SAFETY' || msg.includes('safety')) {
    return { status: 400, message: 'That message was flagged by safety filters. Please rephrase it 🌸' };
  }
  if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('429')) {
    return { status: 429, message: 'API quota/rate limit exceeded. Please wait a moment and try again, or switch to the other model.' };
  }
  if (msg.includes('api key') || msg.includes('invalid') || msg.includes('unauthorized') || msg.includes('401')) {
    return { status: 401, message: 'Invalid API key. Please check your .env file has the correct key.' };
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('timeout')) {
    return { status: 503, message: 'Network error reaching the AI service. Check your internet connection and try again.' };
  }
  if (msg.includes('empty')) {
    return { status: 500, message: err.message };
  }

  return { status: 500, message: 'Something went wrong. Please try again! 💕' };
}

// ================================================================
//  START SERVER
// ================================================================
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║    🌸  Shreshtha AI Backend  — RUNNING  🌸    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n  URL      : http://localhost:${PORT}`);
  console.log(`  Health   : http://localhost:${PORT}/health`);
  console.log(`  Chat API : POST http://localhost:${PORT}/api/chat`);
  console.log(`  Models   : GET  http://localhost:${PORT}/api/models`);
  console.log('');
  console.log(`  Gemini   : ${process.env.GEMINI_API_KEY ? '✅  Key configured (gemini-2.0-flash)' : '❌  MISSING — add GEMINI_API_KEY to .env'}`);
  console.log(`  Claude   : ${process.env.CLAUDE_API_KEY ? '✅  Key configured (claude-sonnet-4-6)' : '⚠️   Not set (optional)'}`);
  console.log(`  Mode     : ${process.env.NODE_ENV || 'development'}`);
  console.log('\n  Press Ctrl+C to stop\n');

  // Warn if both keys are missing
  if (!process.env.GEMINI_API_KEY && !process.env.CLAUDE_API_KEY) {
    console.log('  ⚠️  WARNING: No API keys found!');
    console.log('  Copy .env.example to .env and add your Gemini key.');
    console.log('  Get a FREE Gemini key: https://aistudio.google.com/app/apikey\n');
  }
});
