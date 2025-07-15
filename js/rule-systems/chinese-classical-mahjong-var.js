/**
 * 中国古典麻将规则系统
 * 实现传统中国麻将的计分规则
 */

class ChineseClassicalMahjongVar extends BaseRuleSystem {
    constructor() {
        super('中国古典麻将变种', '从一本盗印的麻将规则书中提取的变种规则');
        this.settings = {
            initialScore: 1000,     // 起始筹码
            targetScore: 2000,      // 目标筹码（未使用
            minScore: 0,            // 最低筹码限制（未使用
            manganPoints: 300,      // 满贯点数（同时也是封顶点数）
            includeFlowers: true,   // 包含花牌
            bankerContinue: true,   // 庄家连庄
            penaltyMangan: true,    // 错和赔满贯
            fullPaymentSystem: true, // 全铳制（默认开启）
            // 包牌设置
            baoFullPayment: true,   // 自摸包牌时包牌者承担全部费用
            baoRonSplitPayment: true, // 出铳包牌时包牌者和出铳者分摊费用
            baoSplitRatio: 0.5      // 包牌分摊比例（包牌者承担的比例）
        };
    }
    
    getSettingsDefinition() {
        return {
            '基本设置': {
                initialScore: { type: 'number', label: '起始筹码', default: 1000, min: 1000, max: 5000 },
                targetScore: { type: 'number', label: '目标筹码', default: 2000, min: 1500, max: 10000 },
                minScore: { type: 'number', label: '最低筹码', default: 0, min: -1000, max: 0 },
                manganPoints: { type: 'number', label: '满贯/封顶点数', default: 300, min: 200, max: 500 }
            },
            '分数计算': {
                fullPaymentSystem: { type: 'boolean', label: '全铳制', default: false, description: '开启时按日麻规则计分，关闭时不追究犯冲责任' }
            },
            '特殊规则': {
                includeFlowers: { type: 'boolean', label: '包含花牌', default: true },
                bankerContinue: { type: 'boolean', label: '庄家连庄', default: true },
                penaltyMangan: { type: 'boolean', label: '错和赔满贯', default: true }
            },
            '包牌规则': {
                baoFullPayment: { 
                    type: 'boolean', 
                    label: '自摸包牌全包', 
                    default: true, 
                    description: '自摸包牌时包牌者承担全部费用，否则按正常分摊' 
                },
                baoRonSplitPayment: { 
                    type: 'boolean', 
                    label: '出铳包牌分摊', 
                    default: true, 
                    description: '出铳包牌时包牌者和出铳者分摊费用，否则包牌者承担全部' 
                },
                baoSplitRatio: { 
                    type: 'number', 
                    label: '包牌分摊比例', 
                    default: 0.5, 
                    min: 0.1, 
                    max: 0.9, 
                    step: 0.1,
                    description: '包牌者在分摊费用中承担的比例（0.5表示各承担一半）' 
                }
            }
        };
    }
    
    formatRound(wind, round) {
        const windNames = {
            east: '东圈',
            south: '南圈', 
            west: '西圈',
            north: '北圈'
        };
        const roundNames = [null, '东', '南', '西', '北'];
        //return `${windNames[wind] || wind}${roundNames[round]}`;
        return `${windNames[wind] || wind}${round ? `${round}` : ''}`;
    }
    
    calculateScores(winner, payers, fanCount, fuCount, winType, banker, baoPlayer = 'none') {
        const scores = [];
        
        // 使用新的基础点数计算方法
        const basePoints = this.calculateBasePoints(fanCount, fuCount);
        
        const isZimo = winType === '自摸';
        
        let isBankerWin = winner === banker;
        
        // 先按正常规则计算所有人的分数变化
        let normalScores = this.calculateNormalScores(winner, payers, basePoints, isZimo, banker);
        
        // 如果有包牌者，则调整分数分配
        if (baoPlayer && baoPlayer !== 'none') {
            return this.applyBaoPlayerAdjustment(normalScores, winner, payers, baoPlayer, isZimo);
        }
        
        return normalScores;
    }
    
    // 计算正常情况下的分数分配
    calculateNormalScores(winner, payers, basePoints, isZimo, banker) {
        const scores = [];
        let isBankerWin = winner === banker;
        
        if (this.settings.fullPaymentSystem) {
            // 全铳制
            if (isZimo) {
                // 自摸
                if (isBankerWin) {
                    const paymentPerPlayer = (basePoints * 2);
                    const totalReceived = paymentPerPlayer * 3; // 三家支付点数之和为庄家得点
                    
                    ['east', 'south', 'west', 'north'].forEach(pos => {
                        if (pos === winner) {
                            scores.push({ player: pos, change: totalReceived });
                        } else {
                            scores.push({ player: pos, change: -paymentPerPlayer });
                        }
                    });
                } else {
                    const bankerPayment = basePoints * 2; // 庄家支付2份
                    const otherPayment = basePoints; // 其他两家各支付1份
                    const totalReceived = bankerPayment + otherPayment * 2;
                    
                    ['east', 'south', 'west', 'north'].forEach(pos => {
                        if (pos === winner) {
                            scores.push({ player: pos, change: totalReceived });
                        } else if (pos === banker) {
                            // 庄家支付2份
                            scores.push({ player: pos, change: -bankerPayment });
                        } else {
                            // 其他两家各支付1份
                            scores.push({ player: pos, change: -otherPayment });
                        }
                    });
                }
            } else {
                ['east', 'south', 'west', 'north'].forEach(pos => {
                    if (pos === winner) {
                        // 和牌者收取
                        let finalPoints = basePoints * 4;
                        if (winner === banker) {
                            // 庄家和牌或庄家放铳时，点数为基础点数的2倍
                            finalPoints = basePoints * 3 * 2;
                        }
                        scores.push({ player: pos, change: finalPoints });
                    } else if (payers.includes(pos)) {
                        // 出铳方支付
                        let finalPoints = basePoints * 4;
                        if (winner === banker) {
                            // 庄家放铳或庄家和牌时，支付的点数是基础点数的2倍
                            finalPoints = basePoints * 3 * 2;
                        }
                        scores.push({ player: pos, change: -finalPoints });
                    } else {
                        scores.push({ player: pos, change: 0 });
                    }
                });
            }
        } else {
            // 非全铳制
            // 不追究放炮责任：自摸和犯铳处理一致
            // 若庄家赢则每人支付2倍基础分，若闲家赢，庄家支付2倍基础分，其他闲家支付1倍基础分
            if (winner == banker) {
                // 庄家赢
                const paymentPerPlayer = basePoints * 2; // 每人支付2倍基础分
                const totalReceived = paymentPerPlayer * 3; // 三家支付点数之和为庄家得点
                ['east', 'south', 'west', 'north'].forEach(pos => {
                    if (pos === winner) {
                        scores.push({ player: pos, change: totalReceived });
                    } else {
                        scores.push({ player: pos, change: -paymentPerPlayer });
                    }
                });
            } else {
                // 闲家赢
                const bankerPayment = basePoints * 2; // 庄家支付2倍基础分
                const otherPayment = basePoints; // 其他两家各支付1倍基础分
                const totalReceived = bankerPayment + otherPayment * 2;
                ['east', 'south', 'west', 'north'].forEach(pos => {
                    if (pos === winner) {
                        scores.push({ player: pos, change: totalReceived });
                    } else if (pos === banker) {
                        // 庄家支付2倍基础分
                        scores.push({ player: pos, change: -bankerPayment });
                    } else {
                        // 其他两家各支付1倍基础分
                        scores.push({ player: pos, change: -otherPayment });
                    }
                });
            }
        }

        return scores;
    }
    
