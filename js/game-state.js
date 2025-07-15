/**
 * 游戏状态管理模块
 * 负责管理游戏的核心状态，包括玩家信息、分数、圈局等
 */

class GameState {
    constructor() {
        this.settings = {
            ruleSystem: 'japanese', // 当前规则系统
            initialScore: 25000,    // 起始分数
            targetScore: 30000,     // 目标分数
            minScore: 0            // 最低分数限制
        };
        
        this.players = {
            east: { name: '东家', score: this.settings.initialScore, wind: '东', position: 'east', isBanker: true, isXiangGong: false },
            south: { name: '北家', score: this.settings.initialScore, wind: '北', position: 'south', isBanker: false, isXiangGong: false },
            west: { name: '西家', score: this.settings.initialScore, wind: '西', position: 'west', isBanker: false, isXiangGong: false },
            north: { name: '南家', score: this.settings.initialScore, wind: '南', position: 'north', isBanker: false, isXiangGong: false }
        };
        
        this.game = {
            round: 1,        // 当前局数 (1-4)
            wind: 'east',    // 当前圈风 (east, south, west, north)
            banker: 'east',  // 当前庄家
            honba: 0,        // 本场数
            riichiBets: 0    // 立直棒数
        };
        
        this.history = [];  // 游戏历史记录
        this.currentAction = null;  // 当前操作状态
        
        this.init();
    }
    
    init() {
        this.loadFromStorage();
        // 初始化时确保风字正确
        this.updatePlayerWinds();
        this.updateUI();
    }
    
    // 保存到本地存储
    saveToStorage() {
        const gameData = {
            players: this.players,
            game: this.game,
            settings: this.settings,
            history: this.history,
            // 保存规则系统的设置
            ruleSettings: window.ruleSystem ? window.ruleSystem.settings : {},
            timestamp: Date.now()
        };
        localStorage.setItem('mahjong-scorepad', JSON.stringify(gameData));
    }
    
    // 从本地存储加载
    loadFromStorage() {
        const saved = localStorage.getItem('mahjong-scorepad');
        if (saved) {
            try {
                const gameData = JSON.parse(saved);
                if (gameData.players) this.players = gameData.players;
                if (gameData.game) this.game = gameData.game;
                if (gameData.settings) this.settings = { ...this.settings, ...gameData.settings };
                if (gameData.history) this.history = gameData.history;
                
                // 恢复规则系统的设置
                if (gameData.ruleSettings && window.ruleSystem) {
                    window.ruleSystem.settings = { ...window.ruleSystem.settings, ...gameData.ruleSettings };
                }
            } catch (e) {
                console.error('Failed to load game data:', e);
            }
        }
    }
    
    // 更新UI显示
    updateUI() {
        this.updatePlayersDisplay();
        this.updateGameInfo();
        this.updateBankerIndicator();
        
        // 更新所有玩家的风字显示
        this.updatePlayerWinds();
        
        // 更新UI控制器的显示
        if (window.uiController) {
            window.uiController.updateBankerDisplay();
            window.uiController.updateXiangGongDisplay();
        }
    }
    
    // 更新玩家显示
    updatePlayersDisplay() {
        Object.keys(this.players).forEach(position => {
            const player = this.players[position];
            const element = document.querySelector(`.player.${position}`);
            
            if (element) {
                // 更新名字
                const nameEl = element.querySelector('.name');
                if (nameEl) nameEl.textContent = player.name;
                
                // 更新分数
                const scoreEl = element.querySelector('.score');
                if (scoreEl) {
                    scoreEl.textContent = player.score.toLocaleString();
                    scoreEl.classList.toggle('negative', player.score < 0);
                }
                
                // 更新风向
                const windEl = element.querySelector('.wind');
                if (windEl) windEl.textContent = player.wind;
                
                // 庄家和相公状态由UI控制器管理
                // 这里不再直接操作类名
            }
        });
    }
    
    // 更新游戏信息
    updateGameInfo() {
        const roundEl = document.querySelector('.round');
        const honbaEl = document.querySelector('.honba');
        
        if (roundEl && window.ruleSystem) {
            roundEl.textContent = window.ruleSystem.formatRound(this.game.wind, this.game.round);
        }
        
        if (honbaEl && window.ruleSystem) {
            const strings = window.ruleSystem.getLocalizedStrings();
            const honbaLabel = strings.honbaLabel || '本场';
            honbaEl.textContent = `${this.game.honba}${honbaLabel}`;
        }
    }
    
    // 更新庄家指示器
    updateBankerIndicator() {
        window.uiController.updateBankerDisplay();
        // 庄家指示器现在由UI控制器管理
    }
    
