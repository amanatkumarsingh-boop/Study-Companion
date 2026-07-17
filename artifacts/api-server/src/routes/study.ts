import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, logsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  ProcessClassBody,
  ProcessPrepBody,
  ProcessFactCheckBody,
  ProcessDoubtBody,
} from "@workspace/api-zod";

const router = Router();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY must be set.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function generateJSON(prompt: string): Promise<Record<string, string>> {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// POST /api/class
router.post("/class", async (req, res) => {
  const parsed = ProcessClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { transcript } = parsed.data;

  try {
    const content = await generateJSON(
      `You are an expert academic tutor. You are receiving a lecture transcription recorded in a multi-language or native environment (such as conversational Hinglish, pure English, or mixed dialects).

BILINGUAL PROCESSING RULES:
- Internally process the vocal expressions and track the semantic subject context perfectly.
- Bypass common colloquial Hindi filler structures (such as "hai", "kuch", "kya", "karne", "yeh", "toh", "aur", "woh", "matlab", "agar", "jab", "tab") — treat them as connective tissue only, never as subject keywords or technical terms.
- Identify and isolate genuine technical English terms (e.g. "PostgreSQL", "React Hooks", "Loop Conditions", "API", "recursion") as the high-yield topic keywords.
- Translate all conceptual ideas internally from Hinglish or any mixed dialect into clean academic English before generating output.

OUTPUT RULES — ALL OUTPUT MUST BE IN ENGLISH ONLY:
Generate a comprehensive study package returned strictly as a clean, parsable JSON object containing exactly four keys:
- "summary": a high-yield 3-sentence executive summary capturing the most important concepts discussed
- "notes": detailed, scannable markdown-style notes with clear section headers and bullet points covering all major topics
- "formulas": a comprehensive glossary tracking all mathematical equations, code parameters, science variables, algorithms, or key definitions mentioned, using standard formatting (if none are present, return "No formulas or equations detected in this lecture.")
- "questions": a numbered list of 5-10 high-probability exam evaluation questions, each followed by a deep step-by-step answer

Transcript:
${transcript}`
    );

    await db.insert(logsTable).values({ mode: "class", content });
    res.json({ content });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to process class transcript");
    res.status(500).json({ error: "Failed to process class transcript" });
  }
});

// POST /api/prep
router.post("/prep", async (req, res) => {
  const parsed = ProcessPrepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { text } = parsed.data;

  try {
    const content = await generateJSON(
      `You are an AI study assistant specializing in processing bilingual Hinglish study material — a natural mixture of Hindi and English words written in Roman script (e.g. "yeh concept bahut important hai", "loop condition kaise kaam karta hai").

BILINGUAL PROCESSING RULES:
- Analyze the full semantic meaning of mixed Hindi/English phrases fluidly. Never skip or misparse a sentence because it contains Hindi words.
- Treat Hindi grammatical filler words (such as "hai", "kuch", "kya", "karne", "yeh", "toh", "aur", "woh", "matlab", "basically", "agar", "jab", "tab") as connective tissue only — do not treat them as subject keywords or technical terms.
- Identify and isolate genuine technical English terms (e.g. "PostgreSQL", "React Hooks", "Loop Conditions", "API", "recursion") as the high-yield topic keywords.
- Translate all conceptual ideas internally from Hinglish into clean academic English before generating any output.

OUTPUT RULES — ALL OUTPUT MUST BE IN ENGLISH ONLY:
Return a JSON object with exactly these fields:
- "summary": a comprehensive topic breakdown in clean academic English covering all core themes
- "questions": a structured bank of 5-8 predicted exam/PYQ-style questions written in clean academic English

Text:
${text}`
    );

    await db.insert(logsTable).values({ mode: "prep", content });
    res.json({ content });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to generate study notes");
    res.status(500).json({ error: "Failed to generate study notes" });
  }
});

// POST /api/factcheck
router.post("/factcheck", async (req, res) => {
  const parsed = ProcessFactCheckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { claim } = parsed.data;

  try {
    const content = await generateJSON(
      `You are a fact-checking assistant. Evaluate this claim and return a JSON object with exactly these fields:
- "verdict": either "CORRECT" or "FALSE" (no other values allowed)
- "explanation": a clear 2-4 sentence explanation of why the claim is correct or false, exposing any logic fallacies or misinformation

Claim: ${claim}`
    );

    const verdict = content.verdict === "CORRECT" ? "CORRECT" : "FALSE";
    await db.insert(logsTable).values({ mode: "factcheck", content, verdict });
    res.json({ content });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to verify claim");
    res.status(500).json({ error: "Failed to verify claim" });
  }
});

// POST /api/doubt
router.post("/doubt", async (req, res) => {
  const parsed = ProcessDoubtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { query } = parsed.data;

  try {
    const content = await generateJSON(
      `You are a patient, expert academic tutor. The student has an educational query written or spoken in their language of choice — this may include English, Hindi, Hinglish (mixed Hindi/English in Roman script), or any other global language or dialect.

PROCESSING RULES:
- Analyze the underlying context and intent of the question regardless of the language it is expressed in.
- Translate and process the core concepts on the fly — do not get confused by mixed scripts or colloquial expressions.
- Hindi filler words like "hai", "kya", "kaise", "matlab", "yeh", "toh" are grammatical connectors; focus on the educational substance of the query.

OUTPUT RULES — ALL OUTPUT MUST BE IN ENGLISH ONLY:
Return a clean JSON object containing exactly one key:
- "answer": a clear, concise, and complete answer to the student's question structured in plain academic English. Include examples, steps, or diagrams described in text where helpful.

Student's query: ${query}`
    );

    await db.insert(logsTable).values({ mode: "doubt", content });
    res.json({ content });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to process doubt query");
    res.status(500).json({ error: "Failed to process doubt query" });
  }
});

// GET /api/history
router.get("/history", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(20);

    res.json(
      rows.map((row) => ({
        id: row.id,
        mode: row.mode,
        content: row.content,
        verdict: row.verdict ?? null,
        created_at: row.createdAt.toISOString(),
      }))
    );
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
