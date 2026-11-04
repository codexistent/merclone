import axios from "axios";

export type GithubRepo = {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
};

export async function scrapeGitHub(username: string): Promise<GithubRepo[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "merclone",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // GitHub
  const { data } = await axios.get(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos`,
    { headers, params: { per_page: 30, sort: "pushed" } },
  );

  const filteredUserRepos = data.map((x: any) => ({
    description: x.description,
    name: x.name,
    fullName: x.full_name,
    starCount: x.stargazers_count,
  }));

  return filteredUserRepos;
}