    // 更新所有玩家的风字显示
    updatePlayerWinds() {
        // 根据庄家位置决定风字分配
        const windOrder = ['东', '南', '西', '北'];
        const positionOrder = ['east', 'south', 'west', 'north'];
        
        // 找到当前庄家在位置序列中的索引
        const bankerIndex = positionOrder.indexOf(this.game.banker);
        
        // 为每个位置分配正确的风字
        positionOrder.forEach((position, index) => {
            // 计算相对于庄家的风字偏移
            const windIndex = (index - bankerIndex + 4) % 4;
            this.players[position].wind = windOrder[windIndex];
        });
    }
    
    // 设置玩家名字
    setPlayerName(position, name) {
        if (!this.players[position]) return;
        
        // 在修改前保存状态快照
        if (window.gameHistory) {
            window.gameHistory.saveStateSnapshot();
        }
        
        const oldName = this.players[position].name;
        this.players[position].name = name;
        
        // 记录历史
        if (window.gameHistory) {
            window.gameHistory.addRecord({
                type: 'nameChange',
                player: position,
                oldName: oldName,
                newName: name,
                round: { ...this.game },
                timestamp: Date.now()
            });
        }
        
        this.updateUI();
        this.saveToStorage();
    }
    
    // 设置玩家相公状态
    setPlayerXiangGong(position, isXiangGong) {
        if (!this.players[position]) return;
        
        // 在修改前保存状态快照
        if (window.gameHistory) {
            window.gameHistory.saveStateSnapshot();
        }
        
        this.players[position].isXiangGong = isXiangGong;
        
        // 记录历史
        if (window.gameHistory) {
            window.gameHistory.addRecord({
                type: 'xiangGong',
                player: position,
                isXiangGong: isXiangGong,
                round: { ...this.game },
                timestamp: Date.now()
            });
        }
        
        this.updateUI();
        this.saveToStorage();
    }
    
    // 旋转分数盘
    rotateScorepad() {
        const scorepad = document.getElementById('scorepad');
        const currentRotation = parseInt(scorepad.dataset.rotation || '0');
        const newRotation = (currentRotation + 90) % 360;
        
        scorepad.dataset.rotation = newRotation;
        
        // 移除所有旋转类
        scorepad.classList.remove('rotate-0', 'rotate-90', 'rotate-180', 'rotate-270', 'rotate-360');
        
        // 添加新的旋转类
        scorepad.classList.add(`rotate-${newRotation === 0 ? '360' : newRotation}`);
        
        // 如果旋转到360度，在动画完成后重置为0度
        if (newRotation === 0) {
            setTimeout(() => {
                scorepad.classList.remove('rotate-360');
                scorepad.dataset.rotation = '0';
            }, 600); // 与CSS transition时间匹配
        }
        
        this.saveToStorage();
    }
    
    // 手动设置圈局
    setRound(wind, round) {
        // 在修改前保存状态快照
        if (window.gameHistory) {
            window.gameHistory.saveStateSnapshot();
        }
        
        const oldWind = this.game.wind;
        const oldRound = this.game.round;
        
        this.game.wind = wind;
        this.game.round = round;
        this.game.honba = 0; // 重置本场数
        
        // 记录历史
        if (window.gameHistory) {
            window.gameHistory.addRecord({
                type: 'roundChange',
                oldRound: { wind: oldWind, round: oldRound },
                newRound: { wind: wind, round: round },
                round: { ...this.game },
                timestamp: Date.now()
            });
        }
        
        this.updatePlayerWinds();
        this.updateUI();
        this.saveToStorage();
    }

    // 下一局
    nextRound(isBanker) {
        if (window.ruleSystem) {
            const nextGame = window.ruleSystem.getNextRound(
                this.game.wind, 
                this.game.round, 
                this.game.banker, 
                isBanker
            );
            
            this.game.wind = nextGame.wind;
            this.game.round = nextGame.round;
            
            if (!isBanker) {
                this.game.honba = 0;
                this.updateBanker(nextGame.banker);
                // 换庄时更新所有玩家的风字
                this.updatePlayerWinds();
            } else {
                this.game.honba++;
            }
        }
        
        this.updateUI();
        this.saveToStorage();
    }
    
    // 更新庄家
    updateBanker(newBanker) {
        Object.keys(this.players).forEach(position => {
            this.players[position].isBanker = (position === newBanker);
        });
        this.game.banker = newBanker;
        // 更新庄家时也要更新所有玩家的风字
        this.updatePlayerWinds();
        this.updateBankerIndicator();
    }
    
