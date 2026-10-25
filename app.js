const checkButton = document.querySelector('#check-button');
const result = document.querySelector('#result');
const teamOneSelect = document.querySelector('#team-one');
const teamTwoSelect = document.querySelector('#team-two');
const dataStatus = document.querySelector('#data-status');
const comparisonContent = document.querySelector('#comparison-content');
const matchList = document.querySelector('#match-list');
const emptyState = document.querySelector('#empty-state');
const matchesCount = document.querySelector('#match-count');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, (values[index] ?? '').trim()]),
  ));
}

function parseMatchDate(value) {
  const match = value.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day, Number(match[4] || 0), Number(match[5] || 0));
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function getOutcome(match, team) {
  const homeGoals = Number(match.FTHG);
  const awayGoals = Number(match.FTAG);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;
  const goalsFor = match.homeTeam === team ? homeGoals : awayGoals;
  const goalsAgainst = match.homeTeam === team ? awayGoals : homeGoals;
  if (goalsFor > goalsAgainst) return 'win';
  if (goalsFor === goalsAgainst) return 'draw';
  return 'loss';
}

function recordFor(matches, team) {
  return matches.reduce((record, match) => {
    const outcome = getOutcome(match, team);
    if (outcome) record[outcome] += 1;
    return record;
  }, { win: 0, draw: 0, loss: 0 });
}

function formatRate(record) {
  const games = record.win + record.draw + record.loss;
  return games ? `${Math.round((record.win / games) * 1000) / 10}%` : '—';
}

function formatRecord(record) {
  const games = record.win + record.draw + record.loss;
  return `${record.win}勝 ${record.draw}分 ${record.loss}敗 · ${games}試合`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function addCell(row, text, className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  row.append(cell);
}

function updateComparison(matches) {
  const teamOne = teamOneSelect.value;
  const teamTwo = teamTwoSelect.value;
  const headToHead = matches.filter((match) => (
    (match.homeTeam === teamOne && match.awayTeam === teamTwo)
    || (match.homeTeam === teamTwo && match.awayTeam === teamOne)
  ));

  const overall = recordFor(headToHead, teamOne);
  const homeMatches = headToHead.filter((match) => match.homeTeam === teamOne);
  const awayMatches = headToHead.filter((match) => match.awayTeam === teamOne);
  const homeRecord = recordFor(homeMatches, teamOne);
  const awayRecord = recordFor(awayMatches, teamOne);

  document.querySelector('#overall-rate').textContent = formatRate(overall);
  document.querySelector('#overall-record').textContent = formatRecord(overall);
  document.querySelector('#home-rate').textContent = formatRate(homeRecord);
  document.querySelector('#home-record').textContent = formatRecord(homeRecord);
  document.querySelector('#away-rate').textContent = formatRate(awayRecord);
  document.querySelector('#away-record').textContent = formatRecord(awayRecord);
  matchesCount.textContent = `${headToHead.length}試合`;
  matchList.replaceChildren();
  emptyState.hidden = headToHead.length > 0;

  headToHead.forEach((match) => {
    const row = document.createElement('tr');
    const outcome = getOutcome(match, teamOne);
    addCell(row, formatDate(match.date));
    addCell(row, match.Season || '—');
    addCell(row, match.homeTeam);
    addCell(row, `${match.FTHG} - ${match.FTAG}`, 'score');
    addCell(row, match.awayTeam);
    const resultLabel = outcome === 'win' ? '勝利' : outcome === 'draw' ? '引分' : '敗戦';
    addCell(row, `${teamOne} ${resultLabel}`, `result-${outcome}`);
    matchList.append(row);
  });
}

function populateTeamSelects(matches) {
  const teams = [...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]))]
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second, 'en'));
  const initialOne = teams.includes('Arsenal') ? 'Arsenal' : teams[0];
  const initialTwo = teams.includes('Manchester City') ? 'Manchester City' : teams[1];

  function fillSelect(select, selected, excluded) {
    select.replaceChildren();
    teams.filter((team) => team !== excluded).forEach((team) => {
      const option = document.createElement('option');
      option.value = team;
      option.textContent = team;
      option.selected = team === selected;
      select.append(option);
    });
    if (!teams.includes(selected) || selected === excluded) select.selectedIndex = 0;
    select.disabled = false;
  }

  fillSelect(teamOneSelect, initialOne, initialTwo);
  fillSelect(teamTwoSelect, initialTwo, teamOneSelect.value);
}

async function loadScoreData() {
  try {
    const response = await fetch('./data/Score_DB.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const matches = parseCsv(await response.text())
      .map((match) => ({ ...match, date: parseMatchDate(match.matchDate) }))
      .filter((match) => (
        match.date && match.League === 'Premier League'
        && match.homeTeam && match.awayTeam
        && Number.isFinite(Number(match.FTHG)) && Number.isFinite(Number(match.FTAG))
      ))
      .sort((first, second) => second.date - first.date);

    if (matches.length === 0) throw new Error('有効な試合データがありません');
    populateTeamSelects(matches);
    dataStatus.textContent = `${matches.length.toLocaleString('ja-JP')}試合を読み込みました`;
    comparisonContent.hidden = false;
    updateComparison(matches);

    function onTeamChange() {
      if (teamOneSelect.value === teamTwoSelect.value) {
        const options = [...teamTwoSelect.options];
        teamTwoSelect.value = options.find((option) => option.value !== teamOneSelect.value)?.value || '';
      }
      const selectedOne = teamOneSelect.value;
      const selectedTwo = teamTwoSelect.value;
      [...teamOneSelect.options].forEach((option) => { option.disabled = option.value === selectedTwo; });
      [...teamTwoSelect.options].forEach((option) => { option.disabled = option.value === selectedOne; });
      updateComparison(matches);
    }

    teamOneSelect.addEventListener('change', onTeamChange);
    teamTwoSelect.addEventListener('change', onTeamChange);
    onTeamChange();
  } catch (error) {
    dataStatus.textContent = '試合データを読み込めませんでした。ローカルサーバーから開いてください。';
    teamOneSelect.disabled = true;
    teamTwoSelect.disabled = true;
    console.error('Score_DB.csv の読み込みに失敗しました:', error);
  }
}

checkButton.addEventListener('click', () => {
  result.textContent = '動作確認に成功しました';
  result.classList.add('is-visible');
});

loadScoreData();
