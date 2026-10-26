let currentType = 'all';
let allMatches = [];
let matchData = {};
let homeRoster = [];
let awayRoster = [];

const POSITIONS = ['GK', 'DF', 'MF', 'FW'];
const POSITION_NAMES = { GK: '门将', DF: '后卫', MF: '中场', FW: '前锋' };

document.addEventListener('DOMContentLoaded', async function() {
    initMobileMenu();
    await loadMatches();
    await loadAllRosterData();
    populateMatchSelect();
});

function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    if (!toggle || !mobileNav) return;
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        mobileNav.classList.toggle('active');
    });
}

async function loadMatches() {
    try {
        const response = await fetch('/api/matches/all');
        if (response.ok) {
            allMatches = await response.json();
        }
    } catch (e) {
        console.error('加载比赛数据失败:', e);
    }
}

function populateMatchSelect() {
    const select = document.getElementById('matchSelect');
    if (!select) return;
    
    const filtered = currentType === 'all'
        ? allMatches
        : allMatches.filter(m => m.type === currentType);
    
    select.innerHTML = '<option value="">-- 请选择比赛 --</option>';
    filtered.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.date || ''} ${m.home} VS ${m.away} (${m.group || ''})`;
        select.appendChild(opt);
    });
}

function filterMatches(type) {
    currentType = type;
    document.querySelectorAll('.tab-group .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
    });
    populateMatchSelect();
    resetForm();
    loadAllRosterData();
}

function filterByDate() {
    const dateVal = document.getElementById('dateFilter').value;
    const select = document.getElementById('matchSelect');
    const filtered = currentType === 'all'
        ? allMatches
        : allMatches.filter(m => m.type === currentType);
    
    let result = filtered;
    if (dateVal) {
        const simplified = dateVal.split('-');
        const targetStr = `${parseInt(simplified[1])}月${parseInt(simplified[2])}日`;
        result = filtered.filter(m => m.date && m.date.includes(targetStr));
    }
    
    select.innerHTML = '<option value="">-- 请选择比赛 --</option>';
    result.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.date || ''} ${m.home} VS ${m.away} (${m.group || ''})`;
        select.appendChild(opt);
    });
}