    calculateHandValue(hand, winTile, melds, conditions) {
        // 首先验证牌型是否有效并获取解析结果
        const validation = this.validateWinningHand(hand, winTile, melds);
        if (!validation.isValid) {
            throw new Error(`诈胡: ${validation.error}`);
        }
        
        // 解析手牌数据（复用验证中的解析逻辑）
        const parser = window.mahjongParser || new MahjongParser();
        parser.setPattern('relaxed');
        
        const handTiles = parser.parseHand(hand || '');
        const winningTile = parser.parseHand(winTile || '');
        const meldTiles = melds ? parser.parseMelds(melds) : [];
        
        // 分离花牌和非花牌
        let meldFlowers = [];
        let meldNormal = [];
        meldTiles.forEach(meld => {
            meld.tiles.forEach(tile => {
                if (tile.suit === 'flower') {
                    meldFlowers.push(tile);
                } else {
                    meldNormal.push(tile);
                }
            });
        });
        
        const allNormalTiles = [...handTiles, ...winningTile];
        
        // 检测门清状态并传递风牌信息
        const isMenQing = meldNormal.length === 0;
        const enhancedConditions = { 
            ...conditions, 
            isMenQing,
            roundWind: conditions.roundWind || conditions.windOfRound,
            playerWind: conditions.playerWind || conditions.windOfSeat
        };
        enhancedConditions.menQing = isMenQing; // 以防旧代码仍在使用
        
        let fanCount = 0; // 翻数
        let fuCount = 10;  // 副数（和数）【副低10副】
        
        // === 和牌方式翻数 ===
        if (enhancedConditions.isGangshangkaihua) fanCount += 1;         // 杠上开花：1翻
        if (enhancedConditions.isHaidiLaoyue) fanCount += 1;             // 海底摸月：1翻
        if (enhancedConditions.isQiangGang) fanCount += 1;               // 抢杠：1翻
        
        if (enhancedConditions.isTianhu) return { fan: 100, fu: 0, fanDetails: [{ name: '天和', fan: '满贯', description: `庄家起手和牌，固定${this.settings.manganPoints}分` }] };     // 天和：满贯
        if (enhancedConditions.isDihu) return { fan: 50, fu: 0, fanDetails: [{ name: '地和', fan: '半满贯', description: `闲家和庄家第一个弃牌，固定${Math.floor(this.settings.manganPoints / 2)}分` }] };     // 地和：半满贯
        
        // === 牌型分析 ===
        const analysis = this.analyzeHand(allNormalTiles, meldNormal, enhancedConditions, meldTiles, winningTile, handTiles);
        
        // === 一色翻数 ===
        if (analysis.isHunYiSe) fanCount += 1;                   // 混一色：1翻
        if (analysis.isQingYiSe) fanCount += 3;                  // 清一色：3翻
        
        // === 对对和 ===
        if (analysis.isDuiduihu) fanCount += 1;                  // 对对和：1翻
        
        // === 翻牌翻数 ===
        fanCount += analysis.fanpaiCount;                        // 每组翻牌：1翻
        
        // === 满贯牌型 ===
        if (analysis.isDaSanYuan) return { fan: 100, fu: 0, fanDetails: [{ name: '大三元', fan: '满贯', description: `中发白三副刻子，固定${this.settings.manganPoints}分` }] };   // 大三元：满贯
        if (analysis.isSiXiHu) return { fan: 100, fu: 0, fanDetails: [{ name: '四喜和', fan: '满贯', description: `东南西北四副刻子，三元雀头，固定${this.settings.manganPoints}分` }] };      // 四喜和：满贯
        if (analysis.isShiSanYao) return { fan: 100, fu: 0, fanDetails: [{ name: '十三幺', fan: '满贯', description: `十三张幺九牌，固定${this.settings.manganPoints}分` }] };   // 十三幺：满贯
        if (analysis.isJiuLianBaoDeng) return { fan: 100, fu: 0, fanDetails: [{ name: '九莲宝灯', fan: '满贯', description: `清一色特殊牌型，门清限定，固定${this.settings.manganPoints}分` }] }; // 九莲宝灯：满贯
        
        // === 副数计算 ===
        fuCount += analysis.kezi.zhongzhang * 2;                 // 中张明刻：2副
        fuCount += analysis.kezi.yaojiuMing * 4;                 // 幺九明刻：2*2=4副
        fuCount += analysis.kezi.zhongzhangAn * 4;               // 中张暗刻：2*2=4副
        fuCount += analysis.kezi.yaojiuAn * 8;                   // 幺九暗刻：2*2*2=8副
        fuCount += analysis.gangzi.zhongzhangMing * 8;           // 中张明杠：2*4=8副
        fuCount += analysis.gangzi.yaojiuMing * 16;              // 幺九明杠：2*2*4=16副
        fuCount += analysis.gangzi.zhongzhangAn * 16;            // 中张暗杠：2*2*4=16副
        fuCount += analysis.gangzi.yaojiuAn * 32;                // 幺九暗杠：2*2*2*4=32副
        
        // === 平和副数 ===
        if (analysis.isPingHe) fuCount += 10;                    // 平和：10副
        
        // === 雀头副数 ===
        fuCount += analysis.sparrow.normalWithWin * 2;          // 普通雀头（铳和）：2副
        fuCount += analysis.sparrow.yaojiuWithWin * 4;          // 幺九雀头（铳和）：4副
        fuCount += analysis.sparrow.normalSelfMade * 4;         // 普通雀头（自摸）：4副
        fuCount += analysis.sparrow.yaojiuSelfMade * 8;         // 幺九雀头（自摸）：8副
        // 注意：普通雀头（analysis.sparrow.normal/yaojiu）不加副
        
        // === 花牌副数和翻数 ===
        if (meldFlowers.length > 0 && this.settings.includeFlowers) {
            const flowers = this.analyzeFlowers(meldFlowers.length, enhancedConditions.flowerDetails, meldFlowers, enhancedConditions.playerWind);
            fuCount += flowers.pianhua * 2;                     // 偏花：2副
            fuCount += flowers.zhenghua * 4;                    // 正花：4副
            fanCount += flowers.yitaihua;                       // 一台花：1翻
        }
        
        // 收集翻符来源详情
        const fanDetails = [];
        const fuDetails = [];
        
        // === 收集翻数来源 ===
        if (enhancedConditions.isGangshangkaihua) fanDetails.push({ name: '杠上开花', fan: 1, description: '杠后摸到和牌' });
        if (enhancedConditions.isHaidiLaoyue) fanDetails.push({ name: '海底捞月', fan: 1, description: '最后一张牌自摸' });
        if (enhancedConditions.isQiangGang) fanDetails.push({ name: '抢杠', fan: 1, description: '抢他人加杠' });
        if (enhancedConditions.isTianhu) fanDetails.push({ name: '天和', fan: '满贯', description: `庄家起手和牌，固定${this.settings.manganPoints}分` });
        if (enhancedConditions.isDihu) fanDetails.push({ name: '地和', fan: '半满贯', description: `闲家和庄家第一个弃牌，固定${Math.floor(this.settings.manganPoints / 2)}分` });
        
        if (analysis.isHunYiSe) fanDetails.push({ name: '混一色', fan: 1, description: '一种花色加字牌' });
        if (analysis.isQingYiSe) fanDetails.push({ name: '清一色', fan: 3, description: '单一花色无字牌' });
        if (analysis.isDuiduihu) fanDetails.push({ name: '对对和', fan: 1, description: '四副刻子一对将' });
        
        if (analysis.fanpaiCount > 0) {
            fanDetails.push({ name: '翻牌', fan: analysis.fanpaiCount, description: `门风、圈风、三元牌刻子共${analysis.fanpaiCount}组` });
        }
        
        if (analysis.isDaSanYuan) fanDetails.push({ name: '大三元', fan: '满贯', description: `中发白三副刻子，固定${this.settings.manganPoints}分` });
        if (analysis.isSiXiHu) fanDetails.push({ name: '四喜和', fan: '满贯', description: `东南西北四副刻子，三元雀头，固定${this.settings.manganPoints}分` });
        if (analysis.isShiSanYao) fanDetails.push({ name: '十三幺', fan: '满贯', description: `十三张幺九牌，固定${this.settings.manganPoints}分` });
        if (analysis.isJiuLianBaoDeng) fanDetails.push({ name: '九莲宝灯', fan: '满贯', description: `清一色特殊牌型，门清限定，固定${this.settings.manganPoints}分` });
        
        if (meldFlowers.length > 0 && this.settings.includeFlowers) {
            const flowers = this.analyzeFlowers(meldFlowers.length, enhancedConditions.flowerDetails, meldFlowers);
            if (flowers.yitaihua > 0) {
                fanDetails.push({ name: '一台花', fan: flowers.yitaihua, description: '收集一套完整花牌' });
            }
        }
        
        // === 收集副数来源 ===
        if (analysis.kezi.zhongzhang > 0) fuDetails.push({ name: '中张明刻', fu: analysis.kezi.zhongzhang * 2, count: analysis.kezi.zhongzhang, description: `${analysis.kezi.zhongzhang}组，每组2副` });
        if (analysis.kezi.yaojiuMing > 0) fuDetails.push({ name: '幺九明刻', fu: analysis.kezi.yaojiuMing * 4, count: analysis.kezi.yaojiuMing, description: `${analysis.kezi.yaojiuMing}组，每组4副` });
        if (analysis.kezi.zhongzhangAn > 0) fuDetails.push({ name: '中张暗刻', fu: analysis.kezi.zhongzhangAn * 4, count: analysis.kezi.zhongzhangAn, description: `${analysis.kezi.zhongzhangAn}组，每组4副` });
        if (analysis.kezi.yaojiuAn > 0) fuDetails.push({ name: '幺九暗刻', fu: analysis.kezi.yaojiuAn * 8, count: analysis.kezi.yaojiuAn, description: `${analysis.kezi.yaojiuAn}组，每组8副` });
        
        if (analysis.gangzi.zhongzhangMing > 0) fuDetails.push({ name: '中张明杠', fu: analysis.gangzi.zhongzhangMing * 8, count: analysis.gangzi.zhongzhangMing, description: `${analysis.gangzi.zhongzhangMing}组，每组8副` });
        if (analysis.gangzi.yaojiuMing > 0) fuDetails.push({ name: '幺九明杠', fu: analysis.gangzi.yaojiuMing * 16, count: analysis.gangzi.yaojiuMing, description: `${analysis.gangzi.yaojiuMing}组，每组16副` });
        if (analysis.gangzi.zhongzhangAn > 0) fuDetails.push({ name: '中张暗杠', fu: analysis.gangzi.zhongzhangAn * 16, count: analysis.gangzi.zhongzhangAn, description: `${analysis.gangzi.zhongzhangAn}组，每组16副` });
        if (analysis.gangzi.yaojiuAn > 0) fuDetails.push({ name: '幺九暗杠', fu: analysis.gangzi.yaojiuAn * 32, count: analysis.gangzi.yaojiuAn, description: `${analysis.gangzi.yaojiuAn}组，每组32副` });
        
        if (analysis.isPingHe) fuDetails.push({ name: '平和', fu: 10, count: 1, description: '全顺子，无刻子杠子，固定10副' });
        
        // 雀头副数详情
        if (analysis.sparrow.normalWithWin > 0) {
            fuDetails.push({ 
                name: '中张雀头【铳和】', 
                fu: analysis.sparrow.normalWithWin * 2, 
                count: analysis.sparrow.normalWithWin, 
                description: `${analysis.sparrow.normalWithWin}组，每组2副` 
            });
        }
        if (analysis.sparrow.yaojiuWithWin > 0) {
            fuDetails.push({ 
                name: '幺九雀头【铳和】', 
                fu: analysis.sparrow.yaojiuWithWin * 4, 
                count: analysis.sparrow.yaojiuWithWin, 
                description: `${analysis.sparrow.yaojiuWithWin}组，每组4副` 
            });
        }
        if (analysis.sparrow.normalSelfMade > 0) {
            fuDetails.push({ 
                name: '中张雀头【自摸】', 
                fu: analysis.sparrow.normalSelfMade * 4, 
                count: analysis.sparrow.normalSelfMade, 
                description: `${analysis.sparrow.normalSelfMade}组，每组4副` 
            });
        }
        if (analysis.sparrow.yaojiuSelfMade > 0) {
            fuDetails.push({ 
                name: '幺九雀头【自摸】', 
                fu: analysis.sparrow.yaojiuSelfMade * 8, 
                count: analysis.sparrow.yaojiuSelfMade, 
                description: `${analysis.sparrow.yaojiuSelfMade}组，每组8副` 
            });
        }
        
        if (meldFlowers.length > 0 && this.settings.includeFlowers) {
            const flowers = this.analyzeFlowers(meldFlowers.length, enhancedConditions.flowerDetails, meldFlowers, enhancedConditions.playerWind);
            if (flowers.pianhua > 0) fuDetails.push({ name: '偏花', fu: flowers.pianhua * 2, count: flowers.pianhua, description: `${flowers.pianhua}张，每张2副` });
            if (flowers.zhenghua > 0) fuDetails.push({ name: '正花', fu: flowers.zhenghua * 4, count: flowers.zhenghua, description: `${flowers.zhenghua}张，每张4副` });
        }
        
        return { fan: fanCount, fu: fuCount, fanDetails, fuDetails, analysis };
    }
    
