/**
 * 日本麻将规则系统
 * 实现标准日本麻将的计分规则
 */

class JapaneseMahjong extends BaseRuleSystem {
    constructor() {
        super('リーチ麻雀', '日本麻将规则，自动计算不一定有效');
        this.settings = {
            initialScore: 25000,
            targetScore: 30000,      // 目标分数
            minScore: 0,             // 最低分数限制
            oneShot: true,           // 一发
            redDora: true,           // 赤ドラ
            openTanyao: true,        // 鳴きタンヤオ
            tripleRon: false,        // 三家和
            nagashiMangan: true,     // 流し満貫
            doubleWindFu: true,      // 連風牌の符
            renhou: false,           // 人和
            tenhou: true,            // 天和
            chiihou: true,           // 地和
            kokushiAnkan: true,      // 国士無双暗槓
            aotenjou: false,         // 青天井规则（不封顶）
            maxYakumanMultiplier: 2  // 最大役满倍数（1-6倍）
        };
    }
    
    getSettingsDefinition() {
        return {
            '基本设置': {
                initialScore: { type: 'number', label: '起始点数', default: 25000, min: 20000, max: 30000 },
                targetScore: { type: 'number', label: '目标点数', default: 30000, min: 25000, max: 50000 },
                minScore: { type: 'number', label: '最低点数', default: 0, min: -30000, max: 0 }
            },
            '特殊规则': {
                oneShot: { type: 'boolean', label: '一发', default: true },
                redDora: { type: 'boolean', label: '赤宝牌', default: true },
                openTanyao: { type: 'boolean', label: '鸣牌断幺九', default: true },
                tripleRon: { type: 'boolean', label: '三家和', default: false },
                nagashiMangan: { type: 'boolean', label: '流局满贯', default: true }
            },
            '高级规则': {
                doubleWindFu: { type: 'boolean', label: '连风牌符数', default: true },
                renhou: { type: 'boolean', label: '人和', default: false },
                tenhou: { type: 'boolean', label: '天和', default: true },
                chiihou: { type: 'boolean', label: '地和', default: true },
                kokushiAnkan: { type: 'boolean', label: '国士暗杠', default: true },
                aotenjou: { type: 'boolean', label: '青天井规则', default: false },
                maxYakumanMultiplier: { 
                    type: 'number', 
                    label: '最大役满倍数', 
                    default: 2, 
                    min: 1, 
                    max: 6,
                    description: '限制役满复合的最大倍数（1-6倍）'
                }
            }
        };
    }
    
    // 准备计算条件（日本麻将特定逻辑）
    prepareConditions(baseConditions, gameState, winnerPosition, winType, melds) {
        // 调用基类方法获取基本条件
        const enhancedConditions = super.prepareConditions(baseConditions, gameState, winnerPosition, winType);
        
        // 日本麻将特定的自动参数
        if (gameState && winnerPosition) {
            const playerData = gameState.players[winnerPosition];
            if (playerData) {
                enhancedConditions.roundWind = gameState.wind;
                enhancedConditions.playerWind = winnerPosition;
                
                // 更准确的门清判断：检查副露是否只包含暗槓
                if (!melds || melds.trim() === '') {
                    enhancedConditions.isMenQing = true;
                } else {
                    // 解析副露，检查是否只有暗槓
                    const parser = window.mahjongParser || new MahjongParser();
                    const meldTiles = parser.parseMelds(melds);
                    enhancedConditions.isMenQing = meldTiles.every(meld => 
                        meld.type === '暗槓' || meld.isConcealed
                    );
                }
            }
        }
        
        // 自摸检测
        enhancedConditions.isTsumo = winType === '自摸';
        
        return enhancedConditions;
    }
    
    formatRound(wind, round) {
        const windNames = {
            east: '東',
            south: '南',
            west: '西',
            north: '北'
        };
        return `${windNames[wind] || wind}${round}局`;
    }
    
    calculateScores(winner, payers, fanCount, fuCount, winType, banker, baoPlayer = 'none') {
        const scores = [];
        
        // 使用新的基础点数计算方法
        const basePoints = this.calculateBasePoints(fanCount, fuCount);
        
        const isTsumo = winType === '自摸';
        const isBanker = winner === banker;
        
        // 处理包牌情况
        if (baoPlayer && baoPlayer !== 'none') {
            return this.calculateBaoScores(winner, payers, basePoints, isTsumo, baoPlayer, banker);
        }
        
        if (isTsumo) {
            // 自摸
            if (isBanker) {
                // 庄家自摸，每家支付 basePoints × 2
                const paymentPerPlayer = Math.ceil(basePoints * 2 / 100) * 100;
                ['east', 'south', 'west', 'north'].forEach(pos => {
                    if (pos === winner) {
                        scores.push({ player: pos, change: paymentPerPlayer * 3 });
                    } else {
                        scores.push({ player: pos, change: -paymentPerPlayer });
                    }
                });
            } else {
                // 闲家自摸，庄家支付 basePoints × 2，其他两家各支付 basePoints × 1
                const bankerPayment = Math.ceil(basePoints * 2 / 100) * 100;
                const playerPayment = Math.ceil(basePoints / 100) * 100;
                
                ['east', 'south', 'west', 'north'].forEach(pos => {
                    if (pos === winner) {
                        scores.push({ player: pos, change: bankerPayment + playerPayment * 2 });
                    } else if (pos === banker) {
                        scores.push({ player: pos, change: -bankerPayment });
                    } else {
                        scores.push({ player: pos, change: -playerPayment });
                    }
                });
            }
        } else {
            // 荣和
            const payment = isBanker ? 
                Math.ceil(basePoints * 6 / 100) * 100 : 
                Math.ceil(basePoints * 4 / 100) * 100;
                
            ['east', 'south', 'west', 'north'].forEach(pos => {
                if (pos === winner) {
                    scores.push({ player: pos, change: payment });
                } else if (payers.includes(pos)) {
                    scores.push({ player: pos, change: -payment });
                } else {
                    scores.push({ player: pos, change: 0 });
                }
            });
        }
        
        return scores;
    }
    
    // 计算包牌分数
    calculateBaoScores(winner, payers, basePoints, isTsumo, baoPlayer, banker) {
        const scores = [];
        
        if (isTsumo) {
            // 自摸时包牌家支付全部
            ['east', 'south', 'west', 'north'].forEach(pos => {
                if (pos === winner) {
                    scores.push({ player: pos, change: basePoints });
                } else if (pos === baoPlayer) {
                    scores.push({ player: pos, change: -basePoints });
                } else {
                    scores.push({ player: pos, change: 0 });
                }
            });
        } else {
            // 荣和时放铳者和包牌家分摊
            const halfPayment = Math.ceil(basePoints / 2 / 100) * 100;
            ['east', 'south', 'west', 'north'].forEach(pos => {
                if (pos === winner) {
                    scores.push({ player: pos, change: basePoints });
                } else if (payers.includes(pos)) {
                    scores.push({ player: pos, change: -halfPayment });
                } else if (pos === baoPlayer) {
                    scores.push({ player: pos, change: -halfPayment });
                } else {
                    scores.push({ player: pos, change: 0 });
                }
            });
        }
        
        return scores;
    }
    getSpecialFanType(fanCount) {
        // 若是青天井
        if (this.settings.aotenjou) {
            return null; // 青天井模式下不使用特殊番数
        }

        // 役满系列 - 返回基本点数
        if (fanCount == 600) {
            return { type: 'sex_yakuman', points: 48000, name: '六倍役满' };
        } else if (fanCount == 500) {
            return { type: 'quint_yakuman', points: 40000, name: '五倍役满' };
        } else if (fanCount == 400) {
            return { type: 'quad_yakuman', points: 32000, name: '四倍役满' };
        } else if (fanCount == 300) {
            return { type: 'triple_yakuman', points: 24000, name: '三倍役满' };
        } else if (fanCount == 200) {
            return { type: 'double_yakuman', points: 16000, name: '双倍役满' };
        } else if (fanCount >= 13) {
            return { type: 'yakuman', points: 8000, name: '役满' };
        } else if (fanCount >= 11) {
            return { type: 'sanbaiman', points: 6000, name: '三倍满' };
        } else if (fanCount >= 8) {
            return { type: 'baiman', points: 4000, name: '倍满' };
        } else if (fanCount >= 6) {
            return { type: 'haneman', points: 3000, name: '跳满' };
        } else if (fanCount >= 5) {
            return { type: 'mangan', points: 2000, name: '满贯' };
        }
        return null;
    }
    
    // 计算基础点数（考虑役满等特殊情况）
    calculateBasePoints(fanCount, fuCount) {
        // 青天井模式：不使用特殊番数，全部按基础计算式计算
        if (this.settings.aotenjou) {
            
            // 青天井模式下的基础点数计算：符数 × 2^(番数+2)
            return fuCount * Math.pow(2, fanCount + 2);
        }
        
        // 非青天井模式：使用传统的特殊番数处理
        const specialType = this.getSpecialFanType(fanCount);
        if (specialType) {
            return specialType.points;
        }
        
        // 普通计算：基础点数 = 符数 × 2^(番数+2)
        let basePoints = fuCount * Math.pow(2, fanCount + 2);
        
        // 2000点以上自动升为满贯
        if (basePoints >= 2000) {
            return 2000; // 满贯基本点数
        }
        
        return basePoints;
    }
    
    isBanker(position) {
        return window.gameState && window.gameState.players[position]?.isBanker;
    }
    
