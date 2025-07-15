/**
 * UI控制器模块
 * 负责处理所有UI交互和模态对话框管理
 */

class UIController {
    constructor() {
        this.currentPlayerMenu = null;
        this.selectedPlayers = []; // 改为数组以保持选择顺序
        this.isWinMode = false;
        this.winnerPosition = null;
        this.currentWinType = null; // 当前和牌类型（自摸/和牌）
        this.multiWinState = null; // 一炮多响状态

        this.init();
    }

    init() {
        this.bindEvents();
        this.adjustRotatedPlayerSizes();

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.adjustRotatedPlayerSizes();
        });

        // 监听历史记录更新事件
        document.addEventListener('historyUpdated', (event) => {
            this.updateUndoButton();
        });

        // 延迟初始化UI显示（等待游戏状态加载）
        setTimeout(() => {
            this.updateBankerDisplay();
            this.updateXiangGongDisplay();
        }, 100);

        this.tileUnicodeMap = {
            // 万字牌
            '1m': '🀇', '2m': '🀈', '3m': '🀉', '4m': '🀊', '5m': '🀋',
            '6m': '🀌', '7m': '🀍', '8m': '🀎', '9m': '🀏',
            // 筒子牌
            '1p': '🀙', '2p': '🀚', '3p': '🀛', '4p': '🀜', '5p': '🀝',
            '6p': '🀞', '7p': '🀟', '8p': '🀠', '9p': '🀡',
            // 条子牌
            '1s': '🀐', '2s': '🀑', '3s': '🀒', '4s': '🀓', '5s': '🀔',
            '6s': '🀕', '7s': '🀖', '8s': '🀗', '9s': '🀘',
            // 字牌
            '1z': '🀀', '2z': '🀁', '3z': '🀂', '4z': '🀃', // 东南西北
            '5z': '🀄︎', '6z': '🀅', '7z': '🀆',              // 中发白
            // 花牌 - 四花 (使用f标识符，1-4编号)
            '1f': '🀢', '2f': '🀣', '3f': '🀥', '4f': '🀤', // 梅兰菊竹
            // 花牌 - 四季 (使用f标识符，5-8编号)
            '5f': '🀦', '6f': '🀧', '7f': '🀨', '8f': '🀩'  // 春夏秋冬
        };
    }

    bindEvents() {
        // 分数盘点击事件
        document.querySelectorAll('.player').forEach(player => {
            player.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handlePlayerClick(player.dataset.position);
            });
        });

        // 南北家的hover效果现在通过CSS处理，不需要JavaScript

        // 中央区域点击事件
        document.querySelector('.center').addEventListener('click', (e) => {
            if (!e.target.classList.contains('center-button')) {
                this.handleCenterClick();
            }
        });

        // 模态对话框外部点击关闭
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });

        // ESC键关闭模态对话框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    handlePlayerClick(position) {
        if (this.isWinMode) {
            this.handleWinModePlayerClick(position);
        } else {
            this.startWinProcess(position);
        }
    }

    handleCenterClick() {
        if (this.isWinMode && this.winnerPosition) {
            // 和牌模式下点击中央按钮
            this.processCenterButtonClick();
        } else {
            // 普通模式下点击中央表示流局
            this.showDrawDialog();
        }
    }

    startWinProcess(position) {
        this.isWinMode = true;
        this.winnerPosition = position;
        this.selectedPlayers.length = 0; // 清空数组

        // 高亮和牌方
        this.highlightPlayer(position);

        // 显示玩家状态
        this.updatePlayerStatuses();

        // 显示中央按钮
        this.showCenterButton('自摸');

        // 禁用菜单
        this.disableMenus(true);
    }

    handleWinModePlayerClick(position) {
        if (position === this.winnerPosition) {
            // 点击和牌方，取消选择
            this.cancelWinProcess();
            return;
        }

        // 切换玩家选择状态
        const index = this.selectedPlayers.indexOf(position);
        if (index !== -1) {
            // 玩家已选择，移除
            this.selectedPlayers.splice(index, 1);
            this.unhighlightPlayer(position);
        } else {
            // 玩家未选择，添加
            this.selectedPlayers.push(position);
            this.highlightPlayer(position);
        }

        // 更新玩家状态显示
        this.updatePlayerStatuses();

        // 更新中央按钮文本
        if (this.selectedPlayers.length === 0) {
            this.showCenterButton('自摸');
        } else if (this.selectedPlayers.length === 1) {
            this.showCenterButton('出铳');
        } else {
            this.showCenterButton(`一炮${this.selectedPlayers.length}响`);
        }
    }

    processCenterButtonClick() {
        if (this.selectedPlayers.length === 0) {
            // 自摸
            this.showWinDialog(this.winnerPosition, [], '自摸');
        } else if (this.selectedPlayers.length === 1) {
            // 单独出铳
            this.showWinDialog(this.winnerPosition, this.selectedPlayers.slice(), '和牌');
        } else {
            // 一炮多响 - 需要特殊处理
            this.handleMultipleWins();
        }
    }

    // 处理一炮多响
    handleMultipleWins() {
        // 最后选择的玩家是出铳者，其他玩家（包括第一个选择的）都是和牌者
        const lastSelected = this.selectedPlayers[this.selectedPlayers.length - 1]; // 最后选择的是出铳者
        const otherSelected = this.selectedPlayers.slice(0, -1); // 其他选择的玩家
        const actualWinners = [this.winnerPosition, ...otherSelected]; // 第一个点击的和其他选择的都是和牌方

        // 存储一炮多响的状态
        this.multiWinState = {
            winners: actualWinners,
            payer: lastSelected,
            currentWinner: 0
        };

        // 开始第一个和牌方的结算
        this.showMultiWinDialog(this.multiWinState);
    }

    // 显示一炮多响的结算对话框
    showMultiWinDialog(multiWinState) {
        const { winners, payer, currentWinner } = multiWinState;
        const winnerPosition = winners[currentWinner];
        const winnerName = window.gameState.players[winnerPosition]?.name || winnerPosition;
        const payerName = window.gameState.players[payer]?.name || payer;

        // 设置当前和牌类型（一炮多响总是和牌，不是自摸）
        this.currentWinType = '和牌';

        document.getElementById('winner-name').textContent = winnerName;
        document.getElementById('win-type').textContent = '和牌';
        document.getElementById('payers').textContent = payerName;

        // 添加进度提示
        const progressText = `(${currentWinner + 1}/${winners.length})`;
        const titleElement = document.querySelector('#win-dialog h3');
        titleElement.textContent = `和牌结算 ${progressText}`;

        // 更新本地化标签
        this.updateLocalizedLabels();

        // 设置默认番符
        document.getElementById('fan-input').value = 0;
        document.getElementById('fu-input').value = 10;

        // 更新包牌选项
        this.updateBaoOptions();

        this.showModal('win-dialog');
    }

    cancelWinProcess() {
        this.isWinMode = false;
        this.winnerPosition = null;
        this.currentWinType = null; // 清空当前和牌类型
        this.selectedPlayers.length = 0; // 清空数组
        this.multiWinState = null;

        // 清除所有高亮
        document.querySelectorAll('.player').forEach(player => {
            player.classList.remove('selected', 'highlight');
        });

        // 隐藏所有玩家状态
        this.hideAllPlayerStatuses();

        // 隐藏中央按钮
        this.hideCenterButton();

        // 启用菜单
        this.disableMenus(false);

        // 重置对话框标题
        const titleElement = document.querySelector('#win-dialog h3');
        if (titleElement) titleElement.textContent = '和牌结算';
    }

    // 更新玩家状态显示（和牌模式时）
    updatePlayerStatuses() {
        if (!this.isWinMode) {
            this.hideAllPlayerStatuses();
            return;
        }

        // 首先隐藏所有状态
        this.hideAllPlayerStatuses();

        // 显示和牌方状态
        if (this.winnerPosition) {
            this.showPlayerStatus(this.winnerPosition, '和牌', 'winner');
        }

        // 显示选择玩家的状态
        if (this.selectedPlayers.length > 0) {
            // 最后选择的是出铳者
            const lastIndex = this.selectedPlayers.length - 1;
            this.selectedPlayers.forEach((position, index) => {
                if (index === lastIndex) {
                    // 最后一个是出铳
                    this.showPlayerStatus(position, '出铳', 'payer');
                } else {
                    // 其他是和牌
                    this.showPlayerStatus(position, '和牌', 'winner');
                }
            });
        }
    }

    // 显示单个玩家状态
    showPlayerStatus(position, text, type) {
        const player = document.querySelector(`.player.${position}`);
        if (!player) return;

        const statusElement = player.querySelector('.player-status');
        if (statusElement) {
            statusElement.textContent = text;
            statusElement.className = `player-status ${type}`;
            statusElement.classList.remove('hidden');
        }
    }

    // 隐藏所有玩家状态
    hideAllPlayerStatuses() {
        document.querySelectorAll('.player-status').forEach(status => {
            status.classList.add('hidden');
            status.className = 'player-status hidden';
        });
    }

    // 更新庄家显示（使用红色风字、更新风指示）
    updateBankerDisplay() {
        // 移除所有庄家标记
        document.querySelectorAll('.player').forEach(player => {
            player.classList.remove('banker');
        });

        // 添加当前庄家标记
        if (window.gameState && window.gameState.game.banker) {
            const bankerPlayer = document.querySelector(`.player.${window.gameState.game.banker}`);
            if (bankerPlayer) {
                bankerPlayer.classList.add('banker');
            }
        }

        // 更新所有玩家的风字显示
        if (window.gameState && window.gameState.players) {
            Object.keys(window.gameState.players).forEach(position => {
                const player = window.gameState.players[position];
                const playerElement = document.querySelector(`.player[data-position="${position}"]`);
                if (playerElement) {
                    const windIndicator = playerElement.querySelector('.wind');
                    if (windIndicator) {
                        windIndicator.textContent = player.wind || '?';
                    }
                }
            });
        }
    }

    // 更新相公显示
    updateXiangGongDisplay() {
        document.querySelectorAll('.player').forEach(player => {
            const position = player.dataset.position;
            const playerData = window.gameState?.players[position];

            if (playerData?.isXiangGong) {
                player.classList.add('xianggong');
            } else {
                player.classList.remove('xianggong');
            }
        });
    }

    highlightPlayer(position) {
        const player = document.querySelector(`.player.${position}`);
        if (player) {
            player.classList.add('highlight');
        }
    }

    unhighlightPlayer(position) {
        const player = document.querySelector(`.player.${position}`);
        if (player) {
            player.classList.remove('highlight');
        }
    }

    showCenterButton(text) {
        const button = document.getElementById('center-button');
        button.textContent = text;
        button.className = `center-button ${text === '自摸' ? '自摸' : '和牌'}`;
        button.style.display = 'flex';
    }

    hideCenterButton() {
        const button = document.getElementById('center-button');
        button.style.display = 'none';
    }

    disableMenus(disabled) {
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.style.pointerEvents = disabled ? 'none' : 'auto';
            btn.style.opacity = disabled ? '0.5' : '1';
        });

        const mainMenuToggle = document.getElementById('main-menu-toggle');
        mainMenuToggle.style.pointerEvents = disabled ? 'none' : 'auto';
        mainMenuToggle.style.opacity = disabled ? '0.5' : '1';
    }

    // 模态对话框管理
    showModal(modalId) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = 'auto';

        // 如果在和牌模式但不是一炮多响状态，才取消和牌模式
        // 一炮多响时需要保持和牌模式以便继续处理下一个和牌方
        if (this.isWinMode && !this.multiWinState) {
            this.cancelWinProcess();
        }
    }

    // 关闭特定的模态对话框，不影响和牌模式状态
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }

        // 检查是否还有其他模态对话框打开
        const openModals = document.querySelectorAll('.modal:not(.hidden)');
        if (openModals.length === 0) {
            // 所有模态对话框都关闭了，隐藏遮罩层
            document.getElementById('modal-overlay').classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    }

    showPlayerMenu(position) {
        if (this.isWinMode) return; // 和牌模式下禁用

        this.currentPlayerMenu = position;
        const title = document.getElementById('player-menu-title');
        if (window.gameState && window.gameState.players[position]) {
            title.textContent = `${window.gameState.players[position].name} - 菜单`;
        }
        this.showModal('player-menu');
    }

    showDrawDialog() {
        if (this.isWinMode) return; // 和牌模式下禁用
        this.showModal('draw-dialog');
    }

    showWinDialog(winner, payers, winType) {
        const winnerName = window.gameState.players[winner]?.name || winner;
        const payerNames = payers.map(p => window.gameState.players[p]?.name || p).join(', ');

        // 存储当前和牌类型
        this.currentWinType = winType;

        document.getElementById('winner-name').textContent = winnerName;
        document.getElementById('win-type').textContent = winType === '自摸' ? '自摸' : '出銃';
        document.getElementById('payers').textContent = payerNames || '无';

        // 更新本地化标签
        this.updateLocalizedLabels();

        // 设置默认番符
        document.getElementById('fan-input').value = 0;
        document.getElementById('fu-input').value = 30;

        // 更新包牌选项
        this.updateBaoOptions();

        this.showModal('win-dialog');
    }

    // 更新本地化标签
    updateLocalizedLabels() {
        if (!window.ruleSystem) return;

        const strings = window.ruleSystem.getLocalizedStrings();

        const fanLabel = document.getElementById('fan-label');
        const fuLabel = document.getElementById('fu-label');

        if (fanLabel) fanLabel.textContent = strings.fanLabel + '：';
        if (fuLabel) fuLabel.textContent = strings.fuLabel + '：';
    }

    // 更新包牌选项
    updateBaoOptions() {
        const baoSelect = document.getElementById('bao-select');
        if (!baoSelect) return;

        // 清空现有选项
        baoSelect.innerHTML = '';

        // 添加"无包牌"选项
        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = '无包牌';
        baoSelect.appendChild(noneOption);

        // 添加玩家选项
        ['east', 'south', 'west', 'north'].forEach(position => {
            const player = window.gameState?.players[position];
            if (player) {
                const option = document.createElement('option');
                option.value = position;
                option.textContent = player.name;
                baoSelect.appendChild(option);
            }
        });
    }

    confirmDraw() {
        if (window.gameState) {
            window.gameState.processDraw();
        }
        this.closeModal();
    }

    confirmWin() {
        // TODO: fan 为何不为零？
        const fanCount = parseInt(document.getElementById('fan-input').value);
        const fuCount = parseInt(document.getElementById('fu-input').value);
        const baoPlayer = document.getElementById('bao-select')?.value || 'none';

        try {
            if (this.multiWinState) {
                // 处理一炮多响的单个和牌
                const { winners, payer, currentWinner } = this.multiWinState;
                const winnerPosition = winners[currentWinner];

                const winData = {
                    winner: winnerPosition,
                    payers: [payer],
                    fanCount: fanCount,
                    fuCount: fuCount,
                    winType: '和牌',
                    baoPlayer: baoPlayer
                };

                let winResult = null;
                if (window.gameState) {
                    // 使用只计算分数的方法，不推进圈局
                    winResult = window.gameState.processWinScoresOnly(winData);
                }

                // 存储本次和牌结果
                if (!this.multiWinState.winResults) {
                    this.multiWinState.winResults = [];
                }
                if (winResult) {
                    this.multiWinState.winResults.push(winResult);
                }

                // 检查是否还有更多和牌方
                if (currentWinner + 1 < winners.length) {
                    this.multiWinState.currentWinner++;
                    this.closeModal();
                    console.log(JSON.stringify(this.multiWinState));
                    setTimeout(() => this.showMultiWinDialog(this.multiWinState), 1000);
                } else {
                    // 所有和牌方都处理完毕，现在推进圈局
                    if (window.gameState && this.multiWinState.winResults) {
                        window.gameState.finishMultipleWins(this.multiWinState.winResults);
                    }
                    this.multiWinState = null;
                    this.closeModal();
                    this.cancelWinProcess();
                }
            } else {
                // 普通单一和牌
                const winType = this.selectedPlayers.length > 0 ? '和牌' : '自摸';
                const payers = this.selectedPlayers.slice(); // 复制数组

                const winData = {
                    winner: this.winnerPosition,
                    payers: payers,
                    fanCount: fanCount,
                    fuCount: fuCount,
                    winType: winType,
                    baoPlayer: baoPlayer
                };

                if (window.gameState) {
                    window.gameState.processWin(winData);
                }
                this.closeModal();
                this.cancelWinProcess();
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    calculateAuto() {
        // 更新计算对话框的条件
        this.updateWinConditions();
        this.showModal('calc-dialog');
    }

    // 更新和牌条件
    updateWinConditions() {
        if (!window.ruleSystem) return;

        const conditionsContainer = document.getElementById('win-conditions');
        if (!conditionsContainer) return;

        // 清空现有条件
        conditionsContainer.innerHTML = '';

        // 获取支持的条件
        const conditions = window.ruleSystem.getSupportedWinConditions();

        conditions.forEach(condition => {
            const label = document.createElement('label');

            // 圈风、门风等自动参数不显示在UI中，由游戏状态自动提供
            if (condition.hide === true) {
                return; // 跳过自动参数
            }

            if (condition.type === 'number') {
                // 数字输入
                label.innerHTML = `
                    <span>${condition.label}：</span>
                    <input type="number" id="${condition.key}" 
                           min="${condition.min || 0}" 
                           max="${condition.max || 99}" 
                           value="${condition.default || 0}">
                `;
            } else {
                // 复选框
                label.innerHTML = `
                    <input type="checkbox" id="${condition.key}" ${condition.default ? 'checked' : ''}> 
                    ${condition.label}
                `;
            }

            conditionsContainer.appendChild(label);
        });
    }

    performCalculation() {
        const hand = document.getElementById('hand-tiles').value;
        const winTile = document.getElementById('win-tile').value;
        const melds = document.getElementById('melds').value;

        // 验证输入
        if (window.mahjongParser) {
            const handValidation = window.mahjongParser.validateTileString(hand);
            const winTileValidation = window.mahjongParser.validateTileString(winTile);
            const meldsValidation = window.mahjongParser.validateTileString(melds);

            if (!handValidation.valid) {
                this.showError('手牌格式错误：' + handValidation.errors.join(', '));
                return;
            }
            if (!winTileValidation.valid) {
                this.showError('和牌格式错误：' + winTileValidation.errors.join(', '));
                return;
            }
            if (!meldsValidation.valid) {
                this.showError('鸣牌格式错误：' + meldsValidation.errors.join(', '));
                return;
            }
        }

        // 收集条件，包括自动参数
        const conditions = this.collectWinConditions();

        // 使用规则集来准备自动条件
        let enhancedConditions = conditions;
        if (window.ruleSystem && window.ruleSystem.prepareConditions) {
            enhancedConditions = window.ruleSystem.prepareConditions(
                conditions, 
                window.gameState, 
                this.winnerPosition, 
                this.currentWinType,
                melds
            );
        } else if (this.winnerPosition && window.gameState) {
            // 如果规则集不支持自动条件准备，程序应该报错
            throw new Error('规则集不支持自动条件准备方法');
        }

        try {
            if (window.ruleSystem && window.ruleSystem.calculateHandValue) {
                const result = window.ruleSystem.calculateHandValue(hand, winTile, melds, enhancedConditions);
                if (result) {
                    // 关闭自动算番对话框
                    this.closeCalcDialog();

                    // 显示翻符详情确认对话框
                    this.showFanFuDetailDialog(hand, winTile, melds, result, enhancedConditions);
                } else {
                    this.showError('无法计算，请检查输入或手牌不符合和牌条件');
                }
            } else {
                this.showError('当前规则系统不支持自动计算');
            }
        } catch (error) {
            this.showError('计算错误：' + error.message);
            console.log(error);
        }
    }

    // 收集和牌条件
    collectWinConditions() {
        const conditions = {};

        if (window.ruleSystem) {
            const supportedConditions = window.ruleSystem.getSupportedWinConditions();

            supportedConditions.forEach(condition => {
                const element = document.getElementById(condition.key);
                if (element) {
                    if (condition.type === 'number') {
                        conditions[condition.key] = parseInt(element.value) || 0;
                    } else {
                        conditions[condition.key] = element.checked;
                    }
                } else if (condition.default !== undefined) {
                    // 对于没有UI元素的条件，使用默认值
                    conditions[condition.key] = condition.default;
                }
            });
        }

        return conditions;
    }

    // 玩家菜单功能
    showPlayerHistory() {
        if (!this.currentPlayerMenu) return;

        const allHistory = window.gameState.getHistory();
        console.log('All history:', allHistory);

        const history = allHistory.filter(record => {
            return record.winner === this.currentPlayerMenu ||
                (record.payers && record.payers.includes(this.currentPlayerMenu));
        });

        console.log('Filtered history for', this.currentPlayerMenu, ':', history);

        this.displayHistory(history, `${window.gameState.players[this.currentPlayerMenu]?.name} 的记录`);
    }

    editPlayerName() {
        if (!this.currentPlayerMenu) return;

        const currentName = window.gameState.players[this.currentPlayerMenu]?.name;
        const newName = prompt('请输入新名字:', currentName);

        if (newName && newName.trim()) {
            window.gameState.setPlayerName(this.currentPlayerMenu, newName.trim());
            this.closeModal();
        }
    }

    setPlayerXiangGong() {
        if (!this.currentPlayerMenu) return;

        const player = window.gameState.players[this.currentPlayerMenu];
        const isXiangGong = !player.isXiangGong;

        if (confirm(`确定要${isXiangGong ? '设置' : '取消'}${player.name}为相公吗？`)) {
            window.gameState.setPlayerXiangGong(this.currentPlayerMenu, isXiangGong);
            this.closeModal();
        }
    }

    declareFraud() {
        if (!this.currentPlayerMenu) return;

        const player = window.gameState.players[this.currentPlayerMenu];
        if (confirm(`确定${player.name}诈胡吗？这将结束本局并扣除相应分数。`)) {
            window.gameState.processFraud(this.currentPlayerMenu);
            this.closeModal();
        }
    }

    // 动态调整南北家的尺寸
    adjustRotatedPlayerSizes() {
        const southPlayer = document.querySelector('.player.south');
        const northPlayer = document.querySelector('.player.north');
        const southContent = document.querySelector('.player.south .player-content');
        const northContent = document.querySelector('.player.north .player-content');

        if (!southPlayer || !northPlayer || !southContent || !northContent) return;

        // 获取父容器的实际尺寸
        const southRect = southPlayer.getBoundingClientRect();
        const northRect = northPlayer.getBoundingClientRect();

        // 设置内容容器的尺寸（交换宽高）
        // 宽度使用父容器的高度，高度使用父容器的宽度
        southContent.style.width = `${southRect.height}px`;
        southContent.style.height = `${southRect.width}px`;
        southContent.style.top = '50%';
        southContent.style.left = '50%';
        // 不直接设置transform，让CSS hover效果正常工作
        southContent.classList.add('rotated-south');

        northContent.style.width = `${northRect.height}px`;
        northContent.style.height = `${northRect.width}px`;
        northContent.style.top = '50%';
        northContent.style.left = '50%';
        // 不直接设置transform，让CSS hover效果正常工作
        northContent.classList.add('rotated-north');
    }

    // 显示成功消息
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    // 显示错误消息
    showError(message) {
        this.showToast(message, 'error');
    }
    
    // 显示Toast消息
    showToast(message, type = 'info') {
        // 移除已存在的toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '9999',
            animation: 'toastSlideIn 0.3s ease-out',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });
        
        // 根据类型设置背景色
        switch (type) {
            case 'success':
                toast.style.background = 'linear-gradient(135deg, #51cf66, #40c057)';
                break;
            case 'error':
                toast.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
                break;
            default:
                toast.style.background = 'linear-gradient(135deg, #339af0, #228be6)';
        }
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes toastSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes toastSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        
        if (!document.querySelector('#toast-styles')) {
            style.id = 'toast-styles';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'toastSlideOut 0.3s ease-out';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 3000);
    }

    // 工具函数
    showError(message) {
        // 创建临时错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translateX(-50%)';
        errorDiv.style.zIndex = '2000';

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    showSuccess(message) {
        // 创建临时成功提示
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.position = 'fixed';
        successDiv.style.top = '20px';
        successDiv.style.left = '50%';
        successDiv.style.transform = 'translateX(-50%)';
        successDiv.style.zIndex = '2000';

        document.body.appendChild(successDiv);

        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 2000);
    }

    displayHistory(history, title) {
        // 设置对话框标题
        const titleElement = document.getElementById('history-title');
        if (titleElement) {
            titleElement.textContent = title;
        }

        // 更新撤回按钮状态
        this.updateUndoButton();

        // 获取历史记录容器
        const container = document.getElementById('history-container');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        if (history.length === 0) {
            // 没有记录时显示空状态
            container.innerHTML = `
                <div class="empty-details">
                    <p>暂无记录</p>
                </div>
            `;
        } else {
            // 生成历史记录HTML
            history.forEach(record => {
                const historyItem = this.createHistoryItem(record);
                container.appendChild(historyItem);
            });
        }

        // 显示对话框
        this.showModal('history-dialog');
    }
    
    // 更新撤回按钮状态
    updateUndoButton() {
        const undoBtn = document.getElementById('undo-btn');
        const undoInfo = document.getElementById('undo-info');
        const historyActions = document.getElementById('history-actions');
        
        if (!undoBtn || !undoInfo) return;
        
        if (window.gameHistory && window.gameHistory.canUndo()) {
            const lastOperation = window.gameHistory.getLastOperationDescription();
            if (lastOperation) {
                undoBtn.classList.remove('hidden');
                undoInfo.classList.remove('hidden');
                historyActions.classList.remove('hidden');
                undoInfo.innerHTML = `
                    <strong>最新操作：</strong>${lastOperation.description}<br>
                    <span style="color: #888; font-size: 12px;">${lastOperation.timestamp}</span>
                `;
            }
        } else {
            undoBtn.classList.add('hidden');
            undoInfo.classList.add('hidden');
            historyActions.classList.add('hidden');
        }
    }

    // 创建历史记录项
    createHistoryItem(record) {
        const item = document.createElement('div');
        item.className = 'history-item';

        const time = new Date(record.timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        // 获取当前规则集的本地化字符串
        const localizedStrings = window.ruleSystem.getLocalizedStrings();

        let content = '';

        if (record.type === 'win') {
            // 和牌记录
            const winnerName = window.gameState.players[record.winner]?.name || record.winner;
            const payerNames = record.payers?.map(p => window.gameState.players[p]?.name || p).join(', ') || '无';

            // 使用规则集本地化的和牌类型术语
            const winTypeText = record.winType === '自摸'
                ? localizedStrings.winType['自摸']
                : localizedStrings.winType['和牌'];

            // 使用规则集本地化的圈局格式
            const roundText = this.formatRoundText(record.round, localizedStrings);

            // 使用规则集本地化的翻/符单位
            const fanUnit = localizedStrings.fanUnit || '番';
            const fuUnit = localizedStrings.fuUnit || '符';

            content = `
                <div class="history-header">
                    <span class="history-round">${roundText}</span>
                    <span class="history-time">${time}</span>
                </div>
                <div class="history-details">
                    <span class="history-winner">${winnerName}</span> ${winTypeText} 
                    ${record.fanCount}${fanUnit}${record.fuCount || 30}${fuUnit}
                    ${record.payers?.length > 0 ? ` (${this.getPayerText(localizedStrings)}: ${payerNames})` : ''}
                </div>
                ${this.createScoreChangesDisplay(record.scoreChanges)}
            `;
        } else if (record.type === 'draw') {
            // 流局记录
            const roundText = this.formatRoundText(record.round, localizedStrings);

            content = `
                <div class="history-header">
                    <span class="history-round">${roundText}</span>
                    <span class="history-time">${time}</span>
                </div>
                <div class="history-details">
                    流局
                </div>
            `;
        } else if (record.type === 'fraud') {
            // 诈胡记录
            const playerName = window.gameState.players[record.player]?.name || record.player;
            const roundText = this.formatRoundText(record.round, localizedStrings);

            content = `
                <div class="history-header">
                    <span class="history-round">${roundText}</span>
                    <span class="history-time">${time}</span>
                </div>
                <div class="history-details">
                    <span class="history-loser">${playerName}</span> 诈胡 
                    ${record.penalty ? `(-${record.penalty}点)` : ''}
                </div>
            `;
        }

        item.innerHTML = content;
        return item;
    }

    // 格式化圈局文本
    formatRoundText(round, localizedStrings) {
        if (!round) return '东1局';

        const windText = localizedStrings.winds[round.wind] || round.wind;
        const roundFormat = localizedStrings.roundFormat || '{wind}{round}局';

        return roundFormat
            .replace('{wind}', windText)
            .replace('{round}', round.round || 1);
    }

    // 获取出铳者文本
    getPayerText(localizedStrings) {
        // 直接使用规则集提供的出铳术语
        return localizedStrings.payerText || '出銃';
    }

    // 创建分数变化显示
    createScoreChangesDisplay(scoreChanges) {
        if (!scoreChanges || scoreChanges.length === 0) return '';

        const changes = scoreChanges.map(change => {
            const playerName = window.gameState.players[change.player]?.name || change.player;
            const changeStr = change.change > 0 ? `+${change.change}` : `${change.change}`;
            const className = change.change > 0 ? 'history-winner' : 'history-loser';
            return `<span class="${className}">${playerName}: ${changeStr}</span>`;
        }).join(' ');

        return `<div class="score-changes">${changes}</div>`;
    }

    // 显示翻符详情对话框
    showFanFuDetailDialog(handTiles, winTile, melds, result, conditions) {
        this.currentFanFuResult = { handTiles, winTile, melds, result, conditions };

        console.log('Showing FanFu detail dialog with result:', JSON.stringify(result));

        // 获取当前规则集的本地化字符串
        const localizedStrings = window.ruleSystem ? window.ruleSystem.getLocalizedStrings() : {
            fanUnit: '翻',
            fuUnit: '符'
        };

        // 显示牌型信息
        const tileDisplay = document.getElementById('detail-tile-display');
        let tileInfo = '';

        if (handTiles || winTile || melds) {
            const parts = [];
            if (handTiles) parts.push(`手牌: ${this.convertTilesToUnicode(handTiles)}`);
            if (winTile) parts.push(`和牌: ${this.convertTilesToUnicode(winTile)}`);
            if (melds) {
                const meldParts = melds.split(',').map(meld => this.convertTilesToUnicode(meld.trim()));
                parts.push(`副露: ${meldParts.join(' | ')}`);
            }
            tileInfo = parts.join('<br>');
        }
        tileDisplay.innerHTML = tileInfo;

        // 显示翻数详情
        const fanContainer = document.getElementById('fan-details-container');
        if (result.fanDetails && result.fanDetails.length > 0) {
            fanContainer.innerHTML = result.fanDetails.map(detail => {
                // 如果fan是数字，添加单位；如果是字符串，直接使用（已格式化）
                const fanValue = typeof detail.fan === 'number'
                    ? `${detail.fan}${localizedStrings.fanUnit || '翻'}`
                    : detail.fan;

                return `
                    <div class="detail-item">
                        <div class="detail-info">
                            <div class="detail-name">${detail.name}</div>
                            <div class="detail-description">${detail.description}</div>
                        </div>
                        <div class="detail-value">${fanValue}</div>
                    </div>
                `;
            }).join('');
        } else {
            fanContainer.innerHTML = `<div class="empty-details">无${localizedStrings.fanUnit || '翻'}数</div>`;
        }

        // 显示副数详情
        const fuContainer = document.getElementById('fu-details-container');
        if (result.fuDetails && result.fuDetails.length > 0) {
            fuContainer.innerHTML = result.fuDetails.map(detail => `
                <div class="detail-item">
                    <div class="detail-info">
                        <div class="detail-name">${detail.name}</div>
                        <div class="detail-description">${detail.description}</div>
                    </div>
                    <div class="detail-value">${detail.fu}${localizedStrings.fuUnit || '符'}</div>
                </div>
            `).join('');
        } else {
            fuContainer.innerHTML = `<div class="empty-details">无${localizedStrings.fuUnit || '符'}数</div>`;
        }

        // 显示总翻数和总符数
        const totalFanElement = document.getElementById('total-fan');
        const totalFuElement = document.getElementById('total-fu');

        if (totalFanElement) {
            totalFanElement.textContent = `${result.fan || 0}${localizedStrings.fanUnit || '翻'}`;
        }
        if (totalFuElement) {
            totalFuElement.textContent = `${result.fu || 30}${localizedStrings.fuUnit || '符'}`;
        }

        // 计算最终点数
        let finalPoints, pointsNote;

        // 使用规则集的特殊番数检查
        const specialType = window.ruleSystem ? window.ruleSystem.getSpecialFanType(result.fan) : null;

        if (result.note) {
            pointsNote = result.note;
            finalPoints = result.points || 0;
        } else {
            if (specialType) {
                finalPoints = specialType.points;
                pointsNote = `${specialType.name}固定分`;
            } else {
                // 必须使用规则集计算点数，不允许后备方法
                if (!window.ruleSystem || !window.ruleSystem.calculateBasePoints) {
                    throw new Error('规则集不支持点数计算方法');
                }
                finalPoints = window.ruleSystem.calculateBasePoints(result.fan || 0, result.fu || 30, conditions);
                pointsNote = '';
            }
        }

        // 显示最终点数
        const finalPointsElement = document.getElementById('final-points');
        const pointsNoteElement = document.getElementById('points-note');

        if (finalPointsElement) {
            finalPointsElement.textContent = finalPoints || 0;
        }
        if (pointsNoteElement) {
            pointsNoteElement.textContent = pointsNote || '';
        }

        this.showModal('fanfu-detail-dialog');
    }

    // 关闭翻符详情对话框
    closeFanFuDetailDialog() {
        this.hideModal('fanfu-detail-dialog');
        this.currentFanFuResult = null;
    }

    // 确认翻符计算并填入
    confirmFanFuCalculation() {
        if (!this.currentFanFuResult) return;

        const { result, conditions } = this.currentFanFuResult;

        // 使用与详情对话框相同的点数计算逻辑
        let finalPoints;
        const specialType = window.ruleSystem ? window.ruleSystem.getSpecialFanType(result.fan) : null;

        if (result.note) {
            finalPoints = result.points || 0;
        } else {
            if (specialType) {
                finalPoints = specialType.points;
            } else {
                // 使用规则集计算常规点数
                if (window.ruleSystem && window.ruleSystem.calculatePoints) {
                    finalPoints = window.ruleSystem.calculatePoints(result.fan || 0, result.fu || 30, conditions);
                } else {
                    // 兜底计算
                    finalPoints = 0;
                }
            }
        }

        // 填入和牌结算对话框
        const fanInput = document.getElementById('fan-input');
        const fuInput = document.getElementById('fu-input');

        if (fanInput) fanInput.value = result.fan || 0;
        if (fuInput) fuInput.value = result.fu || 30;

        // 关闭翻符详情对话框
        this.closeFanFuDetailDialog();

        this.showSuccess('翻符计算完成');
    }

    closeCalcDialog() {
        this.hideModal('calc-dialog');
    }

    // 麻将牌转Unicode显示（简化版）
    convertTilesToUnicode(tileString) {
        if (!tileString) return '';

        if (window.mahjongParser) {
            try {
                const parser = window.mahjongParser;
                parser.setPattern('relaxed');
                const tiles = parser.parseHand(tileString);

                return tiles.map(tile => {
                    let tileKey;
                    if (tile.suit === 'flower') {
                        tileKey = `${tile.number}f`;
                    } else if (tile.suit === 'honor') {
                        tileKey = `${tile.number}z`;
                    } else {
                        const suitChar = tile.suit === 'man' ? 'm' :
                            tile.suit === 'pin' ? 'p' :
                                tile.suit === 'sou' ? 's' : '?';
                        tileKey = `${tile.number}${suitChar}`;
                    }
                    return this.tileUnicodeMap[tileKey] || tileKey;
                }).join(' ');
            } catch (error) {
                console.warn('Parser failed:', error);
            }
        }

        return tileString;
    }
}

// 创建全局UI控制器实例
window.uiController = new UIController();

// 全局函数供HTML调用
window.showPlayerMenu = (position) => window.uiController.showPlayerMenu(position);
window.handleCenterClick = () => window.uiController.handleCenterClick();
window.handleCenterButtonClick = () => window.uiController.processCenterButtonClick();
window.closeModal = () => window.uiController.closeModal();
window.confirmDraw = () => window.uiController.confirmDraw();
window.confirmWin = () => window.uiController.confirmWin();
window.calculateAuto = () => window.uiController.calculateAuto();
window.performCalculation = () => window.uiController.performCalculation();
window.closeCalcDialog = () => window.uiController.closeCalcDialog();
window.showPlayerHistory = () => window.uiController.showPlayerHistory();
window.editPlayerName = () => window.uiController.editPlayerName();
window.setPlayerXiangGong = () => window.uiController.setPlayerXiangGong();
window.declareFraud = () => window.uiController.declareFraud();
window.addTestHistory = () => window.uiController.addTestHistory();
window.showFanFuDetailDialog = () => window.uiController.showFanFuDetailDialog();
window.confirmFanFuCalculation = () => window.uiController.confirmFanFuCalculation();
window.closeFanFuDetailDialog = () => window.uiController.closeFanFuDetailDialog();