/**
 * 香港麻将规则系统
 * 实现基本的香港麻将计分规则
 * 
 * 命名规范：
 * - 使用粤语拼音作为主要命名方式，保持香港麻将的地域特色
 * - 条件变量：is + 粤语拼音，如 isMunCinCeng（门前清）
 * - 方法名称：动词 + 粤语拼音，如 analyzeSamJyun（分析三元）
 * - 常用粤语拼音对照：
 *   - 门前清：MunCinCeng
 *   - 海底捞月：HoiDaiLouJyut
 *   - 杠上开花：GongSeungHoiFa
 *   - 抢杠：CoengGong
 *   - 十三幺：SapSamJiu
 *   - 九莲宝灯：GauLinBouDang
 *   - 七对子：CatDeoiZi
 *   - 对对胡：DeoiDeoiWu
 *   - 三元：SamJyun
 *   - 风牌：FungPaai
 *   - 幺九：JiuGau
 * 
 * 主要特点：
 * - 番数制计分，基础点数 = 底分 × 2^番数
 * - 支持花牌系统（春夏秋冬、梅兰菊竹）
 * - 三番起糊，低于三番不能和牌
 * - 无副数概念，副数恒为1
 * - 自摸三家平分，放炮者独付
 * - 支持各种特殊牌型和例牌
 */

class HongKongMahjong extends BaseRuleSystem {
    /**
     * 构造函数
     * 初始化香港麻将规则系统的基本设置
     */
    constructor() {
        super('香港麻将', '香港麻将规则，全铳');
        this.settings = {
            basePoint: 1,     // 底分，用户可自定义
            minFan: 3,        // 起糊限制，香港麻将主流为3番起糊
            lalaShang: false, // 辣辣上，不选默认半辣上
            maxFan: 10        // 最大番数，默认10
        };
    }

    /**
     * 获取规则设置定义
     * 返回可供用户自定义的设置项配置
     * 
     * @returns {Object} 设置项配置对象
     */
    getSettingsDefinition() {
        return {
            '基本设置': {
                basePoint: { type: 'number', label: '底分', default: 1, min: 1, max: 10 },
                minFan: { type: 'number', label: '起糊番数', default: 3, min: 0, max: 10 },
                maxFan: { type: 'number', label: '最大番数', default: 10, min: 5, max: 20 },
                lalaShang: { type: 'boolean', label: '辣辣上', default: false }
            }
        };
    }

    /**
     * 格式化圈风显示
     * 将英文圈风转换为中文显示
     * 
     * @param {string} wind - 圈风标识 ('east', 'south', 'west', 'north')
     * @param {number} round - 圈数
     * @returns {string} 格式化后的圈风显示，如"东1圈"
     */
    formatRound(wind, round) {
        const windNames = {
            east: '东',
            south: '南',
            west: '西',
            north: '北'
        };
        const roundNames = ['', '东', '南', '西', '北'];
        return `${windNames[wind] || wind}圈${roundNames[round]}局`;
    }

    /**
     * 计算基础点数
     * 香港麻将采用番数制：基础点数 = 底分 × 2^番数
     * 香港麻将没有副数概念，fuCount恒为1（底分）
     * 
     * 半辣上特殊规则：
     * - 5番=4番x1.5=24, 6番=4番x2=32
     * - 7番=6番x1.5=48, 8番=6番x2=64
     * - 依此类推，奇数番=前一偶数番x1.5，偶数番=前两番的偶数番x2
     * 
     * @param {number} fanCount - 番数
     * @param {number} fuCount - 副数（在香港麻将中始终为1）
     * @returns {number} 基础点数
     * @throws {Error} 当番数未达到起糊要求时抛出错误
     */
    calculateBasePoints(fanCount, fuCount = 1) {
        if (fanCount < this.settings.minFan) {
            throw new Error(`未达到起糊番数（${this.settings.minFan}番）`);
        }
        
        // 应用最大番数限制
        const effectiveFanCount = Math.min(fanCount, this.settings.maxFan);
        
        // 辣辣上：使用标准番数计算
        if (this.settings.lalaShang) {
            return this.settings.basePoint * Math.pow(2, effectiveFanCount);
        }
        
        // 半辣上：特殊跳跃规则
        if (effectiveFanCount <= 4) {
            // 1-4番：标准计算
            return this.settings.basePoint * Math.pow(2, effectiveFanCount);
        }
        
        // 5番及以上：特殊跳跃规则
        if (effectiveFanCount % 2 === 1) {
            // 奇数番：前一偶数番 × 1.5
            const previousEvenFan = effectiveFanCount - 1;
            const baseValue = this.calculateBasePointsForEvenFan(previousEvenFan);
            return Math.floor(baseValue * 1.5);
        } else {
            // 偶数番：前两番的偶数番 × 2
            return this.calculateBasePointsForEvenFan(effectiveFanCount);
        }
    }
    
    /**
     * 计算偶数番的基础点数（半辣上专用）
     * 偶数番规则：6番=4番x2, 8番=6番x2, 10番=8番x2, 依此类推
     * 
     * @param {number} evenFanCount - 偶数番数
     * @returns {number} 基础点数
     */
    calculateBasePointsForEvenFan(evenFanCount) {
        if (evenFanCount <= 4) {
            return this.settings.basePoint * Math.pow(2, evenFanCount);
        }
        
        // 偶数番：前两番的偶数番 × 2
        const previousEvenFan = evenFanCount - 2;
        return this.calculateBasePointsForEvenFan(previousEvenFan) * 2;
    }

    /**
     * 计算分数变化
     * 根据和牌方式计算各玩家的分数变化
     * 
     * 规则：
     * - 自摸：和牌者得分 = 基础点数 × 3，其他三家各付基础点数
     * - 荣和（辣辣上）：和牌者得分 = 基础点数 × 3，放炮者独付（与自摸相同）
     * - 荣和（半辣上）：和牌者得分 = 基础点数 × 2，放炮者独付
     * 
     * @param {string} winner - 和牌者位置
     * @param {Array} payers - 付分者数组（荣和时为放炮者）
     * @param {number} fanCount - 番数
     * @param {number} fuCount - 副数（香港麻将中始终为1）
     * @param {string} winType - 和牌类型（'自摸' 或其他）
     * @param {string} banker - 庄家位置（香港麻将中不影响计分）
     * @param {string} baoPlayer - 包牌者（暂未使用）
     * @returns {Array} 分数变化数组，包含每个玩家的分数变动
     */
    calculateScores(winner, payers, fanCount, fuCount, winType, banker, baoPlayer = 'none') {
        const basePoints = this.calculateBasePoints(fanCount, 1);
        const scores = [];
        const isTsumo = winType === '自摸';
        
        if (isTsumo) {
            // 自摸，三家各付
            ['east', 'south', 'west', 'north'].forEach(pos => {
                if (pos === winner) {
                    scores.push({ player: pos, change: basePoints * 3 });
                } else {
                    scores.push({ player: pos, change: -basePoints });
                }
            });
        } else {
            // 荣和，放铳者全付
            // 辣辣上：荣和分数与自摸相同（basePoints * 3）
            // 半辣上：荣和分数为两倍（basePoints * 2）
            const ronMultiplier = this.settings.lalaShang ? 3 : 2;
            const ronPoints = basePoints * ronMultiplier;
            ['east', 'south', 'west', 'north'].forEach(pos => {
                if (pos === winner) {
                    scores.push({ player: pos, change: ronPoints });
                } else if (payers.includes(pos)) {
                    scores.push({ player: pos, change: -ronPoints });
                } else {
                    scores.push({ player: pos, change: 0 });
                }
            });
        }
        return scores;
    }

