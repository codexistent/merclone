import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { WebSocket, type RawData } from "ws";
import { prisma } from "./db";
import { buildInterviewerPrompt, KICKOFF_MESSAGE } from "./prompts";
import { finishInterview } from "./result";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
const VOICE = process.env.GEMINI_VOICE ?? "Kore";

export class InterviewBridge {
  private gemini: Session | null = null;
  private systemPrompt = "";
  private resumeHandle: string | undefined;
  private connectionId = 0; // lets us ignore callbacks from a replaced connection
  private started = false;
  private finished = false;
  private userText = "";
  private aiText = "";
  private writes: Promise<unknown> = Promise.resolve(); // keeps messages in order

  constructor(
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
      if (!interview || interview.status !== "Pre") {
        this.sendJson({ type: "error", message: "Interview already used." });
        this.browser.close();
        return;
      }

      this.systemPrompt = buildInterviewerPrompt(interview.githubMetadata);
      await this.connect();
      if (this.finished) return;

      await prisma.interview.update({
        where: { id: this.interviewId },
        data: { status: "InProgress" },
      });
      this.sendJson({ type: "ready" });
      this.gemini?.sendRealtimeInput({ text: KICKOFF_MESSAGE });
    } catch (error) {
      console.error("Could not start Gemini session: ", error);
      this.sendJson({
        type: "error",
        message: "Could not reach AI interviewer.",
      });
      this.browser.close();
    }
  }

  // connect to gemini session
  private async connect() {
    const id = ++this.connectionId;
    const previous = this.gemini;

    const session = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.systemPrompt,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: { handle: this.resumeHandle },
      },
      // callback functions from gemini to backend, set to trigger under conditions
      callbacks: {
        onmessage: (message) => {
          if (id === this.connectionId) this.onGeminiMessage(message);
        },
        onerror: (event) => console.error("Gemini error:", event.message),
        onclose: () => {
          if (id === this.connectionId) void this.onGeminiClosed();
        },
      },
    });

    this.gemini = session;
    previous?.close();
  }

  private onGeminiMessage(message: LiveServerMessage) {
    const update = message.sessionResumptionUpdate;
    if (update?.resumable && update.newHandle)
      this.resumeHandle = update.newHandle;

    if (message.goAway && this.resumeHandle) {
      this.connect().catch((error) =>
        console.error("Reconnect failed:", error),
      );
    }

    const content = message.serverContent;
    if (!content) return;

    this.userText += content.inputTranscription?.text ?? "";
    this.aiText += content.outputTranscription?.text ?? "";

    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && this.browser.readyState === WebSocket.OPEN) {
        this.browser.send(Buffer.from(part.inlineData.data, "base64"));
      }
    }

    if (content.interrupted) this.sendJson({ type: "interrupted" });
    if (content.turnComplete || content.interrupted) this.saveTurn();
  }

  // called when gemini connection closed; sends error if close not intentional
  private async onGeminiClosed() {
    if (this.finished) return;
    if (this.resumeHandle) {
      try {
        await this.connect();
        return;
      } catch (error) {
        console.error("Resume failed:", error);
      }
    }

    this.sendJson({
      type: "error",
      message: "The AI Interviewer disconnected.",
    });
    this.browser.close();
  }

  private saveTurn() {
    const user = this.userText.trim();
    const assistant = this.aiText.trim();
    this.userText = "";
    this.aiText = "";

    // record messages
    const save = (type: "User" | "Assistant", message: string) => {
      if (!message) return;
      this.writes = this.writes
        .then(() =>
          prisma.message.create({
            data: { interviewId: this.interviewId, type, message },
          }),
        )
        .catch((error) => console.error("Could not save message:", error));
    };

    save("User", user);
    save("Assistant", assistant);
  }

  private async finish() {
    if (this.finished) return;
    this.finished = true;

    this.connectionId++;
    this.gemini?.close();
    this.gemini = null;

    this.saveTurn();
    await this.writes;
    this.sendJson({ type: "ended" });
    if (this.browser.readyState === WebSocket.OPEN) this.browser.close();

    await finishInterview(this.interviewId);
  }

  private sendJson(message: object) {
    if (this.browser.readyState === WebSocket.OPEN) {
      this.browser.send(JSON.stringify(message));
    }
  }
}
