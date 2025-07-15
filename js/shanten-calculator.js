class ShantenCalculator {
    constructor() {
        this.parser = new MahjongParser();
    }

    calculate(handString, meldsString = "") {
        const handTiles = this.parser.parseHand(handString).filter(tile => tile.suit !== 'flower');
        const melds = this.parser.parseMelds(meldsString);
        const meldCount = melds.length;

        const vector = new Array(34).fill(0);
        handTiles.forEach(tile => {
            const index = this.tileToIndex(tile);
            if (index !== -1) vector[index]++;
        });

        const minShanten = this.calculateShanten(vector, meldCount);
        console.log(`向听数结果 ${minShanten}向听`);
        
        const improvements = (minShanten > 0 || handTiles.length === 14)
            ? this.calculateImprovements(vector, meldCount, minShanten)
            : [];

        if (improvements.length > 0) {
            console.log(`找到 ${improvements.length} 种改进方案`);
        }

        return {
            shanten: minShanten,
            improvements
        };
    }

    tileToIndex(tile) {
        let base = -1;
        switch (tile.suit) {
            case 'man': base = 0; break;
            case 'pin': base = 9; break;
            case 'sou': base = 18; break;
            case 'honor': base = 27; break;
            default: 
                return -1;
        }
        const index = base + tile.number - 1;
        if (index < 0 || index > 33) {
            return -1;
        }
        return index;
    }

    indexToTileString(index) {
        if (index < 0 || index > 33) return '';
        let suit, number;
        if (index < 9) {
            suit = 'man';
            number = index + 1;
        } else if (index < 18) {
            suit = 'pin';
            number = index - 8;
        } else if (index < 27) {
            suit = 'sou';
            number = index - 17;
        } else {
            suit = 'honor';
            number = index - 26;
        }
        const suitChar = this.parser.getSuitChar(suit, 'standard');
        return `${number}${suitChar}`;
    }

    calculateShanten(vector, meldCount) {
        let minShanten = Infinity;
        let searchCount = 0;
        let bestCombination = null;

        // 创建vector的副本，避免修改原始数组
        const workVector = [...vector];
        
        const dfs = (startIdx, completed, pairs, partials, depth = 0) => {
            if (depth > 5 - meldCount) return; // 超过5个面子/搭子/雀头，无意义
            searchCount++;
            let shanten = 8 - 2 * (meldCount + completed) - pairs - partials;
            // if (meldCount + completed === 3 && pairs === 0)
            //     shanten += 1; // 剩下4张牌无对子
            if (depth === 5 - meldCount) {
                if (pairs === 0) {
                    shanten += 1; // 已找到5个面子/搭子，却没有对子无法做雀头 
                }
            }
            // if (meldCount + completed === 4)
            //     shanten = 0; // 已经完成4个面子，向听数为0
            
            if (shanten < minShanten) {
                minShanten = shanten;
                bestCombination = { completed, pairs, partials, depth };
                // console.log(`找到更优解 ${shanten}向听 完成面子${completed} 对子${pairs} 搭子${partials}`);
            }
            
            if (startIdx >= 34) {
                return;
            }
            
            if (workVector[startIdx] === 0) {
                dfs(startIdx + 1, completed, pairs, partials, depth);
                return;
            }

            const i = startIdx;
            
            // 刻子
            if (workVector[i] >= 3) {
                workVector[i] -= 3;
                dfs(i, completed + 1, pairs, partials, depth + 1);
                workVector[i] += 3;
            }
            
            // 顺子（仅数牌）
            if (i < 27 && i % 9 <= 6) {
                if (workVector[i] >= 1 && workVector[i + 1] >= 1 && workVector[i + 2] >= 1) {
                    workVector[i]--;
                    workVector[i + 1]--;
                    workVector[i + 2]--;
                    dfs(i, completed + 1, pairs, partials, depth + 1);
                    workVector[i]++;
                    workVector[i + 1]++;
                    workVector[i + 2]++;
                }
            }
            
            // 对子（可作为雀头或搭子）
            if (workVector[i] >= 2) {
                workVector[i] -= 2;
                dfs(i, completed, pairs + 1, partials, depth + 1);
                workVector[i] += 2;
            }
            
            // 两面搭子
            if (i < 27 && i % 9 <= 7) {
                if (workVector[i] >= 1 && workVector[i + 1] >= 1) {
                    workVector[i]--;
                    workVector[i + 1]--;
                    dfs(i, completed, pairs, partials + 1, depth + 1);
                    workVector[i]++;
                    workVector[i + 1]++;
                }
            }
            
            // 嵌张搭子
            if (i < 27 && i % 9 <= 6) {
                if (workVector[i] >= 1 && workVector[i + 2] >= 1) {
                    workVector[i]--;
                    workVector[i + 2]--;
                    dfs(i, completed, pairs, partials + 1, depth + 1);
                    workVector[i]++;
                    workVector[i + 2]++;
                }
            }
            
            // 跳过当前位置，继续下一个
            dfs(startIdx + 1, completed, pairs, partials, depth);
        };
        
        dfs(0, 0, 0, 0);
        //console.log(`搜索完成 总计${searchCount}个节点 最终${minShanten}向听`);
        return minShanten;
    }

    calculateImprovements(vector, meldCount, currentShanten) {
        const improvements = [];
        const origVector = [...vector];
        
        // 通过vector计算手牌总数
        const totalTiles = origVector.reduce((sum, count) => sum + count, 0);
        
        if (totalTiles === 14) {
            // 14张牌：计算打出后的改进方案
            let validDiscards = 0;
            
            for (let discardIdx = 0; discardIdx < 34; discardIdx++) {
                if (origVector[discardIdx] === 0) continue;
                
                const discardTile = this.indexToTileString(discardIdx);
                
                // 创建打出一张牌后的手牌状态
                const discardVector = [...origVector];
                discardVector[discardIdx]--;
                const validDraws = [];
                
                for (let drawIdx = 0; drawIdx < 34; drawIdx++) {
                    // 为每次摸牌计算创建独立的vector副本
                    const testVector = [...discardVector];
                    testVector[drawIdx]++;
                    const newShanten = this.calculateShanten(testVector, meldCount);
                    
                    if (newShanten < currentShanten) {
                        const drawTile = this.indexToTileString(drawIdx);
                        validDraws.push({
                            tile: drawTile,
                            shanten: newShanten
                        });
                    }
                }
                
                if (validDraws.length > 0) {
                    validDiscards++;
                    improvements.push({
                        discard: discardTile,  // 打出的牌
                        tiles: validDraws,     // 打出后的有效摸牌
                        shanten: this.calculateShanten(discardVector, meldCount) // 打出后的向听数
                    });
                }
            }
            
            console.log(`改进方案计算完成 有效打牌 ${validDiscards} 种`);
        } else if (totalTiles === 13) {
            // 13张牌：直接计算进张
            const validDraws = [];
            let minShanten = 8;
            
            for (let drawIdx = 0; drawIdx < 34; drawIdx++) {
                const testVector = [...origVector];
                testVector[drawIdx]++;
                const newShanten = this.calculateShanten(testVector, meldCount);
                
                if (newShanten < currentShanten) {
                    const drawTile = this.indexToTileString(drawIdx);
                    validDraws.push({
                        tile: drawTile,
                        shanten: newShanten
                    });

                    if (newShanten < minShanten) {
                        minShanten = newShanten;
                    }
                }
            }
            
            if (validDraws.length > 0) {
                improvements.push({
                    discard: null, // 13张牌时无需打牌
                    tiles: validDraws, // 有效摸牌
                    shanten: currentShanten // 当前向听数
                });
            }
            
            console.log(`改进方案计算完成 有效进张 ${validDraws.length} 种`);
        } else {
            console.log(`手牌数量异常：${totalTiles}张，无法计算改进方案`);
        }
        
        return improvements;
    }
}