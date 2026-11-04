import { GoogleGenAI, type Session } from "@google/genai";
import { WebSocket, type RawData } from "ws";
import { prisma } from "./db";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
const VOICE = process.env.GEMINI_VOICE ?? "Kore";

export class InterviewBridge {
  private gemini: Session | null = null;
  private systemPrompt = "";
  private connectionId = 0; // lets us ignore callbacks from a replaced connection
  private started = false;
  private finished = false;
  private userText = "";
  private aiText = "";
  private writes: Promise<unknown> = Promise.resolve(); // keeps messages in order

  /*constructor(
    private browser: WebSocket,
    private interviewId: string,
  ) {
    browser.on("message", (data, isBinary) =>
      this.onBrowserMessage(data, isBinary),
    );
    browser.on("close", () => void this.finish());
    browser.on("error", (error) =>
      console.error("Browser socket error:", error),
    );
  }

  private onBrowserMessage(data: RawData, isBinary: boolean) {
    if (isBinary) {
      this.gemini?.sendRealtimeInput({
        audio: {
          data: (data as Buffer).toString("base64"),
          mimeType: "audio/pcm;rate=16000",
        },
      });
      return;
    }

    const message = JSON.parse(data.toString());
    if (message.type === "start") void this.start();
    if (message.type === "end") void this.finish();
  }

  // runs once once mic has access
  private async start() {
    if (this.started) return;
    this.started = true;
    
    try {
        const interview = await prisma.interview.findUnique({
            where: { id: this.interviewId },
        });
        if(!interview || interview.status !== "Pre"){
            this.sendJson({ type: "error", message: "Interview already used." });
            this.browser.close();
            return;
        }

        this.system
    }*/
}
