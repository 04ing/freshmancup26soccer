/* Excel 导出工具（依赖 vendor/xlsx.full.min.js） */
(function (global) {
    function ready() {
        if (typeof global.XLSX === 'undefined') {
            alert('导出组件尚未加载完成，请刷新页面后重试');
            return false;
        }
        return true;
    }

    function buildSheet(aoa, cols) {
        const ws = global.XLSX.utils.aoa_to_sheet(aoa);
        if (cols && cols.length) {
            ws['!cols'] = cols.map(w => ({ wch: w }));
        }
        return ws;
    }

    // 单工作表导出
    function exportAoa(filename, sheetName, aoa, cols) {
        exportSheets(filename, [{ name: sheetName, aoa: aoa, cols: cols }]);
    }

    // 多工作表导出，sheets: [{ name, aoa, cols }]
    function exportSheets(filename, sheets) {
        if (!ready()) return;
        if (!sheets || !sheets.length) {
            alert('没有可导出的数据');
            return;
        }
        const wb = global.XLSX.utils.book_new();
        sheets.forEach(function (s) {
            const name = (s.name || 'Sheet1').replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Sheet1';
            global.XLSX.utils.book_append_sheet(wb, buildSheet(s.aoa, s.cols), name);
        });
        global.XLSX.writeFile(wb, filename);
    }

    // 把一张 <table> 转成二维数组
    function tableToAoa(table) {
        const aoa = [];
        table.querySelectorAll('tr').forEach(function (tr) {
            const row = Array.prototype.map.call(tr.children, function (cell) {
                return cell.textContent.replace(/\s+/g, ' ').trim();
            });
            const hasText = row.some(function (c) { return c !== ''; });
            if (row.length && hasText) aoa.push(row);
        });
        return aoa;
    }

    global.WCExcel = { exportAoa: exportAoa, exportSheets: exportSheets, tableToAoa: tableToAoa };
})(window);
