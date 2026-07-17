import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, logsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  ProcessClassBody,
  ProcessPrepBody,
  ProcessFactCheckBody,
} from "@workspace/api-zod";

const router = Router();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY must be set.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
      `You are an AI study assistant. Analyze this class transcript and return a JSON object with exactly these fields:
- "summary": a concise 3-5 sentence executive summary of the class
- "notes": well-structured study notes in plain text with clear sections
- "questions": 5-7 important exam-style questions based on the content

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
      `You are an AI study assistant. Analyze this text and return a JSON object with exactly these fields:
- "summary": a concise 3-5 sentence summary of the material
- "questions": 5-8 predicted exam questions a professor might ask based on this content

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
- "explanation": a clear 2-4 sentence explanation of why the claim is correct or false

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