    calculateHandValue(hand, winTile, melds, conditions) {
        // 首先验证牌型是否有效并获取解析结果
        const validation = this.validateWinningHand(hand, winTile, melds);
        if (!validation.isValid) {
            throw new Error('无效的和牌：' + validation.error);
        }
        
        // 解析手牌数据
        const parser = window.mahjongParser || new MahjongParser();
        parser.setPattern('relaxed');
        
        const handTiles = parser.parseHand(hand || '');
        const winningTile = parser.parseHand(winTile || '');
        const meldTiles = melds ? parser.parseMelds(melds) : [];
        
        // 分离花牌和非花牌，并标准化鸣牌类型
        let meldFlowers = [];
        let meldNormal = [];
        let standardizedMeldTiles = [];
        meldTiles.forEach(meld => {
            // 标准化鸣牌类型
            let standardizedType = meld.type;
            if (meld.type === '暗槓' || meld.type === '明槓') {
                standardizedType = 'kan';
            } else if (meld.type === '刻子') {
                standardizedType = 'koutsu';
            } else if (meld.type === '順子') {
                standardizedType = 'shuntsu';
            }
            
            // 创建标准化的鸣牌对象
            const standardizedMeld = {
                ...meld,
                type: standardizedType,
                isConcealed: meld.type === '暗槓' || meld.isConcealed
            }; // e.g. {type: "kan", tiles: [{suit: "honor", nuber: 1, original:"1z"}, ...], isConcealed: false, original: "111z"}
            
            if (meld.type === 'flower') {
                meldFlowers = meldFlowers.concat(meld.tiles);
            } else {
                meldNormal = meldNormal.concat(meld.tiles);
                standardizedMeldTiles.push(standardizedMeld);
            }
        });
        
        const allNormalTiles = [...handTiles, ...winningTile];
        
        // 检测门清状态并传递风牌信息
        // 门清状态：没有明牌副露，暗槓不破门清
        const isMenQing = standardizedMeldTiles.every(meld => meld.isConcealed);
        const enhancedConditions = { 
            ...conditions, 
            isMenQing,
            roundWind: conditions.roundWind || conditions.windOfRound,
            playerWind: conditions.playerWind || conditions.windOfSeat
        };
        enhancedConditions.menQing = isMenQing; // 以防旧代码仍在使用
        
        let fanCount = 0; // 飜数
        let fuCount = 20;  // 符数，基础20符
        
        // === 牌型分析 ===
        const analysis = this.analyzeHand(allNormalTiles, meldNormal, enhancedConditions, standardizedMeldTiles, winningTile, handTiles);
        if (analysis.isValid === false) {
            throw new Error('诈和');
        }

        let isYakuman = analysis.isSuuankou || analysis.isDaisangen || analysis.isKokushiMusou ||
            analysis.isChuurenPoutou || analysis.isSuukantsu || analysis.isTsuuiisou ||
            analysis.isChinroutou || analysis.isRyuuiisou || analysis.isShousuushii ||
            analysis.isDaisuushii || analysis.isKokushiJuusanmen || analysis.isChuurenKyuumen || analysis.isSuuankouTanki;
        
        // 非青天井下，若有役满牌型标记，忽略和牌方式计算
        if (this.settings.aotenjou || !isYakuman) {
            // === 非役满情况下的条件性役种处理 ===
            if (enhancedConditions.isRinshan) fanCount += 1;         // 岭上开花：1飜
            if (enhancedConditions.isHaitei) fanCount += 1;          // 海底摸月：1飜
            if (enhancedConditions.isHoutei) fanCount += 1;          // 河底撈魚：1飜
            if (enhancedConditions.isChankan) fanCount += 1;         // 抢杠：1飜
            if (enhancedConditions.isRenhou) fanCount += 5;        // 人和：5飜
            
            // === 门清相关番数 ===
            // 检查是否有天和/地和，青天井模式下不能与门清自摸复合
            const hasTenchihou = enhancedConditions.isTenhou || enhancedConditions.isChiihou;
            const skipMenzenTsumo = this.settings.aotenjou && hasTenchihou;
            
            if (isMenQing && enhancedConditions.isTsumo && !skipMenzenTsumo) {
                fanCount += 1; // 门清自摸：1飜
            }
            
            if (enhancedConditions.isRiichi) {
                fanCount += 1; // 立直：1飜
                if (enhancedConditions.isIppatsu) fanCount += 1; // 一发：1飜
                if (enhancedConditions.isDoubleRiichi) fanCount += 1; // 两立直追加：+1飜
            }
        }
        
        // === 役种番数累计 ===
        fanCount += analysis.fanCount;
        
        // === 符数计算 ===
        fuCount += analysis.fuCount;
        
        // 门清荣和额外符数
        if (isMenQing && !enhancedConditions.isTsumo) {
            fuCount += 10; // 门清荣和：10符
        }
        
        // 自摸符数
        if (enhancedConditions.isTsumo) {
            fuCount += 2; // 自摸：2符
        }
        
        // 符数向上取整到10
        fuCount = Math.ceil(fuCount / 10) * 10;
        
        // 七对子固定25符
        if (analysis.isQiDuiZi) {
            fuCount = 25;
        }
        
        // 平和时的特殊符数处理
        if (analysis.isPinfu) {
            if (enhancedConditions.isTsumo) {
                fuCount = 20; // 平和自摸：20符
            } else {
                fuCount = 30; // 平和荣和：30符
            }
        } else {
            // 非平和最低30符
            if (fuCount < 30 && !analysis.isQiDuiZi) fuCount = 30;
        }
        
        // 收集详情
        const fanDetails = analysis.fanDetails || [];
        const fuDetails = [...(analysis.fuDetails || [])];
        
        // 根据役满状态添加条件性役种到详情
        // 非青天井条件下，若是役满，则不添加详情
        if (this.settings.aotenjou || !isYakuman) {
            if (enhancedConditions.isRinshan) fanDetails.push({ name: '岭上开花', fan: 1, description: '杠后摸到的牌和牌' });
            if (enhancedConditions.isHaitei) fanDetails.push({ name: '海底摸月', fan: 1, description: '最后一张牌自摸' });
            if (enhancedConditions.isHoutei) fanDetails.push({ name: '河底撈魚', fan: 1, description: '最后一张牌荣和' });
            if (enhancedConditions.isChankan) fanDetails.push({ name: '抢杠', fan: 1, description: '抢他人加杠' });
            
            const hasTenchihou = enhancedConditions.isTenhou || enhancedConditions.isChiihou;
            const skipMenzenTsumo = this.settings.aotenjou && hasTenchihou;
            
            if (isMenQing && enhancedConditions.isTsumo && !skipMenzenTsumo) {
                fanDetails.push({ name: '门清自摸', fan: 1, description: '门清状态下自摸' });
            }
            
            if (enhancedConditions.isRiichi) {
                if (enhancedConditions.isDoubleRiichi) {
                    fanDetails.push({ name: '两立直', fan: 2, description: '第一巡立直' });
                } else {
                    fanDetails.push({ name: '立直', fan: 1, description: '立直宣言' });
                }
                if (enhancedConditions.isIppatsu) {
                    fanDetails.push({ name: '一发', fan: 1, description: '立直后一巡内和牌' });
                }
            }
            
            if (enhancedConditions.isRenhou) {
                fanDetails.push({ name: '人和', fan: 5, description: '人和' });
            }
        
            // 添加基础符数和和牌方式符数
            if (enhancedConditions.isTsumo) {
                fuDetails.push({ name: '自摸', fu: 2, description: '自摸和牌' });
            }
            if (isMenQing && !enhancedConditions.isTsumo) {
                fuDetails.push({ name: '门清荣和', fu: 10, description: '门清状态下荣和' });
            }
        }
        
        // 七对子的特殊符数处理
        if (analysis.isQiDuiZi) {
            // 清除其他符数详情，七对子固定25符
            fuDetails.length = 0;
            fuDetails.push({ name: '七对子', fu: 25, description: '七对子固定25符' });
        } else if (analysis.isPinfu) {
            // 平和的特殊符数处理
            fuDetails.length = 0;
            if (enhancedConditions.isTsumo) {
                fuDetails.push({ name: '平和自摸', fu: 20, description: '平和自摸固定20符' });
            } else {
                fuDetails.push({ name: '平和荣和', fu: 30, description: '平和荣和固定30符' });
            }
        } else {
            // 一般情况的符数上调整
            const baseFu = fuDetails.find(detail => detail.name === '基础');
            if (baseFu && fuCount >= 30) {
                // 如果最终符数被调整到30符以上，需要在详情中体现
                const totalFromDetails = fuDetails.reduce((sum, detail) => sum + detail.fu, 0);
                if (totalFromDetails < fuCount) {
                    fuDetails.push({ name: '符数调整', fu: fuCount - totalFromDetails, description: '符数向上调整至10的倍数，最低30符' });
                }
            }
        }
        
        return { fan: fanCount, fu: fuCount, fanDetails, fuDetails, analysis };
    }
    
