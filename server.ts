import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { createInitialDatabase } from './src/game/seedData';
import { ArenaDatabase, QuestionItem, SubjectId } from './src/game/types';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'arena509.json');

function loadDatabase(): ArenaDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ArenaDatabase;
      if (parsed && Array.isArray(parsed.students) && Array.isArray(parsed.questions)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read database file, re-initializing:', err);
  }
  const initial = createInitialDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: ArenaDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  let dbState = loadDatabase();

  app.get('/api/state', (_req, res) => {
    res.json(dbState);
  });

  app.post('/api/state', (req, res) => {
    const incoming = req.body as ArenaDatabase;
    if (!incoming || !Array.isArray(incoming.students) || !Array.isArray(incoming.questions)) {
      res.status(400).json({ error: 'Invalid database payload' });
      return;
    }
    dbState = incoming;
    saveDatabase(dbState);
    res.json({ ok: true, state: dbState });
  });

  app.post('/api/reset', (_req, res) => {
    dbState = createInitialDatabase();
    saveDatabase(dbState);
    res.json({ ok: true, state: dbState });
  });

  // 教師後台：提供課本/習作文字教材 -> AI協助整理及出題（先存草稿供教師核對發布）
  app.post('/api/ai/generate-questions', async (req, res) => {
    const { subjectId, unit, materialText, count = 3 } = req.body as {
      subjectId: SubjectId;
      unit: string;
      materialText: string;
      count?: number;
    };

    if (!materialText || !materialText.trim()) {
      res.status(400).json({ error: '請輸入教材重點或單字課文內容' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `你是臺灣國小五年級（509班）的專業命題教師。請根據以下教師提供的教材內容，為科目「${subjectId}」、單元「${unit || '第一單元'}」設計 ${count} 道適合電子白板雙人PK的題目。
教材內容：
${materialText}

請嚴格輸出 JSON 陣列，每題包含 contentType, answerFormat ('choice' | 'number' | 'spell' | 'order'), difficulty ('easy' | 'medium' | 'hard'), stem, options (字串陣列), correctAnswer, explanation。`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  contentType: { type: Type.STRING },
                  answerFormat: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  stem: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: [
                  'contentType',
                  'answerFormat',
                  'difficulty',
                  'stem',
                  'options',
                  'correctAnswer',
                  'explanation',
                ],
              },
            },
          },
        });

        const parsed = JSON.parse(response.text || '[]') as Array<{
          contentType: string;
          answerFormat: QuestionItem['answerFormat'];
          difficulty: QuestionItem['difficulty'];
          stem: string;
          options: string[];
          correctAnswer: string;
          explanation: string;
        }>;

        const drafts: QuestionItem[] = parsed.map((item, idx) => ({
          id: `AI-${subjectId.toUpperCase().slice(0, 2)}-${Date.now().toString().slice(-4)}-${idx + 1}`,
          version: 1,
          subjectId,
          unit: unit || '第一單元',
          contentType: item.contentType || '綜合',
          answerFormat: (['choice', 'number', 'spell', 'order'].includes(item.answerFormat)
            ? item.answerFormat
            : 'choice') as QuestionItem['answerFormat'],
          difficulty: (['easy', 'medium', 'hard'].includes(item.difficulty)
            ? item.difficulty
            : 'medium') as QuestionItem['difficulty'],
          stem: item.stem,
          options: item.options,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
          purpose: 'both',
          source: 'AI教材輔助出題（待教師核對）',
          status: 'draft',
          updatedAt: new Date().toISOString(),
        }));

        res.json({ ok: true, drafts });
        return;
      } catch (err) {
        console.warn('Gemini generation fallback triggered:', err);
      }
    }

    // 離線或未配置金鑰時的教材解析模板出題（確保功能100%可用）
    const snippet = materialText.trim().slice(0, 45);
    const defaultTypeMap: Record<SubjectId, string> = {
      chinese: '閱讀理解',
      math: '應用',
      social: '課文理解',
      english: '單字',
      life: '生活科學',
    };
    const fallbackDraft: QuestionItem = {
      id: `DRAFT-${subjectId.toUpperCase().slice(0, 2)}-${Date.now().toString().slice(-4)}`,
      version: 1,
      subjectId,
      unit: unit || '第一單元',
      contentType: defaultTypeMap[subjectId],
      answerFormat: 'choice',
      difficulty: 'medium',
      stem: `【教材重點題】根據「${snippet}...」的內容，下列敘述何者正確？`,
      options: ['符合課文核心概念與正確推論', '與教材敘述相反', '屬於無關的假設', '以上皆非'],
      correctAnswer: '符合課文核心概念與正確推論',
      explanation: `依據教師提供之「${unit || '第一單元'}」教材內容整理。`,
      purpose: 'both',
      source: '教材整理草稿（待教師核對）',
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    res.json({ ok: true, drafts: [fallbackDraft] });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`509 Arena Server listening on http://localhost:${PORT}`);
  });
}

startServer();
