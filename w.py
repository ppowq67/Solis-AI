import asyncio, aiohttp, json, os
from tenacity import retry, stop_after_attempt, wait_exponential
from pydantic import BaseModel
from aiolimiter import AsyncLimiter

class RepoIssue(BaseModel):
    number: int
    title: str
    state: str
    created_at: str
    body: str | None = None

class TurboCrawler:
    def __init__(self, rpm=100, concurrency=50, proxy=None):
        self.limiter = AsyncLimiter(rpm) # 100 requests per minute
        self.sem = asyncio.Semaphore(concurrency)
        self.proxy = proxy

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def fetch_issue(self, session: aiohttp.ClientSession, repo: str, issue_num: int) -> RepoIssue | None:
        url = f"https://api.github.com/repos/{repo}/issues/{issue_num}"
        async with self.limiter, self.sem:
            async with session.get(url, proxy=self.proxy) as r:
                if r.status == 404: return None
                r.raise_for_status()
                data = await r.json()
                return RepoIssue(**data)

    async def crawl(self, repo: str, max_issues=500) -> list[RepoIssue]:
        timeout = aiohttp.ClientTimeout(total=30)
        headers = {"Authorization": f"token {os.getenv('GITHUB_TOKEN')}"} if os.getenv('GITHUB_TOKEN') else {}
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            tasks = [self.fetch_issue(session, repo, i) for i in range(1, max_issues+1)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        issues = [r for r in results if isinstance(r, RepoIssue)]
        with open(f"{repo.replace('/', '_')}_issues.json", "w") as f:
            json.dump([i.model_dump() for i in issues], f, indent=2)
        print(f"Saved {len(issues)} issues to {repo.replace('/', '_')}_issues.json")
        return issues

# Run: export GITHUB_TOKEN=your_token && python this.py
if __name__ == "__main__":
    asyncio.run(TurboCrawler(rpm=120, concurrency=100).crawl("microsoft/TypeScript", max_issues=1000))