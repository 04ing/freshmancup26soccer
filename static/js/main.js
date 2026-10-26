/**
 * 2026武汉大学足协杯网站前端交互脚本
 */

// API基础路径
const API_BASE = '';

// ==================== 工具函数 ====================

function normalizeTeamName(name) {
    if (!name) return '';
    let result = String(name).trim();
    result = result.replace(/^[A-Z]组[-_\s]*/, '');
    result = result.replace(/队$/, '');
    result = result.replace(/\([A-Z]\d\)/g, '');
    result = result.replace(/\s+/g, '');
    return result.trim();
}

function findMatchScore(scores, homeTeam, awayTeam) {
    if (!scores || !homeTeam || !awayTeam) return null;
    
    const normHome = normalizeTeamName(homeTeam);
    const normAway = normalizeTeamName(awayTeam);
    
    for (const [key, score] of Object.entries(scores)) {
        const normScoreHome = normalizeTeamName(score.home_team);
        const normScoreAway = normalizeTeamName(score.away_team);
        
        if (normScoreHome === normHome && normScoreAway === normAway) {
            return score;
        }
        if (normScoreHome === normAway && normScoreAway === normHome) {
            return {
                home_team: score.away_team,
                home_score: score.away_score,
                away_team: score.home_team,
                away_score: score.home_score,
                penalty: score.penalty ? {
                    home: score.penalty.away,
                    away: score.penalty.home
                } : null
            };
        }
    }
    
    return null;
}

