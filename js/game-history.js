/**
 * 游戏历史记录模块
 * 负责管理和显示游戏历史记录
 */

class GameHistory {
    constructor() {
        this.history = [];
        this.maxRecords = 200; // 最多保存200条记录
        this.stateSnapshots = []; // 保存游戏状态快照
        this.maxSnapshots = 50; // 最多保存50个状态快照
    }
    
    // 保存游戏状态快照（在操作前调用）
    saveStateSnapshot() {
        if (!window.gameState) return;
        
        const snapshot = {
            id: this.generateId(),
            timestamp: Date.now(),
            players: JSON.parse(JSON.stringify(window.gameState.players)),
            game: JSON.parse(JSON.stringify(window.gameState.game)),
            settings: JSON.parse(JSON.stringify(window.gameState.settings))
        };
        
        this.stateSnapshots.unshift(snapshot);
        
        // 限制快照数量
        if (this.stateSnapshots.length > this.maxSnapshots) {
            this.stateSnapshots = this.stateSnapshots.slice(0, this.maxSnapshots);
        }
        
        this.saveToStorage();
    }
    
    // 检查是否可以撤回
    canUndo() {
        return this.history.length > 0 && this.stateSnapshots.length > 0;
    }
    
    // 撤回最新操作
    undoLastOperation() {
        if (!this.canUndo()) {
            throw new Error('没有可撤回的操作');
        }
        
        if (!window.gameState) {
            throw new Error('游戏状态不可用');
        }
        
        // 获取最新的历史记录和对应的状态快照
        const lastRecord = this.history[0];
        const lastSnapshot = this.stateSnapshots[0];
        
        if (!lastSnapshot) {
            throw new Error('找不到对应的状态快照');
        }
        
        // 恢复游戏状态
        window.gameState.players = JSON.parse(JSON.stringify(lastSnapshot.players));
        window.gameState.game = JSON.parse(JSON.stringify(lastSnapshot.game));
        window.gameState.settings = JSON.parse(JSON.stringify(lastSnapshot.settings));
        
        // 移除最新的历史记录和快照
        const removedRecord = this.history.shift();
        this.stateSnapshots.shift();
        
        // 保存状态并更新UI
        window.gameState.saveToStorage();
        window.gameState.updateUI();
        
        // 更新UI控制器状态
        if (window.uiController) {
            window.uiController.updateBankerDisplay();
            window.uiController.updateXiangGongDisplay();
        }
        
        // 保存更新后的历史记录
        this.saveToStorage();
        
        return {
            undoneRecord: removedRecord,
            restoredSnapshot: lastSnapshot
        };
    }
    
    // 获取最新操作的描述（用于确认对话框）
    getLastOperationDescription() {
        if (this.history.length === 0) return null;
        
        const lastRecord = this.history[0];
        return {
            description: this.getRecordDescription(lastRecord),
            timestamp: lastRecord.datetime,
            type: lastRecord.type
        };
    }
    
    // 添加记录
    addRecord(record) {
        const timestamp = Date.now();
        const formattedRecord = {
            id: this.generateId(),
            timestamp: timestamp,
            datetime: new Date(timestamp).toLocaleString('zh-CN'),
            ...record
        };
        
        this.history.unshift(formattedRecord);
        
        // 限制记录数量
        if (this.history.length > this.maxRecords) {
            this.history = this.history.slice(0, this.maxRecords);
        }
        
        this.saveToStorage();
        
        // 触发历史记录更新事件
        this.dispatchHistoryUpdateEvent();
    }
    
    // 触发历史记录更新事件
    dispatchHistoryUpdateEvent() {
        const event = new CustomEvent('historyUpdated', {
            detail: {
                canUndo: this.canUndo(),
                lastOperation: this.getLastOperationDescription()
            }
        });
        document.dispatchEvent(event);
    }
    
    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // 获取所有记录
    getAllRecords() {
        return [...this.history];
    }
    
    // 获取指定玩家的记录
    getPlayerRecords(playerPosition) {
        return this.history.filter(record => {
            return record.winner === playerPosition || 
                   (record.payers && record.payers.includes(playerPosition)) ||
                   (record.player === playerPosition);
        });
    }
    
    // 获取指定类型的记录
    getRecordsByType(type) {
        return this.history.filter(record => record.type === type);
    }
    