    // 和牌结算
    processWin(winData) {
        if (!window.ruleSystem) return;
        
        // 在处理和牌前保存状态快照
        if (window.gameHistory) {
            window.gameHistory.saveStateSnapshot();
        }
        
        // 兼容旧格式
        if (typeof winData === 'string') {
            winData = {
                winner: arguments[0],
                payers: arguments[1],
                fanCount: arguments[2],
                fuCount: arguments[3],
                winType: arguments[4],
                baoPlayer: 'none'
            };
        }
        
        const { winner, payers, fanCount, fuCount, winType, baoPlayer } = winData;
        
        // 直接使用规则系统计算分数变化（包括包牌处理）
        const scoreChanges = window.ruleSystem.calculateScores(
            winner, payers, fanCount, fuCount, winType, this.game.banker, baoPlayer
        );
        
        // 应用分数变化
        scoreChanges.forEach(change => {
            if (this.players[change.player]) {
                this.players[change.player].score += change.change;
                this.showScoreChange(change.player, change.change);
            }
        });
        
        // 记录历史（使用gameHistory而不是内部history）
        if (window.gameHistory) {
            window.gameHistory.addRecord({
                type: 'win',
                winner: winner,
                payers: payers,
                fanCount: fanCount,
                fuCount: fuCount,
                winType: winType,
                baoPlayer: baoPlayer,
                scoreChanges: scoreChanges,
                round: { ...this.game },
                timestamp: Date.now()
            });
        }
        
        // 根据规则系统设置决定是否连庄
        const shouldContinue = this.shouldBankerContinue(winner, winType);
        this.nextRound(shouldContinue);
    }
    
    // 只处理分数计算，不推进圈局（用于一炮多响）
    processWinScoresOnly(winData) {
        if (!window.ruleSystem) return;
        
        // 兼容旧格式
        if (typeof winData === 'string') {
            winData = {
                winner: arguments[0],
                payers: arguments[1],
                fanCount: arguments[2],
                fuCount: arguments[3],
                winType: arguments[4],
                baoPlayer: 'none'
            };
        }
        
        const { winner, payers, fanCount, fuCount, winType, baoPlayer } = winData;
        
        // 直接使用规则系统计算分数变化（包括包牌处理）
        const scoreChanges = window.ruleSystem.calculateScores(
            winner, payers, fanCount, fuCount, winType, this.game.banker, baoPlayer
        );
        
        // 应用分数变化
        scoreChanges.forEach(change => {
            if (this.players[change.player]) {
                this.players[change.player].score += change.change;
                this.showScoreChange(change.player, change.change);
            }
        });
        
        // 记录历史
        this.addHistory({
            type: 'win',
            winner: winner,
            payers: payers,
            fanCount: fanCount,
            fuCount: fuCount,
            winType: winType,
            baoPlayer: baoPlayer,
            scoreChanges: scoreChanges,
            round: { ...this.game },
            timestamp: Date.now()
        });
        
        // 不推进圈局，由调用方决定何时推进
        return { winner, winType };
    }
    
    // 完成一炮多响后推进圈局
    finishMultipleWins(allWinResults) {
        // 从所有和牌结果中确定连庄逻辑
        // 通常只要有庄家和牌就连庄
        const bankerWon = allWinResults.some(result => 
            result.winner === this.game.banker
        );
        
        this.nextRound(bankerWon);
    }
    
    
    // 流局处理
    processDraw() {
        // 在处理流局前保存状态快照
        if (window.gameHistory) {
            window.gameHistory.saveStateSnapshot();
        }
        
        // 记录历史（使用gameHistory而不是内部history）
        if (window.gameHistory) {
            window.gameHistory.addRecord({
                type: 'draw',
                round: { ...this.game },
                timestamp: Date.now()
            });
        }
        
        // 下一局（庄家连庄）
        this.nextRound(true);
    }
    