function findMatchReport(reports, homeTeam, awayTeam) {
    if (!reports || !homeTeam || !awayTeam) return null;
    
    const normHome = normalizeTeamName(homeTeam);
    const normAway = normalizeTeamName(awayTeam);
    
    for (const [key, report] of Object.entries(reports)) {
        const normReportHome = normalizeTeamName(report.home_team);
        const normReportAway = normalizeTeamName(report.away_team);
        
        if (normReportHome === normHome && normReportAway === normAway) {
            return report;
        }
        if (normReportHome === normAway && normReportAway === normHome) {
            return {
                ...report,
                home_team: report.away_team,
                away_team: report.home_team
            };
        }
    }
    
    return null;
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}/api${endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// ==================== 管理口令（可选鉴权） ====================
// 当服务端设置了 ADMIN_TOKEN 时，数据写接口需要携带 x-admin-token。
// 这里统一封装：自动附加已保存的口令；若返回 401 则弹出一次输入框并缓存，随后重试。
// 未启用鉴权时（默认）authHeaders 返回空对象，行为与原来一致。
function getAdminToken() {
    try { return localStorage.getItem('adminToken') || ''; } catch (e) { return ''; }
}

function authHeaders() {
    const t = getAdminToken();
    return t ? { 'x-admin-token': t } : {};
}

async function apiFetch(url, options = {}) {
    options.headers = Object.assign({}, options.headers, authHeaders());
    if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData) && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    let res = await fetch(url, options);
    if (res.status === 401) {
        const t = prompt('此操作需要管理口令，请输入：');
        if (t) {
            try { localStorage.setItem('adminToken', t); } catch (e) {}
            options.headers = Object.assign({}, options.headers, authHeaders());
            res = await fetch(url, options);
        }
    }
    return res;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth()+1}月${date.getDate()}日`;
}

// ==================== 页面初始化 ====================

document.addEventListener('DOMContentLoaded', async function() {
    // 初始化AI助手（全局）
    initAIAssistant();
    
    // 初始化移动端菜单（全局）
    initMobileMenu();
    
    // 只在首页执行以下代码
    if (document.getElementById('resultsTrack')) {
        loadLatestResults();
        loadFeaturedReports();
        loadStandingsPreview();
        loadScorersPreview();
    }
});

// ==================== 最新赛果 ====================

async function loadLatestResults() {
    const container = document.getElementById('resultsTrack');
    
    try {
        const [matchesRes, reportsRes] = await Promise.all([
            fetch('/api/matches/all?_=' + Date.now(), { cache: 'no-cache' }),
            fetch('/api/reports?_=' + Date.now(), { cache: 'no-cache' })
        ]);
        const matches = await matchesRes.json();
        const reports = await reportsRes.json();
        
        if (!Array.isArray(matches) || matches.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#4a4a5a;padding:40px;">暂无比赛数据</p>';
            return;
        }

        // 构建 matchId -> 战报比分 映射
        const reportScoreMap = {};
        for (const r of reports) {
            if (r.matchId && r.homeScore !== undefined && r.awayScore !== undefined) {
                reportScoreMap[r.matchId] = { homeScore: r.homeScore, awayScore: r.awayScore };
            }
        }

        // 解析比分：优先用战报比分，其次用赛程自带比分
        const processed = matches.map((m, idx) => {
            let homeScore = '--', awayScore = '--';
            let status = 'upcoming';

            const reportScore = reportScoreMap[m.id];
            if (reportScore) {
                homeScore = reportScore.homeScore;
                awayScore = reportScore.awayScore;
                status = 'finished';
            } else if (m.score && m.score.includes(':')) {
                const parts = m.score.split(':');
                homeScore = parts[0].trim();
                awayScore = parts[1].trim();
                if (homeScore !== '' && awayScore !== '') status = 'finished';
            }
            // 赛程顺序号（赛程表场次编号），用于按赛程倒序排列
            const orderNum = parseInt(m.matchNo, 10);
            return { ...m, homeScore, awayScore, status, orderNum: isNaN(orderNum) ? idx + 1 : orderNum };
        });

        // 只展示已完赛的比赛，按赛程顺序倒序（赛程最后的在前）
        const finished = processed
            .filter(m => m.status === 'finished')
            .sort((a, b) => b.orderNum - a.orderNum);

        const latestMatches = finished.slice(0, 10);

        if (latestMatches.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#4a4a5a;padding:40px;">暂无已完赛比赛</p>';
            return;
        }

        container.innerHTML = latestMatches.map(match => `
            <div class="result-card" onclick="window.location.href='reports.html'">
                <div class="result-header">
                    <span class="result-date">${match.date || ''}</span>
                    <span class="result-status status-${match.status}">${match.group || ''}</span>
                </div>
                <div class="result-match">
                    <span class="team-name">${escapeHtml(match.home)}</span>
                    <div class="score-box">
                        <span class="score-num">${match.homeScore}</span>
                        <span class="score-divider">-</span>
                        <span class="score-num">${match.awayScore}</span>
                    </div>
                    <span class="team-name">${escapeHtml(match.away)}</span>
                </div>
            </div>
        `).join('');
    } catch(e) {
        console.error('加载最新赛果失败:', e);
        container.innerHTML = '<p style="text-align:center;color:#4a4a5a;">加载失败</p>';
    }
}

function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
}

// ==================== 焦点战报 ====================

async function loadFeaturedReports() {
    const container = document.getElementById('featuredReports');
    
    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();
        
        if (!Array.isArray(reports) || reports.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#4a4a5a;padding:40px;">暂无战报，请到战报中心上传</p>';
            return;
        }

        // 按上传时间倒序，取最新6场
        reports.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        const topReports = reports.slice(0, 6);
        
        container.innerHTML = topReports.map(report => `
            <div class="report-card" onclick="window.location.href='${report.id}.html'">
                <div class="report-image">⚽</div>
                <div class="report-body">
                    <h3 class="report-title">${escapeHtml(report.title)}</h3>
                    <p style="color: #4a4a5a; font-size: 14px; margin-bottom: 12px;">${escapeHtml((report.content || '').substring(0, 100))}...</p>
                    <div class="report-meta">
                        <span>📅 ${formatDate(report.uploadedAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch(e) {
        console.error('加载焦点战报失败:', e);
        container.innerHTML = '<p style="text-align:center;color:#4a4a5a;padding:40px;">暂无战报</p>';
    }
}

// ==================== 积分榜预览 ====================

async function loadStandingsPreview() {
    const container = document.getElementById('standingsPreview');
    
    try {
        const response = await fetch('/api/standings/live');
        const data = await response.json();
        
        if (!data.groups || Object.keys(data.groups).length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#4a4a5a;padding:40px;">暂无积分数据，比赛开始后将更新</p>';
            return;
        }

        // 收集所有球队，按积分排序取前5
        let allTeams = [];
        for (const [group, teams] of Object.entries(data.groups)) {
            if (Array.isArray(teams)) {
                teams.forEach(t => allTeams.push({ ...t, group }));
            }
        }
        allTeams.sort((a, b) => (b.points || 0) - (a.points || 0) || (b.gd || 0) - (a.gd || 0));
        const topTeams = allTeams.slice(0, 5);
        
        if (topTeams.length > 0) {
            container.innerHTML = `
                <table class="standings-table">
                    <thead>
                        <tr>
                            <th>排名</th>
                            <th class="team-col">球队</th>
                            <th>场次</th>
                            <th>胜</th>
                            <th>平</th>
                            <th>负</th>
                            <th>进球</th>
                            <th>失球</th>
                            <th>净胜球</th>
                            <th class="points-col">积分</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topTeams.map((team, idx) => `
                            <tr class="${idx < 3 ? 'rank-' + (idx + 1) : ''}">
                                <td>${idx + 1}</td>
                                <td class="team-col">${escapeHtml(team.team || '')}</td>
                                <td>${team.played ?? 0}</td>
                                <td>${team.won ?? 0}</td>
                                <td>${team.drawn ?? 0}</td>
                                <td>${team.lost ?? 0}</td>
                                <td>${team.gf ?? 0}</td>
                                <td>${team.ga ?? 0}</td>
                                <td>${team.gd > 0 ? '+' : ''}${team.gd ?? 0}</td>
                                <td class="points-col">${team.points ?? 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            container.innerHTML = '<p style="text-align:center;color:#4a4a5a;">暂无数据</p>';
        }
    } catch(e) {
        console.error('加载积分榜预览失败:', e);
        container.innerHTML = '<p style="text-align:center;color:#4a4a5a;">加载失败</p>';
    }
}

// ==================== 射手榜预览 ====================

async function loadScorersPreview() {
    const container = document.getElementById('scorersPreview');
    
    try {
        const response = await fetch('/api/scorers/live');
        const data = await response.json();
        
        const scorers = (data && data.scorers) ? data.scorers : [];
        
        if (scorers.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#4a4a5a;padding:40px;">暂无射手榜数据，比赛开始后将更新</p>';
            return;
        }

        const displayScorers = scorers.slice(0, 5);
        
        container.innerHTML = `
            <div class="scorers-list">
                ${displayScorers.map((scorer, idx) => `
                    <div class="scorer-item">
                        <span class="scorer-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span>
                        <div class="scorer-info">
                            <span class="scorer-name">${escapeHtml(scorer.name || '')}</span>
                            <span class="scorer-team">${escapeHtml(scorer.team || '')}</span>
                        </div>
                        <span class="scorer-goals">${scorer.goals || 0}球</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch(e) {
        console.error('加载射手榜预览失败:', e);
        container.innerHTML = '<p style="text-align:center;color:#4a4a5a;">加载失败</p>';
    }
}

// ==================== AI助手 ====================

function initAIAssistant() {
    const trigger = document.getElementById('aiTrigger');
    const panel = document.getElementById('aiPanel');
    const closeBtn = document.getElementById('aiClose');
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSend');
    const messages = document.getElementById('aiMessages');
    
    if (!trigger || !panel) return;
    
    trigger.addEventListener('click', () => {
        panel.classList.add('active');
    });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.classList.remove('active');
        });
    }
    
    if (sendBtn && input && messages) {
        sendBtn.addEventListener('click', sendAIMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAIMessage();
        });
    }
}

