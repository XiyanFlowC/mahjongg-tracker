/**
 * 麻将牌型解析器
 * 负责将字符串表示的牌型转换为内部数据结构
 */

class MahjongParser {
    constructor() {
        // 定义不同地区的牌型表示方法
        this.patterns = {
            // 标准表示法 (日本/国际)
            standard: {
                man: 'm',      // 万子
                pin: 'p',      // 筒子
                sou: 's',      // 条子
                honor: 'z',    // 字牌
                flower: 'f'    // 花牌
            },
            // 中文表示法
            chinese: {
                man: 'w',      // 万子
                pin: 'b',      // 饼子/筒子
                sou: 't',      // 条子
                honor: 'z',    // 字牌
                flower: 'h'    // 花牌
            },
            // 英文表示法
            english: {
                man: 'c',      // characters
                pin: 'd',      // dots
                sou: 'b',      // bamboo
                honor: 'h',    // honors
                flower: 'f'    // flowers
            },
            // 宽松表示法 - 支持多种简写和中文（移除英语兼容避免冲突）
            relaxed: {
                man: ['m', 'w', '万', '萬'],                    // 万子的表示
                pin: ['p', 'b', '筒', '饼', '餅', '筒'],       // 筒子的表示
                sou: ['s', 't', '条', '索', '條'],              // 条子的表示
                honor: ['z', '字'],                       // 字牌的表示
                flower: ['f', 'h', '花']                       // 花牌的表示
            }
        };
        
        // 当前使用的表示法
        this.currentPattern = 'relaxed';
        
        // 字牌映射 - 支持中文直接输入
        this.honorMapping = {
            1: '東', 2: '南', 3: '西', 4: '北',
            5: '白', 6: '發', 7: '中'
        };
        
        // 字牌中文反向映射
        this.honorReverseMapping = {
            '东': 1, '東': 1, '南': 2, '西': 3, '北': 4,
            '白': 5, '发': 6, '發': 6, '中': 7
        };
        
        // 花牌映射 - 支持中文直接输入，使用与前端Unicode一致的编号
        this.flowerMapping = {
            1: '春', 2: '夏', 3: '秋', 4: '冬', 
            5: '梅', 6: '蘭', 7: '竹', 8: '菊' 
        };
        
        // 花牌中文反向映射
        this.flowerReverseMapping = {
            '春': 1, '夏': 2, '秋': 3, '冬': 4,   // 四季 (对应8z-11z)
            '梅': 5, '兰': 6, '蘭': 6, '竹': 7, '菊': 8  // 四花 (对应12z-15z)
        };
        
        // 中文数字映射
        this.chineseNumbers = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9,
            '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
            '6': 6, '7': 7, '8': 8, '9': 9
        };
    }
    
    // 设置表示法模式
    setPattern(pattern) {
        if (this.patterns[pattern]) {
            this.currentPattern = pattern;
        }
    }
    
    // 解析手牌字符串
    parseHand(handString) {
        if (!handString) return [];
        
        const tiles = [];
        
        // 如果是宽松模式，先处理中文表示
        if (this.currentPattern === 'relaxed') {
            return this.parseRelaxedHand(handString);
        }
        
        const pattern = this.patterns[this.currentPattern];
        
        // 正则表达式匹配牌型
        const regex = new RegExp(`([0-9]+)([${Object.values(pattern).join('')}])`, 'g');
        let match;
        
        while ((match = regex.exec(handString)) !== null) {
            const numbers = match[1];
            const suit = match[2];
            
            // 转换为内部表示
            const suitType = this.getSuitType(suit);
            
            for (let char of numbers) {
                const number = parseInt(char);
                if (number >= 1 && number <= 9) {
                    tiles.push({
                        suit: suitType,
                        number: number,
                        original: `${number}${suit}`
                    });
                }
            }
        }
        
        return tiles;
    }
    
    // 解析鸣牌字符串
    parseMelds(meldsString) {
        if (!meldsString) return [];
        
        const melds = [];
        const meldParts = meldsString.split(',');
        
        for (let meldPart of meldParts) {
            const meld = this.parseMeld(meldPart.trim());
            if (meld) {
                melds.push(meld);
            }
        }
        
        return melds;
    }
    
    // 解析单个鸣牌
    parseMeld(meldString) {
        const trimmed = meldString.trim();
        
        // 检查是否为暗杠的多种表示方法
        // 1. 括号表示：(1111m) 或 (东东东东)
        // 2. 方括号表示：[1111m] 或 [东东东东]  
        // 3. 大括号表示：{1111m} 或 {东东东东}
        // 4. 前缀表示：暗1111m 或 an1111m
        let isConcealed = false;
        let actualMeldString = trimmed;
        
        if ((trimmed.startsWith('(') && trimmed.endsWith(')')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            isConcealed = true;
            actualMeldString = trimmed.slice(1, -1);
        } else if (trimmed.startsWith('暗') || trimmed.startsWith('an')) {
            isConcealed = true;
            actualMeldString = trimmed.startsWith('暗') ? trimmed.slice(1) : trimmed.slice(2);
        }
        
        const tiles = this.parseHand(actualMeldString);
        if (tiles.length === 0) return null;
        
        // 判断鸣牌类型
        const type = this.determineMeldType(tiles, isConcealed);
        
        return {
            type: type,
            tiles: tiles,
            original: meldString,
            isConcealed: isConcealed
        };
    }
    
    // 判斷鳴牌類型
    determineMeldType(tiles, isConcealed = false) {
        // 若全为花牌，返回 '花牌'
        if (tiles.every(tile => tile.suit === 'flower')) {
            return '花牌';
        }
        if (tiles.length === 2) {
            // 對子（將牌）
            return tiles[0].suit === tiles[1].suit && tiles[0].number === tiles[1].number ? '對子' : 'unknown';
        } else if (tiles.length === 3) {
            // 刻子或順子
            if (this.is刻子(tiles)) return '刻子';
            if (this.is順子(tiles)) return '順子';
            return 'unknown';
        } else if (tiles.length === 4) {
            // 槓子 - 区分明杠和暗杠
            if (this.is槓子(tiles)) {
                return isConcealed ? '暗槓' : '明槓';
            }
            return 'unknown';
        }
        
        return 'unknown';
    }
    
    // 檢查是否為刻子
    is刻子(tiles) {
        if (tiles.length !== 3) return false;
        return tiles.every(tile => 
            tile.suit === tiles[0].suit && tile.number === tiles[0].number
        );
    }
    
    // 檢查是否為順子
    is順子(tiles) {
        if (tiles.length !== 3) return false;
        if (tiles[0].suit === 'honor' || tiles[0].suit === 'flower') return false;
        
        const numbers = tiles.map(tile => tile.number).sort((a, b) => a - b);
        return tiles.every(tile => tile.suit === tiles[0].suit) &&
               numbers[1] === numbers[0] + 1 &&
               numbers[2] === numbers[1] + 1;
    }
    
    // 檢查是否為槓子
    is槓子(tiles) {
        if (tiles.length !== 4) return false;
        return tiles.every(tile => 
            tile.suit === tiles[0].suit && tile.number === tiles[0].number
        );
    }
    
    // 获取花色类型
    getSuitType(suitChar) {
        // 宽松模式下使用专门的方法
        if (this.currentPattern === 'relaxed') {
            return this.getSuitTypeFromRelaxedChar(suitChar);
        }
        
        const pattern = this.patterns[this.currentPattern];
        
        if (suitChar === pattern.man) return 'man';
        if (suitChar === pattern.pin) return 'pin';
        if (suitChar === pattern.sou) return 'sou';
        if (suitChar === pattern.honor) return 'honor';
        if (suitChar === pattern.flower) return 'flower';
        
        return 'unknown';
    }
    
    // 将内部表示转换为显示字符串
    tilesToString(tiles, pattern = null) {
        if (!pattern) pattern = this.currentPattern;
        
        const groups = {};
        const patternDef = this.patterns[pattern];
        
        // 按花色分组
        tiles.forEach(tile => {
            const suitChar = this.getSuitChar(tile.suit, pattern);
            if (!groups[suitChar]) groups[suitChar] = [];
            groups[suitChar].push(tile.number);
        });
        
        // 生成字符串
        let result = '';
        Object.keys(groups).forEach(suit => {
            const numbers = groups[suit].sort((a, b) => a - b);
            result += numbers.join('') + suit;
        });
        
        return result;
    }
    
    // 获取花色字符
    getSuitChar(suitType, pattern = null) {
        if (!pattern) pattern = this.currentPattern;
        const patternDef = this.patterns[pattern];
        
        switch (suitType) {
            case 'man': return patternDef.man;
            case 'pin': return patternDef.pin;
            case 'sou': return patternDef.sou;
            case 'honor': return patternDef.honor;
            case 'flower': return patternDef.flower;
            default: return '?';
        }
    }
    
    // 验证牌型字符串格式
    validateTileString(tileString) {
        if (!tileString) return { valid: true, errors: [] };
        
        const errors = [];
        
        // 宽松模式下的验证
        if (this.currentPattern === 'relaxed') {
            return this.validateRelaxedTileString(tileString);
        }
        
        const pattern = this.patterns[this.currentPattern];
        const validSuits = Object.values(pattern);
        
        // 检查格式
        const regex = new RegExp(`^([0-9]+[${validSuits.join('')}]\\s*)+$`);
        if (!regex.test(tileString.trim())) {
            errors.push('格式不正确，应为数字+花色，如：123m456p');
        }
        
        // 检查牌数是否合理
        const tiles = this.parseHand(tileString);
        if (tiles.length > 14) {
            errors.push('手牌数量不能超过14张');
        }
        
        // 检查每种牌是否超过4张
        const tileCount = {};
        tiles.forEach(tile => {
            const key = `${tile.suit}-${tile.number}`;
            tileCount[key] = (tileCount[key] || 0) + 1;
            if (tileCount[key] > 4) {
                errors.push(`${tile.original}超过4张`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // 验证宽松模式牌型字符串
    validateRelaxedTileString(tileString) {
        const errors = [];
        
        try {
            // 尝试解析
            const tiles = this.parseHand(tileString);
            
            // 检查牌数是否合理
            if (tiles.length > 14) {
                errors.push('手牌数量不能超过14张');
            }
            
            // 检查每种牌是否超过4张
            const tileCount = {};
            tiles.forEach(tile => {
                const key = `${tile.suit}-${tile.number}`;
                tileCount[key] = (tileCount[key] || 0) + 1;
                if (tileCount[key] > 4) {
                    const tileName = this.getTileName(tile);
                    errors.push(`${tileName}超过4张`);
                }
            });
            
            // 如果没有解析到任何牌，可能是格式错误
            if (tiles.length === 0 && tileString.trim().length > 0) {
                errors.push('无法识别的牌型格式');
            }
            
        } catch (e) {
            errors.push('解析错误：' + e.message);
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // 获取牌的显示名称
    getTileName(tile) {
        if (tile.suit === 'honor') {
            return this.honorMapping[tile.number] || `未知字牌${tile.number}`;
        } else if (tile.suit === 'flower') {
            return this.flowerMapping[tile.number] || `未知花牌${tile.number}`;
        } else {
            const suitNames = {
                man: '万',
                pin: '筒',
                sou: '条'
            };
            return `${tile.number}${suitNames[tile.suit] || tile.suit}`;
        }
    }
    
    // 获取可用的表示法列表
    getAvailablePatterns() {
        return Object.keys(this.patterns).map(key => ({
            key: key,
            name: this.getPatternName(key),
            example: this.getPatternExample(key)
        }));
    }
    
    // 获取表示法名称
    getPatternName(pattern) {
        const names = {
            standard: '标准表示法',
            chinese: '中文表示法',
            english: '英文表示法',
            relaxed: '宽松表示法'
        };
        return names[pattern] || pattern;
    }
    
    // 获取表示法示例
    getPatternExample(pattern) {
        if (pattern === 'relaxed') {
            return '123万456筒789条东南白, 123m456p, 梅兰竹菊';
        }
        
        const p = this.patterns[pattern];
        return `123${p.man}456${p.pin}789${p.sou}1122${p.honor}`;
    }
    
    // 统计手牌信息
    analyzeHand(tiles) {
        const analysis = {
            totalTiles: tiles.length,
            suits: { man: 0, pin: 0, sou: 0, honor: 0, flower: 0 },
            terminals: 0,  // 老頭牌 (1,9)
            honors: 0,     // 字牌
            flowers: 0,    // 花牌
            pairs: [],     // 對子
            sequences: [], // 順子
            triplets: []   // 刻子
        };
        
        // 统计各花色数量
        tiles.forEach(tile => {
            analysis.suits[tile.suit]++;
            
            if (tile.suit === 'honor') {
                analysis.honors++;
            } else if (tile.suit === 'flower') {
                analysis.flowers++;
            } else if (tile.number === 1 || tile.number === 9) {
                analysis.terminals++;
            }
        });
        
        return analysis;
    }
    
    // 解析宽松模式手牌字符串
    parseRelaxedHand(handString) {
        const tiles = [];
        let remainingString = handString;
        
        // 1. 先处理中文花色格式（如"123万"、"456筒"）
        const chineseSuitResult = this.parseAndRemoveChineseSuitTiles(remainingString);
        tiles.push(...chineseSuitResult.tiles);
        remainingString = chineseSuitResult.remaining;
        
        // 2. 处理直接的字牌和花牌中文
        const honorsResult = this.parseAndRemoveDirectChineseHonors(remainingString);
        tiles.push(...honorsResult.tiles);
        remainingString = honorsResult.remaining;
        
        const flowersResult = this.parseAndRemoveDirectChineseFlowers(remainingString);
        tiles.push(...flowersResult.tiles);
        remainingString = flowersResult.remaining;
        
        // 3. 处理剩余的标准格式（123m, 456p等）
        tiles.push(...this.parseStandardFormatInRelaxed(remainingString));
        
        return tiles;
    }
    
    // 解析並移除中文花色表示（如"123万"、"二三四筒"）
    parseAndRemoveChineseSuitTiles(handString) {
        const tiles = [];
        let remaining = handString;
        
        // 匹配模式：数字+中文花色
        const patterns = [
            // 数字+万
            { regex: /([一二三四五六七八九1-9]+)万/g, suit: 'man' },
            // 数字+筒/饼
            { regex: /([一二三四五六七八九1-9]+)[筒饼]/g, suit: 'pin' },
            // 数字+条/索
            { regex: /([一二三四五六七八九1-9]+)[条索]/g, suit: 'sou' }
        ];
        
        for (let pattern of patterns) {
            let match;
            // 重置regex的lastIndex
            pattern.regex.lastIndex = 0;
            while ((match = pattern.regex.exec(remaining)) !== null) {
                const numberStr = match[1];
                const fullMatch = match[0];
                
                // 解析数字序列
                for (let char of numberStr) {
                    const number = this.chineseNumbers[char];
                    if (number && number >= 1 && number <= 9) {
                        tiles.push({
                            suit: pattern.suit,
                            number: number,
                            original: fullMatch
                        });
                    }
                }
                
                // 从剩余字符串中移除这个匹配
                remaining = remaining.replace(fullMatch, '');
                // 重置regex的lastIndex以避免跳过匹配
                pattern.regex.lastIndex = 0;
            }
        }
        
        return { tiles, remaining };
    }
    
    // 解析並移除直接的中文字牌
    parseAndRemoveDirectChineseHonors(handString) {
        const tiles = [];
        const honorChars = ['东', '南', '西', '北', '白', '发', '中'];
        let remaining = handString;
        
        for (let char of honorChars) {
            while (remaining.includes(char)) {
                tiles.push({
                    suit: 'honor',
                    number: this.honorReverseMapping[char],
                    original: char
                });
                remaining = remaining.replace(char, '');
            }
        }
        
        return { tiles, remaining };
    }
    
    // 解析並移除直接的中文花牌
    parseAndRemoveDirectChineseFlowers(handString) {
        const tiles = [];
        const flowerChars = ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'];
        let remaining = handString;
        
        for (let char of flowerChars) {
            while (remaining.includes(char)) {
                tiles.push({
                    suit: 'flower',
                    number: this.flowerReverseMapping[char],
                    original: char
                });
                remaining = remaining.replace(char, '');
            }
        }
        
        return { tiles, remaining };
    }
    
    // 在宽松模式下解析标准格式
    parseStandardFormatInRelaxed(handString) {
        const tiles = [];
        
        // 支持所有可能的花色字符
        const allSuitChars = [];
        const relaxedPattern = this.patterns.relaxed;
        
        for (let suitType in relaxedPattern) {
            allSuitChars.push(...relaxedPattern[suitType]);
        }
        
        // 创建正则表达式
        const suitCharsEscaped = allSuitChars.map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
        const regex = new RegExp(`([0-9]+)([${suitCharsEscaped}])`, 'g');
        
        let match;
        while ((match = regex.exec(handString)) !== null) {
            const numbers = match[1];
            const suitChar = match[2];
            
            // 获取花色类型
            const suitType = this.getSuitTypeFromRelaxedChar(suitChar);
            
            if (suitType !== 'unknown') {
                for (let char of numbers) {
                    const number = parseInt(char);
                    if (number >= 1 && number <= 9) {
                        tiles.push({
                            suit: suitType,
                            number: number,
                            original: `${number}${suitChar}`
                        });
                    }
                }
            }
        }
        
        return tiles;
    }
    
    // 从宽松模式字符获取花色类型
    getSuitTypeFromRelaxedChar(suitChar) {
        const relaxedPattern = this.patterns.relaxed;
        
        for (let suitType in relaxedPattern) {
            if (relaxedPattern[suitType].includes(suitChar)) {
                return suitType;
            }
        }
        
        return 'unknown';
    }
}

// 创建全局解析器实例
window.mahjongParser = new MahjongParser();