    // 获取今日记录
    getTodayRecords() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        
        return this.history.filter(record => record.timestamp >= todayTimestamp);
    }
    
    // 获取本局记录
    getCurrentRoundRecords() {
        if (!window.gameState) return [];
        
        const currentRound = window.gameState.game;
        return this.history.filter(record => {
            return record.round && 
                   record.round.wind === currentRound.wind && 
                   record.round.round === currentRound.round;
        });
    }
    
    // 格式化记录用于显示
    formatRecord(record) {
        const formatted = {
            id: record.id,
            datetime: record.datetime,
            round: this.formatRoundInfo(record.round),
            description: this.getRecordDescription(record),
            scoreChanges: record.scoreChanges || []
        };
        
        return formatted;
    }
    
    // 格式化圈局信息
    formatRoundInfo(round) {
        if (!round) return '未知';
        
        if (window.ruleSystem && window.ruleSystem.formatRound) {
            return window.ruleSystem.formatRound(round.wind, round.round);
        }
        
        const windNames = { east: '东', south: '南', west: '西', north: '北' };
        return `${windNames[round.wind] || round.wind}${round.round}局`;
    }
    
    // 获取记录描述
    getRecordDescription(record) {
        const getPlayerName = (position) => {
            return window.gameState?.players[position]?.name || position;
        };
        
        switch (record.type) {
            case 'win':
                const winner = getPlayerName(record.winner);
                const winType = record.winType === '自摸' ? '自摸' : '';
                let description = `${winner} ${winType}和牌`;
                
                if (record.fanCount && record.fuCount) {
                    description += ` (${record.fanCount}翻${record.fuCount}副)`;
                } else if (record.fanCount) {
                    description += ` (${record.fanCount}翻)`;
                }
                
                if (record.payers && record.payers.length > 0) {
                    const payers = record.payers.map(getPlayerName).join('、');
                    description += ` - ${payers}出铳`;
                }
                
                return description;
                
            case 'draw':
                return '流局';
                
            case 'fraud':
                const fraudPlayer = getPlayerName(record.player);
                return `${fraudPlayer} 诈胡`;
                
            case 'xiangGong':
                const xiangGongPlayer = getPlayerName(record.player);
                const xiangGongAction = record.isXiangGong ? '设为相公' : '取消相公';
                return `${xiangGongPlayer} ${xiangGongAction}`;
                
            case 'nameChange':
                return `${record.oldName} 改名为 ${record.newName}`;
                
            case 'roundChange':
                const oldRound = this.formatRoundInfo(record.oldRound);
                const newRound = this.formatRoundInfo(record.newRound);
                return `手动设置圈局：${oldRound} → ${newRound}`;
                
            case 'scoreAdjust':
                const adjustPlayer = getPlayerName(record.player);
                const change = record.change > 0 ? `+${record.change}` : record.change;
                return `${adjustPlayer} 分数调整 ${change}`;
                
            default:
                return '未知操作';
        }
    }
    
    // 计算统计信息
    calculateStatistics(playerPosition = null) {
        const records = playerPosition ? this.getPlayerRecords(playerPosition) : this.getAllRecords();
        
        const stats = {
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            frauds: 0,
            winRate: 0,
            averageScore: 0,
            bestWin: null,
            worstLoss: null,
            winTypes: { 自摸: 0, 和牌: 0 },
            fanDistribution: {},
            dailyStats: {}
        };
        
        records.forEach(record => {
            const date = new Date(record.timestamp).toDateString();
            if (!stats.dailyStats[date]) {
                stats.dailyStats[date] = { games: 0, wins: 0, score: 0 };
            }
            stats.dailyStats[date].games++;
            
            switch (record.type) {
                case 'win':
                    stats.totalGames++;
                    if (!playerPosition || record.winner === playerPosition) {
                        stats.wins++;
                        stats.dailyStats[date].wins++;
                        if (record.winType === '自摸') stats.winTypes.自摸++;
                        else stats.winTypes.和牌++;
                        
                        if (record.fanCount) {
                            stats.fanDistribution[record.fanCount] = 
                                (stats.fanDistribution[record.fanCount] || 0) + 1;
                        }
                    } else if (record.payers && record.payers.includes(playerPosition)) {
                        stats.losses++;
                    }
                    break;
                    
                case 'draw':
                    stats.totalGames++;
                    stats.draws++;
                    break;
                    
                case 'fraud':
                    stats.frauds++;
                    if (!playerPosition || record.player === playerPosition) {
                        stats.losses++;
                    }
                    break;
            }
            
            // 分数变化统计
            if (record.scoreChanges && playerPosition) {
                const playerChange = record.scoreChanges.find(c => c.player === playerPosition);
                if (playerChange) {
                    stats.dailyStats[date].score += playerChange.change;
                    
                    if (playerChange.change > 0 && (!stats.bestWin || playerChange.change > stats.bestWin.score)) {
                        stats.bestWin = { score: playerChange.change, record: record };
                    }
                    if (playerChange.change < 0 && (!stats.worstLoss || playerChange.change < stats.worstLoss.score)) {
                        stats.worstLoss = { score: playerChange.change, record: record };
                    }
                }
            }
        });
        
        stats.winRate = stats.totalGames > 0 ? (stats.wins / stats.totalGames * 100) : 0;
        
        return stats;
    }
    
    // 导出记录为JSON
    exportToJSON() {
        const exportData = {
            exportTime: new Date().toISOString(),
            recordCount: this.history.length,
            records: this.history
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    // 导出记录为CSV
    exportToCSV() {
        const headers = ['时间', '圈局', '类型', '描述', '玩家', '分数变化'];
        const rows = [headers];
        
        this.history.forEach(record => {
            const formatted = this.formatRecord(record);
            if (record.scoreChanges && record.scoreChanges.length > 0) {
                record.scoreChanges.forEach(change => {
                    const playerName = window.gameState?.players[change.player]?.name || change.player;
                    rows.push([
                        formatted.datetime,
                        formatted.round,
                        record.type,
                        formatted.description,
                        playerName,
                        change.change
                    ]);
                });
            } else {
                rows.push([
                    formatted.datetime,
                    formatted.round,
                    record.type,
                    formatted.description,
                    '',
                    ''
                ]);
            }
        });
        
        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }
    
    // 从JSON导入记录
    importFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.records && Array.isArray(data.records)) {
                this.history = data.records;
                this.saveToStorage();
                return true;
            }
        } catch (e) {
            console.error('导入失败:', e);
        }
        return false;
    }
    
    // 清空记录
    clearHistory() {
        this.history = [];
        this.stateSnapshots = [];
        this.saveToStorage();
        this.dispatchHistoryUpdateEvent();
    }
    
    // 删除指定记录
    deleteRecord(recordId) {
        this.history = this.history.filter(record => record.id !== recordId);
        this.saveToStorage();
    }
    
    // 保存到本地存储
    saveToStorage() {
        try {
            localStorage.setItem('mahjong-history', JSON.stringify(this.history));
            localStorage.setItem('mahjong-state-snapshots', JSON.stringify(this.stateSnapshots));
        } catch (e) {
            console.error('保存历史记录失败:', e);
        }
    }
    
    // 从本地存储加载
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('mahjong-history');
            if (saved) {
                this.history = JSON.parse(saved);
            }
            
            const savedSnapshots = localStorage.getItem('mahjong-state-snapshots');
            if (savedSnapshots) {
                this.stateSnapshots = JSON.parse(savedSnapshots);
            }
        } catch (e) {
            console.error('加载历史记录失败:', e);
            this.history = [];
            this.stateSnapshots = [];
        }
    }
    
    // 搜索记录
    searchRecords(query) {
        const lowerQuery = query.toLowerCase();
        return this.history.filter(record => {
            const description = this.getRecordDescription(record).toLowerCase();
            const round = this.formatRoundInfo(record.round).toLowerCase();
            return description.includes(lowerQuery) || round.includes(lowerQuery);
        });
    }
    
    // 获取记录统计摘要
    getSummary() {
        const totalRecords = this.history.length;
        const todayRecords = this.getTodayRecords().length;
        const winRecords = this.getRecordsByType('win').length;
        const drawRecords = this.getRecordsByType('draw').length;
        const fraudRecords = this.getRecordsByType('fraud').length;
        
        return {
            totalRecords,
            todayRecords,
            winRecords,
            drawRecords,
            fraudRecords,
            lastRecord: this.history[0] || null
        };
    }
}

// 创建全局游戏历史实例
window.gameHistory = new GameHistory();

// 页面加载时从存储加载历史记录
document.addEventListener('DOMContentLoaded', () => {
    window.gameHistory.loadFromStorage();
    
    // 初始化完成后触发历史记录更新事件
    setTimeout(() => {
        window.gameHistory.dispatchHistoryUpdateEvent();
    }, 100);
});
