import axios from "axios";

export async function scrapeGitHub(username: string) {
  // GitHub
  const userRepos = await axios.get(
    `https://api.github.com/users/${username}/repos`,
  );
  const filteredUserRepos = userRepos.data.map((x: any) => ({
    description: x.description,
    name: x.name,
    fullName: x.full_name,
    starCount: x.stargazers_count,
  }));

  console.log(filteredUserRepos);
}
