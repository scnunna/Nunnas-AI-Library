// n8n Code node: turn this week's new finds into an HTML newsletter (one item out).
const games = $input.all().map(i => i.json);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const week = new Date().toISOString().slice(0, 10);
const rows = games.map((g, n) => `
  <tr><td style="padding:12px 0;border-bottom:1px solid #eee">
    <div style="font:600 16px system-ui">${n + 1}. <a href="${esc(g.url)}" style="color:#5b3df5">${esc(g.name)}</a></div>
    <div style="font:13px system-ui;color:#666">Viral score ${g.viralScore} · ${g.engagement} upvotes/points · ${g.comments} comments · via ${esc(g.source)}
      · <a href="${esc(g.discussion)}" style="color:#666">discussion</a></div>
  </td></tr>`).join('');
const html = `<div style="max-width:600px;margin:auto;font-family:system-ui">
  <h1 style="font-size:22px">🎮 AI Game Library — week of ${week}</h1>
  <p style="color:#444">The ${games.length} most-talked-about free, AI-built browser games we found this week. All free to play in your browser.</p>
  <table width="100%" cellspacing="0">${rows || '<tr><td>No new games this week — see the full Top 100 library.</td></tr>'}</table>
  <p style="font-size:12px;color:#888">Ranked by viral score: upvotes/points (log-scaled), comment count and freshness.</p></div>`;
return [{ json: { subject: `🎮 ${games.length} viral AI-built browser games this week (${week})`, html } }];
