// Builds ai-games-newsletter.workflow.json (import into n8n: Workflows → Import from file).
import { readFileSync, writeFileSync } from "node:fs";
const code = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const UA = { sendHeaders: true, headerParameters: { parameters: [{ name: "User-Agent", value: "ai-games-library-newsletter/1.0" }] } };
const http = (id, name, url, y) => ({ id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [660, y],
  executeOnce: true, onError: "continueRegularOutput", parameters: { url: url.includes("{{") ? "=" + url : url, ...UA, options: {} } });
const nodes = [
  { id: "n1", name: "Every Monday 9am", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [220, 300],
    parameters: { rule: { interval: [{ field: "weeks", triggerAtDay: [1], triggerAtHour: 9 }] } } },
  { id: "n2", name: "Read Library Sheet", type: "n8n-nodes-base.googleSheets", typeVersion: 4.5, position: [440, 300], alwaysOutputData: true,
    parameters: { documentId: { __rl: true, mode: "url", value: "PASTE_YOUR_GOOGLE_SHEET_URL" }, sheetName: { __rl: true, mode: "name", value: "Games" }, options: {} } },
  http("n3", "Reddit: top AI game posts", "https://www.reddit.com/r/vibecoding+aigamedev+WebGames+ClaudeAI+ChatGPTCoding+cursor+IndieDev/search.json?q=game%20(vibe%20OR%20claude%20OR%20gemini%20OR%20cursor%20OR%20ai)&restrict_sr=1&sort=top&t=week&limit=100", 160),
  http("n4", "Hacker News: Show HN games", "https://hn.algolia.com/api/v1/search?query=game&tags=show_hn&numericFilters=created_at_i>{{ Math.floor(Date.now()/1000) - 7*86400 }}&hitsPerPage=100", 300),
  http("n5", "Hacker News: vibe coded games", "https://hn.algolia.com/api/v1/search?query=vibe%20coded%20game&numericFilters=created_at_i>{{ Math.floor(Date.now()/1000) - 7*86400 }}&hitsPerPage=100", 440),
  { id: "n6", name: "Combine Sources", type: "n8n-nodes-base.merge", typeVersion: 3, position: [880, 300], parameters: { numberInputs: 3 } },
  { id: "n7", name: "Score + Remove Duplicates", type: "n8n-nodes-base.code", typeVersion: 2, position: [1100, 300], parameters: { jsCode: code("./score.js") } },
  { id: "n8", name: "Add New Games to Sheet", type: "n8n-nodes-base.googleSheets", typeVersion: 4.5, position: [1320, 300],
    parameters: { operation: "append", documentId: { __rl: true, mode: "url", value: "PASTE_YOUR_GOOGLE_SHEET_URL" }, sheetName: { __rl: true, mode: "name", value: "Games" },
      columns: { mappingMode: "autoMapInputData", value: {} }, options: {} } },
  { id: "n9", name: "Build Newsletter", type: "n8n-nodes-base.code", typeVersion: 2, position: [1540, 300], parameters: { jsCode: code("./newsletter.js") } },
  { id: "n10", name: "Send Newsletter (Gmail)", type: "n8n-nodes-base.gmail", typeVersion: 2.1, position: [1760, 300], webhookId: "ai-games-newsletter",
    parameters: { sendTo: "PASTE_RECIPIENTS_OR_YOUR_EMAIL", subject: "={{ $json.subject }}", emailType: "html", message: "={{ $json.html }}", options: {} } },
  { id: "n11", name: "Setup notes", type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: [180, -40],
    parameters: { width: 620, height: 200, content: "## AI Game Library — weekly newsletter\n1. Make a Google Sheet with a tab named **Games** (columns: name, url, discussion, source, engagement, comments, viralScore, foundOn, status). Import games/top100.csv into it to seed the library.\n2. Paste the sheet URL into both Google Sheets nodes and connect your Google account.\n3. Connect Gmail and set recipients (or swap the last node for Beehiiv / Buttondown / Telegram / Discord).\n4. Run once manually, then turn the workflow **Active**." } },
];
const link = (to, index = 0) => ({ node: to, type: "main", index });
const connections = {
  "Every Monday 9am": { main: [[link("Read Library Sheet")]] },
  "Read Library Sheet": { main: [[link("Reddit: top AI game posts"), link("Hacker News: Show HN games"), link("Hacker News: vibe coded games")]] },
  "Reddit: top AI game posts": { main: [[link("Combine Sources", 0)]] },
  "Hacker News: Show HN games": { main: [[link("Combine Sources", 1)]] },
  "Hacker News: vibe coded games": { main: [[link("Combine Sources", 2)]] },
  "Combine Sources": { main: [[link("Score + Remove Duplicates")]] },
  "Score + Remove Duplicates": { main: [[link("Add New Games to Sheet")]] },
  "Add New Games to Sheet": { main: [[link("Build Newsletter")]] },
  "Build Newsletter": { main: [[link("Send Newsletter (Gmail)")]] },
};
writeFileSync(new URL("./ai-games-newsletter.workflow.json", import.meta.url),
  JSON.stringify({ name: "AI Game Library — Weekly Newsletter", nodes, connections, settings: { executionOrder: "v1" }, pinData: {} }, null, 2));
console.log("written");