    // 完整的牌型分析
    analyzeHand(allNormalTiles, meldNormal, enhancedConditions = {}, meldTiles = [], winningTile = [], handTiles = []) {
        const analysis = {
            isHunYiSe: false,
            isQingYiSe: false,
            isDuiduihu: false,
            isDaSanYuan: false,
            isSiXiHu: false,
            isShiSanYao: false,
            isJiuLianBaoDeng: false,
            isPingHe: false,        // 平和（全顺子）
            fanpaiCount: 0,
            kezi: {
                zhongzhang: 0,      // 中张明刻
                yaojiuMing: 0,      // 幺九明刻
                zhongzhangAn: 0,    // 中张暗刻
                yaojiuAn: 0         // 幺九暗刻
            },
            gangzi: {
                zhongzhangMing: 0,  // 中张明杠
                yaojiuMing: 0,      // 幺九明杠
                zhongzhangAn: 0,    // 中张暗杠
                yaojiuAn: 0         // 幺九暗杠
            },
            sparrow: {
                normal: 1,          // 普通雀头
                yaojiu: 0,          // 幺九雀头
                normalSelfMade: 0,  // 普通雀头（自己做成）
                yaojiuSelfMade: 0,  // 幺九雀头（自己做成）
                normalWithWin: 0,   // 普通雀头（包含和牌）
                yaojiuWithWin: 0    // 幺九雀头（包含和牌）
            }
        };
        
        console.log(`分析牌型：${allNormalTiles.map(t => t.original || `${t.number}${t.suit}`).join('')}`);
        
        // 一色检查
        analysis.isHunYiSe = this.checkHunYiSe(allNormalTiles, meldNormal);
        analysis.isQingYiSe = this.checkQingYiSe(allNormalTiles, meldNormal);
        
        // 注意：对对和检查已移动到 analyzeHandStructure 中，基于实际分解结果进行判定
        
        // 满贯牌型检查
        analysis.isDaSanYuan = this.checkDaSanYuan(allNormalTiles, meldNormal);
        analysis.isSiXiHu = this.checkSiXiHu(allNormalTiles, meldNormal);
        analysis.isShiSanYao = this.checkShiSanYao(allNormalTiles);
        analysis.isJiuLianBaoDeng = this.checkJiuLianBaoDeng(allNormalTiles, meldNormal, enhancedConditions, handTiles, winningTile);
        
        // 翻牌计数（门风、圈风、中、发、白的刻子）
        analysis.fanpaiCount = this.countFanpaiSets(allNormalTiles, meldNormal, enhancedConditions.roundWind, enhancedConditions.playerWind);
        
        // 刻子、杠子、雀头和平和统一分析（使用相同的牌型分解）
        this.analyzeHandStructure(allNormalTiles, meldNormal, analysis, meldTiles, winningTile, handTiles, enhancedConditions);

        console.log(`分析结果: ${JSON.stringify(analysis)}`);
        
        return analysis;
    }
    
    // 混一色检查：一种花色加字牌
    checkHunYiSe(tiles, meldNormal = []) {
        // 合并手牌和副露中的牌
        const allTiles = [...tiles, ...meldNormal];
        const hasM = allTiles.some(t => t.suit === 'man');
        const hasP = allTiles.some(t => t.suit === 'pin');
        const hasS = allTiles.some(t => t.suit === 'sou');
        const hasZ = allTiles.some(t => t.suit === 'honor');
        
        const suitCount = [hasM, hasP, hasS].filter(Boolean).length;
        return suitCount === 1 && hasZ;
    }
    
    // 清一色检查：单一花色，无字牌
    checkQingYiSe(tiles, meldNormal = []) {
        // 合并手牌和副露中的牌
        const allTiles = [...tiles, ...meldNormal];
        const hasM = allTiles.some(t => t.suit === 'man');
        const hasP = allTiles.some(t => t.suit === 'pin');
        const hasS = allTiles.some(t => t.suit === 'sou');
        const hasZ = allTiles.some(t => t.suit === 'honor');
        
        const suitCount = [hasM, hasP, hasS].filter(Boolean).length;
        return suitCount === 1 && !hasZ;
    }
    
    // 对对和检查（已弃用 - 现在在 applyDecompositionToAnalysis 中基于实际分解结果进行判定）
    checkDuiduihu(tiles, meldNormal = []) {
        // 合并手牌和副露中的牌
        const allTiles = [...tiles, ...meldNormal];
        // 检查是否有足够的刻子组合
        const tileCount = this.getTileCountFromParsed(allTiles);
        const triplets = Object.values(tileCount).filter(count => count >= 3).length;
        return triplets >= 4;
    }
    
    // 大三元检查
    checkDaSanYuan(tiles, meldNormal = []) {
        // 合并手牌和副露中的牌
        const allTiles = [...tiles, ...meldNormal];
        const tileCount = this.getTileCountFromParsed(allTiles);
        const zhong = tileCount['honor-5'] || 0;
        const fa = tileCount['honor-6'] || 0;
        const bai = tileCount['honor-7'] || 0;
        return zhong >= 3 && fa >= 3 && bai >= 3;
    }
    
    // 四喜和检查（现代大四喜，雀头必须为三元牌）
    checkSiXiHu(tiles, meldNormal = []) {
        // 合并手牌和副露中的牌
        const allTiles = [...tiles, ...meldNormal];
        const tileCount = this.getTileCountFromParsed(allTiles);
        const dong = tileCount['honor-1'] || 0;
        const nan = tileCount['honor-2'] || 0;
        const xi = tileCount['honor-3'] || 0;
        const bei = tileCount['honor-4'] || 0;
        
        const windTriplets = [dong >= 3, nan >= 3, xi >= 3, bei >= 3].filter(Boolean).length;
        const hasSanyuanPair = this.hasSanyuanPair(allTiles);
        
        return windTriplets === 4 && hasSanyuanPair;
    }
    
    // 检查是否有三元牌雀头
    hasSanyuanPair(tiles) {
        const tileCount = this.getTileCountFromParsed(tiles);
        const zhong = tileCount['honor-5'] || 0;
        const fa = tileCount['honor-6'] || 0;
        const bai = tileCount['honor-7'] || 0;
        return zhong === 2 || fa === 2 || bai === 2;
    }
    
    // 十三幺检查
    checkShiSanYao(tiles) {
        if (tiles.length !== 14) return false;
        
        const requiredTiles = [
            'man-1', 'man-9', 'pin-1', 'pin-9', 'sou-1', 'sou-9',
            'honor-1', 'honor-2', 'honor-3', 'honor-4', 'honor-5', 'honor-6', 'honor-7'
        ];
        
        const tileCount = this.getTileCountFromParsed(tiles);
        const tileKeys = Object.keys(tileCount);
        
        // 检查是否只包含幺九牌
        if (!tileKeys.every(key => requiredTiles.includes(key))) return false;
        
        // 检查是否有且仅有一对
        const pairs = tileKeys.filter(key => tileCount[key] === 2);
        const singles = tileKeys.filter(key => tileCount[key] === 1);
        
        return pairs.length === 1 && singles.length === 12;
    }
    
