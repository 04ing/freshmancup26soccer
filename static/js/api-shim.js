/* 静态站点数据适配：把 /api/... 请求映射到本地 data/*.json */
(function () {
    var nativeFetch = window.fetch.bind(window);

    function toLocalPath(url) {
        var clean = String(url).split('?')[0].replace(/^https?:\/\/[^/]+/, '');
        if (clean.indexOf('/api/') !== 0) return null;
        var map = {
            '/api/matches/all': 'data/matches.json',
            '/api/reports': 'data/reports.json',
            '/api/match-events': 'data/match-events.json',
            '/api/scorers/live': 'data/scorers.json',
            '/api/cards/live': 'data/cards.json',
            '/api/standings/live': 'data/standings.json',
            '/api/rosters': 'data/rosters.json',
            '/api/teams': 'data/teams.json',
            '/api/referees': 'data/referees.json',
            '/api/stats/summary': 'data/stats.json'
        };
        if (map[clean]) return map[clean];
        var m = clean.match(/^\/api\/reports\/([^/]+)$/);
        if (m) return 'data/r_' + decodeURIComponent(m[1]) + '.json';
        m = clean.match(/^\/api\/referees\/([^/]+)$/);
        if (m) return 'data/ref_' + decodeURIComponent(m[1]) + '.json';
        m = clean.match(/^\/api\/match-events\/([^/]+)$/);
        if (m) return 'data/ev_' + decodeURIComponent(m[1]) + '.json';
        return null;
    }

    window.fetch = function (url, options) {
        var method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';
        if (method !== 'GET') {
            return Promise.resolve(new Response(JSON.stringify({ success: false, error: '静态站点不支持在线修改' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            }));
        }

        var local = toLocalPath(url);
        if (!local) return nativeFetch(url, options);

        // 球队大名单按 team 参数过滤
        var query = String(url).split('?')[1] || '';
        var teamParam = /(?:^|&)team=([^&]*)/.exec(query);
        if (teamParam && local === 'data/rosters.json') {
            var team = decodeURIComponent(teamParam[1]);
            return nativeFetch(local).then(function (res) { return res.json(); }).then(function (all) {
                var list = all[team] || [];
                return new Response(JSON.stringify(list), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            });
        }

        return nativeFetch(local);
    };
})();