function resetForm() {
    document.getElementById('entryFormContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    matchData = {};
    homeRoster = [];
    awayRoster = [];
}

async function onMatchChange() {
    const select = document.getElementById('matchSelect');
    const matchId = select.value;
    if (!matchId) {
        resetForm();
        return;
    }
    
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    matchData = match;
    
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('entryFormContainer').style.display = 'block';
    
    document.getElementById('homeTeam').value = match.home;
    document.getElementById('awayTeam').value = match.away;
    document.getElementById('roundInput').value = match.group || '';
    document.getElementById('matchNo').value = match.matchNo || '';
    document.getElementById('matchDate').value = convertDate(match.date);
    document.getElementById('matchTime').value = match.time || '';
    document.getElementById('matchVenue').value = match.venue || '';
    
    // 切换比赛时清空裁判员和球衣颜色，等待重新填写
    ['referee', 'assistant1', 'assistant2', 'fourthOfficial'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['homeJerseyTop', 'homeJerseyShorts', 'homeJerseySocks',
     'homeGKTop', 'homeGKShorts', 'homeGKSocks',
     'awayJerseyTop', 'awayJerseyShorts', 'awayJerseySocks',
     'awayGKTop', 'awayGKShorts', 'awayGKSocks'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    // 更新球队大名单下拉默认选中项
    populateTeamSelects();
    
    await loadTeamRosters(match.home, match.away);
}

function convertDate(dateStr) {
    if (!dateStr) return '';
    const match = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
    if (match) {
        return `2026-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    }
    return '';
}

function formatDateCN(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

let allTeamNames = [];
let allRosterData = {}; // { '队名': [{name,number}, ...] }
let pickerSide = 'home';   // 'home' | 'away'
let pickerSelection = new Set(); // key: `${teamName}::${playerIdx}`
let pickerCollapsedTeams = new Set();

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadAllRosterData() {
    try {
        const res = await fetch(`/api/rosters?type=${currentType}`);
        if (!res.ok) return;
        const data = await res.json();
        allRosterData = data || {};
        allTeamNames = Object.keys(allRosterData).sort();
    } catch (e) {
        console.error('加载大名单失败:', e);
        allRosterData = {};
        allTeamNames = [];
    }
}

// 弹窗打开
function openRosterPicker(side) {
    pickerSide = side;
    const modal = document.getElementById('rosterPickerModal');
    const titleEl = document.getElementById('rosterPickerTitle');
    titleEl.textContent = `从大名单选择球员 → 导入到${side === 'home' ? '主队' : '客队'}名单`;
    modal.style.display = 'flex';
    pickerSelection.clear();
    document.getElementById('rosterPickerSearch').value = '';
    renderPicker();
    updatePickerSelectedCount();
}

function closeRosterPicker() {
    const modal = document.getElementById('rosterPickerModal');
    if (modal) modal.style.display = 'none';
}

function togglePickerGroup(expandAll) {
    const groups = document.querySelectorAll('#rosterPickerBody .picker-team-group');
    groups.forEach(g => {
        const teamName = g.dataset.team;
        if (expandAll) {
            g.classList.remove('collapsed');
            pickerCollapsedTeams.delete(teamName);
        } else {
            g.classList.add('collapsed');
            pickerCollapsedTeams.add(teamName);
        }
    });
}

function toggleOneGroup(teamName, evt) {
    // 避免点复选框时触发
    if (evt && evt.target && evt.target.closest('input,label')) return;
    const group = document.querySelector(`.picker-team-group[data-team="${cssEscape(teamName)}"]`);
    if (!group) return;
    if (group.classList.toggle('collapsed')) {
        pickerCollapsedTeams.add(teamName);
    } else {
        pickerCollapsedTeams.delete(teamName);
    }
}

function cssEscape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\'+c); }

function filterPickerPlayers() {
    const kw = (document.getElementById('rosterPickerSearch')?.value || '').trim().toLowerCase();
    const body = document.getElementById('rosterPickerBody');
    if (!body) return;

    allTeamNames.forEach(team => {
        const group = body.querySelector(`.picker-team-group[data-team="${cssEscape(team)}"]`);
        if (!group) return;
        const players = allRosterData[team] || [];
        let visibleInTeam = 0;
        players.forEach((p, idx) => {
            const key = `${team}::${idx}`;
            const lab = group.querySelector(`.picker-player-list label[data-key="${cssEscape(key)}"]`);
            if (!lab) return;
            const match = !kw || (p.name && p.name.toLowerCase().includes(kw)) || String(p.number||'').includes(kw);
            lab.classList.toggle('picker-player-hidden', !match);
            if (match) visibleInTeam++;
        });
        // 没匹配到就整组隐藏
        group.style.display = (!kw || visibleInTeam > 0) ? '' : 'none';
    });
}

function updatePickerSelectedCount() {
    const el = document.getElementById('pickerSelectedCount');
    if (el) el.textContent = pickerSelection.size;
}

function togglePickerPlayer(key, checked) {
    if (checked) pickerSelection.add(key);
    else pickerSelection.delete(key);
    updatePickerSelectedCount();
}

function togglePickerTeamAll(teamName, checked) {
    const players = allRosterData[teamName] || [];
    players.forEach((_, idx) => {
        const key = `${teamName}::${idx}`;
        if (checked) pickerSelection.add(key);
        else pickerSelection.delete(key);
    });
    // 重渲染整组checkbox同步状态
    renderPickerGroupPlayers(teamName);
    updatePickerSelectedCount();
}

function renderPicker() {
    const body = document.getElementById('rosterPickerBody');
    if (!body) return;
    if (!allTeamNames.length) {
        body.innerHTML = '<div style="text-align:center;color:#888;padding:40px;">暂无可用大名单数据</div>';
        return;
    }
    body.innerHTML = allTeamNames.map(team => {
        const players = allRosterData[team] || [];
        const collapsed = pickerCollapsedTeams.has(team);
        return `
        <div class="picker-team-group ${collapsed ? 'collapsed' : ''}" data-team="${escapeHtml(team)}">
            <div class="picker-team-head" onclick="toggleOneGroup('${escapeAttr(team)}', event)">
                <div class="team-left">
                    <input type="checkbox" onclick="event.stopPropagation(); togglePickerTeamAll('${escapeAttr(team)}', this.checked)" onchange="event.stopPropagation()">
                    <span class="team-name">${escapeHtml(team)}</span>
                    <span class="team-count">(${players.length} 人)</span>
                </div>
                <span class="picker-toggle-arrow">▼</span>
            </div>
            <div class="picker-player-list" id="picker-list-${sanitizeId(team)}">
                ${renderPickerPlayerList(team)}
            </div>
        </div>`;
    }).join('');
}

function sanitizeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

function renderPickerPlayerList(team) {
    const players = allRosterData[team] || [];
    if (!players.length) return '<div style="color:#aaa;font-size:12px;padding:6px;">暂无球员</div>';
    return players.map((p, idx) => {
        const key = `${team}::${idx}`;
        const checked = pickerSelection.has(key) ? 'checked' : '';
        return `
        <label data-key="${escapeAttr(key)}">
            <input type="checkbox" ${checked} onchange="togglePickerPlayer('${escapeAttr(key)}', this.checked)">
            <span class="picker-player-num">${escapeHtml(p.number || '')}</span>
            <span>${escapeHtml(p.name || '')}</span>
        </label>`;
    }).join('');
}

function renderPickerGroupPlayers(team) {
    const box = document.getElementById(`picker-list-${sanitizeId(team)}`);
    if (!box) return;
    box.innerHTML = renderPickerPlayerList(team);
}

function confirmPickerImport() {
    if (pickerSelection.size === 0) {
        alert('请至少选择 1 名球员');
        return;
    }
    // 收集
    const selected = [];
    const teamCount = {};
    pickerSelection.forEach(key => {
        const [team, idxStr] = key.split('::');
        const idx = parseInt(idxStr, 10);
        const list = allRosterData[team] || [];
        const p = list[idx];
        if (!p) return;
        teamCount[team] = (teamCount[team] || 0) + 1;
        selected.push({
            number: p.number || '',
            name: p.name || '',
            position: '',
            isCaptain: false,
            isGK: false
        });
    });
    // 排序：按号码
    selected.sort((a,b) => (parseInt(a.number)||999) - (parseInt(b.number)||999));

    const replaceMode = document.getElementById('pickerReplaceMode').checked;
    const side = pickerSide;
    const tbodyId = side === 'home' ? 'homeRosterBody' : 'awayRosterBody';
    if (side === 'home') {
        homeRoster = replaceMode ? selected : [...homeRoster, ...selected];
        renderRosterTable(tbodyId, homeRoster);
    } else {
        awayRoster = replaceMode ? selected : [...awayRoster, ...selected];
        renderRosterTable(tbodyId, awayRoster);
    }

    // 若选中的球员全部（或绝大多数）来自同一支真实球队，且当前输入的是占位符(如A1/77W等)，则自动替换队名
    const entries = Object.entries(teamCount).sort((a,b) => b[1]-a[1]);
    if (entries.length > 0) {
        const topTeam = entries[0][0];
        const topTeamCount = entries[0][1];
        const total = selected.length;
        // 如果该队球员占导入球员的一半以上，就认定为来自这支队
        if (topTeamCount / total >= 0.5) {
            const inputEl = document.getElementById(side === 'home' ? 'homeTeam' : 'awayTeam');
            const current = (inputEl?.value || '').trim();
            if (current && isPlaceholderTeamName(current)) {
                inputEl.value = topTeam;
                // 同步刷新名单标题显示
                const titleEl = document.getElementById(side === 'home' ? 'homeRosterTitle' : 'awayRosterTitle');
                if (titleEl) titleEl.textContent = topTeam + ' 名单';
                // 同步 matchData
                if (side === 'home') matchData.home = topTeam;
                else matchData.away = topTeam;
            }
        }
    }

    alert(`已导入 ${selected.length} 名球员到${side === 'home' ? '主队' : '客队'}名单`);
    closeRosterPicker();
}

// 判定队名是不是淘汰赛占位符（短、无汉字、大写字母+数字组合）
function isPlaceholderTeamName(name) {
    if (!name) return false;
    // 包含汉字的不算占位符
    if (/[\u4e00-\u9fa5]/.test(name)) return false;
    // 常见形态：单字母+1-2位数字(A1, B2, H11)，或双字母+数字(B2:1)，或"77W"这类混合
    return /^[A-Z]?\d+[A-Z]?(:\d+)?$/.test(name) ||
           (name.length <= 4 && /^[A-Z0-9:]+$/.test(name));
}

async function loadTeamRosters(homeTeam, awayTeam) {
    // 小组占位符(如 "A1"/"F2")不做强求，404 时置空即可，不抛控制台 error
    async function loadOne(team) {
        try {
            if (!team) return null;
            const r = await fetch(`/api/rosters?team=${encodeURIComponent(team)}`);
            if (!r.ok) return null;
            return await r.json();
        } catch (e) {
            return null;
        }
    }
    const [homeData, awayData] = await Promise.all([
        loadOne(homeTeam),
        loadOne(awayTeam)
    ]);
    const toList = (d) => (d && d.players) ? d.players.map(p => ({
        number: p.number || '',
        name: p.name || '',
        position: '',
        isCaptain: false,
        isGK: false
    })) : [];

    homeRoster = toList(homeData);
    awayRoster = toList(awayData);
    renderRosters();
}

// 向后兼容：保留空实现，避免旧HTML残留引用
function populateTeamSelects() {}
function importRosterForTeam() {
    alert('请点击各名单右上角的「从大名单导入…」按钮手动选择球员');
}

function guessPosition(player) {
    const num = parseInt(player.number);
    if (num === 1 || num === 22 || num === 23) return 'GK';
    if (player.name && player.name.includes('GK')) return 'GK';
    if (player.name && player.name.includes('门将')) return 'GK';
    return 'MF';
}

function renderRosters() {
    renderRosterTable('homeRosterBody', homeRoster);
    renderRosterTable('awayRosterBody', awayRoster);
    
    document.getElementById('homeRosterTitle').textContent = matchData.home + ' 名单';
    document.getElementById('awayRosterTitle').textContent = matchData.away + ' 名单';
}

function renderRosterTable(tbodyId, roster) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    roster.sort((a, b) => {
        const na = parseInt(a.number) || 999;
        const nb = parseInt(b.number) || 999;
        return na - nb;
    });
    
    tbody.innerHTML = roster.map((p, i) => `
        <tr data-index="${i}">
            <td style="text-align:center;"><input type="text" value="${p.number}" onchange="updatePlayer('${tbodyId}', ${i}, 'number', this.value)"></td>
            <td style="text-align:center;">
                <input type="text" value="${p.name}" onchange="updatePlayer('${tbodyId}', ${i}, 'name', this.value)">
            </td>
            <td style="text-align:center;"><input type="checkbox" ${p.isCaptain ? 'checked' : ''} onchange="togglePlayerFlag('${tbodyId}', ${i}, 'isCaptain', this.checked)"></td>
            <td style="text-align:center;"><input type="checkbox" ${p.isGK ? 'checked' : ''} onchange="togglePlayerFlag('${tbodyId}', ${i}, 'isGK', this.checked)"></td>
            <td style="text-align:center;"><button class="btn-delete" onclick="removePlayer('${tbodyId}', ${i})">删除</button></td>
        </tr>
    `).join('');
}

function updatePlayer(tbodyId, index, field, value) {
    const roster = tbodyId === 'homeRosterBody' ? homeRoster : awayRoster;
    if (roster[index]) {
        roster[index][field] = value;
    }
}

function togglePlayerFlag(tbodyId, index, field, value) {
    const roster = tbodyId === 'homeRosterBody' ? homeRoster : awayRoster;
    if (roster[index]) {
        roster[index][field] = value;
        if (field === 'isGK' && value) {
            roster[index].position = 'GK';
            renderRosterTable(tbodyId, roster);
        }
    }
}

function removePlayer(tbodyId, index) {
    if (tbodyId === 'homeRosterBody') {
        homeRoster.splice(index, 1);
        renderRosterTable(tbodyId, homeRoster);
    } else {
        awayRoster.splice(index, 1);
        renderRosterTable(tbodyId, awayRoster);
    }
}

function manualAddPlayer(team) {
    const newPlayer = {
        number: '',
        name: '',
        position: 'MF',
        isCaptain: false,
        isGK: false
    };
    
    if (team === 'home') {
        homeRoster.push(newPlayer);
        renderRosterTable('homeRosterBody', homeRoster);
    } else {
        awayRoster.push(newPlayer);
        renderRosterTable('awayRosterBody', awayRoster);
    }
}

function clearRosters() {
    if (confirm('确定清空所有名单吗？')) {
        homeRoster = [];
        awayRoster = [];
        renderRosterTable('homeRosterBody', homeRoster);
        renderRosterTable('awayRosterBody', awayRoster);
    }
}

function collectFormData() {
    return {
        title: document.getElementById('matchTitle').value,
        homeTeam: document.getElementById('homeTeam').value,
        awayTeam: document.getElementById('awayTeam').value,
        round: document.getElementById('roundInput').value,
        matchNo: document.getElementById('matchNo').value,
        date: document.getElementById('matchDate').value,
        time: document.getElementById('matchTime').value,
        city: document.getElementById('matchCity').value,
        venue: document.getElementById('matchVenue').value,
        referee: document.getElementById('referee').value,
        assistant1: document.getElementById('assistant1').value,
        assistant2: document.getElementById('assistant2').value,
        fourthOfficial: document.getElementById('fourthOfficial').value,
        homeColors: {
            top: document.getElementById('homeJerseyTop').value,
            shorts: document.getElementById('homeJerseyShorts').value,
            socks: document.getElementById('homeJerseySocks').value,
            gkTop: document.getElementById('homeGKTop').value,
            gkShorts: document.getElementById('homeGKShorts').value,
            gkSocks: document.getElementById('homeGKSocks').value
        },
        awayColors: {
            top: document.getElementById('awayJerseyTop').value,
            shorts: document.getElementById('awayJerseyShorts').value,
            socks: document.getElementById('awayJerseySocks').value,
            gkTop: document.getElementById('awayGKTop').value,
            gkShorts: document.getElementById('awayGKShorts').value,
            gkSocks: document.getElementById('awayGKSocks').value
        },
        homeCoach: document.getElementById('homeCoach').value,
        awayCoach: document.getElementById('awayCoach').value,
        homeRoster: homeRoster,
        awayRoster: awayRoster
    };
}

function generatePrintHTML(data) {
    const MAX_ROWS_HARD = 22;
    const homeLen = (data.homeRoster || []).length;
    const awayLen = (data.awayRoster || []).length;
    // 行数取两队中较长者，且限制不超过22；但最小有5行，避免太空
    const MAX_ROWS = Math.max(5, Math.min(MAX_ROWS_HARD, Math.max(homeLen, awayLen)));

    // A4: 297mm 总高，上下边距各5mm → 可用 287mm
    // 固定区域（标题/球队行/比赛信息/裁判/球衣/教练/备注/签名）估算约 95mm
    const PAGE_USABLE = 287;
    const FIXED_HEIGHT = 95;
    const availableForTable = PAGE_USABLE - FIXED_HEIGHT;  // ~192mm
    // 表头高度
    const thH = Math.min(11, Math.max(8, Math.floor(availableForTable / MAX_ROWS * 0.4)));
    // 行高 = (可用高度 - 表头) / 行数，限制在 7~14mm 之间
    const rowH = Math.min(14, Math.max(7, Math.floor((availableForTable - thH) / MAX_ROWS)));
    function padRoster(rows) {
        const result = (rows || []).slice(0, MAX_ROWS);
        while (result.length < MAX_ROWS) {
            result.push({ number: '', name: '', isCaptain: false, isGK: false, _empty: true });
        }
        return result;
    }
    const homePadded = padRoster(data.homeRoster);
    const awayPadded = padRoster(data.awayRoster);
    
    const dateStr = formatDateCN(data.date);
    
    const style = `
        @page {
            size: A4 portrait;
            margin: 5mm 5mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
            margin: 0;
            padding: 0;
        }
        body {
            width: 100%;
            max-width: 200mm;
            margin: 0 auto;
            font-family: "SimSun", "宋体", "Microsoft YaHei", sans-serif;
            color: #000;
            font-size: 10.5px;
            line-height: 1.2;
        }
        .entry-form {
            width: 100%;
            border: 1.5px solid #000;
        }
        .form-title {
            text-align: center;
            font-weight: bold;
            padding: 4px 8px 3px 8px;
            border-bottom: 1.5px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .form-title .logo-img {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .form-title .title-text {
            display: flex;
            flex-direction: column;
            line-height: 1.15;
        }
        .form-title .title-main {
            font-size: 15px;
            font-weight: bold;
        }
        .form-title .title-sub {
            font-size: 9.5px;
            font-weight: normal;
            color: #333;
        }
        .teams-row {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            border-bottom: 1px solid #000;
        }
        .teams-row .team-cell {
            padding: 3px 6px;
            text-align: center;
            font-weight: bold;
            font-size: 12px;
        }
        .teams-row .vs-cell {
            padding: 3px 10px;
            font-weight: bold;
            font-size: 12px;
            background: #f5f5f5;
            border-left: 1px solid #000;
            border-right: 1px solid #000;
        }
        .match-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            border-bottom: 1px solid #000;
        }
        .match-info .cell {
            border-right: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 2.5px 5px;
            font-size: 9px;
            text-align: center;
        }
        .match-info .cell:nth-child(3n) { border-right: none; }
        .match-info .cell:nth-last-child(-n+3) { border-bottom: none; }
        .match-info .label { color: #555; font-size: 8px; margin-bottom: 1px; }
        .match-info .value { font-weight: bold; font-size: 10px; }
        .referee-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            border-bottom: 1px solid #000;
        }
        .referee-row .ref-cell {
            padding: 2.5px 5px;
            border-right: 1px solid #000;
            font-size: 9px;
            text-align: center;
        }
        .referee-row .ref-cell:last-child { border-right: none; }
        .referee-row .ref-cell .val { font-weight: bold; font-size: 10px; }
        .colors-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-bottom: 1px solid #000;
        }
        .colors-block { padding: 2px 6px; font-size: 8px; line-height: 1.3; }
        .colors-block.home-colors { border-right: 1px solid #000; }
        .colors-block .color-title { font-weight: bold; font-size: 9px; margin-bottom: 1px; }
        .colors-block .color-row { margin: 0.8px 0; }
        .roster-section {
            border-bottom: 1px solid #000;
        }
        .roster-team-head {
            display: grid;
            grid-template-columns: 1fr 1fr;
            background: #eaeaea;
            border-bottom: 1px solid #000;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
            padding: 2px 0;
        }
        .roster-team-head div:first-child { border-right: 1px solid #000; }
        .roster-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .roster-table th,
        .roster-table td {
            border: 1px solid #000;
            padding: 0;
            margin: 0;
            text-align: center;
            vertical-align: middle;
            font-size: 12px;
            line-height: 1.1;
            height: ${rowH}mm;
        }
        .roster-table th {
            background: #f0f0f0;
            font-size: 11px;
            font-weight: bold;
            height: ${thH}mm;
            line-height: 1.1;
        }
        .roster-table td.name-cell .tag {
            font-size: 9px;
            color: #c8102e;
            font-weight: bold;
            margin-left: 2px;
        }
        .roster-coach-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border: 1px solid #000;
            border-top: none;
            font-size: 11px;
        }
        .roster-coach-row div {
            padding: 2.5px 5px;
            text-align: center;
        }
        .roster-coach-row div:first-child { border-right: 1px solid #000; }
        .roster-coach-row .val { font-weight: bold; margin-left: 2px; }
        .notes-row {
            padding: 2px 6px;
            border-bottom: 1px solid #000;
            font-size: 7.5px;
            color: #333;
            text-align: center;
        }
        .score-row {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            padding: 4px 8px;
            border-bottom: 1px solid #000;
            font-size: 11px;
            font-weight: bold;
        }
        .score-row .score-team {
            text-align: center;
            font-size: 10px;
        }
        .score-row .score-team:first-child { text-align: right; padding-right: 4px; }
        .score-row .score-team:last-child { text-align: left; padding-left: 4px; }
        .score-row .score-mid {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .score-row .score-num {
            display: inline-block;
            min-width: 22px;
            text-align: center;
            font-size: 14px;
            padding: 1px 3px;
        }
        .score-row .score-sep { font-size: 12px; }
        .signature-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            font-size: 9px;
        }
        .sig-cell {
            padding: 2px 6px 1px 6px;
            border-right: 1px solid #000;
            text-align: center;
        }
        .sig-cell:last-child { border-right: none; }
        .sig-cell .lbl { font-weight: bold; margin-bottom: 1px; }
        .sig-cell .sig-line {
            margin-top: 5mm;
            padding-top: 1px;
            font-size: 8px;
            text-align: center;
            min-height: 2em;
        }
    `;
    
    return `
    <style>${style}</style>
    <div class="entry-form">
        <div class="form-title">
            <img class="logo-img" src="/static/img/whufa-logo.jpg" alt="WHUFA Logo">
            <div class="title-text">
                <span class="title-main">${data.title}</span>
                <span class="title-sub">比赛名单</span>
            </div>
        </div>
        
        <div class="teams-row">
            <div class="team-cell">${data.homeTeam}</div>
            <div class="vs-cell">VS</div>
            <div class="team-cell">${data.awayTeam}</div>
        </div>
        
        <div class="match-info">
            <div class="cell"><div class="label">轮次</div><div class="value">${data.round || ''}</div></div>
            <div class="cell"><div class="label">场序</div><div class="value">${data.matchNo || ''}</div></div>
            <div class="cell"><div class="label">日期</div><div class="value">${dateStr}</div></div>
            <div class="cell"><div class="label">开球时间</div><div class="value">${data.time || ''}</div></div>
            <div class="cell"><div class="label">城市</div><div class="value">${data.city || ''}</div></div>
            <div class="cell"><div class="label">场地</div><div class="value">${data.venue || ''}</div></div>
        </div>
        
        <div class="referee-row">
            <div class="ref-cell">裁判员：<div class="val">${data.referee || ''}</div></div>
            <div class="ref-cell">第一助理：<div class="val">${data.assistant1 || ''}</div></div>
            <div class="ref-cell">第二助理：<div class="val">${data.assistant2 || ''}</div></div>
            <div class="ref-cell">第四官员：<div class="val">${data.fourthOfficial || ''}</div></div>
        </div>
        
        <div class="colors-section">
            <div class="colors-block home-colors">
                <div class="color-title">主队球衣颜色</div>
                <div class="color-row">上衣：${data.homeColors.top || ''}　短裤：${data.homeColors.shorts || ''}　袜子：${data.homeColors.socks || ''}</div>
                <div class="color-row">守门员上衣：${data.homeColors.gkTop || ''}　短裤：${data.homeColors.gkShorts || ''}　袜子：${data.homeColors.gkSocks || ''}</div>
            </div>
            <div class="colors-block">
                <div class="color-title">客队球衣颜色</div>
                <div class="color-row">上衣：${data.awayColors.top || ''}　短裤：${data.awayColors.shorts || ''}　袜子：${data.awayColors.socks || ''}</div>
                <div class="color-row">守门员上衣：${data.awayColors.gkTop || ''}　短裤：${data.awayColors.gkShorts || ''}　袜子：${data.awayColors.gkSocks || ''}</div>
            </div>
        </div>
        
        <div class="roster-section">
            <div class="roster-team-head">
                <div>主队名单</div>
                <div>客队名单</div>
            </div>
            <div class="roster-table-wrap">
                <table class="roster-table">
                    <colgroup>
                        <col style="width:5%"><col style="width:16%"><col style="width:4%"><col style="width:4%"><col style="width:4%"><col style="width:10%"><col style="width:3.5%"><col style="width:3.5%">
                        <col style="width:5%"><col style="width:16%"><col style="width:4%"><col style="width:4%"><col style="width:4%"><col style="width:10%"><col style="width:3.5%"><col style="width:3.5%">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>号码</th><th>姓名</th><th>首发</th><th>替补</th><th>换人</th><th>进球时间</th><th>黄牌</th><th>红牌</th>
                            <th>号码</th><th>姓名</th><th>首发</th><th>替补</th><th>换人</th><th>进球时间</th><th>黄牌</th><th>红牌</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({length: MAX_ROWS}, (_, i) => {
                            const hp = homePadded[i] || {};
                            const ap = awayPadded[i] || {};
                            const htag = [hp.isCaptain ? '(C)' : '', hp.isGK ? 'GK' : ''].filter(Boolean).join(' ');
                            const atag = [ap.isCaptain ? '(C)' : '', ap.isGK ? 'GK' : ''].filter(Boolean).join(' ');
                            const hname = (hp.name || '') + (htag ? '<span class="tag">'+htag+'</span>' : '');
                            const aname = (ap.name || '') + (atag ? '<span class="tag">'+atag+'</span>' : '');
                            return `<tr>
                                <td>${hp.number || ''}</td>
                                <td class="name-cell">${hname}</td>
                                <td></td><td></td><td></td><td></td><td></td><td></td>
                                <td>${ap.number || ''}</td>
                                <td class="name-cell">${aname}</td>
                                <td></td><td></td><td></td><td></td><td></td><td></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="roster-coach-row">
                <div>主教练：<span class="val">${data.homeCoach || ''}</span></div>
                <div>主教练：<span class="val">${data.awayCoach || ''}</span></div>
            </div>
        </div>
        
        <div class="notes-row">注：首发、替补、换人、进球时间、黄牌、红牌栏请比赛现场填写；(C)队长，GK守门员</div>
        
        <div class="score-row">
            <div class="score-team">${data.homeTeam || ''}</div>
            <div class="score-mid">
                <span class="score-num">${data.homeScore !== undefined ? data.homeScore : ''}</span>
                <span class="score-sep">:</span>
                <span class="score-num">${data.awayScore !== undefined ? data.awayScore : ''}</span>
            </div>
            <div class="score-team">${data.awayTeam || ''}</div>
        </div>
        
        <div class="signature-row">
            <div class="sig-cell">
                <div class="lbl">主队负责人签字：</div>
                <div class="sig-line"></div>
            </div>
            <div class="sig-cell">
                <div class="lbl">裁判员签字：</div>
                <div class="sig-line"></div>
            </div>
            <div class="sig-cell">
                <div class="lbl">客队负责人签字：</div>
                <div class="sig-line"></div>
            </div>
        </div>
    </div>`;
}

function previewPrint() {
    const data = collectFormData();
    const contentHTML = generatePrintHTML(data);
    const fullHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${data.homeTeam} VS ${data.awayTeam} 比赛报名表</title></head><body>${contentHTML}</body></html>`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(fullHTML);
    printWindow.document.close();
    printWindow.onload = function() {
        setTimeout(function() { printWindow.print(); }, 300);
    };
}