    // 九莲宝灯检查 - 中国古典麻将要求纯正九莲宝灯
    checkJiuLianBaoDeng(tiles, meldNormal, enhancedConditions, handTiles = [], winningTile = []) {
        // 九莲宝灯必须门前清
        const isMenQing = !meldNormal || meldNormal.length === 0;
        if (!isMenQing) return false;
        
        // 检查是否为清一色且包含特定模式
        if (!this.checkQingYiSe(tiles)) return false;
        if (tiles.length !== 14) return false;
        
        // 获取牌的花色
        const suits = ['man', 'pin', 'sou'];
        let targetSuit = null;
        
        // 确定是哪种花色的清一色
        for (let suit of suits) {
            if (tiles.some(t => t.suit === suit)) {
                targetSuit = suit;
                break;
            }
        }
        
        if (!targetSuit) return false;
        
        // 中国古典麻将的纯正九莲宝灯严格要求：
        // 手牌必须是1112345678999（13张），和牌必须是1-9的任意一张
        
        // 如果没有传入handTiles和winningTile，则无法判断纯正形式
        if (!handTiles || handTiles.length === 0 || !winningTile || winningTile.length === 0) {
            return false;
        }
        
        // 统计手牌中该花色的牌数（不包括和牌）
        const handTileCount = {};
        for (let i = 1; i <= 9; i++) {
            handTileCount[i] = 0;
        }
        
        // 统计手牌（13张）
        for (let tile of handTiles) {
            if (tile.suit === targetSuit && tile.number >= 1 && tile.number <= 9) {
                handTileCount[tile.number]++;
            }
        }
        
        // 检查手牌是否严格符合1112345678999的模式
        const requiredPattern = [3, 1, 1, 1, 1, 1, 1, 1, 3]; // 1112345678999
        for (let i = 1; i <= 9; i++) {
            if (handTileCount[i] !== requiredPattern[i - 1]) {
                return false;
            }
        }
        
        // 检查和牌是否是同花色的1-9
        let isValidWinningTile = false;
        for (let tile of winningTile) {
            if (tile.suit === targetSuit && tile.number >= 1 && tile.number <= 9) {
                isValidWinningTile = true;
                break;
            }
        }
        
        if (!isValidWinningTile) {
            return false;
        }
        
        // 确认手牌总数为13张
        const totalHandTiles = Object.values(handTileCount).reduce((sum, count) => sum + count, 0);
        if (totalHandTiles !== 13) {
            return false;
        }
        
        return true;
    }
    
    // 统计翻牌刻子数量
    countFanpaiSets(tiles, meldNormal = [], roundWind, playerWind) {
        // 合并手牌和副露中的牌
        const allTiles = [...tiles, ...meldNormal];
        const tileCount = this.getTileCountFromParsed(allTiles);
        let count = 0;
        
        // 风牌映射：east=1, south=2, west=3, north=4
        const windMap = { east: 1, south: 2, west: 3, north: 4 };
        
        // 圈风刻子：1翻
        if (roundWind && windMap[roundWind] && tileCount[`honor-${windMap[roundWind]}`] >= 3) {
            count++;
        }
        
        // 门风刻子：1翻
        if (playerWind && windMap[playerWind] && tileCount[`honor-${windMap[playerWind]}`] >= 3) {
            count++;
        }
        
        // 三元牌刻子：中、发、白各1翻
        ['honor-5', 'honor-6', 'honor-7'].forEach(tile => {
            if (tileCount[tile] >= 3) count++;
        });
        
        return count;
    }
    
    // 检查特殊番数类型（中国古典麻将）
    getSpecialFanType(fanCount) {
        if (fanCount >= 100) {
            return { type: 'mangan', points: this.settings.manganPoints, name: '满贯' };
        } else if (fanCount >= 50) {
            return { type: 'half_mangan', points: Math.floor(this.settings.manganPoints / 2), name: '半满贯' };
        }
        return null; // 普通番数
    }
    
    // 计算基础点数（考虑满贯等特殊情况）
    calculateBasePoints(fanCount, fuCount) {
        const specialType = this.getSpecialFanType(fanCount);
        if (specialType) {
            return specialType.points;
        }
        
        // 普通计算：符数 × 2^番数
        const fu = fuCount || 0;
        const fan = fanCount || 0;
        let basePoints = fu * Math.pow(2, fan);
        
        // 满贯封顶（在中国古典麻将中，满贯点数即为封顶点数）
        if (basePoints >= this.settings.manganPoints) {
            return this.settings.manganPoints;
        }
        
        return basePoints;
    }

    // 刻子和杠子分析
    analyzeHandStructure(tiles, meldNormal, analysis, meldTiles = [], winningTile = [], handTiles = [], enhancedConditions = {}) {
        console.log(`开始分析手牌结构：手牌=${tiles.map(t => t.original || `${t.number}${t.suit}`).join('')}, 副露=${meldNormal.map(t => t.original || `${t.number}${t.suit}`).join('')}`);
        
        // 使用正确的牌型分解逻辑，找出所有可能的分解方式
        const allDecompositions = this.findAllValidDecompositions(tiles, meldNormal);
        
        if (allDecompositions.length === 0) {
            console.warn('未找到有效的牌型分解 - 可能是特殊牌型或诈胡');
            // 对于特殊牌型（如十三幺、七对子等），不进行标准分解
            // 这些牌型的副数会在其他地方专门处理
            return;
        }
        
        console.log(`找到${allDecompositions.length}种可能的分解`);
        
        // 计算每种分解的副数，选择副数最大的那种
        let bestDecomposition = null;
        let maxFu = -1;
        
        for (const decomposition of allDecompositions) {
            const fu = this.calculateDecompositionFu(decomposition, meldNormal);
            console.log(`分解方案副数: ${fu}`, decomposition);
            if (fu > maxFu) {
                maxFu = fu;
                bestDecomposition = decomposition;
            }
        }
        
        console.log(`选择最佳分解，副数: ${maxFu}`, bestDecomposition);
        
        // 应用最佳分解到分析结果（包括刻子、杠子、雀头和平和）
        this.applyDecompositionToAnalysis(bestDecomposition, meldNormal, analysis, meldTiles, winningTile, handTiles, enhancedConditions);
    }
    
    // 找出所有可能的有效牌型分解
    findAllValidDecompositions(tiles, meldNormal) {
        const decompositions = [];
        
        // 找出所有可能的雀头
        const possiblePairs = this.findAllPossiblePairs(tiles);
        
        for (const pairResult of possiblePairs) {
            const remainingTiles = [...pairResult.remaining];
            const pairTile = pairResult.pair[0];
            
            // 尝试分解剩余牌为顺子和刻子的所有可能组合
            const mianziCombinations = this.findAllMianziCombinations(remainingTiles);
            
            for (const mianziCombination of mianziCombinations) {
                decompositions.push({
                    pair: { tile: this.tileToKey(pairTile), count: 2 },
                    groups: mianziCombination
                });
            }
        }
        
        return decompositions;
    }
    
    // 找出剩余牌的所有可能面子组合
    findAllMianziCombinations(tiles) {
        const combinations = [];
        
        const findCombinations = (remainingTiles, currentGroups) => {
            if (remainingTiles.length === 0) {
                combinations.push([...currentGroups]);
                return;
            }
            
            if (remainingTiles.length % 3 !== 0) {
                return; // 剩余牌数不是3的倍数，无法组成面子
            }
            
            const tileCount = this.getTileCountFromParsed(remainingTiles);
            const sortedTileKeys = Object.keys(tileCount).sort();
            
            if (sortedTileKeys.length === 0) return;
            
            const firstTileKey = sortedTileKeys[0];
            const firstTile = remainingTiles.find(t => this.tileToKey(t) === firstTileKey);
            
            // 尝试刻子
            if (tileCount[firstTileKey] >= 3) {
                const newRemaining = [...remainingTiles];
                let removed = 0;
                for (let i = newRemaining.length - 1; i >= 0 && removed < 3; i--) {
                    if (this.tileToKey(newRemaining[i]) === firstTileKey) {
                        newRemaining.splice(i, 1);
                        removed++;
                    }
                }
                
                findCombinations(newRemaining, [
                    ...currentGroups,
                    { type: 'kezi', tile: firstTileKey, count: 3 }
                ]);
            }
            
            // 尝试顺子（仅数牌）
            if (this.canFormShunzi(firstTile, tileCount)) {
                const shunziTiles = this.getShunziTiles(firstTile);
                if (shunziTiles.every(tileKey => tileCount[tileKey] >= 1)) {
                    const newRemaining = [...remainingTiles];
                    shunziTiles.forEach(tileKey => {
                        const index = newRemaining.findIndex(t => this.tileToKey(t) === tileKey);
                        if (index !== -1) {
                            newRemaining.splice(index, 1);
                        }
                    });
                    
                    findCombinations(newRemaining, [
                        ...currentGroups,
                        { type: 'shunzi', tiles: shunziTiles }
                    ]);
                }
            }
        };
        
        findCombinations(tiles, []);
        return combinations;
    }
    
