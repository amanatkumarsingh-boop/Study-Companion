import { Router } from "express";
import OpenAI from "openai";
import { db, logsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  ProcessClassBody,
  ProcessPrepBody,
  ProcessFactCheckBody,
} from "@workspace/api-zod";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/class
router.post("/class", async (req, res) => {
  const parsed = ProcessClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { transcript } = parsed.data;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are an AI study assistant. Given a class transcript, produce structured study materials in JSON format. Respond ONLY with valid JSON, no markdown fences.",
        },
        {
          role: "user",
          content: `Analyze this class transcript and return a JSON object with exactly these fields:
- summary: a concise 3-5 sentence executive summary of the class
- notes: well-structured study notes (use plain text with clear sections, no markdown)
- questions: 5-7 important exam-style questions based on the content

Transcript:
${transcript}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let content: Record<string, string>;
    try {
      content = JSON.parse(raw);
    } catch {
      content = {
        summary: raw.slice(0, 500),
        notes: raw,
        questions: "",
      };
    }

    await db.insert(logsTable).values({
      mode: "class",
      content,
    });

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are an AI study assistant. Given study material text, produce structured study output in JSON format. Respond ONLY with valid JSON, no markdown fences.",
        },
        {
          role: "user",
          content: `Analyze this text and return a JSON object with exactly these fields:
- summary: a concise 3-5 sentence summary of the material
- questions: 5-8 predicted exam questions a professor might ask based on this content

Text:
${text}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let content: Record<string, string>;
    try {
      content = JSON.parse(raw);
    } catch {
      content = {
        summary: raw.slice(0, 500),
        questions: "",
      };
    }

    await db.insert(logsTable).values({
      mode: "prep",
      content,
    });

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "You are a fact-checking assistant. Evaluate claims for accuracy and respond ONLY with valid JSON, no markdown fences.",
        },
        {
          role: "user",
          content: `Evaluate this claim and return a JSON object with exactly these fields:
- verdict: either "CORRECT" or "FALSE" (no other values)
- explanation: a clear 2-4 sentence explanation of why the claim is correct or false, citing reasoning

Claim: ${claim}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let content: Record<string, string>;
    try {
      content = JSON.parse(raw);
    } catch {
      content = {
        verdict: "FALSE",
        explanation: raw,
      };
    }

    const verdict = content.verdict === "CORRECT" ? "CORRECT" : "FALSE";

    await db.insert(logsTable).values({
      mode: "factcheck",
      content,
      verdict,
    });

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

    const history = rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      content: row.content,
      verdict: row.verdict ?? null,
      created_at: row.createdAt.toISOString(),
    }));

    res.json(history);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
