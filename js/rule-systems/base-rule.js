/**
 * 基础规则系统抽象类
 * 定义所有规则系统必须实现的接口
 */

class BaseRuleSystem {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.settings = {};
    }
    
    // 获取规则系统的设置定义
    getSettingsDefinition() {
        return {};
    }
    
    // 更新规则设置
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
    
    // 格式化圈局显示 (例: 东1局, East 1, etc.)
    formatRound(wind, round) {
        const windNames = {
            east: '东',
            south: '南', 
            west: '西',
            north: '北'
        };
        return `${windNames[wind] || wind}${round}局`;
    }
    
    // 获取下一圈局信息
    getNextRound(currentWind, currentRound, currentBanker, isBanker) {
        const winds = ['east', 'south', 'west', 'north'];
        const windIndex = winds.indexOf(currentWind);
        
        if (isBanker) {
            // 庄家连庄，圈局不变
            return {
                wind: currentWind,
                round: currentRound,
                banker: currentBanker
            };
        }
        
        // 换庄
        const bankerPositions = ['east', 'south', 'west', 'north'];
        const currentBankerIndex = bankerPositions.indexOf(currentBanker);
        const nextBankerIndex = (currentBankerIndex + 1) % 4;
        const nextBanker = bankerPositions[nextBankerIndex];
        
        let nextWind = currentWind;
        let nextRound = currentRound;
        
        // 正常换庄时，局数增加
        nextRound++;
        
        // 如果一圈结束（4局都打完了）
        if (nextRound > 4) {
            // 换圈
            const nextWindIndex = (windIndex + 1) % 4;
            nextWind = winds[nextWindIndex];
            nextRound = 1;
        }
        
        return {
            wind: nextWind,
            round: nextRound,
            banker: nextBanker
        };
    }

    calculateBasePoints(fanCount, fuCount) {
        throw new Error('calculateBasePoints must be implemented by subclass');
    }
    
    // 计算分数变化（必须由子类实现）
    calculateScores(winner, payers, fanCount, fuCount, winType, banker, baoPlayer = 'none') {
        throw new Error('calculateScores must be implemented by subclass');
    }
    
    // 自动计算番符（可选实现）
    calculateHandValue(hand, winTile, melds, conditions) {
        // 返回 { fan: number, fu: number } 或 null
        return null;
    }
    
    // 计算诈胡惩罚（可选实现）
    calculateFraudPenalty() {
        return 8000 * 3; // 默认惩罚
    }
    
    // 验证和牌是否有效（可选实现）
    validateWin(hand, winTile, melds, conditions) {
        return true;
    }
    
    // 获取支持的番种列表（可选实现）
    getSupportedYaku() {
        return [];
    }
    
    // 获取特殊规则说明（可选实现）
    getSpecialRules() {
        return [];
    }
    
    // 获取支持的和牌条件
    getSupportedWinConditions() {
        return [
            { key: 'isTsumo', label: '自摸', default: false, hide: true },
            { key: 'isRiichi', label: '立直', default: false },
            { key: 'isIppatsu', label: '一发', default: false },
            { key: 'isRinshan', label: '岭上开花', default: false }
        ];
    }
    
    // 获取本地化字符串
    getLocalizedStrings() {
        return {
            fanLabel: '番数',
            fuLabel: '符数',
            fanUnit: '番',  // 用于历史记录显示的简化单位
            fuUnit: '符',   // 用于历史记录显示的简化单位
            honbaLabel: '本场',
            winType: {
                自摸: '自摸',
                和牌: '出銃'
            },
            payerText: '出銃',
            positions: {
                east: '东家',
                south: '南家',
                west: '西家',
                north: '北家'
            },
            winds: {
                east: '东',
                south: '南',
                west: '西',
                north: '北'
            },
            roundFormat: '{wind}{round}局'
        };
    }
    
    // 检查条件是否适用于当前规则
    isConditionApplicable(conditionKey) {
        const supportedConditions = this.getSupportedWinConditions();
        return supportedConditions.some(condition => condition.key === conditionKey);
    }
    
    // 检查特殊番数类型（满贯、役满等）
    getSpecialFanType(fanCount) {
        // 基础规则：使用通用的番数判断
        if (fanCount >= 100) {
            return { type: 'mangan', points: 300, name: '满贯' };
        } else if (fanCount >= 50) {
            return { type: 'half_mangan', points: 150, name: '半满贯' };
        }
        return null; // 普通番数
    }
    
    // 检查是否为固定点数的特殊番数
    isFixedPointsFan(fanCount) {
        const specialType = this.getSpecialFanType(fanCount);
        return specialType !== null;
    }
    
    // 获取特殊番数的固定点数
    getFixedPoints(fanCount) {
        const specialType = this.getSpecialFanType(fanCount);
        return specialType ? specialType.points : null;
    }
    
    // 准备计算条件（由规则集自动填充游戏状态参数）
    prepareConditions(baseConditions, gameState, winnerPosition, winType) {
        // 基类默认实现，子类可以重写
        const enhancedConditions = { ...baseConditions };
        
        if (gameState && winnerPosition) {
            // 基本游戏状态信息
            enhancedConditions.roundWind = gameState.game.wind || 'east';
            enhancedConditions.playerWind = this.getPlayerWind(gameState, winnerPosition);
            enhancedConditions.isBanker = (winnerPosition === gameState.game.banker);
            enhancedConditions.honbaCount = gameState.game.honba || 0;
            
            // 和牌类型
            enhancedConditions.isZimo = (winType === '自摸');
            enhancedConditions.isTsumo = enhancedConditions.isZimo;
            enhancedConditions.isRon = (winType === '和牌');
        }
        
        return enhancedConditions;
    }
    
    // 获取玩家门风（由子类实现具体逻辑）
    getPlayerWind(gameState, position) {
        const player = gameState.players[position];
        if (player && player.wind) {
            // 将中文风向转换为英文
            const windMap = {
                '东': 'east',
                '南': 'south', 
                '西': 'west',
                '北': 'north'
            };
            return windMap[player.wind] || 'east';
        }
        return 'east';
    }
}

// 导出基类供其他规则系统继承
window.BaseRuleSystem = BaseRuleSystem;
