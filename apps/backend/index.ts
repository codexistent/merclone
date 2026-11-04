import express from "express";
import { PreInterviewBody } from "./types";
import axios from "axios";
import cors from "cors";
import { scrapeGitHub } from "./scrapers/github";
import { prisma } from "./db";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/v1/pre-interview", async (req, res) => {
  const { success, data } = PreInterviewBody.safeParse(req.body);

  if (!success) {
    res.status(411).json({
      message: "Incorrect body",
    });
    return;
  }

  const githubUrl = data.github.endsWith("/")
    ? data.github.slice(0, -1)
    : data.github; // https://github.com/username
  //   const linkedinUrl = data.linkedin.endsWith("/")
  //     ? data.linkedin.slice(0, -1)
  //     : data.linkedin;

  // TODO: url can be supa malformed, maybe use SLM here
  const githubUsername = githubUrl.split("/").pop();
  // const linkedinUsername = linkedinUrl.split("/").pop();

  // GitHub
  const githubData = await scrapeGitHub(githubUsername ?? "guest");

  // TODO: LinkedIn or other accounts

  // interview added to db
  const interview = await prisma.interview.create({
    data: {
      githubMetadata: JSON.stringify(githubData),
      status: "Pre",
    },
  });

  res.json({ id: interview.id });
});

app.listen(3001, () => {
  console.log("Backend running at http://localhost:3001");
});