    // 完整的牌型分析
    analyzeHand(allNormalTiles, meldNormal, enhancedConditions = {}, standardizedMeldTiles = [], winningTile = [], handTiles = []) {
        const analysis = {
            fanCount: 0,
            fuCount: 0,
            fanDetails: [],
            fuDetails: [],
            // 役种标记
            isPinfu: false,
            isTanyao: false,
            isIipeikou: false,
            isRyanpeikou: false,
            isSanshokuDoujun: false,
            isIttsu: false,
            isToitoi: false,
            isSanankou: false,
            isHonroutou: false,
            isJunchan: false,
            isChanta: false,
            isHonitsu: false,
            isChiitsu: false,
            isQiDuiZi: false,
            isKokushi: false,
            // 役满
            isSuuankou: false,
            isDaisangen: false,
            isKokushiMusou: false,
            isChuurenPoutou: false,
            isSuukantsu: false,
            isTsuuiisou: false,
            isChinroutou: false,
            isRyuuiisou: false,
            isShousuushii: false,  // 小四喜
            isDaisuushii: false,   // 大四喜
            isKokushiJuusanmen: false,
            isChuurenKyuumen: false,
            isSuuankouTanki: false,
            // 结构分析
            mentsu: [],
            jantou: null,
            isValid: true
        };
        
        console.log(`分析牌型：${allNormalTiles.map(t => t.original || `${t.number}${t.suit}`).join('')}`);
        
        // 首先检查特殊和牌型
        if (this.checkKokushi(allNormalTiles)) {
            analysis.isKokushi = true;
            analysis.isKokushiMusou = true;
            
            // 检查天和/地和/人和复合
            const specialConditions = [];
            if (enhancedConditions.isTenhou) specialConditions.push('天和');
            if (enhancedConditions.isChiihou) specialConditions.push('地和');
            
            let maxYakumanMultiplier = this.settings.maxYakumanMultiplier || 2;
            if (this.checkKokushiJuusanmen(allNormalTiles, winningTile)) {
                analysis.isKokushiJuusanmen = true;
                const multiplier = specialConditions.length + 2; // 国士十三面本身是双倍役满
                
                if (this.settings.aotenjou) {
                    // 青天井模式：累计番数，继续检查其他役种
                    analysis.fanCount += 13 * 2; // 国士十三面本身是双倍役满
                    analysis.fanDetails.push({ name: '国士无双十三面', fan: 13 * 2, description: '十三面听牌的国士无双' });
                    // 天和/地和在analyzeYaku开头已经计算，这里不重复计算
                    analysis.fuCount = 30; // 国士固定30符
                    // 继续检查其他役种
                } else {
                    // 非青天井模式：应用最大役满倍数限制
                    const actualMultiplier = Math.min(multiplier, maxYakumanMultiplier);
                    const yakumanName = specialConditions.length > 0 ? 
                        `${specialConditions.join('+')}+国士无双十三面` : 
                        '国士无双十三面';
                    
                    let multiplierText;
                    if (multiplier > maxYakumanMultiplier) {
                        multiplierText = `${actualMultiplier}倍役满（实际${multiplier}倍，限制${maxYakumanMultiplier}倍）`;
                    } else {
                        multiplierText = actualMultiplier > 1 ? `${actualMultiplier}倍役满` : '役满';
                    }
                    
                    const fanCountCode = this.getYakumanFanCount(actualMultiplier);
                    
                    return { fanCount: fanCountCode, fuCount: 30, fanDetails: [{ name: yakumanName, fan: multiplierText, description: '役满' }], fuDetails: [], analysis };
                }
            } else {
                const multiplier = specialConditions.length + 1; // 国士无双是单倍役满
                
                if (this.settings.aotenjou) {
                    // 青天井模式：累计番数，继续检查其他役种
                    analysis.fanCount += 13; // 国士无双是单倍役满
                    analysis.fanDetails.push({ name: '国士无双', fan: 13, description: '十三种幺九牌各一张' });
                    // 天和/地和在analyzeYaku开头已经计算，这里不重复计算
                    analysis.fuCount = 30; // 国士固定30符
                    // 继续检查其他役种
                } else {
                    // 非青天井模式：应用最大役满倍数限制
                    const actualMultiplier = Math.min(multiplier, maxYakumanMultiplier);
                    const yakumanName = specialConditions.length > 0 ? 
                        `${specialConditions.join('+')}+国士无双` : 
                        '国士无双';
                    
                    let multiplierText;
                    if (multiplier > maxYakumanMultiplier) {
                        multiplierText = `${actualMultiplier}倍役满（实际${multiplier}倍，限制${maxYakumanMultiplier}倍）`;
                    } else {
                        multiplierText = actualMultiplier > 1 ? `${actualMultiplier}倍役满` : '役满';
                    }
                    
                    const fanCountCode = this.getYakumanFanCount(actualMultiplier);
                    
                    return { fanCount: fanCountCode, fuCount: 30, fanDetails: [{ name: yakumanName, fan: multiplierText, description: '役满复合' }], fuDetails: [], analysis };
                }
            }
        }
        
        // 优化的七对子检查：先检查标准型，只有当标准型番数不足2番时才考虑七对子
        let bestResult = null;
        let bestScore = -1;
        
        // 1. 检查标准型
        const decompositions = this.findAllValidDecompositions(allNormalTiles, standardizedMeldTiles);
        if (decompositions.length > 0) {
            for (const decomposition of decompositions) {
                console.log(`尝试分解：`, decomposition);

                let tempAnalysis = {
                    fanCount: 0,
                    fuCount: 0,
                    fanDetails: [],
                    fuDetails: [],
                    isQiDuiZi: false,
                    isPinfu: false,
                    isTanyao: false,
                    isIipeikou: false,
                    isRyanpeikou: false,
                    mentsu: [],
                    jantou: null,
                    isValid: true
                };
                
                // 计算符数
                const fuCount = this.calculateDecompositionFu(decomposition, meldNormal, enhancedConditions, winningTile, standardizedMeldTiles);
                tempAnalysis.fuCount = fuCount;
                
                // 分析役种
                this.analyzeYaku(decomposition, allNormalTiles, meldNormal, enhancedConditions, tempAnalysis, standardizedMeldTiles, winningTile, handTiles);
                
                // 计算基本点数来比较
                const basePoints = this.calculateBasePoints(tempAnalysis.fanCount, tempAnalysis.fuCount);

                console.log(`标准型分析：${tempAnalysis.fanCount}番 ${tempAnalysis.fuCount}符，基本点数：${basePoints}`);
                console.log(`分析详情：`, tempAnalysis);
                
                if (basePoints > bestScore) {
                    bestScore = basePoints;
                    bestResult = tempAnalysis;
                    // 添加分解的符数详情
                    if (decomposition && decomposition.fuDetails) {
                        bestResult.fuDetails = [...(bestResult.fuDetails || []), ...decomposition.fuDetails];
                    }
                }
            }
        }
        
        // 2. 只有当标准型番数不足2番时才考虑七对子
        // 因为标准型最低30符，如果有2番或以上，必定优于七对子的2番25符
        // 七对子必须门清（不能有明牌副露）
        if ((!bestResult || bestResult.fanCount < 2) && enhancedConditions.isMenQing && this.checkQiDuiZi(allNormalTiles)) {
            // 检查是否为字一色七对子
            const isTsuuiisou = this.checkTsuuiisou(allNormalTiles, meldNormal);
            
            if (isTsuuiisou) {
                // 字一色七对子的处理
                if (this.settings.aotenjou) {
                    // 青天井模式：计七对子+字一色
                    const qiduiziAnalysis = {
                        fanCount: 15,  // 七对子2番 + 字一色13番
                        fuCount: 25,   // 七对子固定25符
                        fanDetails: [
                            { name: '七对子', fan: 2, description: '七个对子的特殊和牌' },
                            { name: '字一色', fan: 13, description: '全部为字牌' }
                        ],
                        fuDetails: [{ name: '七对子', fu: 25, description: '七对子固定25符' }],
                        isQiDuiZi: true,
                        isTsuuiisou: true,
                        isPinfu: false,
                        isTanyao: false,
                        isIipeikou: false,
                        isRyanpeikou: false,
                        mentsu: [],
                        jantou: null,
                        isValid: true
                    };
                    
                    const qiduiziScore = this.calculateBasePoints(qiduiziAnalysis.fanCount, qiduiziAnalysis.fuCount);
                    if (qiduiziScore > bestScore) {
                        bestScore = qiduiziScore;
                        bestResult = qiduiziAnalysis;
                    }
                } else {
                    // 非青天井模式：只计字一色役满
                    const tsuuiisouAnalysis = {
                        fanCount: 13,  // 字一色役满
                        fuCount: 25,   // 固定25符
                        fanDetails: [{ name: '字一色', fan: '役满', description: '全部为字牌' }],
                        fuDetails: [{ name: '字一色', fu: 25, description: '字一色固定25符' }],
                        isQiDuiZi: false,  // 不计七对子
                        isTsuuiisou: true,
                        isPinfu: false,
                        isTanyao: false,
                        isIipeikou: false,
                        isRyanpeikou: false,
                        mentsu: [],
                        jantou: null,
                        isValid: true
                    };
                    
                    const tsuuiisouScore = this.calculateBasePoints(tsuuiisouAnalysis.fanCount, tsuuiisouAnalysis.fuCount);
                    if (tsuuiisouScore > bestScore) {
                        bestScore = tsuuiisouScore;
                        bestResult = tsuuiisouAnalysis;
                    }
                }
            } else {
                // 普通七对子
                const qiduiziAnalysis = {
                    fanCount: 2,  // 七对子固定2番
                    fuCount: 25,  // 七对子固定25符
                    fanDetails: [{ name: '七对子', fan: 2, description: '七个对子的特殊和牌' }],
                    fuDetails: [{ name: '七对子', fu: 25, description: '七对子固定25符' }],
                    isQiDuiZi: true,
                    isPinfu: false,
                    isTanyao: false,  // 先设置为false，下面会检查
                    isIipeikou: false,
                    isRyanpeikou: false,
                    mentsu: [],
                    jantou: null,
                    isValid: true
                };
                
                // 检查七对子是否可以复合断幺九
                if (this.checkTanyao(allNormalTiles, meldNormal)) {
                    // 七对子必须门清，且如果设置允许鸣牌断幺九或确实门清，就可以计算断幺九
                    qiduiziAnalysis.isTanyao = true;
                    qiduiziAnalysis.fanCount += 1;
                    qiduiziAnalysis.fanDetails.push({ name: '断幺九', fan: 1, description: '不含幺九牌的和牌' });
                }
                
                // 检查七对子是否可以复合混一色（七对子必须门清）
                if (this.checkHonitsu(allNormalTiles, meldNormal)) {
                    qiduiziAnalysis.isHonitsu = true;
                    const fanValue = 3; // 门清混一色3番
                    qiduiziAnalysis.fanCount += fanValue;
                    qiduiziAnalysis.fanDetails.push({ name: '混一色', fan: fanValue, description: '门清，一种花色+字牌' });
                }
                
                // 检查七对子是否可以复合清一色（七对子必须门清）
                if (this.checkChiitsu(allNormalTiles, meldNormal)) {
                    qiduiziAnalysis.isChiitsu = true;
                    const fanValue = 6; // 门清清一色6番
                    qiduiziAnalysis.fanCount += fanValue;
                    qiduiziAnalysis.fanDetails.push({ name: '清一色', fan: fanValue, description: '门清，全部为一种花色' });
                }
                
                const qiduiziScore = this.calculateBasePoints(qiduiziAnalysis.fanCount, qiduiziAnalysis.fuCount);
                if (qiduiziScore > bestScore) {
                    bestScore = qiduiziScore;
                    bestResult = qiduiziAnalysis;
                }
            }
        }
        
        // 应用最佳结果
        if (bestResult) {
            Object.assign(analysis, bestResult);
        } else {
            analysis.isValid = false;
            return analysis;
        }
        
        console.log(`分析结果: 飜数=${analysis.fanCount}, 符数=${analysis.fuCount}`);
        
        return analysis;
    }
    
    // 找出所有可能的有效牌型分解
    findAllValidDecompositions(tiles, melds) {
        const decompositions = [];
        
        // 找出所有可能的雀头
        const possiblePairs = this.findAllPossiblePairs(tiles);
        
        for (const pairResult of possiblePairs) {
            const remainingTiles = [...pairResult.remaining];
            const combinations = this.findAllMentuCombinations(remainingTiles);
            
            // 计算所需的面子数量：总共需要4副面子，减去已有的副露面子数量
            const meldCount = melds.length; // melds 是副露的数组
            const requiredMentsuCount = 4 - meldCount;
            
            for (const combination of combinations) {
                if (combination.length === requiredMentsuCount) {
                    const decomposition = {
                        jantou: pairResult.pair,
                        mentsu: combination,
                        tiles: tiles,
                        melds: melds  // 保存副露信息
                    };
                    
                    // 统一数据结构
                    decompositions.push(this.normalizeDecomposition(decomposition));
                }
            }
        }
        
        return decompositions;
    }
    