    // 检查是否可以形成顺子
    canFormShunzi(tile, tileCount) {
        if (tile.suit === 'honor' || tile.suit === 'flower') {
            return false; // 字牌和花牌不能组成顺子
        }
        
        if (tile.number > 7) {
            return false; // 8、9无法作为顺子开头
        }
        
        const baseKey = this.tileToKey(tile);
        const nextKey = this.tileToKey({ ...tile, number: tile.number + 1 });
        const thirdKey = this.tileToKey({ ...tile, number: tile.number + 2 });
        
        return tileCount[baseKey] >= 1 && tileCount[nextKey] >= 1 && tileCount[thirdKey] >= 1;
    }
    
    // 获取顺子的三张牌
    getShunziTiles(tile) {
        return [
            this.tileToKey(tile),
            this.tileToKey({ ...tile, number: tile.number + 1 }),
            this.tileToKey({ ...tile, number: tile.number + 2 })
        ];
    }
    
    // 计算某种分解的副数贡献
    calculateDecompositionFu(decomposition, meldNormal) {
        let fu = 0;
        
        // 雀头副数
        if (this.isYaojiuTileFromKey(decomposition.pair.tile)) {
            fu += 2; // 幺九雀头
        }
        
        // 面子副数
        for (const group of decomposition.groups) {
            if (group.type === 'kezi') {
                const isYaojiu = this.isYaojiuTileFromKey(group.tile);
                
                // 检查是否为暗刻（不在副露中）
                const meldTileKeys = meldNormal.map(tile => this.tileToKey(tile));
                const isConcealed = !meldTileKeys.includes(group.tile);
                
                if (isYaojiu) {
                    fu += isConcealed ? 8 : 4; // 幺九暗刻8副，明刻4副
                } else {
                    fu += isConcealed ? 4 : 2; // 中张暗刻4副，明刻2副
                }
            }
            // 顺子不加副数
        }
        
        return fu;
    }
    
    // 将最佳分解应用到分析结果
    applyDecompositionToAnalysis(decomposition, meldNormal, analysis, meldTiles = [], winningTile = [], handTiles = [], enhancedConditions = {}) {
        // 重置计数
        analysis.kezi = {
            zhongzhang: 0,
            yaojiuMing: 0,
            zhongzhangAn: 0,
            yaojiuAn: 0
        };
        
        analysis.gangzi = {
            zhongzhangMing: 0,
            yaojiuMing: 0,
            zhongzhangAn: 0,
            yaojiuAn: 0
        };
        
        analysis.keziDetails = [];
        analysis.gangziDetails = [];
        
        // 获取和牌方式信息
        const isZimo = enhancedConditions.isZimo;
        const winTileKey = winningTile.length > 0 ? this.tileToKey(winningTile[0]) : null;
        
        // 处理雀头 - 根据和牌方式判断雀头类型
        const isYaojiuPair = this.isYaojiuTileFromKey(decomposition.pair.tile);
        let pairType = 'normal'; // 'normal', 'zimo', 'ron'
        
        if (winTileKey && decomposition.pair.tile === winTileKey) {
            // 和牌参与了雀头组成
            if (isZimo) {
                // 自摸：该雀头要被标记为自摸雀头
                pairType = 'zimo';
            } else {
                // 犯冲：该雀头要被标记为铳和雀头
                pairType = 'ron';
            }
        } else {
            // 雀头来自于手牌，是普通雀头
            pairType = 'normal';
        }
        
        // 重置所有雀头计数
        analysis.sparrow = {
            normal: 0,
            yaojiu: 0,
            normalSelfMade: 0,
            yaojiuSelfMade: 0,
            normalWithWin: 0,
            yaojiuWithWin: 0
        };
        
        // 根据雀头类型设置计数
        if (isYaojiuPair) {
            analysis.sparrow.yaojiu = 1;
            if (pairType === 'ron') {
                analysis.sparrow.yaojiuWithWin = 1; // 铳和雀头
            } else if (pairType === 'zimo') {
                analysis.sparrow.yaojiuSelfMade = 1; // 自摸雀头
            }
            // 如果是 normal 类型，则不加副（普通雀头）
        } else {
            analysis.sparrow.normal = 1;
            if (pairType === 'ron') {
                analysis.sparrow.normalWithWin = 1; // 铳和雀头
            } else if (pairType === 'zimo') {
                analysis.sparrow.normalSelfMade = 1; // 自摸雀头
            }
            // 如果是 normal 类型，则不加副（普通雀头）
        }
        
        // 处理手牌分解的面子（暗刻等）- 需要考虑和牌方式对刻子类型的影响
        // decomposition只包含手牌，不包含副露，所以其中的刻子默认都是暗刻
        for (const group of decomposition.groups) {
            if (group.type === 'kezi') {
                const isYaojiu = this.isYaojiuTileFromKey(group.tile);
                let isConcealed = true; // decomposition中的刻子默认为暗刻
                
                // 检查和牌是否参与了刻子组成（贪心策略优化）
                if (!isZimo && winTileKey && group.tile === winTileKey) {
                    // 点炮和牌且和牌参与刻子组成时，需要进一步判断
                    // 贪心策略：统计手牌中该牌的总数量
                    const allTiles = [...handTiles, ...winningTile];
                    const tileCount = allTiles.filter(tile => this.tileToKey(tile) === group.tile).length;
                    
                    // 若手牌中该牌总数>=4张，则将和牌排除在刻子之外（保持暗刻，得分更高）
                    // 若手牌中该牌总数=3张，则和牌必须参与刻子组成（明刻）
                    if (tileCount === 3) {
                        isConcealed = false; // 只有3张时，和牌必须参与刻子，标记为明刻
                    }
                    // tileCount >= 4时，保持isConcealed = true，将和牌排除在刻子之外
                }
                
                analysis.keziDetails.push({ tile: group.tile, isConcealed });
                
                if (isYaojiu) {
                    if (isConcealed) analysis.kezi.yaojiuAn++;
                    else analysis.kezi.yaojiuMing++;
                } else {
                    if (isConcealed) analysis.kezi.zhongzhangAn++;
                    else analysis.kezi.zhongzhang++;
                }
            }
        }
        
        // 处理副露中的刻子和杠子（已知类型）
        if (meldTiles && meldTiles.length > 0) {
            meldTiles.forEach(meld => {
                // 过滤掉花牌，只处理非花牌的副露
                const normalTiles = meld.tiles.filter(tile => tile.suit !== 'flower');
                if (normalTiles.length === 0) return;
                
                // 获取第一张牌的信息来判断是否为幺九牌
                const firstTile = normalTiles[0];
                const tileKey = this.tileToKey(firstTile);
                const isYaojiu = this.isYaojiuTileFromKey(tileKey);
                
                // 根据副露类型处理
                if (meld.type === '刻子' || (normalTiles.length === 3 && this.isAllSameTile(normalTiles))) {
                    // 明刻
                    analysis.keziDetails.push({ tile: tileKey, isConcealed: false });
                    
                    if (isYaojiu) {
                        analysis.kezi.yaojiuMing++;
                    } else {
                        analysis.kezi.zhongzhang++;
                    }
                } else if (meld.type === '明槓') {
                    // 明杠
                    analysis.gangziDetails.push({ tile: tileKey, isConcealed: false });
                    
                    if (isYaojiu) {
                        analysis.gangzi.yaojiuMing++;
                    } else {
                        analysis.gangzi.zhongzhangMing++;
                    }
                } else if (meld.type === '暗槓') {
                    // 暗杠
                    analysis.gangziDetails.push({ tile: tileKey, isConcealed: true });
                    
                    if (isYaojiu) {
                        analysis.gangzi.yaojiuAn++;
                    } else {
                        analysis.gangzi.zhongzhangAn++;
                    }
                }
                // 顺子不需要特殊处理，不计副数
            });
        }
        
        // 平和判定：检查是否全为顺子（无刻子和杠子）
        const hasKezi = analysis.kezi.zhongzhang > 0 || analysis.kezi.yaojiuMing > 0 || 
                        analysis.kezi.zhongzhangAn > 0 || analysis.kezi.yaojiuAn > 0;
        const hasGangzi = analysis.gangzi.zhongzhangMing > 0 || analysis.gangzi.yaojiuMing > 0 ||
                         analysis.gangzi.zhongzhangAn > 0 || analysis.gangzi.yaojiuAn > 0;
        const allShunzi = decomposition.groups.every(group => group.type === 'shunzi');
        
        // 平和：全为顺子（基于最优分解的判定）
        analysis.isPingHe = allShunzi && !hasKezi && !hasGangzi;
        
        // 对对和：基于最优分解的判定，需要至少4个刻子（包括副露）
        const handKeziCount = decomposition.groups.filter(group => group.type === 'kezi').length;
        let meldKeziCount = 0;
        if (meldTiles && meldTiles.length > 0) {
            meldKeziCount = meldTiles.filter(meld => {
                const normalTiles = meld.tiles.filter(tile => tile.suit !== 'flower');
                return meld.type === '刻子' || meld.type === '明槓' || meld.type === '暗槓' || 
                       (normalTiles.length === 3 && this.isAllSameTile(normalTiles)) ||
                       (normalTiles.length === 4 && this.isAllSameTile(normalTiles));
            }).length;
        }
        const totalKeziCount = handKeziCount + meldKeziCount;
        analysis.isDuiduihu = totalKeziCount >= 4;
        
        console.log(`对对和判定: 手牌刻子=${handKeziCount}, 副露刻子=${meldKeziCount}, 总刻子=${totalKeziCount}, 结果=${analysis.isDuiduihu}`);
        console.log(`平和判定: 全顺子=${allShunzi}, 无刻子=${!hasKezi}, 无杠子=${!hasGangzi}, 结果=${analysis.isPingHe}`);
        console.log(`刻子统计: 中张明刻=${analysis.kezi.zhongzhang}, 幺九明刻=${analysis.kezi.yaojiuMing}, 中张暗刻=${analysis.kezi.zhongzhangAn}, 幺九暗刻=${analysis.kezi.yaojiuAn}`);
        console.log(`杠子统计: 中张明杠=${analysis.gangzi.zhongzhangMing}, 幺九明杠=${analysis.gangzi.yaojiuMing}, 中张暗杠=${analysis.gangzi.zhongzhangAn}, 幺九暗杠=${analysis.gangzi.yaojiuAn}`);
    }
    
