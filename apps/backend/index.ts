import { createServer } from "node:http";
import express from "express";
import { parseGithubUsername, PreInterviewBody } from "./types";
import axios from "axios";
import cors from "cors";
import { scrapeGitHub } from "./scrapers/github";
import { prisma } from "./db";
import { WebSocketServer } from "ws";
import { InterviewBridge } from "./liveSession";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(express.json());
app.use(cors({ origin: FRONTEND_ORIGIN }));

// listen for interview requests
app.post("/api/v1/pre-interview", async (req, res) => {
  const body = PreInterviewBody.safeParse(req.body);
  const username = body.success ? parseGithubUsername(body.data.github) : null;

  if (!username) {
    res.status(400).json({ message: "Enter a valid Github URL." });
    return;
  }

  try {
    const githubMetadata = await scrapeGitHub(username);

    // add interview to db
    const interview = await prisma.interview.create({
      data: { githubMetadata },
    });

    res.json({ id: interview.id });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      res.status(404).json({ message: "Github user does not exist." });
      return;
    }
    console.error("pre-interview failed: ", error);
    res.status(502).json({ message: "Could not read Github profile." });
  }

  // TODO: LinkedIn or other accounts
});

// listen for interview results
app.get("/api/v1/result/:interviewId", async (req, res) => {
  const interview = await prisma.interview.findUnique({
    where: { id: req.params.interviewId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!interview) {
    res.status(404).json({ message: "Interview not found" });
    return;
  }

  // return interview results
  res.json({
    status: interview.status,
    score: interview.score,
    feedback: interview.feedback,
    transcript: interview.messages.map((m) => ({
      type: m.type,
      content: m.message,
      createdAt: m.createdAt,
    })),
  });
});

const server = createServer(app);
const sockets = new WebSocketServer({ noServer: true });

// upgrade connection to websocket and starts up interview
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const interviewId = url.pathname.match(/^\/ws\/interview\/([\w-]+)$/)?.[1];

  if (!interviewId || req.headers.origin !== FRONTEND_ORIGIN) {
    socket.destroy();
    return;
  }

  sockets.handleUpgrade(req, socket, head, (ws) => {
    new InterviewBridge(ws, interviewId);
  });
});

server.listen(3001, () => {
  console.log("Backend running at http://localhost:3001");
});