    getSupportedYaku() {
        return [
            { name: '立直', fan: 1, description: 'リーチ' },
            { name: '一发', fan: 1, description: '一発' },
            { name: '门清自摸', fan: 1, description: '門前清自摸和' },
            { name: '断幺九', fan: 1, description: 'タンヤオ' },
            { name: '平和', fan: 1, description: 'ピンフ' },
            { name: '一杯口', fan: 1, description: '一盃口' },
            { name: '岭上开花', fan: 1, description: '嶺上開花' },
            { name: '枪杠', fan: 1, description: 'チャンカン' },
            { name: '海底摸月', fan: 1, description: '海底摸月' },
            { name: '河底捞鱼', fan: 1, description: '河底撈魚' },
            { name: '三色同顺', fan: 2, description: '三色同順' },
            { name: '一气通贯', fan: 2, description: '一気通貫' },
            { name: '混全带幺九', fan: 2, description: 'チャンタ' },
            { name: '七对子', fan: 2, description: '七対子' },
            { name: '对对和', fan: 2, description: '対々和' },
            { name: '三暗刻', fan: 2, description: '三暗刻' },
            { name: '三杠子', fan: 2, description: '三槓子' },
            { name: '小三元', fan: 2, description: '小三元' },
            { name: '混老头', fan: 2, description: '混老頭' },
            { name: '二杯口', fan: 3, description: '二盃口' },
            { name: '纯全带幺九', fan: 3, description: 'ジュンチャン' },
            { name: '混一色', fan: 3, description: '混一色' },
            { name: '清一色', fan: 6, description: '清一色' },
            { name: '天和', fan: 13, description: '天和' },
            { name: '地和', fan: 13, description: '地和' },
            { name: '大三元', fan: 13, description: '大三元' },
            { name: '四暗刻', fan: 13, description: '四暗刻' },
            { name: '字一色', fan: 13, description: '字一色' },
            { name: '绿一色', fan: 13, description: '緑一色' },
            { name: '清老头', fan: 13, description: '清老頭' },
            { name: '国士无双', fan: 13, description: '国士無双' },
            { name: '九莲宝灯', fan: 13, description: '九蓮宝燈' },
            { name: '小四喜', fan: 13, description: '小四喜' },
            { name: '大四喜', fan: 26, description: '大四喜' },
            { name: '四暗刻单骑', fan: 26, description: '四暗刻単騎' },
            { name: '国士无双十三面', fan: 26, description: '国士無双13面' },
            { name: '纯正九莲宝灯', fan: 26, description: '純正九蓮宝燈' }
        ];
    }
    
    getSpecialRules() {
        return [
            '起始点数：25000点',
            '返点：30000点',
            '役满：16000点基础',
            '流局时听牌玩家获得1500点',
            '立直费用：1000点',
            '包牌责任制'
        ];
    }
    
    getSupportedWinConditions() {
        return [
            { key: 'isTsumo', label: '自摸', default: false },
            { key: 'isRiichi', label: '立直', default: false },
            { key: 'isDoubleRiichi', label: '两立直', default: false },
            { key: 'isIppatsu', label: '一发', default: false },
            { key: 'isRinshan', label: '岭上开花', default: false },
            { key: 'isHaitei', label: '海底摸月', default: false },
            { key: 'isHoutei', label: '河底撈魚', default: false },
            { key: 'isChankan', label: '抢杠', default: false },
            { key: 'isTenhou', label: '天和', default: false },
            { key: 'isChiihou', label: '地和', default: false },
            { key: 'isRenhou', label: '人和', default: false },
            { key: 'roundWind', label: '圈风', default: 'east', type: 'select', 
              options: [
                  { value: 'east', label: '东风' },
                  { value: 'south', label: '南风' },
                  { value: 'west', label: '西风' },
                  { value: 'north', label: '北风' }
              ], hide: true},
            { key: 'playerWind', label: '门风', default: 'east', type: 'select', 
              options: [
                  { value: 'east', label: '东风' },
                  { value: 'south', label: '南风' },
                  { value: 'west', label: '西风' },
                  { value: 'north', label: '北风' }
              ], hide: true}
        ];
    }
    
    getLocalizedStrings() {
        return {
            fanLabel: '飜数',
            fuLabel: '符数',
            fanUnit: '飜',  // 用于历史记录显示的简化单位
            fuUnit: '符',   // 用于历史记录显示的简化单位
            honbaLabel: '本場',
            winType: {
                自摸: 'ツモ',
                和牌: 'ロン'
            },
            payerText: '放铳',
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
    
    
    getDefaultSettings() {
        return {
            initialScore: 25000,
            targetScore: 30000,
            minScore: 0
        };
    }
    
    // 检查断幺九
    checkTanyao(tiles, meldNormal) {
        const allTiles = [...tiles, ...meldNormal];
        return !allTiles.some(tile => this.isYaochuuTile(tile));
    }
    
    // 检查一杯口
    checkIipeikou(decomposition) {
        const shuntsuList = decomposition.mentsu.filter(mentsu => mentsu.type === 'shuntsu');
        const shuntsuStrings = shuntsuList.map(mentsu => mentsu.tile);
        
        // 检查是否有重复的顺子
        const shuntsuCounts = {};
        shuntsuStrings.forEach(str => {
            shuntsuCounts[str] = (shuntsuCounts[str] || 0) + 1;
        });
        
        return Object.values(shuntsuCounts).some(count => count >= 2);
    }
    
    // 检查二杯口
    checkRyanpeikou(decomposition) {
        const shuntsuList = decomposition.mentsu.filter(mentsu => mentsu.type === 'shuntsu');
        if (shuntsuList.length !== 4) return false;
        
        const shuntsuStrings = shuntsuList.map(mentsu => mentsu.tile);
        const shuntsuCounts = {};
        shuntsuStrings.forEach(str => {
            shuntsuCounts[str] = (shuntsuCounts[str] || 0) + 1;
        });
        
        const counts = Object.values(shuntsuCounts);
        return counts.filter(count => count === 2).length === 2;
    }
    
    // 检查三色同顺
    checkSanshokuDoujun(decomposition, meldTiles) {
        const allShuntsu = [...decomposition.mentsu.filter(m => m.type === 'shuntsu')];
        if (meldTiles) {
            allShuntsu.push(...meldTiles.filter(m => m.type === 'shuntsu'));
        }
        
        const shuntsuByNumber = {};
        allShuntsu.forEach(mentsu => {
            // 数据结构已统一，直接访问tiles[0]
            const {suit, number} = mentsu.tiles[0];
            if (suit !== 'honor') {
                if (!shuntsuByNumber[number]) shuntsuByNumber[number] = [];
                shuntsuByNumber[number].push(suit);
            }
        });
        
        for (const [number, suits] of Object.entries(shuntsuByNumber)) {
            const uniqueSuits = [...new Set(suits)];
            if (uniqueSuits.length === 3 && uniqueSuits.includes('man') && uniqueSuits.includes('pin') && uniqueSuits.includes('sou')) {
                return true;
            }
        }
        
        return false;
    }
    
    // 检查三色同刻
    checkSanshokuDouko(decomposition, meldTiles) {
        const allKoutsu = [...decomposition.mentsu.filter(m => m.type === 'koutsu')];
        if (meldTiles) {
            allKoutsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === '刻子'));
        }
        
        const koutsuByNumber = {};
        allKoutsu.forEach(mentsu => {
            // 数据结构已统一，直接访问tiles[0]
            const {suit, number} = mentsu.tiles[0];
            if (suit !== 'honor') {
                if (!koutsuByNumber[number]) koutsuByNumber[number] = [];
                koutsuByNumber[number].push(suit);
            }
        });
        
        for (const [number, suits] of Object.entries(koutsuByNumber)) {
            const uniqueSuits = [...new Set(suits)];
            if (uniqueSuits.length === 3 && uniqueSuits.includes('man') && uniqueSuits.includes('pin') && uniqueSuits.includes('sou')) {
                return true;
            }
        }
        
        return false;
    }

    // 检查一气通贯
    checkIttsu(decomposition, meldTiles) {
        const allShuntsu = [...decomposition.mentsu.filter(m => m.type === 'shuntsu')];
        if (meldTiles) {
            allShuntsu.push(...meldTiles.filter(m => m.type === 'shuntsu'));
        }
        
        const shuntsuBySuit = {};
        allShuntsu.forEach(mentsu => {
            // 数据结构已统一，直接访问tiles[0]
            const {suit, number} = mentsu.tiles[0];
            if (suit !== 'honor') {
                if (!shuntsuBySuit[suit]) shuntsuBySuit[suit] = [];
                shuntsuBySuit[suit].push(parseInt(number));
            }
        });
        
        for (const [suit, numbers] of Object.entries(shuntsuBySuit)) {
            const uniqueNumbers = [...new Set(numbers)];
            if (uniqueNumbers.includes(1) && uniqueNumbers.includes(4) && uniqueNumbers.includes(7)) {
                return true;
            }
        }
        
        return false;
    }
    