    // 花牌分析
    analyzeFlowers(flowerCount, flowerDetails, meldFlowers = [], playerWind = null) {
        const flowers = {
            pianhua: 0,     // 偏花
            zhenghua: 0,    // 正花
            yitaihua: 0     // 一台花
        };

        console.log(`分析花牌：副露花牌=${meldFlowers.map(f => f.original || `${f.number}${f.suit}`)}, 门风=${playerWind}`);
        
        // 风牌映射：east=1, south=2, west=3, north=4
        const windMap = { east: 1, south: 2, west: 3, north: 4 };
        const playerWindNumber = windMap[playerWind];
        
        if (meldFlowers && meldFlowers.length > 0) {
            // 基于实际花牌副露进行分析
            meldFlowers.forEach(flower => {
                // 花牌编号：1-4为春夏秋冬，5-8为梅兰竹菊
                // 正花：春(1)夏(2)秋(3)冬(4) 对应 东(1)南(2)西(3)北(4)
                // 偏花：梅(5)兰(6)菊(7)竹(8) 对应 东(1)南(2)西(3)北(4)
                const flowerNumber = flower.number;
                
                if (flowerNumber >= 1 && flowerNumber <= 4) {
                    if (playerWindNumber && flowerNumber === playerWindNumber) {
                        flowers.zhenghua++;
                    } else {
                        flowers.pianhua++;
                    }
                } else if (flowerNumber >= 5 && flowerNumber <= 8) {
                    const correspondingWind = flowerNumber - 4; // 5->1, 6->2, 7->3, 8->4
                    if (playerWindNumber && correspondingWind === playerWindNumber) {
                        flowers.zhenghua++;
                    } else {
                        flowers.pianhua++;
                    }
                }
            });
            
            // 检查一台花：春夏秋冬全齐或梅兰竹菊全齐
            const seasonSet = new Set();
            const flowerSet = new Set();
            
            meldFlowers.forEach(flower => {
                const flowerNumber = flower.number;
                if (flowerNumber >= 1 && flowerNumber <= 4) {
                    seasonSet.add(flowerNumber);
                } else if (flowerNumber >= 5 && flowerNumber <= 8) {
                    flowerSet.add(flowerNumber);
                }
            });
            
            if (seasonSet.size === 4 || flowerSet.size === 4) {
                flowers.yitaihua = 1;
            }
            
        } else if (flowerDetails) {
            // 根据具体花牌详情分析（备用方案）
            flowers.zhenghua = flowerDetails.zhenghua || 0;
            flowers.pianhua = flowerDetails.pianhua || 0;
            flowers.yitaihua = flowerDetails.yitaihua || 0;
        } else if (flowerCount && flowerCount > 0) {
            // 如果只有花牌数量但没有详情，默认全部为偏花（仅作为后备）
            console.warn('花牌分析：缺少具体花牌信息，默认全部为偏花');
            flowers.pianhua = flowerCount;
        }
        
        console.log(`花牌分析结果: 正花=${flowers.zhenghua}, 偏花=${flowers.pianhua}, 一台花=${flowers.yitaihua}`);
        
        return flowers;
    }
    
    // 准备计算条件（中国古典麻将特定逻辑）
    prepareConditions(baseConditions, gameState, winnerPosition, winType, melds) {
        // 调用基类方法获取基本条件
        const enhancedConditions = super.prepareConditions(baseConditions, gameState, winnerPosition, winType);
        
        // 中国古典麻将特定的自动参数
        if (gameState && winnerPosition) {
            // 门清状态（无副露）
            if (!melds || melds.trim() === '') {
                enhancedConditions.menQing = true;
                enhancedConditions.isMenQing = true; // 兼容性
            }
            
            // 参数名兼容性处理
            enhancedConditions.windOfRound = enhancedConditions.roundWind;
            enhancedConditions.windOfSeat = enhancedConditions.playerWind;
        }
        
        return enhancedConditions;
    }

    // 辅助方法：获取牌的计数
    getTileCount(tiles) {
        const count = {};
        const matches = tiles.match(/\d[mpsz]/g) || [];
        matches.forEach(tile => {
            count[tile] = (count[tile] || 0) + 1;
        });
        return count;
    }
    
    // 辅助方法：从解析后的牌型获取计数
    getTileCountFromParsed(tiles) {
        const count = {};
        tiles.forEach(tile => {
            const key = this.tileToKey(tile);
            count[key] = (count[key] || 0) + 1;
        });
        return count;
    }
    
    // 辅助方法：判断是否为幺九牌
    isYaojiuTile(tile) {
        return /[19][mps]|[1-7]z/.test(tile);
    }
    
    // 辅助方法：从键值判断是否为幺九牌
    isYaojiuTileFromKey(tileKey) {
        const [suit, number] = tileKey.split('-');
        const num = parseInt(number);
        
        if (suit === 'honor') {
            return true; // 所有字牌都是幺九牌
        } else if (suit === 'man' || suit === 'pin' || suit === 'sou') {
            return num === 1 || num === 9;
        }
        return false;
    }
    
    // 判断是否为满贯牌型
    isManganHand(fanCount) {
        // 满贯牌型：天和、大三元、四喜和、十三幺、九莲宝灯
        return fanCount == 100; // 这些牌型会设置为100翻
    }
    
    getSupportedYaku() {
        const manganPoints = this.settings.manganPoints || 300;
        const halfManganPoints = Math.floor(manganPoints / 2);
        
        return [
            // 和牌方式
            { name: '杠上开花', fan: 1, description: '杠后摸到和牌' },
            { name: '海底捞月', fan: 1, description: '最后一张牌自摸' },
            { name: '抢杠', fan: 1, description: '抢他人加杠' },
            { name: '对对和', fan: 1, description: '四副刻子一对将' },
            
            // 一色
            { name: '混一色', fan: 1, description: '一种花色加字牌' },
            { name: '清一色', fan: 3, description: '单一花色无字牌' },
            
            // 翻牌
            { name: '门风刻', fan: 1, description: '本门风刻子' },
            { name: '圈风刻', fan: 1, description: '本圈风刻子' },
            { name: '中刻', fan: 1, description: '红中刻子' },
            { name: '发刻', fan: 1, description: '青发刻子' },
            { name: '白刻', fan: 1, description: '白板刻子' },
            
            // 花牌
            { name: '一台花', fan: 1, description: '收集一套完整花牌' },
            
            // 满贯牌型
            { name: '天和', fan: '满贯', description: `庄家起手和牌，固定${manganPoints}分` },
            { name: '地和', fan: '半满贯', description: `闲家和专家第一个弃牌，固定${halfManganPoints}分` },
            { name: '三元和', fan: '满贯', description: `中发白三副刻子，固定${manganPoints}分` },
            { name: '四喜和', fan: '满贯', description: `东南西北四副刻子，三元雀头，固定${manganPoints}分` },
            { name: '十三幺', fan: '满贯', description: `十三张幺九牌，固定${manganPoints}分` },
            { name: '九莲宝灯', fan: '满贯', description: `清一色特殊牌型，固定${manganPoints}分` }
        ];
    }
    
    getSpecialRules() {
        const manganPoints = this.settings.manganPoints || 300;
        const bankerMultiplier = 2 || 2;
        
        return [
            `满贯：${manganPoints}点`,
            `东家（庄家）的一切点数得失乘${bankerMultiplier}`,
            '错吃、错碰、多牌、少牌一切得点无效',
            '错和向三家赔满贯并过庄',
            `结算点数超${manganPoints}点皆按${manganPoints}点计算`,
            '副数计算：',
            '　• 中张明刻：2副，幺九刻×2，暗刻×2',
            '　• 杠子：刻子×4，最多幺九暗杠32副',
            '　• 雀头：铳和2/4副，自摸4/8副（普通/幺九）',
            '　　　　　　普通雀头不加副',
            '　• 平和：10副（全顺子，无刻子杠子）',
            '和牌方式影响：',
            '　• 犯冲：和牌参与刻子→明刻，参与雀头→铳和雀头',
            '　• 自摸：和牌参与雀头→自摸雀头',
            '花牌计算：',
            '　• 偏花：2副，正花：4副',
            '　• 一台花：1翻'
        ];
    }
    