function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const messages = document.getElementById('aiMessages');
    const message = input.value.trim();
    
    if (!message) return;
    
    messages.innerHTML += `
        <div class="ai-message ai-user">
            <p>${message}</p>
        </div>
    `;
    
    input.value = '';
    
    fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            messages.innerHTML += `
                <div class="ai-message ai-response">
                    <p>⚠️ ${data.error}</p>
                </div>
            `;
        } else {
            messages.innerHTML += `
                <div class="ai-message ai-response">
                    <p>${data.reply}</p>
                </div>
            `;
        }
        messages.scrollTop = messages.scrollHeight;
    })
    .catch(err => {
        messages.innerHTML += `
            <div class="ai-message ai-response">
                <p>⚠️ 网络错误，请稍后重试</p>
            </div>
        `;
    });
}

function askAI(question) {
    document.getElementById('aiInput').value = question;
    sendAIMessage();
}

// ==================== 大名单查询 ====================

async function queryTeamRoster(teamName) {
    const url = `/api/rosters?team=${encodeURIComponent(teamName)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            return { success: false, message: data.error };
        }
        
        return {
            success: true,
            team: data.team,
            players: data.players
        };
    } catch (error) {
        console.error('查询大名单失败:', error);
        return { success: false, message: '查询失败，请稍后重试' };
    }
}

async function loadAllRosters() {
    try {
        const response = await fetch('/api/rosters');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('加载大名单失败:', error);
        return {};
    }
}

function askRoster(teamName) {
    document.getElementById('aiInput').value = `${teamName}的大名单有哪些球员？`;
    sendAIMessage();
}

// ==================== 导航链接激活 ====================

document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === window.location.pathname) {
        link.classList.add('active');
    } else {
        link.classList.remove('active');
    }
});

function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    
    if (!toggle || !mobileNav) return;
    
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        mobileNav.classList.toggle('active');
    });
    
    document.querySelectorAll('.mobile-nav .nav-link').forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            mobileNav.classList.remove('active');
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
            toggle.classList.remove('active');
            mobileNav.classList.remove('active');
        }
    });
}