    /**
     * 获取特殊番数类型
     * 香港麻将无副数相关特殊番数，直接返回null
     * 
     * @param {number} fanCount - 番数
     * @returns {null} 始终返回null
     */
    getSpecialFanType(fanCount) {
        return null;
    }

    /**
     * 获取支持的番种列表
     * 返回香港麻将支持的所有番种及其番数和描述
     * 
     * @returns {Array} 番种列表，包含name、fan、description字段
     */
    getSupportedYaku() {
        return [
            // 零番
            { name: '小和', fan: 0, description: '單純四搭一對、無任何其他組合的牌型' },
            
            // 一番
            { name: '平和', fan: 1, description: '只有順子、沒有刻子的牌型' },
            { name: '無花', fan: 1, description: '沒有花牌' },
            { name: '正花', fan: 1, description: '花牌跟座位的風位（門風）吻合' },
            { name: '自摸', fan: 1, description: '自己摸出和牌之牌' },
            { name: '門前清', fan: 1, description: '沒有上、碰、槓任何牌而和牌' },
            { name: '番牌', fan: 1, description: '有三元牌或風牌的刻子' },
            { name: '搶槓', fan: 1, description: '聽牌時別家槓出自己所聽之牌' },
            { name: '海底撈月', fan: 1, description: '食全局最後一隻牌自摸' },
            
            // 兩番
            { name: '槓上開花', fan: 2, description: '明/暗/加槓後自摸' },
            { name: '一台花', fan: 2, description: '集齊同一系列的花牌（春夏秋冬或梅蘭菊竹）' },
            
            // 三番
            { name: '花和', fan: 3, description: '集齊七隻花牌可即時和牌' },
            { name: '對對和', fan: 3, description: '只有刻子的牌型' },
            { name: '混一色', fan: 3, description: '只有一門數字牌跟字牌的和牌牌型' },
            
            // 四番
            { name: '花么九', fan: 4, description: '只有么九及字牌的對對和' },
            
            // 五番
            { name: '小三元', fan: 5, description: '全部三種三元牌組成兩副刻子加一對將' },
            
            // 六番
            { name: '小四喜', fan: 6, description: '全部四種風牌組成三副刻子加一對將' },
            
            // 七番
            { name: '清一色', fan: 7, description: '只有一門數字牌，沒有字牌的和牌牌型' },
            
            // 八番
            { name: '大三元', fan: 8, description: '集齊中、發、白三個刻子的和牌牌型' },
            { name: '連槓開花', fan: 8, description: '連開超過一槓後自摸和牌' },
            { name: '大花和', fan: 8, description: '摸齊八隻花可即時和牌' },
            { name: '坎坎胡', fan: 8, description: '沒有碰、槓過的對對和（四暗刻）' },
            
            // 十番（例牌）
            { name: '字一色', fan: 10, description: '只有字牌的和牌牌型' },
            { name: '清么九', fan: 10, description: '只有么九牌的對對和' },
            { name: '九蓮寶燈', fan: 10, description: '門清狀態下以么九刻子各一對、其餘二至八各一湊成的清一色' },
            
            // 十三番（例牌）
            { name: '天和', fan: 13, description: '莊家開局補花後立即自摸' },
            { name: '地和', fan: 13, description: '開局後，閒家食莊家打出的第一隻牌' },
            { name: '人和', fan: 13, description: '閒家於開局第一輪即自摸' },
            { name: '大四喜', fan: 13, description: '以東、南、西、北組成四個刻子的和牌牌型' },
            { name: '十三么', fan: 13, description: '集齊六種么九牌及七種字牌，再加其中一張作將' },
            { name: '十八羅漢', fan: 13, description: '開了四個槓的和牌牌型' }
        ];
    }

    /**
     * 获取支持的和牌条件
     * 返回可选择的和牌条件配置
     * 
     * @returns {Array} 和牌条件配置数组
     */
    getSupportedWinConditions() {
        return [
            { key: 'isTsumo', label: '自摸', default: false, hide: true },
            { key: 'isMunCinCeng', label: '門前清', default: false, hide: true },
            { key: 'isHoiDaiLouJyut', label: '海底撈月', default: false },
            { key: 'isGongSeungHoiFa', label: '槓上開花', default: false },
            { key: 'isCoengGong', label: '搶槓', default: false },
            { key: 'isLinGongHoiFa', label: '連槓開花', default: false },
            { key: 'isFirstTurn', label: '首輪', default: false },
            { key: 'isTianhu', label: '天和', default: false },
            { key: 'isDihu', label: '地和', default: false },
            { key: 'isRenhu', label: '人和', default: false },
            { key: 'playerWind', label: '門風', type: 'select', options: [
                { value: 'east', label: '東' },
                { value: 'south', label: '南' },
                { value: 'west', label: '西' },
                { value: 'north', label: '北' }
            ], default: 'east', hide: true },
            { key: 'roundWind', label: '場風', type: 'select', options: [
                { value: 'east', label: '東' },
                { value: 'south', label: '南' },
                { value: 'west', label: '西' },
                { value: 'north', label: '北' }
            ], default: 'east',  hide: true }
        ];
    }

    /**
     * 获取本地化字符串
     * 返回用于界面显示的本地化文本
     * 
     * @returns {Object} 本地化字符串对象
     */
    getLocalizedStrings() {
        return {
            fanLabel: '番數',
            fuLabel: '底分',
            fanUnit: '番',
            fuUnit: '分',
            honbaLabel: '連莊',
            winType: {
                自摸: '自摸',
                和牌: '食糊'
            },
            payerText: '出冲',
            positions: {
                east: '東家',
                south: '南家',
                west: '西家',
                north: '北家'
            },
            winds: {
                east: '東',
                south: '南',
                west: '西',
                north: '北'
            },
            roundFormat: '{wind}{round}局'
        };
    }

    /**
     * 获取特殊规则说明
     * 返回香港麻将的特殊规则说明文本
     * 
     * @returns {Array} 规则说明数组
     */
    getSpecialRules() {
        return [
            '香港麻將採用番數制，基本點數為底分×2^番數',
            '主流規則為三番起糊，低於三番不能和牌',
            '沒有副數概念，副數恆為1（底分）',
            '支援花牌系統，正花、一台花、花和、大花和等',
            '莊家無額外加成，所有玩家計分方式相同',
            '自摸三家平分，放炮者獨付',
            '門前清：只有明副露（上、碰、明槓）破壞門清，暗槓和花牌不破壞',
            '例牌（十番及以上）不另計其他牌型',
            '連槓開花需連續開槓，中間不可補花',
            '搶槓可搶明槓，暗槓只有聽十三么時可搶',
            '十三么為唯一可搶暗槓的牌型',
            '風牌只有自風（門風）和場風（圈風）才計番',
            '三元牌為紅中、青發、白板'
        ];
    }