    getSupportedWinConditions() {
        return [
            { key: 'isZimo', label: '自摸', default: false },
            { key: 'isGangshangkaihua', label: '杠上开花', default: false },
            { key: 'isHaidiLaoyue', label: '海底摸月', default: false },
            { key: 'isQiangGang', label: '抢杠', default: false },
            { key: 'isTianhu', label: '天和', default: false },
            { key: 'isDihu', label: '地和', default: false },
            { key: 'flowerDetails', label: '花牌详情', default: {}, type: 'object', 
              description: '包含正花、偏花、一台花的详细信息（自动从副露花牌计算）', hide: true },
            { key: 'menQing', label: '门清', default: false, hide: true},
            { key: 'windOfSeat', label: '门风', default: 'east', type: 'select', 
              options: [
                  { value: 'east', label: '东风' },
                  { value: 'south', label: '南风' },
                  { value: 'west', label: '西风' },
                  { value: 'north', label: '北风' }
              ], hide: true},
            { key: 'windOfRound', label: '圈风', default: 'east', type: 'select',
              options: [
                  { value: 'east', label: '东风圈' },
                  { value: 'south', label: '南风圈' },
                  { value: 'west', label: '西风圈' },
                  { value: 'north', label: '北风圈' }
              ], hide: true}
        ];
    }

    calculateFraudPenalty() {
        // 赔满贯
        return this.settings.manganPoints * 3; // 三家各赔满贯
    }
    
