interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

interface RepoFile {
  path: string;
  content: string;
}

const GITHUB_API = "https://api.github.com";

async function githubFetch(path: string, token: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "linear-agents-worker",
    },
  });
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  token: string,
  branch = "main",
): Promise<GitHubTreeItem[]> {
  const res = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token,
  );
  if (!res.ok) {
    throw new Error(`GitHub tree fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tree: GitHubTreeItem[] };
  return data.tree.filter((item) => item.type === "blob");
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
  branch = "main",
): Promise<string> {
  const res = await githubFetch(
    `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    token,
  );
  if (!res.ok) {
    throw new Error(`GitHub file fetch failed for ${path}: ${res.status}`);
  }
  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding === "base64") {
    return atob(data.content);
  }
  return data.content;
}

export async function fetchMultipleFiles(
  owner: string,
  repo: string,
  paths: string[],
  token: string,
  branch = "main",
): Promise<RepoFile[]> {
  const results: RepoFile[] = [];
  const capped = paths.slice(0, 50);
  const settled = await Promise.allSettled(
    capped.map(async (path) => {
      const content = await fetchFileContent(owner, repo, path, token, branch);
      return { path, content };
    }),
  );
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
  }
  return results;
}

export function selectRelevantFiles(
  tree: GitHubTreeItem[],
  keywords: string[],
  maxFiles = 50,
): string[] {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  const scored = tree
    .filter((item) => {
      const ext = item.path.split(".").pop()?.toLowerCase();
      return ["ts", "tsx", "js", "jsx", "md", "json", "sql", "toml", "yaml", "yml"].includes(ext ?? "");
    })
    .map((item) => {
      const lowerPath = item.path.toLowerCase();
      let score = 0;
      for (const kw of lowerKeywords) {
        if (lowerPath.includes(kw)) score += 10;
      }
      if (lowerPath.includes("readme")) score += 5;
      if (lowerPath.includes("package.json")) score += 3;
      if (lowerPath.endsWith(".sql")) score += 2;
      if (item.size && item.size > 50000) score -= 5;
      return { path: item.path, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxFiles).map((item) => item.path);
}
