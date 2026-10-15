// Fetches every fixture (past and future) for every Newcastle City team on PlayHQ
// and writes them to data.json, which index.html reads. `from`/`to` mark the current
// Wednesday–Tuesday week, which index.html uses as its default view.
//
// Usage:  node scripts/fetch-fixtures.mjs [--out data.json] [--date YYYY-MM-DD]
//   --date  pretend "today" is this date (Sydney time), handy for testing
//
// Needs Node 18+ (built-in fetch). No npm packages.

import { writeFile } from 'node:fs/promises';

const CONFIG = {
  orgId: '2a11b05e',                                            // PlayHQ organisation id (from the club's PlayHQ URL)
  orgSlug: 'newcastle-city-and-eastern-districts-cricket-club', // used to build team links
  tenant: 'cricket-australia',
  timeZone: 'Australia/Sydney',
  api: 'https://api.playhq.com/graphql',
};

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const OUT = args.out || 'data.json';

// ---------- dates (in Sydney time, whatever the runner's clock zone is) ----------
const sydneyToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const TODAY = args.date || sydneyToday();
// The cricket week runs Wednesday to Tuesday (Masters on Wednesday, T20 Bash on Monday).
// Use the Wed–Tue week that contains tomorrow: run on a Tuesday and you get the week
// starting the next day; run on any other day and you get the week in progress.
const tomorrow = addDays(TODAY, 1);
const dow = new Date(tomorrow + 'T00:00:00Z').getUTCDay(); // 0 = Sunday, 3 = Wednesday
const FROM = addDays(tomorrow, -((dow - 3 + 7) % 7));
const TO = addDays(FROM, 6);

// ---------- PlayHQ ----------
const slug = s => (s || 'x').toLowerCase().replace(/&/g, 'and').replace(/[\/.'’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function gq(query, variables, attempt = 1) {
  try {
    const res = await fetch(CONFIG.api, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        tenant: CONFIG.tenant,
        origin: 'https://www.playhq.com',
        referer: 'https://www.playhq.com/',
        'user-agent': 'Mozilla/5.0 (club fixtures page; github actions)',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length && !json.data) throw new Error(json.errors.map(e => e.message).join('; '));
    return json;
  } catch (e) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1500 * attempt));
      return gq(query, variables, attempt + 1);
    }
    throw new Error(`PlayHQ request failed: ${e.message}`);
  }
}

const Q_COMPS = `query($o:ID!){discoverCompetitions(organisationID:$o){name seasons(organisationID:$o){id name endDate}}}`;
const Q_TEAMS = `query($s:ID!,$o:ID!){discoverTeams(filter:{seasonID:$s,organisationID:$o}){id name}}`;
const T = '... on DiscoverTeam{id name} ... on ProvisionalTeam{name}';
const Q_FIX = `query($teamID:ID!){discoverTeamFixture(teamID:$teamID){name grade{name season{name competition{name organisation{name}}}} fixture{games{id date home{${T}} away{${T}} status{name} allocation{time dateTimeList{date time} court{name latitude longitude venue{name address suburb state postcode latitude longitude}}} gameType{name}}}}}`;

async function main() {
  const comps = (await gq(Q_COMPS, { o: CONFIG.orgId })).data?.discoverCompetitions;
  if (!Array.isArray(comps)) throw new Error('Unexpected response for competitions');
  const seasons = comps.flatMap(c => c.seasons).filter(s => s.endDate >= TODAY);

  const teams = [];
  for (const s of seasons) {
    const r = await gq(Q_TEAMS, { s: s.id, o: CONFIG.orgId });
    teams.push(...(r.data?.discoverTeams || []));
  }
  if (!teams.length) throw new Error('No teams found for any current season');

  const games = [], idle = [];
  // a few at a time, to be polite to PlayHQ
  for (let i = 0; i < teams.length; i += 6) {
    await Promise.all(teams.slice(i, i + 6).map(async t => {
      const r = await gq(Q_FIX, { teamID: t.id });
      let anyThisWeek = false, grade = '';
      for (const rd of r.data?.discoverTeamFixture || []) {
        grade = rd.grade.name;
        const se = rd.grade.season, co = se.competition;
        for (const g of rd.fixture?.games || []) {
          const dt = g.allocation?.dateTimeList?.length ? g.allocation.dateTimeList : [{ date: g.date, time: g.allocation?.time }];
          if (dt.some(x => x.date >= FROM && x.date <= TO)) anyThisWeek = true;
          const c = g.allocation?.court, v = c?.venue;
          games.push({
            team: t.name,
            teamUrl: `https://www.playhq.com/${CONFIG.tenant}/org/${CONFIG.orgSlug}/${CONFIG.orgId}/${slug(co.name + ' ' + se.name)}/teams/${slug(t.name)}/${t.id}`,
            grade: rd.grade.name, comp: co.name, assoc: co.organisation.name, round: rd.name, dates: dt,
            home: g.home?.name || 'TBC', away: g.away?.name || 'TBC',
            format: g.gameType?.name, status: g.status?.name,
            gameUrl: `https://www.playhq.com/${CONFIG.tenant}/org/${slug(co.organisation.name)}/${slug(co.name + ' ' + se.name)}/${slug(rd.grade.name)}/game-centre/${g.id}`,
            venue: v?.name || 'TBC', court: c?.name || '',
            address: v ? [v.address, v.suburb, v.state, v.postcode].filter(Boolean).join(', ') : '',
            lat: c?.latitude || v?.latitude, lng: c?.longitude || v?.longitude,
          });
        }
      }
      if (!anyThisWeek) idle.push({ team: t.name, grade });
    }));
  }

  const out = { generated: new Date().toISOString(), today: TODAY, from: FROM, to: TO, games, idle };
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote ${OUT}: ${games.length} games total (week shown: ${FROM} to ${TO}), from ${teams.length} teams.`);
  const tbc = games.filter(g => g.venue === 'TBC' || g.home === 'TBC' || g.away === 'TBC');
  if (tbc.length) console.log(`Note: ${tbc.length} game(s) have a TBC venue or opponent.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