    // 检查混全带幺九
    checkChanta(decomposition, meldTiles) {
        const allMentsu = [...decomposition.mentsu];
        if (meldTiles) {
            allMentsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'shuntsu' || m.type === 'kan'));
        }
        
        // 雀头必须是幺九牌
        if (!this.isYaochuuTile(decomposition.jantou.tiles[0])) return false;
        
        // 每个面子都必须包含幺九牌
        const hasYaochuuInAllMentsu = allMentsu.every(mentsu => {
            if (mentsu.type === 'koutsu' || mentsu.type === 'kan') {
                return this.isYaochuuTile(mentsu.tiles[0]);
            } else if (mentsu.type === 'shuntsu') {
                const {suit, number} = mentsu.tiles[0];
                const num = parseInt(number);
                return num === 1 || num === 7; // 123或789
            }
            return false;
        });
        
        if (!hasYaochuuInAllMentsu) return false;
        
        // 混全带幺九的定义：必须同时包含字牌和数牌
        const jantouHasHonor = decomposition.jantou.tiles[0].suit === 'honor';
        const mentsuHasHonor = allMentsu.some(mentsu => mentsu.tiles[0].suit === 'honor');
        const hasHonorTiles = jantouHasHonor || mentsuHasHonor;
        
        const jantouHasNumeric = decomposition.jantou.tiles[0].suit !== 'honor';
        const mentsuHasNumeric = allMentsu.some(mentsu => mentsu.tiles[0].suit !== 'honor');
        const hasNumericTiles = jantouHasNumeric || mentsuHasNumeric;
        
        // 必须同时包含字牌和数牌才能是混全带幺九
        return hasHonorTiles && hasNumericTiles;
    }
    
    // 检查纯全带幺九
    checkJunchan(decomposition, meldTiles) {
        const allMentsu = [...decomposition.mentsu];
        if (meldTiles) {
            allMentsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'shuntsu' || m.type === 'kan'));
        }
        
        // 雀头必须是幺九牌
        if (!this.isYaochuuTile(decomposition.jantou.tiles[0])) return false;
        
        // 每个面子都必须包含幺九牌
        const hasYaochuuInAllMentsu = allMentsu.every(mentsu => {
            if (mentsu.type === 'koutsu' || mentsu.type === 'kan') {
                return this.isYaochuuTile(mentsu.tiles[0]);
            } else if (mentsu.type === 'shuntsu') {
                const {suit, number} = mentsu.tiles[0];
                const num = parseInt(number);
                return num === 1 || num === 7; // 123或789
            }
            return false;
        });
        
        if (!hasYaochuuInAllMentsu) return false;
        
        // 检查是否包含字牌，纯全带幺九不能包含字牌
        const jantouHasHonor = decomposition.jantou.tiles[0].suit === 'honor';
        const mentsuHasHonor = allMentsu.some(mentsu => mentsu.tiles[0].suit === 'honor');
        
        // 不能包含字牌才能是纯全带幺九
        return !jantouHasHonor && !mentsuHasHonor;
    }
    
    // 检查混老头
    checkHonroutou(decomposition, meldTiles) {
        const allMentsu = [...decomposition.mentsu];
        if (meldTiles) {
            allMentsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'kan'));
        }
        
        // 只能是刻子或杠子，不能有顺子
        if (meldTiles && meldTiles.some(meld => meld.type === 'shuntsu')) return false;
        if (decomposition.mentsu.some(mentsu => mentsu.type === 'shuntsu')) return false;
        
        // 雀头和所有刻子都必须是幺九牌
        if (!this.isYaochuuTile(decomposition.jantou.tiles[0])) return false;
        
        if (!allMentsu.every(mentsu => this.isYaochuuTile(mentsu.tiles[0]))) return false;
        
        // 混老头的定义：必须同时包含字牌和数牌的老头牌（1或9）
        const jantouHasHonor = decomposition.jantou.tiles[0].suit === 'honor';
        const mentsuHasHonor = allMentsu.some(mentsu => mentsu.tiles[0].suit === 'honor');
        const hasHonorTiles = jantouHasHonor || mentsuHasHonor;
        
        const jantouHasTerminal = decomposition.jantou.tiles[0].suit !== 'honor' && 
            (decomposition.jantou.tiles[0].number === 1 || decomposition.jantou.tiles[0].number === 9);
        const mentsuHasTerminal = allMentsu.some(mentsu => 
            mentsu.tiles[0].suit !== 'honor' && 
            (mentsu.tiles[0].number === 1 || mentsu.tiles[0].number === 9)
        );
        const hasTerminalTiles = jantouHasTerminal || mentsuHasTerminal;
        
        // 必须同时包含字牌和老头牌才能是混老头
        return hasHonorTiles && hasTerminalTiles;
    }
    
    // 检查三暗刻
    checkSanankou(decomposition, meldNormal, meldTiles) {
        const ankouCount = decomposition.mentsu.filter(mentsu => 
            mentsu.type === 'koutsu' && !this.isMeldTile(mentsu.tile, meldNormal)
        ).length;
        
        // 加上暗杠数量
        const ankanCount = meldTiles ? meldTiles.filter(meld => meld.type === 'kan' && meld.isConcealed).length : 0;
        
        return ankouCount + ankanCount === 3;
    }
    
    // 检查字一色
    checkTsuuiisou(tiles, meldNormal) {
        const allTiles = [...tiles, ...meldNormal];
        return allTiles.every(tile => tile.suit === 'honor');
    }
    
    // 检查绿一色
    checkRyuuiisou(tiles, meldNormal) {
        const allTiles = [...tiles, ...meldNormal];
        const greenTiles = ['sou-2', 'sou-3', 'sou-4', 'sou-6', 'sou-8', 'honor-6']; // 包括发财
        
        return allTiles.every(tile => {
            const key = this.tileToKey(tile);
            return greenTiles.includes(key);
        });
    }
    
    // 检查清老头
    checkChinroutou(tiles, meldNormal) {
        const allTiles = [...tiles, ...meldNormal];
        return allTiles.every(tile => {
            if (tile.suit === 'honor') return false;
            return tile.number === 1 || tile.number === 9;
        });
    }

    getYakumanFanCount(multiplier) {
        // 青天井模式：每个役满视作13番
        if (this.settings.aotenjou) {
            return 13 * multiplier;
        }
        
        // 非青天井模式：使用特殊编码
        switch (multiplier) {
            case 2: return 200;
            case 3: return 300;
            case 4: return 400;
            case 5: return 500;
            case 6: return 600;
        }
        return 13; // 默认返回13，表示单倍役满
    }
    
    // 检查四喜
    checkSuushii(decomposition, meldTiles) {
        const allKoutsu = [...decomposition.mentsu.filter(m => m.type === 'koutsu')];
        if (meldTiles) {
            allKoutsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'kan'));
        }
        
        const windKoutsu = allKoutsu.filter(mentsu => {
            const {suit, number} = mentsu.tiles[0];
            return suit === 'honor' && number >= 1 && number <= 4;
        });
        
        // 大四喜：四个风牌刻子
        if (windKoutsu.length === 4) {
            return { isDaisuushii: true, isShousuushii: false };
        }
        
        // 小四喜：三个风牌刻子 + 一个风牌雀头
        if (windKoutsu.length === 3) {
            const jantou = decomposition.jantou.tiles[0];
            if (jantou.suit === 'honor' && jantou.number >= 1 && jantou.number <= 4) {
                return { isDaisuushii: false, isShousuushii: true };
            }
        }
        
        return { isDaisuushii: false, isShousuushii: false };
    }
    
    // 检查小三元
    checkSshousangen(decomposition, meldTiles) {
        const allKoutsu = [...decomposition.mentsu.filter(m => m.type === 'koutsu')];
        if (meldTiles) {
            allKoutsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'kan'));
        }
        
        const dragonKoutsu = allKoutsu.filter(mentsu => {
            const {suit, number} = mentsu.tiles[0];
            return suit === 'honor' && number >= 5 && number <= 7;
        });
        
        if (dragonKoutsu.length === 2) {
            const jantou = decomposition.jantou.tiles[0];
            if (jantou.suit === 'honor' && jantou.number >= 5 && jantou.number <= 7) {
                return true;
            }
        }
        
        return false;
    }
    
    // 检查三杠子
    checkSankantsu(meldTiles) {
        if (!meldTiles) return false;
        const kanCount = meldTiles.filter(meld => meld.type === 'kan').length;
        return kanCount === 3;
    }
    
    // 检查四杠子
    checkSuukantsu(meldTiles) {
        if (!meldTiles) return false;
        const kanCount = meldTiles.filter(meld => meld.type === 'kan').length;
        return kanCount === 4;
    }
    
    // 检查风牌役
    checkWindYaku(decomposition, meldTiles, enhancedConditions, analysis) {
        const allKoutsu = [...decomposition.mentsu.filter(m => m.type === 'koutsu')];
        if (meldTiles) {
            allKoutsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'kan'));
        }
        
        const windMap = { east: 1, south: 2, west: 3, north: 4 };
        const roundWind = windMap[enhancedConditions.roundWind];
        const playerWind = windMap[enhancedConditions.playerWind];
        
        allKoutsu.forEach(mentsu => {
            const {suit, number} = mentsu.tiles[0];
            if (suit === 'honor') {
                const num = parseInt(number);
                if (num >= 1 && num <= 4) {
                    if (num === roundWind) {
                        analysis.fanCount += 1;
                        analysis.fanDetails.push({ name: `圈风${this.getWindName(num)}`, fan: 1, description: '圈风牌刻子' });
                    }
                    if (num === playerWind) {
                        analysis.fanCount += 1;
                        analysis.fanDetails.push({ name: `门风${this.getWindName(num)}`, fan: 1, description: '门风牌刻子' });
                    }
                }
            }
        });
    }
    
    // 检查三元牌役
    checkDragonYaku(decomposition, meldTiles, analysis) {
        const allKoutsu = [...decomposition.mentsu.filter(m => m.type === 'koutsu')];
        if (meldTiles) {
            allKoutsu.push(...meldTiles.filter(m => m.type === 'koutsu' || m.type === 'kan'));
        }
        
        allKoutsu.forEach(mentsu => {
            const {suit, number} = mentsu.tiles[0];
            if (suit === 'honor') {
                const num = parseInt(number);
                if (num >= 5 && num <= 7) {
                    analysis.fanCount += 1;
                    analysis.fanDetails.push({ name: this.getDragonName(num), fan: 1, description: '三元牌刻子' });
                }
            }
        });
    }
    
    // 获取风牌名称
    getWindName(windNumber) {
        const names = { 1: '东', 2: '南', 3: '西', 4: '北' };
        return names[windNumber] || '未知';
    }
    
    // 获取三元牌名称
    getDragonName(dragonNumber) {
        const names = { 5: '中', 6: '发', 7: '白' };
        return names[dragonNumber] || '未知';
    }
    
    // 检查平和
    checkPinfu(decomposition, conditions) {
        // 门清且全为顺子
        if (!conditions.isMenQing) return false;
        
        const allShuntsu = decomposition.mentsu.every(mentsu => mentsu.type === 'shuntsu');
        if (!allShuntsu) return false;
        
        // 雀头不能是役牌
        const jantouKey = decomposition.jantou.tile;
        if (this.isYakuhai(jantouKey, conditions)) return false;
        
        // 必须是两面听牌（简化实现）
        return true;
    }
    
    // 检查对对和
    checkToitoi(decomposition, meldTiles) {
        // 检查手牌分解中是否全为刻子（不包括杠子，因为杠子在副露中）
        const handAllKoutsu = decomposition.mentsu.every(mentsu => mentsu.type === 'koutsu');
        
        // 检查副露中是否有顺子
        const hasMeldShuntsu = meldTiles && meldTiles.some(meld => meld.type === 'shuntsu');
        
        return handAllKoutsu && !hasMeldShuntsu;
    }
    
    // 检查清一色
    checkChiitsu(tiles, meldNormal) {
        const allTiles = [...tiles, ...meldNormal];
        const suits = new Set(allTiles.map(tile => tile.suit));
        return suits.size === 1 && !suits.has('honor');
    }
    
    // 检查混一色
    checkHonitsu(tiles, meldNormal) {
        const allTiles = [...tiles, ...meldNormal];
        const suits = new Set(allTiles.map(tile => tile.suit));
        const hasHonor = suits.has('honor');
        const nonHonorSuits = Array.from(suits).filter(suit => suit !== 'honor');
        return hasHonor && nonHonorSuits.length === 1;
    }
    
    // 检查大三元
    checkDaisangen(decomposition, meldTiles) {
        const allSets = [...decomposition.mentsu];
        if (meldTiles) {
            allSets.push(...meldTiles.filter(meld => meld.type === 'koutsu' || meld.type === 'kan'));
        }
        
        const sanyuanSets = allSets.filter(set => {
            const {suit, number} = set.tiles[0];
            return suit === 'honor' && number >= 5 && number <= 7;
        });
        
        return sanyuanSets.length === 3;
    }
    
    // 检查四暗刻
    checkSuuankou(decomposition, meldNormal, conditions, meldTiles) {
        if (!conditions.isMenQing) return false;
        if (!conditions.isTsumo) return false;
        
        // 计算手牌中的暗刻数
        const ankouCount = decomposition.mentsu.filter(mentsu => mentsu.type === 'koutsu').length;
        
        // 计算暗杠数（暗杠也算作暗刻）
        const ankanCount = meldTiles ? meldTiles.filter(meld => meld.type === 'kan' && meld.isConcealed).length : 0;
        
        return ankouCount + ankanCount === 4;
    }
    
    // 检查四暗刻单骑
    checkSuuankouTanki(decomposition, winningTile) {
        if (winningTile.length === 0) return false;
        
        const winTileKey = this.tileToKey(winningTile[0]);
        return decomposition.jantou.tile === winTileKey;
    }
    
    // 检查国士无双
    checkKokushi(tiles) {
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
    
    // 检查国士无双十三面
    checkKokushiJuusanmen(tiles, winningTile) {
        if (!winningTile || winningTile.length === 0) return false;
        
        const requiredTiles = [
            'man-1', 'man-9', 'pin-1', 'pin-9', 'sou-1', 'sou-9',
            'honor-1', 'honor-2', 'honor-3', 'honor-4', 'honor-5', 'honor-6', 'honor-7'
        ];
        
        const tileCount = this.getTileCountFromParsed(tiles);
        const winTileKey = this.tileToKey(winningTile[0]);
        
        // 检查是否所有13种幺九牌都有且只有一张
        const singleTiles = Object.keys(tileCount).filter(key => tileCount[key] === 1);
        const pairTiles = Object.keys(tileCount).filter(key => tileCount[key] === 2);
        
        // 十三面的条件：12种单张 + 1种对子，且和牌是其中任意一种
        return singleTiles.length === 12 && pairTiles.length === 1 && 
               requiredTiles.includes(winTileKey);
    }
    
    // 检查纯正九莲宝灯
    checkChuurenKyuumen(tiles, winningTile) {
        if (!winningTile || winningTile.length === 0) return false;
        
        const suits = ['man', 'pin', 'sou'];
        let targetSuit = null;
        
        for (let suit of suits) {
            if (tiles.every(tile => tile.suit === suit)) {
                targetSuit = suit;
                break;
            }
        }
        
        if (!targetSuit) return false;
        
        // 检查是否为标准九莲宝灯形态 1112345678999
        const tileCount = this.getTileCountFromParsed(tiles);
        const suitTileCount = {};

        // 检查和牌和手牌是否为清一色
        if (winningTile[0].suit !== targetSuit) return false;
        
        for (let i = 1; i <= 9; i++) {
            suitTileCount[i] = tileCount[`${targetSuit}-${i}`] || 0;
        }
        
        const basePattern = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        const winTileNumber = winningTile[0].number;
        
        // 检查是否为九面听牌（任意一张都可以和牌）
        const testPattern = [...basePattern];
        testPattern[winTileNumber - 1] += 1;
        
        for (let i = 1; i <= 9; i++) {
            if (suitTileCount[i] !== testPattern[i - 1]) {
                return false;
            }
        }
        
        return true;
    }
    
    // 验证牌型是否有效
    validateWinningHand(hand, winTile, melds) {
        if (!hand && !winTile) {
            return { isValid: false, error: '没有输入牌型' };
        }
        
        try {
            const parser = window.mahjongParser || new MahjongParser();
            parser.setPattern('relaxed');
            
            const handTiles = parser.parseHand(hand || '');
            const winningTile = parser.parseHand(winTile || '');
            const meldTiles = melds ? parser.parseMelds(melds) : [];
            
            // 计算总牌数和杠子数量
            const totalTiles = handTiles.length + winningTile.length + 
                              meldTiles.reduce((sum, meld) => sum + meld.tiles.length, 0);
            
            // 计算杠子数量
            const kanCount = meldTiles.filter(meld => 
                meld.type === 'kan' || meld.type === '暗槓' || meld.type === '明槓'
            ).length;
            
            // 检查牌数是否正确（标准14张 + 每个杠子额外1张）
            const expectedTiles = 14 + kanCount;
            if (totalTiles !== expectedTiles) {
                return { isValid: false, error: `牌数错误，应为${expectedTiles}张（基础14张+${kanCount}个杠子），实际为${totalTiles}张` };
            }
            
            // 检查是否有重复牌过多
            const allTiles = [...handTiles, ...winningTile];
            meldTiles.forEach(meld => {
                allTiles.push(...meld.tiles);
            });
            
            const tileCount = this.getTileCountFromParsed(allTiles);
            for (const [tileKey, count] of Object.entries(tileCount)) {
                if (count > 4) {
                    return { isValid: false, error: `${tileKey}牌数过多（${count}张）` };
                }
            }
            
            return { isValid: true };
            
        } catch (error) {
            return { isValid: false, error: '牌型解析错误: ' + error.message };
        }
    }
    
    // 检查是否为边张听牌
    isPenchanWait(winTileKey, decomposition) {
        const winTile = this.keyToTile(winTileKey);
        if (winTile.suit === 'honor') return false;
        
        // 检查是否在顺子中形成边张
        for (const mentsu of decomposition.mentsu) {
            if (mentsu.type === 'shuntsu') {
                const baseTile = mentsu.tile;
                if (baseTile.suit === winTile.suit) {
                    // 检查是否是123的3或789的7
                    if ((baseTile.number === 1 && winTile.number === 3) ||
                        (baseTile.number === 7 && winTile.number === 7)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    // 检查是否为嵌张听牌
    isKanchanWait(winTileKey, decomposition) {
        const winTile = this.keyToTile(winTileKey);
        if (winTile.suit === 'honor') return false;
        
        // 检查是否在顺子中形成嵌张
        for (const mentsu of decomposition.mentsu) {
            if (mentsu.type === 'shuntsu') {
                const baseTile = mentsu.tile;
                if (baseTile.suit === winTile.suit) {
                    // 检查是否是中间的牌
                    if (winTile.number === baseTile.number + 1) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    // 找出所有可能的雀头
    findAllPossiblePairs(tiles) {
        const tileCount = this.getTileCountFromParsed(tiles);
        const possiblePairs = [];
        
        for (const [tileKey, count] of Object.entries(tileCount)) {
            if (count >= 2) {
                const remaining = [...tiles];
                // 移除一对牌
                let removedCount = 0;
                for (let i = remaining.length - 1; i >= 0 && removedCount < 2; i--) {
                    if (this.tileToKey(remaining[i]) === tileKey) {
                        remaining.splice(i, 1);
                        removedCount++;
                    }
                }
                
                possiblePairs.push({
                    pair: { tile: tileKey, count: 2 },
                    remaining: remaining
                });
            }
        }
        
        return possiblePairs;
    }
    
    // 找出所有可能的面子组合
    findAllMentuCombinations(tiles) {
        if (tiles.length === 0) return [[]];
        if (tiles.length % 3 !== 0) return [];
        
        const tileCount = this.getTileCountFromParsed(tiles);
        const combinations = [];
        
        this.findMentuRecursive(tileCount, [], combinations);
        
        return combinations;
    }
    
    // 递归查找面子组合
    findMentuRecursive(tileCount, currentCombination, allCombinations) {
        // 检查是否所有牌都已用完
        const remainingTiles = Object.values(tileCount).reduce((sum, count) => sum + count, 0);
        if (remainingTiles === 0) {
            allCombinations.push([...currentCombination]);
            return;
        }
        
        // 找到第一个有牌的位置
        const firstTileKey = Object.keys(tileCount).find(key => tileCount[key] > 0);
        if (!firstTileKey) return;
        
        const firstTile = this.keyToTile(firstTileKey);
        
        // 尝试形成刻子
        if (tileCount[firstTileKey] >= 3) {
            const newTileCount = { ...tileCount };
            newTileCount[firstTileKey] -= 3;
            
            const mentsu = {
                type: 'koutsu',
                tile: firstTileKey,
                tiles: [firstTileKey, firstTileKey, firstTileKey]
            };
            
            currentCombination.push(mentsu);
            this.findMentuRecursive(newTileCount, currentCombination, allCombinations);
            currentCombination.pop();
        }
        
        // 尝试形成顺子
        if (this.canFormShunzi(firstTile, tileCount)) {
            const shunziTiles = this.getShunziTiles(firstTile);
            const newTileCount = { ...tileCount };
            
            shunziTiles.forEach(tileKey => {
                newTileCount[tileKey] -= 1;
            });
            
            const mentsu = {
                type: 'shuntsu',
                tile: firstTileKey,
                tiles: shunziTiles
            };
            
            currentCombination.push(mentsu);
            this.findMentuRecursive(newTileCount, currentCombination, allCombinations);
            currentCombination.pop();
        }
    }
    
    // 基于分解结果分析役种
    analyzeYaku(decomposition, allNormalTiles, meldNormal, enhancedConditions, analysis, meldTiles, winningTile, handTiles) {
        const isMenQing = enhancedConditions.isMenQing;
        let yakumanCount = 0;
        let yakumanDetails = [];
        
        // 天和/地和检查（只在青天井模式下单独计算，非青天井模式在其他地方处理）
        if (this.settings.aotenjou) {
            if (enhancedConditions.isTenhou) {
                yakumanCount += 1;
                yakumanDetails.push('天和');
            }
            if (enhancedConditions.isChiihou) {
                yakumanCount += 1;
                yakumanDetails.push('地和');
            }
        }
        
        // 检查所有可能的役满，允许复合
        
        // 四暗刻（四暗刻）
        if (this.checkSuuankou(decomposition, meldNormal, enhancedConditions, meldTiles)) {
            yakumanCount += 1;
            
            // 四暗刻单骑
            if (this.checkSuuankouTanki(decomposition, winningTile)) {
                yakumanCount += 1; // 额外+1倍役满
                yakumanDetails.push('四暗刻单骑');
                analysis.isSuuankouTanki = true; // 标记为四暗刻单骑
            }
            else {
                yakumanDetails.push('四暗刻');
                analysis.isSuuankou = true; // 标记为四暗刻
            }
        }
        
        // 大三元（大三元）
        if (this.checkDaisangen(decomposition, meldTiles)) {
            yakumanCount += 1;
            yakumanDetails.push('大三元');
            analysis.isDaisangen = true; // 标记为大三元
        }
        
        // 字一色（字一色）
        if (this.checkTsuuiisou(allNormalTiles, meldNormal)) {
            yakumanCount += 1;
            yakumanDetails.push('字一色');
            analysis.isTsuuiisou = true; // 标记为字一色
        }
        
        // 绿一色（緑一色）
        if (this.checkRyuuiisou(allNormalTiles, meldNormal)) {
            yakumanCount += 1;
            yakumanDetails.push('绿一色');
            analysis.isRyuuiisou = true; // 标记为绿一色
        }
        
        // 清老头（清老頭）
        const isChinroutou = this.checkChinroutou(allNormalTiles, meldNormal);
        if (isChinroutou) {
            yakumanCount += 1;
            yakumanDetails.push('清老头');
            analysis.isChinroutou = true; // 标记为清老头
        }
        
        // 小四喜和大四喜
        const suushii = this.checkSuushii(decomposition, meldTiles);
        if (suushii.isDaisuushii) {
            yakumanCount += 2; // 大四喜本身就是双倍役满
            yakumanDetails.push('大四喜');
            analysis.isDaisuushii = true; // 标记为大四喜
        } else if (suushii.isShousuushii) {
            yakumanCount += 1;
            yakumanDetails.push('小四喜');
            analysis.isShousuushii = true; // 标记为小四喜
        }
        
        // 四杠子（四槓子）
        if (this.checkSuukantsu(meldTiles)) {
            yakumanCount += 1;
            yakumanDetails.push('四杠子');
            analysis.isSuukantsu = true; // 标记为四杠子
        }
        
        // 九莲宝灯（九蓮宝燈）
        if (this.checkChuurenPoutou(allNormalTiles, meldNormal, enhancedConditions)) {
            // 检查是否为纯正九莲宝灯（九面听）
            if (this.checkChuurenKyuumen(allNormalTiles, winningTile)) {
                yakumanCount += 2; // 纯正九莲宝灯是双倍役满
                yakumanDetails.push('纯正九莲宝灯');
                analysis.isChuurenKyuumen = true; // 标记为纯正九莲宝灯
            } else {
                yakumanCount += 1;
                yakumanDetails.push('九莲宝灯');
                analysis.isChuurenPoutou = true; // 标记为九莲宝灯
            }
        }
        
        // 如果有役满，设置对应的特殊fan数
        if (yakumanCount > 0) {
            // 应用最大役满倍数限制
            const maxMultiplier = (this.settings.aotenjou ? 999 : this.settings.maxYakumanMultiplier) || 2;
            const actualYakumanCount = Math.min(yakumanCount, maxMultiplier);
            
            if (this.settings.aotenjou) {
                // 青天井模式：累计役满番数
                analysis.fanCount += 13 * actualYakumanCount;
                let totalYakumanCount = actualYakumanCount;
                // 添加天和/地和的详情
                if (enhancedConditions.isTenhou) {
                    analysis.fanDetails.push({ name: '天和', fan: 13, description: '庄家第一巡和牌' });
                    totalYakumanCount += 1; // 天和计为1倍役满
                }
                if (enhancedConditions.isChiihou) {
                    analysis.fanDetails.push({ name: '地和', fan: 13, description: '闲家第一巡和牌' });
                    totalYakumanCount += 1; // 地和计为1倍役满
                }
                // 添加其他役满详情
                const otherYakumanDetails = yakumanDetails.filter(name => name !== '天和' && name !== '地和');
                if (otherYakumanDetails.length > 0) {
                    const otherYakumanCount = otherYakumanDetails.length;
                    analysis.fanDetails.push({ name: otherYakumanDetails.join('+'), fan: 13 * totalYakumanCount, description: '役满复合' });
                }
                // 继续检查其他役种
            } else {
                // 非青天井模式：设置特殊fan数编码
                analysis.fanCount = this.getYakumanFanCount(actualYakumanCount);
                
                // 组合役满描述
                const yakumanName = `${yakumanDetails.join('+')}`;
                let multiplierText;
                
                if (yakumanCount > maxMultiplier) {
                    // 超出限制时显示实际役满和限制信息
                    multiplierText = `${actualYakumanCount}倍役满（实际${yakumanCount}倍，限制${maxMultiplier}倍）`;
                } else {
                    multiplierText = actualYakumanCount >= 2 ? `${actualYakumanCount}倍役满` : '役满';
                }
                
                analysis.fanDetails = [{ name: yakumanName, fan: multiplierText, description: '役满复合' }];
                
                // 直接返回
                return;
            }
        }
        
        // 普通役种检查
        
        // 在青天井模式下，需要检查役种冲突
        const isAotenjou = this.settings.aotenjou;
        
        // 记录已成立的役满，用于青天井模式下的冲突检查
        const hasYakuman = yakumanCount > 0;
        const hasSuuankou = yakumanDetails.includes('四暗刻') || yakumanDetails.includes('四暗刻单骑');
        const hasSuukantsu = yakumanDetails.includes('四杠子');
        const hasDaisuushii = yakumanDetails.includes('大四喜');
        const hasTenchihou = enhancedConditions.isTenhou || enhancedConditions.isChiihou;
        
        // 天和/地和不可和门前清自摸和复合（青天井模式）
        let skipMenzenTsumo = false;
        if (isAotenjou && hasTenchihou) {
            skipMenzenTsumo = true;
        }
        
        // 断幺九（タンヤオ）
        if (this.checkTanyao(allNormalTiles, meldNormal)) {
            if (isMenQing || this.settings.openTanyao) {
                analysis.isTanyao = true;
                analysis.fanCount += 1;
                analysis.fanDetails.push({ name: '断幺九', fan: 1, description: '不含幺九牌的和牌' });
            }
        }
        
        // 平和（ピンフ）
        if (this.checkPinfu(decomposition, enhancedConditions)) {
            analysis.isPinfu = true;
            analysis.fanCount += 1;
            analysis.fanDetails.push({ name: '平和', fan: 1, description: '门清，四组顺子，非役牌雀头，边张、坎张、单骑以外的听牌' });
        }
        
        // 对对和（対々和）
        // 青天井模式下：四暗刻、四杠子、大四喜不计对对和
        const skipToitoi = isAotenjou && (hasSuuankou || hasSuukantsu || hasDaisuushii);
        if (!skipToitoi && this.checkToitoi(decomposition, meldTiles)) {
            analysis.isToitoi = true;
            analysis.fanCount += 2;
            analysis.fanDetails.push({ name: '对对和', fan: 2, description: '四组刻子（槓子）' });
        }
        
        // 二杯口（二盃口）- 先检查二杯口
        if (isMenQing && this.checkRyanpeikou(decomposition)) {
            analysis.isRyanpeikou = true;
            analysis.fanCount += 3;
            analysis.fanDetails.push({ name: '二杯口', fan: 3, description: '门清，两组相同的顺子' });
        }
        // 一杯口（一盃口）- 只有在没有二杯口的情况下才计算一杯口
        else if (isMenQing && this.checkIipeikou(decomposition)) {
            analysis.isIipeikou = true;
            analysis.fanCount += 1;
            analysis.fanDetails.push({ name: '一杯口', fan: 1, description: '门清，一组相同的顺子' });
        }
        
        // 三色同顺（三色同順）
        if (this.checkSanshokuDoujun(decomposition, meldTiles)) {
            analysis.isSanshokuDoujun = true;
            const fanValue = isMenQing ? 2 : 1;
            analysis.fanCount += fanValue;
            analysis.fanDetails.push({ name: '三色同顺', fan: fanValue, description: isMenQing ? '门清，三种花色各一组相同顺子' : '三种花色各一组相同顺子' });
        }
        
        // 三色同刻（三色同刻）
        if (this.checkSanshokuDouko(decomposition, meldTiles)) {
            analysis.isSanshokuDouko = true;
            analysis.fanCount += 2;
            analysis.fanDetails.push({ name: '三色同刻', fan: 2, description: '三种花色各一组相同刻子' });
        }
        
        // 一气通贯（一気通貫）
        if (this.checkIttsu(decomposition, meldTiles)) {
            analysis.isIttsu = true;
            const fanValue = isMenQing ? 2 : 1;
            analysis.fanCount += fanValue;
            analysis.fanDetails.push({ name: '一气通贯', fan: fanValue, description: isMenQing ? '门清，同一花色123、456、789三组顺子' : '同一花色123、456、789三组顺子' });
        }
        
        // 混老头（混老頭）
        const isHonroutou = this.checkHonroutou(decomposition, meldTiles);
        if (isHonroutou) {
            analysis.isHonroutou = true;
            analysis.fanCount += 2;
            analysis.fanDetails.push({ name: '混老头', fan: 2, description: '全部由幺九牌组成，包含字牌' });
        }
        
        // 纯全带幺九（ジュンチャン）- 先检查纯全带幺九
        const isJunchan = this.checkJunchan(decomposition, meldTiles);
        if (isJunchan && !isChinroutou) { // 清老头成立时，纯全带幺九不计入
            analysis.isJunchan = true;
            const fanValue = isMenQing ? 3 : 2;
            analysis.fanCount += fanValue;
            analysis.fanDetails.push({ name: '纯全带幺九', fan: fanValue, description: isMenQing ? '门清，每组牌都含一九牌，不含字牌' : '每组牌都含一九牌，不含字牌' });
        }
        // 混全带幺九（チャンタ）- 只有在没有纯全带幺九和混老头的情况下才计算混全带幺九
        else if (!isJunchan && !isHonroutou && this.checkChanta(decomposition, meldTiles)) {
            analysis.isChanta = true;
            const fanValue = isMenQing ? 2 : 1;
            analysis.fanCount += fanValue;
            analysis.fanDetails.push({ name: '混全带幺九', fan: fanValue, description: isMenQing ? '门清，每组牌都含幺九牌' : '每组牌都含幺九牌' });
        }
        
        // 混一色（混一色）
        if (this.checkHonitsu(allNormalTiles, meldNormal)) {
            analysis.isHonitsu = true;
            const fanValue = isMenQing ? 3 : 2;
            analysis.fanCount += fanValue;
            analysis.fanDetails.push({ name: '混一色', fan: fanValue, description: isMenQing ? '门清，一种花色+字牌' : '一种花色+字牌' });
        }
        
        // 清一色（清一色）
        if (this.checkChiitsu(allNormalTiles, meldNormal)) {
            analysis.isChiitsu = true;
            const fanValue = isMenQing ? 6 : 5;
            analysis.fanCount += fanValue;
            analysis.fanDetails.push({ name: '清一色', fan: fanValue, description: isMenQing ? '门清，全部为一种花色' : '全部为一种花色' });
        }
        
        // 三暗刻（三暗刻）
        // 青天井模式下：四暗刻不计三暗刻
        const skipSanankou = isAotenjou && hasSuuankou;
        if (!skipSanankou && this.checkSanankou(decomposition, meldNormal, meldTiles)) {
            analysis.isSanankou = true;
            analysis.fanCount += 2;
            analysis.fanDetails.push({ name: '三暗刻', fan: 2, description: '三组暗刻（暗杠）' });
        }
        
        // 小三元（小三元）
        if (this.checkSshousangen(decomposition, meldTiles)) {
            analysis.fanCount += 2;
            analysis.fanDetails.push({ name: '小三元', fan: 2, description: '三元牌中两组刻子一组对子' });
        }
        
        // 三杠子（三槓子）
        // 青天井模式下：四杠子不计三杠子
        const skipSankantsu = isAotenjou && hasSuukantsu;
        if (!skipSankantsu && this.checkSankantsu(meldTiles)) {
            analysis.fanCount += 2;
            analysis.fanDetails.push({ name: '三杠子', fan: 2, description: '三组杠子' });
        }
        
        // 风牌役
        this.checkWindYaku(decomposition, meldTiles, enhancedConditions, analysis);
        
        // 三元牌役
        this.checkDragonYaku(decomposition, meldTiles, analysis);
        
        // 番数封顶检查（非青天井规则）
        if (!this.settings.aotenjou && analysis.fanCount >= 13) {
            analysis.fanCount = 13; // 累计役满最大13番
            analysis.fanDetails.push({ name: '累计役满', fan: 13, description: '累计番数达到役满' });
        }
    }
    
    // 检查七对子
    checkQiDuiZi(tiles) {
        if (tiles.length !== 14) return false;
        
        const tileCount = this.getTileCountFromParsed(tiles);
        const counts = Object.values(tileCount);
        
        return counts.length === 7 && counts.every(count => count === 2);
    }
    
    // 检查九莲宝灯
    checkChuurenPoutou(tiles, meldNormal, conditions) {
        if (!conditions.isMenQing) return false;
        if (tiles.length !== 14) return false;
        
        return this.checkChiitsu(tiles, meldNormal) && this.isChuurenPattern(tiles);
    }
    
    // 检查九莲宝灯模式
    isChuurenPattern(tiles) {
        const suits = ['man', 'pin', 'sou'];
        let targetSuit = null;
        
        for (let suit of suits) {
            if (tiles.every(tile => tile.suit === suit)) {
                targetSuit = suit;
                break;
            }
        }
        
        if (!targetSuit) return false;
        
        const tileCount = this.getTileCountFromParsed(tiles);
        const suitTileCount = {};
        
        for (let i = 1; i <= 9; i++) {
            suitTileCount[i] = tileCount[`${targetSuit}-${i}`] || 0;
        }
        
        // 检查基础形态：1112345678999
        const basePattern = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        let hasExtraCard = false;
        
        for (let i = 1; i <= 9; i++) {
            const expected = basePattern[i - 1];
            const actual = suitTileCount[i];
            
            if (actual === expected + 1) {
                if (hasExtraCard) return false;
                hasExtraCard = true;
            } else if (actual !== expected) {
                return false;
            }
        }
        
        return hasExtraCard;
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
    
    // 辅助方法：将牌转换为键值
    tileToKey(tile) {
        return `${tile.suit}-${tile.number}`;
    }
    
    // 辅助方法：将键值转换为牌
    keyToTile(key) {
        const [suit, number] = key.split('-');
        return { suit, number: parseInt(number) };
    }
    
    // 将牌键转换为可读名称
    keyToTileName(tileKey) {
        const [suit, number] = tileKey.split('-');
        const num = parseInt(number);
        
        if (suit === 'honor') {
            const honorNames = {
                1: '东', 2: '南', 3: '西', 4: '北',
                5: '中', 6: '发', 7: '白'
            };
            return honorNames[num] || `字${num}`;
        } else {
            const suitNames = {
                'man': '万', 'pin': '筒', 'sou': '索'
            };
            return `${num}${suitNames[suit] || suit}`;
        }
    }
    
    // 辅助方法：判断是否为幺九牌
    isYaochuuTile(tile) {
        if (tile.suit === 'honor') return true;
        return tile.number === 1 || tile.number === 9;
    }
    
    // 检查是否可以形成顺子
    canFormShunzi(tile, tileCount) {
        if (tile.suit === 'honor' || tile.suit === 'flower') return false;
        
        if (tile.number > 7) return false;
        
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
    
    // 计算某种分解的符数贡献
    calculateDecompositionFu(decomposition, meldNormal, enhancedConditions, winningTile, meldTiles = []) {
        let fu = 0;
        const fuDetails = [];
        
        // 基础符数
        fuDetails.push({ name: '基础', fu: 20, description: '基础符数' });
        
        // 雀头符数
        const jantouKey = decomposition.jantou.tile;
        if (this.isYakuhai(jantouKey, enhancedConditions)) {
            fu += 2; // 役牌雀头: 2符
            const tileName = this.keyToTileName(jantouKey);
            fuDetails.push({ name: '役牌雀头', fu: 2, description: `${tileName}雀头` });
        }
        
        // 面子符数
        for (const mentsu of decomposition.mentsu) {
            if (mentsu.type === 'koutsu') {
                const isYaochuu = this.isYaochuuTileFromKey(mentsu.tile);
                const isAnkou = !this.isMeldTile(mentsu.tile, meldNormal);
                const tileName = this.keyToTileName(mentsu.tile);
                
                if (isYaochuu) {
                    const fuValue = isAnkou ? 8 : 4; // 幺九刻子: 暗8符明4符
                    fu += fuValue;
                    const typeDesc = isAnkou ? '暗刻' : '明刻';
                    fuDetails.push({ name: `${typeDesc}(幺九)`, fu: fuValue, description: `${tileName}${typeDesc}` });
                } else {
                    const fuValue = isAnkou ? 4 : 2; // 中张刻子: 暗4符明2符
                    fu += fuValue;
                    const typeDesc = isAnkou ? '暗刻' : '明刻';
                    fuDetails.push({ name: `${typeDesc}(中张)`, fu: fuValue, description: `${tileName}${typeDesc}` });
                }
            }
            // 顺子不加符
        }
        
        // 副露杠子符数
        if (meldTiles && meldTiles.length > 0) {
            for (const meld of meldTiles) {
                if (meld.type === 'kan') {
                    const tileKey = this.tileToKey(meld.tiles[0]);
                    const isYaochuu = this.isYaochuuTileFromKey(tileKey);
                    const isAnkan = meld.isConcealed;
                    const tileName = this.keyToTileName(tileKey);
                    
                    if (isYaochuu) {
                        const fuValue = isAnkan ? 32 : 16; // 幺九杠子: 暗32符明16符
                        fu += fuValue;
                        const typeDesc = isAnkan ? '暗杠' : '明杠';
                        fuDetails.push({ name: `${typeDesc}(幺九)`, fu: fuValue, description: `${tileName}${typeDesc}` });
                    } else {
                        const fuValue = isAnkan ? 16 : 8; // 中张杠子: 暗16符明8符
                        fu += fuValue;
                        const typeDesc = isAnkan ? '暗杠' : '明杠';
                        fuDetails.push({ name: `${typeDesc}(中张)`, fu: fuValue, description: `${tileName}${typeDesc}` });
                    }
                }
            }
        }
        
        // 和牌符数
        const winTileKey = winningTile.length > 0 ? this.tileToKey(winningTile[0]) : null;
        if (winTileKey) {
            const tileName = this.keyToTileName(winTileKey);
            // 检查是否单骑、边张、嵌张
            if (this.isTankiWait(winTileKey, decomposition)) {
                fu += 2; // 单骑: 2符
                fuDetails.push({ name: '单骑', fu: 2, description: `${tileName}单骑` });
            } else if (this.isPenchanWait(winTileKey, decomposition)) {
                fu += 2; // 边张: 2符
                fuDetails.push({ name: '边张', fu: 2, description: `${tileName}边张` });
            } else if (this.isKanchanWait(winTileKey, decomposition)) {
                fu += 2; // 嵌张: 2符
                fuDetails.push({ name: '嵌张', fu: 2, description: `${tileName}嵌张` });
            }
        }
        
        // 将符数详情保存到分解对象中
        decomposition.fuDetails = fuDetails;
        
        return fu;
    }
    
    // 检查是否为役牌
    isYakuhai(tileKey, conditions) {
        const [suit, number] = tileKey.split('-');
        if (suit !== 'honor') return false;
        
        const num = parseInt(number);
        // 三元牌 (5:中, 6:发, 7:白)
        if (num >= 5 && num <= 7) return true;
        
        // 风牌检查
        const windMap = { east: 1, south: 2, west: 3, north: 4 };
        const roundWind = windMap[conditions.roundWind];
        const playerWind = windMap[conditions.playerWind];
        
        return num === roundWind || num === playerWind;
    }
    
    // 检查是否为幺九牌
    isYaochuuTileFromKey(tileKey) {
        const [suit, number] = tileKey.split('-');
        const num = parseInt(number);
        
        if (suit === 'honor') return true;
        return num === 1 || num === 9;
    }

    isYaochuuTile(tile) {
        if (tile.suit === 'honor') return true;
        return tile.number === 1 || tile.number === 9;
    }
    
    // 检查是否为副露牌
    isMeldTile(tileKey, meldNormal) {
        return meldNormal.some(tile => this.tileToKey(tile) === tileKey);
    }
    
    // 检查是否为单骑听牌
    isTankiWait(winTileKey, decomposition) {
        return decomposition.jantou.tile === winTileKey;
    }
    
    // 统一面子数据结构：将字符串键转换为对象格式
    normalizeMentsu(mentsu) {
        const normalizedMentsu = {
            type: mentsu.type,
            tile: mentsu.tile,
            tiles: [],
            isConcealed: mentsu.isConcealed !== undefined ? mentsu.isConcealed : true,
            original: mentsu.original
        };
        
        // 统一tiles数组格式：都转换为对象数组
        if (mentsu.tiles && mentsu.tiles.length > 0) {
            normalizedMentsu.tiles = mentsu.tiles.map(tile => {
                if (typeof tile === 'string') {
                    // 字符串键转换为对象
                    return this.keyToTile(tile);
                } else {
                    // 已经是对象，直接返回
                    return tile;
                }
            });
        }
        
        return normalizedMentsu;
    }
    
    // 统一雀头数据结构
    normalizeJantou(jantou) {
        if (!jantou) return null;
        
        const normalizedJantou = {
            tile: jantou.tile,
            tiles: [],
            count: jantou.count || 2
        };
        
        // 如果有tiles数组，统一格式
        if (jantou.tiles && jantou.tiles.length > 0) {
            normalizedJantou.tiles = jantou.tiles.map(tile => {
                if (typeof tile === 'string') {
                    return this.keyToTile(tile);
                } else {
                    return tile;
                }
            });
        } else {
            // 根据tile属性生成tiles数组
            const tileObj = typeof jantou.tile === 'string' ? 
                this.keyToTile(jantou.tile) : jantou.tile;
            normalizedJantou.tiles = [tileObj, tileObj];
        }
        
        return normalizedJantou;
    }
    
    // 统一分解结果数据结构
    normalizeDecomposition(decomposition) {
        const normalized = {
            jantou: this.normalizeJantou(decomposition.jantou),
            mentsu: [],
            tiles: decomposition.tiles,
            melds: decomposition.melds || []
        };
        
        // 统一面子数组
        if (decomposition.mentsu && decomposition.mentsu.length > 0) {
            normalized.mentsu = decomposition.mentsu.map(mentsu => this.normalizeMentsu(mentsu));
        }
        
        // 统一副露数组
        if (decomposition.melds && decomposition.melds.length > 0) {
            normalized.melds = decomposition.melds.map(meld => this.normalizeMentsu(meld));
        }
        
        return normalized;
    }
}

// 注册日本麻将规则
window.JapaneseMahjong = JapaneseMahjong;
