import { GoogleGenAI, ApiError } from "@google/genai";
import { buildGraderPrompt } from "./prompts";
import z from "zod";
import { prisma } from "./db";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_GRADER_MODEL ?? "gemini-3.8-flash";
const RETRYABLE = new Set([429, 500, 503]);

const GradeSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string(),
});

// use Gemini text model to grade transcript
async function grade(transcript: string) {
  for(let attempt = 1; ; attempt++){
    try{
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildGraderPrompt(transcript),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(GradeSchema),
        },
      });
      return GradeSchema.parse(JSON.parse(response.text ?? ""));
    }catch(error){
      const retryable = error instanceof ApiError && RETRYABLE.has(error.status);
      if(!retryable || attempt >= 4) throw error;
      console.warn(`Grader returned ${error.status}, retry ${attempt}/3`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    }
  }
}

// safe to call more than once - only caller claiming row does any work
export async function finishInterview(interviewId: string) {
  // try to claim row
  const claim = await prisma.interview.updateMany({
    where: { id: interviewId, status: "InProgress" },
    data: { status: "Grading" },
  });

  // if none, return
  if (claim.count === 0) return;

  try {
    // fetch messages from user
    const messages = await prisma.message.findMany({
      where: { interviewId },
      orderBy: { createdAt: "asc" },
    });
    const candidateSpoke = messages.some((m) => m.type === "User");

    // pass candidate transcript to grade() and get result
    const result = candidateSpoke
      ? await grade(messages.map((m) => `${m.type}: ${m.message}`).join("\n"))
      : {
          score: 0,
          feedback: "The interview ended before you answered a question.",
        };

    // update interview status to 'Done' and attach result
    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: "Done", ...result },
    });
  } catch (error) {
    console.error("Grading failed:", error);
    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: "Failed" },
    });
  }
}
