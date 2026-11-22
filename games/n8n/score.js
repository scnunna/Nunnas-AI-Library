// n8n Code node: normalise Reddit + HN + itch posts, score them, drop ones already in the library sheet.
const known = new Set($('Read Library Sheet').all().map(i => String(i.json.url || i.json.playUrl || '').toLowerCase()).filter(Boolean));
const AI = /(vibe ?cod|claude|chatgpt|gpt-?\d|codex|cursor|gemini|grok|lovable|bolt\.new|replit|rosebud|websim|made with ai|ai[- ]built|ai[- ]generated|one[- ]shot)/i;
const GAME = /(game|play|arcade|puzzle|shooter|platformer|roguelike|idle|racing|flight|simulator|rpg|tower defense)/i;
const out = [];
const add = (title, url, link, src, score, comments, created) => {
  const text = `${title}`;
  if (!AI.test(text) || !GAME.test(text)) return;
  const key = String(url || link).toLowerCase();
  if (!key || known.has(key)) return;
  known.add(key);
  // Viral score (0-100): reach (log-scaled engagement) + discussion + freshness
  const reach = Math.min(60, Math.log10(1 + score) * 20);           // 1k upvotes/points = 60
  const talk = Math.min(25, Math.log10(1 + comments) * 10);         // ~300 comments = 25
  const ageDays = (Date.now() - created) / 864e5;
  const fresh = Math.max(0, 15 - ageDays * 2);                       // new this week = up to 15
  out.push({ json: { name: title.slice(0, 120), url: url || link, discussion: link, source: src,
    engagement: score, comments, viralScore: Math.round(reach + talk + fresh),
    foundOn: new Date().toISOString().slice(0, 10), status: 'new — review' } });
};
for (const item of $input.all()) {
  const j = item.json;
  // Reddit listing
  for (const c of (j.data?.children || [])) {
    const d = c.data; add(d.title, d.is_self ? null : d.url, 'https://www.reddit.com' + d.permalink, 'reddit r/' + d.subreddit, d.score || 0, d.num_comments || 0, d.created_utc * 1000);
  }
  // Hacker News (Algolia)
  for (const h of (j.hits || [])) add(h.title, h.url, 'https://news.ycombinator.com/item?id=' + h.objectID, 'hacker news', h.points || 0, h.num_comments || 0, h.created_at_i * 1000);
}
out.sort((a, b) => b.json.viralScore - a.json.viralScore);
return out.slice(0, 15);