    getLocalizedStrings() {
        return {
            fanLabel: '翻数',
            fuLabel: '副数',
            fanUnit: '翻',  // 用于历史记录显示的简化单位
            fuUnit: '副',   // 用于历史记录显示的简化单位
            honbaLabel: '连庄',
            winType: {
                自摸: '自摸',
                和牌: '铳和'
            },
            payerText: '出冲',
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
    
    
    // 处理犯规和错和
    calculatePenalty(penaltyType, offender) {
        const scores = [];
        const manganPoints = this.settings.manganPoints;
        
        if (penaltyType === 'wrongWin') {
            // 错和向三家赔满贯
            ['east', 'south', 'west', 'north'].forEach(pos => {
                if (pos === offender) {
                    scores.push({ player: pos, change: -manganPoints * 3 });
                } else {
                    scores.push({ player: pos, change: manganPoints });
                }
            });
        } else if (penaltyType === 'invalidPlay') {
            // 错吃、错碰、多牌、少牌：得点无效
            scores.push({ player: offender, change: 0, note: '本局得点无效' });
        }
        
        return scores;
    }
    
    // 获取下一圈局信息（覆盖基类方法以实现庄家连庄规则）
    getNextRound(currentWind, currentRound, currentBanker, isBankerWin) {
        const winds = ['east', 'south', 'west', 'north'];
        const windIndex = winds.indexOf(currentWind);
        
        if (isBankerWin && this.settings.bankerContinue) {
            // 庄家连庄
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
    
    // 验证牌型是否有效（检测诈胡）
    validateWinningHand(hand, winTile, melds) {
        try {
            // 1. 解析手牌
            const parser = window.mahjongParser || new MahjongParser();
            parser.setPattern('relaxed');
            
            const handTiles = parser.parseHand(hand || '');
            const winningTile = parser.parseHand(winTile || '');
            const meldTiles = melds ? parser.parseMelds(melds) : [];
            
            // 2. 检查花牌位置：花牌只能在副露中，不能在手牌中
            const hasFlowerInHand = handTiles.some(tile => tile.suit === 'flower');
            const hasFlowerInWinTile = winningTile.some(tile => tile.suit === 'flower');
            
            if (hasFlowerInHand || hasFlowerInWinTile) {
                return {
                    isValid: false,
                    error: '花牌不能在手牌中，只能通过副露处理',
                    errorType: 'FLOWER_IN_HAND'
                };
            }
            
            // 3. 分离副露中的花牌和非花牌
            let meldFlowers = [];
            let meldNormal = [];
            meldTiles.forEach(meld => {
                meld.tiles.forEach(tile => {
                    if (tile.suit === 'flower') {
                        meldFlowers.push(tile);
                    } else {
                        meldNormal.push(tile);
                    }
                });
            });
            
            // 4. 检查基本条件：计算有效牌数（杠子算作3张牌）
            let meldNormalCount = 0;
            let kangCount = 0; // 杠子数量
            
            // 遍历副露，计算非花牌数量，特别处理杠子
            meldTiles.forEach(meld => {
                const normalTilesInMeld = meld.tiles.filter(tile => tile.suit !== 'flower');
                // 检查是否为杠子（明杠、暗杠，或者4张相同牌）
                if (normalTilesInMeld.length === 4 && 
                    (meld.type === '明槓' || meld.type === '暗槓' ||
                     this.isKangzi(normalTilesInMeld))) {
                    // 杠子：4张牌算作3张（与刻子等价）
                    meldNormalCount += 3;
                    kangCount++;
                } else {
                    // 其他副露（顺子、刻子等）
                    meldNormalCount += normalTilesInMeld.length;
                }
            });
            
            const totalNormalTiles = handTiles.length + winningTile.length + meldNormalCount;
            
            // 5. 检查牌数是否正确（14张有效牌，杠子按3张计算）
            if (totalNormalTiles !== 14) {
                const actualTileCount = handTiles.length + winningTile.length + meldNormal.length;
                return {
                    isValid: false,
                    error: `牌数不正确：实际${actualTileCount}张，有效${totalNormalTiles}张（应为14张有效牌，${kangCount}个杠子已调整计算）`,
                    errorType: 'INVALID_TILE_COUNT'
                };
            }
            
            // 6. 组合所有非花牌进行和牌验证
            const allNormalTiles = [...handTiles, ...winningTile];

            // 7. 检查是否为特殊牌型
            if (this.isSpecialWinningPattern(allNormalTiles)) {
                return { isValid: true, pattern: '特殊牌型' };
            }
            
            // 8. 检查是否为标准和牌牌型（顺子+刻子+雀头）
            // 注意：只传入非花牌的副露
            const normalMelds = meldTiles.map(meld => ({
                ...meld,
                tiles: meld.tiles.filter(tile => tile.suit !== 'flower')
            })).filter(meld => meld.tiles.length > 0);
            
            const standardCheck = this.isStandardWinningPattern(allNormalTiles, normalMelds);
            if (standardCheck.isValid) {
                return { isValid: true, pattern: '标准牌型', details: standardCheck.details };
            }
            
            // 9. 如果都不是，则为诈胡
            return {
                isValid: false,
                error: '未形成有效牌型组合',
                errorType: 'INVALID_PATTERN',
                suggestion: '请检查是否遗漏了顺子、刻子或雀头'
            };
            
        } catch (error) {
            return {
                isValid: false,
                error: `解析错误: ${error.message}`,
                errorType: 'PARSE_ERROR'
            };
        }
    }
    
    // 检查是否为特殊牌型（十三幺、七对子等）
    isSpecialWinningPattern(tiles) {
        // 十三幺检查
        if (this.isShiSanYao(tiles)) return true;
        
        // 七对子检查
        //if (this.isQiDuiZi(tiles)) return true;
        
        return false;
    }
    
    // 检查是否为标准和牌牌型
    isStandardWinningPattern(handTiles, melds) {
        // 复制手牌进行分析
        const tiles = [...handTiles];
        const groups = [];
        
        // 添加已有的副露
        melds.forEach(meld => {
            groups.push({
                type: meld.type,
                tiles: meld.tiles,
                isConcealed: meld.isConcealed
            });
        });
        
        // 尝试找出雀头
        const pairResults = this.findAllPossiblePairs(tiles);
        
        for (let pairResult of pairResults) {
            const remainingTiles = [...pairResult.remaining];
            const currentGroups = [...groups, { type: '雀头', tiles: pairResult.pair }];
            
            // 尝试分解剩余牌为顺子和刻子
            if (this.canFormMianziCombination(remainingTiles, currentGroups)) {
                return {
                    isValid: true,
                    details: {
                        groups: currentGroups,
                        pattern: '标准牌型'
                    }
                };
            }
        }
        
        return { isValid: false };
    }
    
    // 找出所有可能的雀头
    findAllPossiblePairs(tiles) {
        const pairs = [];
        const tileCount = this.countTiles(tiles);
        
        Object.keys(tileCount).forEach(tileKey => {
            if (tileCount[tileKey] >= 2) {
                // 创建雀头
                const pair = [];
                const remaining = [];
                let pairCount = 0;
                
                tiles.forEach(tile => {
                    const key = this.tileToKey(tile);
                    if (key === tileKey && pairCount < 2) {
                        pair.push(tile);
                        pairCount++;
                    } else {
                        remaining.push(tile);
                    }
                });
                
                pairs.push({ pair, remaining });
            }
        });
        
        return pairs;
    }
    
    // 检查剩余牌是否能组成面子组合
    canFormMianziCombination(tiles, currentGroups) {
        if (tiles.length === 0) return true;
        if (tiles.length % 3 !== 0) return false;
        
        // 尝试组成刻子
        const keziResult = this.tryFormKezi(tiles);
        if (keziResult.success) {
            const newGroups = [...currentGroups, { type: '刻子', tiles: keziResult.kezi }];
            if (this.canFormMianziCombination(keziResult.remaining, newGroups)) {
                return true;
            }
        }
        
        // 尝试组成顺子
        const shunziResult = this.tryFormShunzi(tiles);
        if (shunziResult.success) {
            const newGroups = [...currentGroups, { type: '顺子', tiles: shunziResult.shunzi }];
            if (this.canFormMianziCombination(shunziResult.remaining, newGroups)) {
                return true;
            }
        }
        
        return false;
    }
    
    // 尝试组成刻子
    tryFormKezi(tiles) {
        const tileCount = this.countTiles(tiles);
        
        for (let tileKey of Object.keys(tileCount)) {
            if (tileCount[tileKey] >= 3) {
                const kezi = [];
                const remaining = [];
                let keziCount = 0;
                
                tiles.forEach(tile => {
                    if (this.tileToKey(tile) === tileKey && keziCount < 3) {
                        kezi.push(tile);
                        keziCount++;
                    } else {
                        remaining.push(tile);
                    }
                });
                
                return { success: true, kezi, remaining };
            }
        }
        
        return { success: false };
    }
    
    // 尝试组成顺子
    tryFormShunzi(tiles) {
        // 只有数字牌能组成顺子
        const numberTiles = tiles.filter(t => t.suit === 'man' || t.suit === 'pin' || t.suit === 'sou');
        if (numberTiles.length < 3) return { success: false };
        
        // 按花色分组
        const suits = {};
        numberTiles.forEach(tile => {
            if (!suits[tile.suit]) suits[tile.suit] = [];
            suits[tile.suit].push(tile);
        });
        
        // 尝试每个花色的顺子
        for (let suit of Object.keys(suits)) {
            const suitTiles = suits[suit].sort((a, b) => a.number - b.number);
            
            // 查找连续的三张牌
            for (let i = 0; i < suitTiles.length - 2; i++) {
                const tile1 = suitTiles[i];
                const tile2 = suitTiles.find(t => t.number === tile1.number + 1);
                const tile3 = suitTiles.find(t => t.number === tile1.number + 2);
                
                if (tile2 && tile3) {
                    const shunzi = [tile1, tile2, tile3];
                    const remaining = tiles.filter(t => !shunzi.includes(t));
                    return { success: true, shunzi, remaining };
                }
            }
        }
        
        return { success: false };
    }
    
    // 统计牌的数量
    countTiles(tiles) {
        const count = {};
        tiles.forEach(tile => {
            const key = this.tileToKey(tile);
            count[key] = (count[key] || 0) + 1;
        });
        return count;
    }
    
    // 将牌转换为键值
    tileToKey(tile) {
        return `${tile.suit}-${tile.number}`;
    }
    
    // 检查是否为十三幺
    isShiSanYao(tiles) {
        if (tiles.length !== 14) return false;
        
        const requiredTiles = [
            'man-1', 'man-9', 'pin-1', 'pin-9', 'sou-1', 'sou-9',
            'honor-1', 'honor-2', 'honor-3', 'honor-4', 'honor-5', 'honor-6', 'honor-7'
        ];
        
        const tileCount = this.countTiles(tiles);
        const tileKeys = Object.keys(tileCount);
        
        // 检查是否只包含幺九牌
        if (!tileKeys.every(key => requiredTiles.includes(key))) return false;
        
        // 检查是否有且仅有一对
        const pairs = tileKeys.filter(key => tileCount[key] === 2);
        const singles = tileKeys.filter(key => tileCount[key] === 1);
        
        return pairs.length === 1 && singles.length === 12;
    }
    
    // 检查是否为七对子
    isQiDuiZi(tiles) {
        if (tiles.length !== 14) return false;
        
        const tileCount = this.countTiles(tiles);
        const counts = Object.values(tileCount);
        
        // 检查是否恰好有7对
        return counts.length === 7 && counts.every(count => count === 2);
    }

    // 平和检查：手牌和副露中没有刻子，全是顺子
    checkPingHe(analysis) {
        // 检查是否有任何刻子或杠子
        const hasKezi = analysis.kezi.zhongzhang > 0 || 
                       analysis.kezi.yaojiuMing > 0 || 
                       analysis.kezi.zhongzhangAn > 0 || 
                       analysis.kezi.yaojiuAn > 0;
                       
        const hasGangzi = analysis.gangzi.zhongzhangMing > 0 || 
                         analysis.gangzi.yaojiuMing > 0 || 
                         analysis.gangzi.zhongzhangAn > 0 || 
                         analysis.gangzi.yaojiuAn > 0;
        
        // 平和：没有刻子也没有杠子
        return !hasKezi && !hasGangzi;
    }

    // 检查4张牌是否构成杠子
    isKangzi(tiles) {
        if (tiles.length !== 4) return false;
        
        // 检查是否为4张相同的牌
        const firstTile = tiles[0];
        return tiles.every(tile => 
            tile.suit === firstTile.suit && tile.number === firstTile.number
        );
    }

    // 检查牌组中的所有牌是否相同
    isAllSameTile(tiles) {
        if (tiles.length === 0) return false;
        const firstTile = tiles[0];
        return tiles.every(tile => 
            tile.suit === firstTile.suit && tile.number === firstTile.number
        );
    }
    
    // 基于正常分数计算结果调整包牌分配
    applyBaoPlayerAdjustment(normalScores, winner, payers, baoPlayer, isZimo) {
        // 创建分数调整副本
        const adjustedScores = normalScores.map(score => ({...score}));
        
        // 找到相关玩家的分数记录
        const winnerScore = adjustedScores.find(s => s.player === winner);
        const baoPlayerScore = adjustedScores.find(s => s.player === baoPlayer);
        const payerScores = adjustedScores.filter(s => payers.includes(s.player));
        
        if (!winnerScore || !baoPlayerScore) {
            console.warn('包牌处理：找不到和牌者或包牌者的分数记录');
            return normalScores;
        }
        
        if (isZimo || !this.settings.fullPaymentSystem) {
            // 非全铳制下包牌者包赔
            // 全铳制下，自摸包牌者包赔
            if (this.settings.baoFullPayment) {
                // 包牌者承担所有其他玩家应支付的费用
                const totalPayment = Math.abs(winnerScore.change); // 和牌者收到的总点数
                
                // 重置所有非和牌者、非包牌者的分数为0
                adjustedScores.forEach(score => {
                    if (score.player !== winner && score.player !== baoPlayer) {
                        score.change = 0;
                    }
                });
                
                // 包牌者承担全部费用
                baoPlayerScore.change = -totalPayment;
                
                // 和牌者分数保持不变（已经是正确的总收入）
            } else {
                // 按正常规则分摊，包牌者只承担自己应该承担的部分
                // 这种情况下直接返回正常分数即可
                return normalScores;
            }
            
        } else {
            // 出铳包牌处理
            const winnerIncome = winnerScore.change;
            
            if (payers.includes(baoPlayer)) {
                // 包牌者就是出铳者：包牌者承担全部费用
                baoPlayerScore.change = -winnerIncome;
                
                // 其他玩家分数为0
                adjustedScores.forEach(score => {
                    if (score.player !== winner && score.player !== baoPlayer) {
                        score.change = 0;
                    }
                });
                
            } else if (this.settings.baoRonSplitPayment) {
                // 包牌者不是出铳者：采用分摊制
                const baoRatio = this.settings.baoSplitRatio || 0.5;
                const payerRatio = 1 - baoRatio;
                
                const baoPayment = Math.ceil(winnerIncome * baoRatio);
                const payerPayment = winnerIncome - baoPayment;
                
                // 包牌者承担指定比例
                baoPlayerScore.change = -baoPayment;
                
                // 出铳者承担剩余部分
                if (payerScores.length > 0) {
                    // 如果有多个出铳者，平均分摊
                    const paymentPerPayer = Math.ceil(payerPayment / payerScores.length);
                    let totalAssigned = 0;
                    
                    payerScores.forEach((payerScore, index) => {
                        if (index === payerScores.length - 1) {
                            // 最后一个出铳者承担剩余的所有费用（处理除不尽的情况）
                            payerScore.change = -(payerPayment - totalAssigned);
                        } else {
                            payerScore.change = -paymentPerPayer;
                            totalAssigned += paymentPerPayer;
                        }
                    });
                }
                
                // 其他玩家分数为0
                adjustedScores.forEach(score => {
                    if (score.player !== winner && 
                        score.player !== baoPlayer && 
                        !payers.includes(score.player)) {
                        score.change = 0;
                    }
                });
                
            } else {
                // 包牌者承担全部费用
                baoPlayerScore.change = -winnerIncome;
                
                // 重置所有非和牌者、非包牌者的分数为0
                adjustedScores.forEach(score => {
                    if (score.player !== winner && score.player !== baoPlayer) {
                        score.change = 0;
                    }
                });
            }
        }
        
        // 验证分数平衡
        const totalChange = adjustedScores.reduce((sum, score) => sum + score.change, 0);
        if (Math.abs(totalChange) > 0.01) { // 允许小的浮点数误差
            console.warn(`包牌处理后分数不平衡，总变化: ${totalChange}`, adjustedScores);
            
            // 尝试自动修正小的误差
            if (Math.abs(totalChange) < 5) {
                const winnerScore = adjustedScores.find(s => s.player === winner);
                if (winnerScore) {
                    winnerScore.change -= totalChange;
                    console.log(`自动修正分数误差: ${totalChange}`);
                }
            }
        }
        
        return adjustedScores;
    }
}