    // 诈胡处理
    processFraud(player) {
        if (!this.players[player]) return;
        
        // 在处理诈胡前保存状态快照
        if (window.gameHistory) {
            window.gameHistory.saveStateSnapshot();
        }
        
        // 直接调用规则集计算诈胡分数分配
        const penalty = window.ruleSystem.calculateFraudPenalty();
        
        // 应用分数变化：诈胡者向其他三家各赔付
        const scoreChanges = [];
        let totalPenalty = 0;
        
        ['east', 'south', 'west', 'north'].forEach(pos => {
            if (pos === player) {
                // 诈胡者支付
                const totalPay = penalty * 3;
                this.players[pos].score -= totalPay;
                this.showScoreChange(pos, -totalPay);
                scoreChanges.push({ 
                    player: pos, 
                    change: -totalPay,
                    type: 'fraud_penalty'
                });
                totalPenalty = totalPay;
            } else {
                // 其他玩家收到
                this.players[pos].score += penalty;
                this.showScoreChange(pos, penalty);
                scoreChanges.push({ 
                    player: pos, 
                    change: penalty,
                    type: 'fraud_compensation'
                });
            }
        });
        
        // 记录历史（使用gameHistory而不是内部history）
        if (window.gameHistory) {
            window.gameHistory.addRecord({
                type: 'fraud',
                player: player,
                penalty: totalPenalty,
                scoreChanges: scoreChanges,
                round: { ...this.game },
                timestamp: Date.now()
            });
        }
        
        // 下一局
        this.nextRound(false);
    }
    
    // 显示分数变化动画
    showScoreChange(position, change) {
        const element = document.querySelector(`.player.${position}`);
        if (!element) return;
        
        // 对于南北家，需要添加到 .player-content 容器内以正确显示旋转
        const contentContainer = element.querySelector('.player-content');
        const targetContainer = contentContainer || element;
        
        const changeEl = document.createElement('div');
        changeEl.className = `score-change ${change > 0 ? 'positive' : 'negative'}`;
        changeEl.textContent = `${change > 0 ? '+' : ''}${change}`;
        
        targetContainer.appendChild(changeEl);
        
        setTimeout(() => {
            if (changeEl.parentNode) {
                changeEl.parentNode.removeChild(changeEl);
            }
        }, 2000);
    }
    
    // 添加历史记录
    addHistory(record) {
        this.history.unshift(record);
        // 只保留最近100条记录
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
        this.saveToStorage();
    }
    
    // 获取历史记录
    getHistory() {
        return this.history;
    }
    
    // 重置游戏
    resetGame() {
        this.players = {
            east: { name: '东家', score: this.settings.initialScore, wind: '东', position: 'east', isBanker: true, isXiangGong: false },
            south: { name: '南家', score: this.settings.initialScore, wind: '南', position: 'south', isBanker: false, isXiangGong: false },
            west: { name: '西家', score: this.settings.initialScore, wind: '西', position: 'west', isBanker: false, isXiangGong: false },
            north: { name: '北家', score: this.settings.initialScore, wind: '北', position: 'north', isBanker: false, isXiangGong: false }
        };
        
        this.game = {
            round: 1,
            wind: 'east',
            banker: 'east',
            honba: 0,
            riichiBets: 0
        };
        
        this.history = [];
        // 重置后更新风字显示
        this.updatePlayerWinds();
        this.updateUI();
        this.saveToStorage();
    }
    
    // 导出数据
    exportData() {
        return {
            players: this.players,
            game: this.game,
            settings: this.settings,
            history: this.history,
            exportTime: new Date().toISOString()
        };
    }
    
    // 导入数据
    importData(data) {
        try {
            if (data.players) this.players = data.players;
            if (data.game) this.game = data.game;
            if (data.settings) this.settings = { ...this.settings, ...data.settings };
            if (data.history) this.history = data.history;
            
            this.updateUI();
            this.saveToStorage();
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
    
    // 获取当前规则系统的设置值
    getRuleSetting(key, defaultValue = null) {
        if (window.ruleSystem && window.ruleSystem.settings && window.ruleSystem.settings.hasOwnProperty(key)) {
            return window.ruleSystem.settings[key];
        }
        return defaultValue;
    }
    
    // 更新规则系统的设置值
    updateRuleSetting(key, value) {
        if (window.ruleSystem && window.ruleSystem.settings) {
            window.ruleSystem.settings[key] = value;
            
            // 如果是影响游戏状态的设置，同步更新
            if (key === 'initialScore') {
                this.settings.initialScore = value;
            } else if (key === 'targetScore') {
                this.settings.targetScore = value;
            } else if (key === 'minScore') {
                this.settings.minScore = value;
            }
            
            this.saveToStorage();
        }
    }
    
    // 根据规则系统设置决定庄家是否连庄
    shouldBankerContinue(winner, winType) {
        // 如果和牌方是庄家，默认连庄
        if (this.game.banker === winner) {
            return true;
        }
        
        // 检查规则系统的连庄设置
        const bankerContinue = this.getRuleSetting('bankerContinue', true);
        if (!bankerContinue) {
            return false;
        }
        
        // 其他连庄条件可以在这里添加
        return false;
    }
}

// 创建全局游戏状态实例
window.gameState = new GameState();