    /**
     * 准备计算条件
     * 重写基类方法，设置香港麻将特有的门前清判定规则
     * 
     * @param {Object} baseConditions - 基础条件对象
     * @param {Object} gameState - 游戏状态
     * @param {string} winnerPosition - 和牌者位置
     * @param {string} winType - 和牌类型
     * @returns {Object} 增强后的条件对象
     */
    prepareConditions(baseConditions, gameState, winnerPosition, winType) {
        // 调用父类方法获取基础条件
        const enhancedConditions = super.prepareConditions(baseConditions, gameState, winnerPosition, winType);
        
        // 香港麻将特殊规则：暗杠不破坏门前清
        // 这个逻辑会在calculateHandValue中的门前清判定部分生效
        // 门前清判定：只有明副露（上、碰、明杠）才破坏门清，暗杠和花牌不破坏
        
        return enhancedConditions;
    }

    /**
     * 验证和牌是否达到起糊要求
     * 检查手牌是否符合和牌条件且达到最小番数要求
     * 
     * @param {string} hand - 手牌字符串
     * @param {string} winTile - 和牌张字符串
     * @param {string} melds - 副露字符串
     * @param {Object} conditions - 和牌条件对象
     * @returns {boolean} 是否可以和牌
     */
    validateWin(hand, winTile, melds, conditions) {
        // 基础验证，检查是否达到起糊番数
        try {
            const handValue = this.calculateHandValue(hand, winTile, melds, conditions);
            if (handValue && handValue.fan >= this.settings.minFan) {
                return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    /**
     * 计算诈胡惩罚
     * 当玩家错误声明和牌时的惩罚分数
     * 
     * @returns {number} 惩罚分数（32倍底分）
     */
    calculateFraudPenalty() {
        return this.settings.basePoint * 32; // 32倍底分的惩罚
    }

    /**
     * 香港麻将手牌自动计算
     * 根据手牌、和牌张、副露和条件自动计算番数和番种
     * 
     * @param {string} hand - 手牌字符串
     * @param {string} winTile - 和牌张字符串
     * @param {string} melds - 副露字符串
     * @param {Object} conditions - 和牌条件对象
     * @returns {Object} 计算结果 { fan, fu, fanDetails, isValid }
     * @throws {Error} 当未达到起糊要求时抛出错误
     */
    calculateHandValue(hand, winTile, melds, conditions) {
        let totalFan = 0;
        const fanDetails = [];
        
        // 向后兼容性处理：映射旧命名到粤语拼音命名
        conditions = this.mapLegacyConditionNames(conditions);
        
        // 解析手牌和副露
        const parser = window.mahjongParser || new MahjongParser();
        parser.setPattern('relaxed');
        
        const handTiles = parser.parseHand(hand || '');
        const winningTile = parser.parseHand(winTile || '');
        const meldTiles = melds ? parser.parseMelds(melds) : [];
        
        // 标准化副露
        const standardMeldTiles = this.standardizeMelds(meldTiles);
        
        // 分离花牌和非花牌
        let meldFlowers = [];
        let meldNormal = [];
        let nonFlowerMeldTiles = []; // 过滤掉花牌后的副露面子
        
        standardMeldTiles.forEach(meld => {
            if (meld.type === 'flower') {
                meldFlowers = meldFlowers.concat(meld.tiles);
            } else {
                // 检查面子中是否包含花牌
                const flowerTiles = meld.tiles.filter(tile => tile.suit === 'flower');
                const normalTiles = meld.tiles.filter(tile => tile.suit !== 'flower');
                
                if (flowerTiles.length > 0) {
                    meldFlowers = meldFlowers.concat(flowerTiles);
                }
                
                if (normalTiles.length > 0) {
                    // 如果面子还有非花牌，保留面子但只包含非花牌
                    const cleanMeld = { ...meld, tiles: normalTiles };
                    nonFlowerMeldTiles.push(cleanMeld);
                    meldNormal = meldNormal.concat(normalTiles);
                }
            }
        });
        
        // 先分析花牌相关番种
        // 检查无花番种
        if (meldFlowers.length === 0) {
            totalFan += 1;
            fanDetails.push({ name: '無花', fan: 1 });
        }
        
        // 分析花牌
        const flowerAnalysis = this.analyzeFlowers(meldFlowers, conditions.playerWind);
        totalFan += flowerAnalysis.totalFan;
        fanDetails.push(...flowerAnalysis.fanDetails);
        
        // 花牌分析完毕，从此处开始只使用非花牌的副露进行分析
        // 设定门前清状态：没有除花牌和暗杠以外的副露
        const hasNonFlowerMelds = nonFlowerMeldTiles.some(meld => 
            meld.type !== 'concealed_quad' &&  // 暗杠不破坏门清
            meld.type !== 'flower'  // 花牌不破坏门清（已过滤）
        );
        conditions.isMunCinCeng = !hasNonFlowerMelds;
        
        // 特殊牌型优先判断（例牌）
        if (conditions.isTianhu) {
            // 天和必定门清，不另计自摸
            return { fan: 13, fu: 1, fanDetails: [{ name: '天和', fan: 13 }], isValid: true };
        }
        
        if (conditions.isDihu) {
            // 地和必定门清，不另计自摸
            return { fan: 13, fu: 1, fanDetails: [{ name: '地和', fan: 13 }], isValid: true };
        }
        
        if (conditions.isRenhu) {
            // 人和必定门清，不另计自摸
            return { fan: 13, fu: 1, fanDetails: [{ name: '人和', fan: 13 }], isValid: true };
        }
        
        // 检查十八罗汉（四个杠）- 使用过滤后的副露
        const quadCount = nonFlowerMeldTiles.filter(meld => 
            meld.type === 'quad' || meld.type === 'concealed_quad'
        ).length;
        if (quadCount === 4) {
            // 十八罗汉是全刻子，不另计对对和
            return { fan: 13, fu: 1, fanDetails: [{ name: '十八罗汉', fan: 13 }], isValid: true };
        }
        
        // 分析牌型结构 - 手牌和和牌张
        const pureHandTiles = [...handTiles, ...winningTile];
        
        // 检查九莲宝灯
        if (this.isSapSamJiu(pureHandTiles)) {
            // 十三幺必定门清，不另计自摸和门前清
            return { fan: 13, fu: 1, fanDetails: [{ name: '十三么', fan: 13 }], isValid: true };
        }
        
        // 检查九莲宝灯
        if (this.isGauLinBouDang(pureHandTiles, conditions.isMunCinCeng)) {
            // 九莲宝灯必定门清，不另计自摸和门前清
            return { fan: 10, fu: 1, fanDetails: [{ name: '九蓮寶燈', fan: 10 }], isValid: true };
        }
        
        // 使用过滤后的副露进行结构分析
        // 手牌应该只包含手牌和和牌张，不包含副露中的牌
        const structureAnalysis = this.analyzeHandStructure(pureHandTiles, [], nonFlowerMeldTiles, conditions);
        totalFan += structureAnalysis.totalFan;
        fanDetails.push(...structureAnalysis.fanDetails);
        
        // 检查特殊全刻子牌型，不另计对对和
        const hasSpecialAllTriplets = fanDetails.some(detail => 
            ['大四喜', '字一色', '坎坎胡'].includes(detail.name)
        );
        
        // 如果已经有特殊全刻子牌型，移除对对和
        if (hasSpecialAllTriplets) {
            const duiDuiIndex = fanDetails.findIndex(detail => detail.name === '對對和');
            if (duiDuiIndex !== -1) {
                totalFan -= fanDetails[duiDuiIndex].fan;
                fanDetails.splice(duiDuiIndex, 1);
            }
        }
        
        // 检查坎坎糊（四暗刻），必定门清，不另计自摸
        const hasKankanhu = fanDetails.some(detail => detail.name === '坎坎胡');
        
        // 和牌方式 - 根据特殊牌型决定是否计算
        const isMustMenqian = hasKankanhu; // 坎坎糊必定门清
        
        if (conditions.isTsumo && !isMustMenqian) {
            totalFan += 1;
            fanDetails.push({ name: '自摸', fan: 1 });
        }
        
        if (conditions.isMunCinCeng && !isMustMenqian) {
            totalFan += 1;
            fanDetails.push({ name: '門前清', fan: 1 });
        }
        
        if (conditions.isLinGongHoiFa) {
            totalFan += 8;
            fanDetails.push({ name: '連槓開花', fan: 8 });
        } else if (conditions.isGongSeungHoiFa) {
            totalFan += 2;
            fanDetails.push({ name: '槓上開花', fan: 2 });
        }
        
        if (conditions.isCoengGong) {
            totalFan += 1;
            fanDetails.push({ name: '搶槓', fan: 1 });
        }
        
        if (conditions.isHoiDaiLouJyut) {
            totalFan += 1;
            fanDetails.push({ name: '海底撈月', fan: 1 });
        }
        
        // 如果没有任何番种，检查是否为小和
        if (totalFan === 0) {
            // 小和：单纯四搭一对、无任何其他组合的牌型
            fanDetails.push({ name: '小和', fan: 0 });
            // 小和不满足起糊要求，会在后续检查中被拒绝
        }
        
        // 检查是否达到起糊要求
        if (totalFan < this.settings.minFan) {
            throw new Error(`未达到起糊要求：${totalFan}番 < ${this.settings.minFan}番`);
        }
        
        return {
            fan: totalFan,
            fu: 1,
            fanDetails: fanDetails,
            isValid: true
        };
    }
    
    /**
     * 分析花牌
     * 分析花牌组合并计算相应的番数
     * 
     * 花牌规则：
     * - 春夏秋冬(1-4)、梅兰菊竹(5-8)
     * - 大花和：8只花，8番
     * - 花和：7只花，3番
     * - 一台花：4只同类花，2番
     * - 正花：与座位风位对应的花，1番
     * 
     * @param {Array} flowerTiles - 花牌数组
     * @param {string} playerWind - 玩家风位
     * @returns {Object} 花牌分析结果
     */
    analyzeFlowers(flowerTiles, playerWind) {
        const analysis = {
            totalFan: 0,
            fanDetails: [],
            flowerCount: flowerTiles.length,
            hasCorrectFlower: false,
            hasOneTypeFlower: false,
            hasAllFlowers: false
        };
        
        if (flowerTiles.length === 0) {
            return analysis;
        }
        
        // 花牌分类：春夏秋冬(1-4) 和 梅兰菊竹(5-8)
        const seasons = flowerTiles.filter(tile => tile.number >= 1 && tile.number <= 4);
        const plants = flowerTiles.filter(tile => tile.number >= 5 && tile.number <= 8);
        
        // 检查八仙过海（八只花）
        if (flowerTiles.length === 8) {
            analysis.totalFan += 8;
            analysis.fanDetails.push({ name: '大花和', fan: 8 });
            analysis.hasAllFlowers = true;
            return analysis;
        }
        
        // 检查花和（七只花）
        if (flowerTiles.length === 7) {
            analysis.totalFan += 3;
            analysis.fanDetails.push({ name: '花和', fan: 3 });
            return analysis;
        }
        
        // 检查一台花
        if (seasons.length === 4) {
            analysis.totalFan += 2;
            analysis.fanDetails.push({ name: '一台花', fan: 2 });
            analysis.hasOneTypeFlower = true;
        } else if (plants.length === 4) {
            analysis.totalFan += 2;
            analysis.fanDetails.push({ name: '一台花', fan: 2 });
            analysis.hasOneTypeFlower = true;
        }
        
        // 检查正花
        if (playerWind && this.hasCorrectFlower(flowerTiles, playerWind)) {
            analysis.totalFan += 1;
            analysis.fanDetails.push({ name: '正花', fan: 1 });
            analysis.hasCorrectFlower = true;
        }
        
        return analysis;
    }
    
    /**
     * 检查是否有正花
     * 判断花牌是否与玩家风位匹配
     * 
     * 对应关系：
     * - 东：春(1)、梅(5)
     * - 南：夏(2)、兰(6)
     * - 西：秋(3)、菊(7)
     * - 北：冬(4)、竹(8)
     * 
     * @param {Array} flowerTiles - 花牌数组
     * @param {string} playerWind - 玩家风位
     * @returns {boolean} 是否有正花
     */
    hasCorrectFlower(flowerTiles, playerWind) {
        const windFlowerMap = {
            'east': [1, 5],   // 东：春、梅
            'south': [2, 6],  // 南：夏、兰
            'west': [3, 7],   // 西：秋、菊
            'north': [4, 8]   // 北：冬、竹
        };
        
        const correctFlowers = windFlowerMap[playerWind];
        if (!correctFlowers) return false;
        
        return flowerTiles.some(tile => correctFlowers.includes(tile.number));
    }
    
    /**
     * 检查是否为十三幺（粤语拼音：SapSamJiu）
     * 判断手牌是否为十三幺牌型
     * 
     * 十三幺：集齐六种幺九牌及七种字牌，其中一种作将
     * 必须有13种不同的幺九牌，其中一种有2张
     * 
     * @param {Array} tiles - 牌张数组
     * @returns {boolean} 是否为十三幺
     */
    isSapSamJiu(tiles) {
        if (tiles.length !== 14) return false;
        
        const yaochuTiles = [
            'man_1', 'man_9', 'pin_1', 'pin_9', 'sou_1', 'sou_9',
            'honor_1', 'honor_2', 'honor_3', 'honor_4', 'honor_5', 'honor_6', 'honor_7'
        ];
        
        const tileCount = this.countTiles(tiles);
        
        // 检查是否只有幺九牌
        for (const tile of tiles) {
            const key = `${tile.suit}_${tile.number}`;
            if (!yaochuTiles.includes(key)) {
                return false;
            }
        }
        
        // 检查是否有13种不同的幺九牌，其中一种有2张
        const uniqueTypes = Object.keys(tileCount).length;
        const pairCount = Object.values(tileCount).filter(count => count === 2).length;
        
        return uniqueTypes === 13 && pairCount === 1;
    }
    
    /**
     * 检查是否为九莲宝灯（粤语拼音：GauLinBouDang）
     * 判断手牌是否为九莲宝灯牌型
     * 
     * 九莲宝灯：门清状态下，同一花色的1112345678999 + 任意一张同花色牌
     * 必须门前清且为同一数字花色
     * 
     * @param {Array} tiles - 牌张数组
     * @param {boolean} isMunCin - 是否门前清
     * @returns {boolean} 是否为九莲宝灯
     */
    isGauLinBouDang(tiles, isMunCin) {
        if (!isMunCin || tiles.length !== 14) return false;
        
        // 必须是同一花色
        const suits = [...new Set(tiles.map(tile => tile.suit))];
        if (suits.length !== 1 || suits[0] === 'honor') return false;
        
        const suit = suits[0];
        const numbers = tiles.map(tile => tile.number).sort((a, b) => a - b);
        
        // 检查是否符合九莲宝灯模式：1112345678999
        const expected = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9];
        
        // 允许其中一张牌多一张（听牌状态）
        for (let i = 1; i <= 9; i++) {
            const testNumbers = [...expected];
            testNumbers.push(i);
            testNumbers.sort((a, b) => a - b);
            
            if (JSON.stringify(numbers) === JSON.stringify(testNumbers)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 分析花色
     * 分析牌张的花色组合类型
     * 
     * @param {Array} tiles - 牌张数组
     * @returns {Object} 花色分析结果
     * @returns {boolean} returns.isZiyise - 是否为字一色
     * @returns {boolean} returns.isQingyise - 是否为清一色
     * @returns {boolean} returns.isHunyise - 是否为混一色
     * @returns {Array} returns.suits - 包含的花色数组
     * @returns {Array} returns.numberSuits - 数字花色数组
     */
    analyzeColors(tiles) {
        const suits = [...new Set(tiles.map(tile => tile.suit))];
        const hasHonor = suits.includes('honor');
        const numberSuits = suits.filter(suit => suit !== 'honor');
        
        return {
            isZiyise: suits.length === 1 && suits[0] === 'honor',
            isQingyise: suits.length === 1 && suits[0] !== 'honor',
            isHunyise: numberSuits.length === 1 && hasHonor,
            suits: suits,
            numberSuits: numberSuits
        };
    }
    
    /**
     * 分析三元牌（粤语拼音：SamJyun）
     * 分析中发白三元牌的组合情况
     * 
     * @param {Array} melds - 面子数组
     * @param {Object} conditions - 和牌条件
     * @returns {Object} 三元牌分析结果
     * @returns {number} returns.totalFan - 总番数
     * @returns {Array} returns.fanDetails - 番种详情
     */
    analyzeSamJyun(melds, conditions) {
        const analysis = {
            totalFan: 0,
            fanDetails: []
        };
        
        const sangenMelds = melds.filter(meld => 
            meld.suit === 'honor' && 
            meld.number >= 5 && meld.number <= 7 && 
            (meld.type === 'triplet' || meld.type === 'quad' || meld.type === 'concealed_quad')
        );
        
        const sangenPairs = melds.filter(meld => 
            meld.suit === 'honor' && 
            meld.number >= 5 && meld.number <= 7 && 
            meld.type === 'pair'
        );
        
        // 大三元
        if (sangenMelds.length === 3) {
            analysis.totalFan += 8;
            analysis.fanDetails.push({ name: '大三元', fan: 8 });
            return analysis;
        }
        
        // 小三元
        if (sangenMelds.length === 2 && sangenPairs.length === 1) {
            analysis.totalFan += 5;
            analysis.fanDetails.push({ name: '小三元', fan: 5 });
            return analysis;
        }
        
        // 普通番牌
        sangenMelds.forEach(meld => {
            analysis.totalFan += 1;
            const names = ['', '', '', '', '', '紅中', '青發', '白板'];
            analysis.fanDetails.push({ name: `${names[meld.number]}`, fan: 1 });
        });
        
        return analysis;
    }
    
    /**
     * 将风位字符串转换为数字
     * 
     * @param {string} wind - 风位字符串 ('east', 'south', 'west', 'north')
     * @returns {number} 对应的数字 (1-4)
     */
    getWindNumber(wind) {
        const windMap = {
            'east': 1,
            'south': 2,
            'west': 3,
            'north': 4
        };
        return windMap[wind] || 0;
    }
    
    /**
     * 分析风牌（粤语拼音：FungPaai）
     * 分析东南西北风牌的组合情况
     * 
     * @param {Array} melds - 面子数组
     * @param {Object} conditions - 和牌条件
     * @returns {Object} 风牌分析结果
     * @returns {number} returns.totalFan - 总番数
     * @returns {Array} returns.fanDetails - 番种详情
     */
    analyzeFungPaai(melds, conditions) {
        const analysis = {
            totalFan: 0,
            fanDetails: []
        };
        
        const kazeMelds = melds.filter(meld => 
            meld.suit === 'honor' && 
            meld.number >= 1 && meld.number <= 4 && 
            (meld.type === 'triplet' || meld.type === 'quad' || meld.type === 'concealed_quad')
        );
        
        const kazePairs = melds.filter(meld => 
            meld.suit === 'honor' && 
            meld.number >= 1 && meld.number <= 4 && 
            meld.type === 'pair'
        );
        
        // 大四喜
        if (kazeMelds.length === 4) {
            analysis.totalFan += 13;
            analysis.fanDetails.push({ name: '大四喜', fan: 13 });
            return analysis;
        }
        
        // 小四喜
        if (kazeMelds.length === 3 && kazePairs.length === 1) {
            analysis.totalFan += 6;
            analysis.fanDetails.push({ name: '小四喜', fan: 6 });
            return analysis;
        }
        
        // 普通风牌番牌 - 检查门风和圈风
        kazeMelds.forEach(meld => {
            const windNames = ['東', '南', '西', '北'];
            const windName = windNames[meld.number - 1];
            
            // 检查是否为门风（自风）
            if (conditions.playerWind && this.getWindNumber(conditions.playerWind) === meld.number) {
                analysis.totalFan += 1;
                analysis.fanDetails.push({ name: `門風 ${windName}`, fan: 1 });
            }
            // 检查是否为圈风（场风）
            else if (conditions.roundWind && this.getWindNumber(conditions.roundWind) === meld.number) {
                analysis.totalFan += 1;
                analysis.fanDetails.push({ name: `場風 ${windName}`, fan: 1 });
            }
            // 其他风牌不计番（除非是自风或场风）
        });
        
        return analysis;
    }
    
    /**
     * 分析幺九牌（粤语拼音：JiuGau）
     * 分析1、9和字牌的组合情况
     * 
     * @param {Array} melds - 面子数组
     * @param {Array} tiles - 所有牌张
     * @returns {Object} 幺九牌分析结果
     * @returns {number} returns.totalFan - 总番数
     * @returns {Array} returns.fanDetails - 番种详情
     */
    analyzeJiuGau(melds, tiles) {
        const analysis = {
            totalFan: 0,
            fanDetails: []
        };
        
        const isYaochu = (tile) => {
            if (tile.suit === 'honor') return true;
            return tile.number === 1 || tile.number === 9;
        };
        
        const isTerminal = (tile) => {
            return tile.suit !== 'honor' && (tile.number === 1 || tile.number === 9);
        };
        
        const allYaochu = tiles.every(isYaochu);
        const allTerminals = tiles.every(isTerminal);
        const hasYaochu = tiles.some(isYaochu);
        
        // 清幺九
        if (allTerminals && melds.every(meld => meld.type === 'triplet' || meld.type === 'quad' || meld.type === 'concealed_quad' || meld.type === 'pair')) {
            analysis.totalFan += 10;
            analysis.fanDetails.push({ name: '清么九', fan: 10 });
            return analysis;
        }
        
        // 花幺九（混幺九）
        if (allYaochu && melds.every(meld => meld.type === 'triplet' || meld.type === 'quad' || meld.type === 'concealed_quad' || meld.type === 'pair')) {
            analysis.totalFan += 4;
            analysis.fanDetails.push({ name: '花么九', fan: 4 });
            return analysis;
        }
        
        return analysis;
    }
    
    /**
     * 分析手牌结构
     * 分析手牌的面子结构并计算相应番种
     * 正确处理副露信息，副露是固定的面子不能重新分解
     * 
     * @param {Array} handTiles - 手牌数组（不包含副露）
     * @param {Array} meldNormal - 副露中的普通牌（已弃用，保留兼容性）
     * @param {Array} meldTiles - 副露面子数组（固定面子）
     * @param {Object} conditions - 和牌条件
     * @returns {Object} 手牌结构分析结果
     */
    analyzeHandStructure(handTiles, meldNormal, meldTiles, conditions) {
        const analysis = {
            totalFan: 0,
            fanDetails: [],
            bestDecomposition: null
        };
        
        // 检查例牌（只需检查手牌，副露不影响例牌判定）
        if (this.isShisanyao(handTiles)) {
            analysis.totalFan += 13;
            analysis.fanDetails.push({ name: '十三么', fan: 13 });
            return analysis;
        }
        
        if (this.isJiulianbaodeng(handTiles, meldTiles.length === 0)) {
            analysis.totalFan += 10;
            analysis.fanDetails.push({ name: '九蓮寶燈', fan: 10 });
            return analysis;
        }
        
        // 分解手牌（不包含副露，副露是固定的）
        const decompositions = this.decomposeHand(handTiles, meldTiles.length);
        
        let bestFan = 0;
        let bestAnalysis = null;
        
        // 对每种分解方式计算番种
        for (const decomposition of decompositions) {
            const fanAnalysis = this.calculateFanForDecomposition(decomposition, meldTiles, conditions);
            
            if (fanAnalysis.totalFan > bestFan) {
                bestFan = fanAnalysis.totalFan;
                bestAnalysis = fanAnalysis;
            }
        }
        
        if (bestAnalysis) {
            analysis.totalFan = bestAnalysis.totalFan;
            analysis.fanDetails = bestAnalysis.fanDetails;
            analysis.bestDecomposition = bestAnalysis.decomposition;
        }
        
        return analysis;
    }
    
    /**
     * 分解手牌为所有可能的面子组合
     * 将手牌分解为不同的面子组合方式，用于计算最高番数
     * 考虑副露的数量来确定需要的面子数
     * 
     * @param {Array} tiles - 手牌数组
     * @param {number} meldCount - 副露面子数量
     * @returns {Array} 所有可能的分解方式
     */
    decomposeHand(tiles, meldCount = 0) {
        const decompositions = [];
        
        // 先检查特殊牌型（只有门前清时才可能）
        if (meldCount === 0) {
            if (this.isSapSamJiu(tiles)) {
                return [{ type: 'sapsam', melds: [], pair: null, tiles: tiles }];
            }
            
            if (this.isCatDeoiZi(tiles)) {
                const pairs = this.extractPairs(tiles);
                return [{ type: 'catdeoi', melds: [], pairs: pairs, tiles: tiles }];
            }
        }
        
        // 计算需要的面子数量：总共需要4个面子+1个对子，减去已有的副露
        const requiredMelds = 4 - meldCount;
        const requiredPairs = 1;
        
        // 递归分解普通牌型
        this.decomposeRecursive(tiles, [], decompositions, requiredMelds, requiredPairs);
        
        return decompositions;
    }
    
    /**
     * 递归分解手牌
     * 递归地尝试各种面子组合，找出所有可能的分解方式
     * 
     * @param {Array} remainingTiles - 剩余待分解的牌
     * @param {Array} currentMelds - 当前已分解的面子
     * @param {Array} decompositions - 分解结果数组
     * @param {number} requiredMelds - 还需要的面子数量
     * @param {number} requiredPairs - 还需要的对子数量
     */
    decomposeRecursive(remainingTiles, currentMelds, decompositions, requiredMelds, requiredPairs) {
        // 如果牌用完了，检查是否有效
        if (remainingTiles.length === 0) {
            const pairs = currentMelds.filter(m => m.type === 'pair');
            const sets = currentMelds.filter(m => m.type !== 'pair');
            
            // 检查是否满足要求的面子和对子数量
            if (pairs.length === requiredPairs && sets.length === requiredMelds) {
                decompositions.push({
                    type: 'standard',
                    melds: sets,
                    pair: pairs[0] || null,
                    tiles: [...currentMelds.flatMap(m => m.tiles)]
                });
            }
            return;
        }
        
        // 检查是否已经有足够的面子
        const currentPairs = currentMelds.filter(m => m.type === 'pair').length;
        const currentSets = currentMelds.filter(m => m.type !== 'pair').length;
        
        if (currentPairs > requiredPairs || currentSets > requiredMelds) {
            return; // 超出需要的数量
        }
        
        // 统计牌数
        const tileCount = this.countTiles(remainingTiles);
        
        // 尝试提取雀头（如果还需要）
        if (currentPairs < requiredPairs) {
            for (const [key, count] of Object.entries(tileCount)) {
                if (count >= 2) {
                    const [suit, number] = this.parseTileKey(key);
                    const pairTiles = this.removeTiles(remainingTiles, suit, number, 2);
                    const newMelds = [...currentMelds, { type: 'pair', tiles: pairTiles, suit, number }];
                    const newRemaining = this.removeSpecificTiles(remainingTiles, pairTiles);
                    this.decomposeRecursive(newRemaining, newMelds, decompositions, requiredMelds, requiredPairs);
                }
            }
        }
        
        // 尝试提取刻子（如果还需要面子）
        if (currentSets < requiredMelds) {
            for (const [key, count] of Object.entries(tileCount)) {
                if (count >= 3) {
                    const [suit, number] = this.parseTileKey(key);
                    const tripletTiles = this.removeTiles(remainingTiles, suit, number, 3);
                    const newMelds = [...currentMelds, { type: 'triplet', tiles: tripletTiles, suit, number, concealed: true }];
                    const newRemaining = this.removeSpecificTiles(remainingTiles, tripletTiles);
                    this.decomposeRecursive(newRemaining, newMelds, decompositions, requiredMelds, requiredPairs);
                }
            }
            
            // 尝试提取顺子（只对数字牌，如果还需要面子）
            for (const suit of ['man', 'pin', 'sou']) {
                for (let i = 1; i <= 7; i++) {
                    const key1 = `${suit}_${i}`;
                    const key2 = `${suit}_${i + 1}`;
                    const key3 = `${suit}_${i + 2}`;
                    
                    if (tileCount[key1] >= 1 && tileCount[key2] >= 1 && tileCount[key3] >= 1) {
                        const sequenceTiles = [
                            ...this.removeTiles(remainingTiles, suit, i, 1),
                            ...this.removeTiles(remainingTiles, suit, i + 1, 1),
                            ...this.removeTiles(remainingTiles, suit, i + 2, 1)
                        ];
                        const newMelds = [...currentMelds, { 
                            type: 'sequence', 
                            tiles: sequenceTiles, 
                            suit, 
                            startNumber: i,
                            concealed: true
                        }];
                        const newRemaining = this.removeSpecificTiles(remainingTiles, sequenceTiles);
                        this.decomposeRecursive(newRemaining, newMelds, decompositions, requiredMelds, requiredPairs);
                    }
                }
            }
        }
    }
    
    /**
     * 统计牌数
     * 统计各种牌的数量，返回键值对形式
     * 
     * @param {Array} tiles - 牌张数组
     * @returns {Object} 牌数统计对象，键为"花色_数字"格式
     */
    countTiles(tiles) {
        const count = {};
        tiles.forEach(tile => {
            const key = `${tile.suit}_${tile.number}`;
            count[key] = (count[key] || 0) + 1;
        });
        return count;
    }
    
    /**
     * 解析牌键
     * 将"花色_数字"格式的键解析为花色和数字
     * 
     * @param {string} key - 牌键，格式为"花色_数字"
     * @returns {Array} [花色, 数字]
     */
    parseTileKey(key) {
        const parts = key.split('_');
        return [parts[0], parseInt(parts[1])];
    }
    
    /**
     * 移除指定数量的牌
     * 从牌组中移除指定花色和数字的牌
     * 
     * @param {Array} tiles - 牌张数组
     * @param {string} suit - 花色
     * @param {number} number - 数字
     * @param {number} count - 要移除的数量
     * @returns {Array} 移除的牌张数组
     */
    removeTiles(tiles, suit, number, count) {
        const result = [];
        let removed = 0;
        for (const tile of tiles) {
            if (tile.suit === suit && tile.number === number && removed < count) {
                result.push(tile);
                removed++;
            }
        }
        return result;
    }
    
    /**
     * 从牌组中移除特定的牌
     * 从牌组中移除指定的具体牌张
     * 
     * @param {Array} tiles - 原牌张数组
     * @param {Array} tilesToRemove - 要移除的牌张数组
     * @returns {Array} 移除后的牌张数组
     */
    removeSpecificTiles(tiles, tilesToRemove) {
        const result = [...tiles];
        tilesToRemove.forEach(tileToRemove => {
            const index = result.findIndex(tile => 
                tile.suit === tileToRemove.suit && 
                tile.number === tileToRemove.number
            );
            if (index !== -1) {
                result.splice(index, 1);
            }
        });
        return result;
    }
    
    /**
     * 检查是否为七对子（粤语拼音：CatDeoiZi）
     * 判断手牌是否为七对子牌型（14张牌，7个对子）
     * 
     * @param {Array} tiles - 牌张数组
     * @returns {boolean} 是否为七对子
     */
    isCatDeoiZi(tiles) {
        if (tiles.length !== 14) return false;
        
        const tileCount = this.countTiles(tiles);
        const pairs = Object.values(tileCount).filter(count => count === 2);
        return pairs.length === 7;
    }
    
    /**
     * 提取对子
     * 从牌组中提取所有的对子
     * 
     * @param {Array} tiles - 牌张数组
     * @returns {Array} 对子数组
     */
    extractPairs(tiles) {
        const tileCount = this.countTiles(tiles);
        const pairs = [];
        
        for (const [key, count] of Object.entries(tileCount)) {
            if (count === 2) {
                const [suit, number] = this.parseTileKey(key);
                const pairTiles = this.removeTiles(tiles, suit, number, 2);
                pairs.push({ type: 'pair', tiles: pairTiles, suit, number });
            }
        }
        
        return pairs;
    }
    
    /**
     * 基于分解结果计算番种
     * 根据手牌分解结果计算所有适用的番种和番数
     * 
     * @param {Object} decomposition - 手牌分解结果
     * @param {Array} meldTiles - 副露面子数组
     * @param {Object} conditions - 和牌条件
     * @returns {Object} 番种计算结果
     */
    calculateFanForDecomposition(decomposition, meldTiles, conditions) {
        const analysis = {
            totalFan: 0,
            fanDetails: [],
            decomposition: decomposition
        };
        
        // 特殊牌型
        if (decomposition.type === 'sapsam') {
            analysis.totalFan += 13;
            analysis.fanDetails.push({ name: '十三么', fan: 13 });
            return analysis;
        }
        
        if (decomposition.type === 'catdeoi') {
            // 七对子在香港麻将中通常不被认可，但这里保留
            // 注意：标准香港麻将规则中七对子通常不允许
            analysis.totalFan += 2;
            analysis.fanDetails.push({ name: '七對子', fan: 2 });
        }
        
        // 合并手牌面子和副露面子
        const allMelds = [...(decomposition.melds || []), ...meldTiles];
        const allTiles = [...decomposition.tiles, ...meldTiles.flatMap(m => m.tiles)];
        
        // 分析花色
        const colorAnalysis = this.analyzeColors(allTiles);
        if (colorAnalysis.isZiyise) {
            analysis.totalFan += 10;
            analysis.fanDetails.push({ name: '字一色', fan: 10 });
            return analysis; // 例牌，不计其他番种
        }
        
        if (colorAnalysis.isQingyise) {
            analysis.totalFan += 7;
            analysis.fanDetails.push({ name: '清一色', fan: 7 });
        } else if (colorAnalysis.isHunyise) {
            analysis.totalFan += 3;
            analysis.fanDetails.push({ name: '混一色', fan: 3 });
        }
        
        // 分析对对和
        const isDuiDuihu = allMelds.every(meld => 
            meld.type === 'triplet' || meld.type === 'quad' || meld.type === 'concealed_quad' || meld.type === 'pair'
        );
        
        if (isDuiDuihu && decomposition.type === 'standard') {
            analysis.totalFan += 3;
            analysis.fanDetails.push({ name: '對對和', fan: 3 });
            
            // 检查坎坎胡（四暗刻）
            // 坎坎胡要求四个暗刻（包括暗杠），即没有碰、明杠过的对对和
            const concealed = allMelds.filter(meld => 
                (meld.type === 'triplet' || meld.type === 'quad' || meld.type === 'concealed_quad') && 
                (meld.concealed !== false || meld.type === 'concealed_quad')
            );
            
            if (concealed.length === 4) {
                analysis.totalFan += 8;
                analysis.fanDetails.push({ name: '坎坎胡', fan: 8 });
            }
        }
        
        // 分析平和
        if (decomposition.type === 'standard' && !isDuiDuihu) {
            const allSequences = allMelds.every(meld => 
                meld.type === 'sequence' || meld.type === 'pair'
            );
            
            if (allSequences) {
                analysis.totalFan += 1;
                analysis.fanDetails.push({ name: '平和', fan: 1 });
            }
        }
        
        // 分析三元牌和风牌
        const samJyunAnalysis = this.analyzeSamJyun(allMelds, conditions);
        analysis.totalFan += samJyunAnalysis.totalFan;
        analysis.fanDetails.push(...samJyunAnalysis.fanDetails);
        
        const fungPaaiAnalysis = this.analyzeFungPaai(allMelds, conditions);
        analysis.totalFan += fungPaaiAnalysis.totalFan;
        analysis.fanDetails.push(...fungPaaiAnalysis.fanDetails);
        
        // 分析幺九牌
        const jiuGauAnalysis = this.analyzeJiuGau(allMelds, allTiles);
        analysis.totalFan += jiuGauAnalysis.totalFan;
        analysis.fanDetails.push(...jiuGauAnalysis.fanDetails);
        
        // 检查是否有特殊全刻子牌型，这些牌型不另计对对和
        const hasSpecialAllTriplets = analysis.fanDetails.some(detail => 
            ['大四喜', '字一色', '坎坎胡'].includes(detail.name)
        );
        
        // 如果有特殊全刻子牌型，移除对对和
        if (hasSpecialAllTriplets) {
            const duiDuiIndex = analysis.fanDetails.findIndex(detail => detail.name === '對對和');
            if (duiDuiIndex !== -1) {
                analysis.totalFan -= analysis.fanDetails[duiDuiIndex].fan;
                analysis.fanDetails.splice(duiDuiIndex, 1);
            }
        }
        
        return analysis;
    }

    /**
     * 向后兼容性处理
     * 将旧的命名方式映射到新的粤语拼音命名
     * 确保现有代码能够正常工作
     * 
     * @param {Object} conditions - 和牌条件对象
     * @returns {Object} 处理后的条件对象
     */
    mapLegacyConditionNames(conditions) {
        if (!conditions) return conditions;
        
        const mapping = {
            // 旧命名 -> 新命名（粤语拼音）
            'isMenqianqing': 'isMunCinCeng',
            'isHaidilaoyue': 'isHoiDaiLouJyut',
            'isGangshangkaihua': 'isGongSeungHoiFa',
            'isQianggang': 'isCoengGong',
            'isLiangang': 'isLinGongHoiFa'
        };
        
        const mappedConditions = { ...conditions };
        
        // 映射旧命名到新命名
        for (const [oldName, newName] of Object.entries(mapping)) {
            if (oldName in mappedConditions && !(newName in mappedConditions)) {
                mappedConditions[newName] = mappedConditions[oldName];
                // 保留旧名称以确保兼容性
            }
        }
        
        return mappedConditions;
    }

    /**
     * 标准化副露
     * 将Parser返回的副露数据标准化为内部通用格式
     * 
     * Parser返回格式：{type: "暗槓", tiles: Array(4), original: "(1111s)", isConcealed: true}
     * 标准化格式：{type: "concealed_quad", tiles: Array(4), suit: "sou", number: 1, concealed: true}
     * 
     * @param {Array} rawMelds - Parser返回的原始副露数组
     * @returns {Array} 标准化后的副露数组
     */
    standardizeMelds(rawMelds) {
        if (!rawMelds || !Array.isArray(rawMelds)) {
            return [];
        }
        
        return rawMelds.map(rawMeld => this.standardizeSingleMeld(rawMeld)).filter(meld => meld !== null);
    }
    
    /**
     * 标准化单个副露
     * 
     * @param {Object} rawMeld - Parser返回的原始副露
     * @returns {Object|null} 标准化后的副露，无效时返回null
     */
    standardizeSingleMeld(rawMeld) {
        if (!rawMeld || !rawMeld.type || !rawMeld.tiles) {
            return null;
        }
        
        const { type: rawType, tiles, isConcealed = false } = rawMeld;
        
        // 类型映射表：中文 -> 英文标准格式
        const typeMapping = {
            '對子': 'pair',
            '对子': 'pair',
            '刻子': 'triplet',
            '順子': 'sequence',
            '顺子': 'sequence',
            '明槓': 'quad',
            '暗槓': 'concealed_quad',
            '明杠': 'quad',
            '暗杠': 'concealed_quad',
            '花牌': 'flower'
        };
        
        const standardType = typeMapping[rawType];
        if (!standardType) {
            console.warn(`未知的副露类型: ${rawType}`);
            throw new Error(`未知的副露类型: ${rawType}`);
        }
        
        // 验证牌张数量是否符合类型要求
        const expectedCounts = {
            'pair': 2,
            'triplet': 3,
            'sequence': 3,
            'quad': 4,
            'concealed_quad': 4,
            'flower': [1, 2, 3, 4, 5, 6, 7, 8] // 花牌可以是任意数量
        };
        
        const expected = expectedCounts[standardType];
        if (Array.isArray(expected)) {
            if (!expected.includes(tiles.length)) {
                console.warn(`副露 ${rawType} 的牌张数量不正确: 期望 ${expected.join('或')}, 实际 ${tiles.length}`);
                return null;
            }
        } else if (tiles.length !== expected) {
            console.warn(`副露 ${rawType} 的牌张数量不正确: 期望 ${expected}, 实际 ${tiles.length}`);
            return null;
        }
        
        // 确定花色和数字（对于顺子，使用起始数字）
        let suit = null;
        let number = null;
        let startNumber = null;
        
        if (tiles.length > 0) {
            const firstTile = tiles[0];
            suit = firstTile.suit;
            number = firstTile.number;
            
            // 对于顺子，确定起始数字
            if (standardType === 'sequence') {
                const numbers = tiles.map(t => t.number).sort((a, b) => a - b);
                startNumber = numbers[0];
                number = startNumber; // 顺子的number表示起始数字
            }
        }
        
        // 构造标准化副露
        const standardMeld = {
            type: standardType,
            tiles: tiles,
            suit: suit,
            number: number,
            concealed: isConcealed || standardType === 'concealed_quad',
            original: rawMeld.original || ''
        };
        
        // 顺子特有属性
        if (standardType === 'sequence') {
            standardMeld.startNumber = startNumber;
        }
        
        return standardMeld;
    }

    // ====== 向后兼容性别名方法 ======
    // 为保持向后兼容性，提供旧方法名的别名
    
    /** @deprecated 使用 isSapSamJiu 代替 */
    isShisanyao(tiles) { return this.isSapSamJiu(tiles); }
    
    /** @deprecated 使用 isGauLinBouDang 代替 */
    isJiulianbaodeng(tiles, isMenqian) { return this.isGauLinBouDang(tiles, isMenqian); }
    
    /** @deprecated 使用 isCatDeoiZi 代替 */
    isQiduizi(tiles) { return this.isCatDeoiZi(tiles); }
    
    /** @deprecated 使用 analyzeSamJyun 代替 */
    analyzeSangen(melds, conditions) { return this.analyzeSamJyun(melds, conditions); }
    
    /** @deprecated 使用 analyzeFungPaai 代替 */
    analyzeKazehai(melds, conditions) { return this.analyzeFungPaai(melds, conditions); }
    
    /** @deprecated 使用 analyzeJiuGau 代替 */
    analyzeYaochu(melds, tiles) { return this.analyzeJiuGau(melds, tiles); }
}

// 导出类
window.HongKongMahjong = HongKongMahjong;
