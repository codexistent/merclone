import { GoogleGenAI } from "@google/genai";
import { buildGraderPrompt } from "./prompts";
import z from "zod";
import { prisma } from "./db";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_GRADER_MODEL ?? "gemini-3.8.flash";

const GradeSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string(),
});

// use Gemini text model to grade transcript
async function grade(transcript: string) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildGraderPrompt(transcript),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(GradeSchema),
    },
  });
  return GradeSchema.parse(JSON.parse(response.text ?? ""));
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
