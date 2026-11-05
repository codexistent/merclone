import z from "zod";

const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export const PreInterviewBody = z.object({
  // linkedin: z.string(),
  github: z.string().trim().min(1),
});

export function parseGithubUsername(input: string): string | null {
  const withoutHost = input
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?github\.com\//i, "");

  const username = withoutHost.split(/[/?#]/)[0] ?? "";
  return GITHUB_USERNAME.test(username) ? username : null;
}
