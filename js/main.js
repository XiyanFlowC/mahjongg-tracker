/**
 * 主程序入口
 * 负责应用初始化和全局功能
 */

// 全局变量
window.ruleSystem = null;
window.availableRules = {};

// 应用初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('麻将记分器初始化中...');
    
    // 确保UI控制器已初始化
    if (!window.uiController) {
        console.log('等待UI控制器初始化...');
        setTimeout(initializeApp, 100);
        return;
    }
    
    // 注册规则系统
    registerRuleSystems();
    
    // 加载上次选择的规则系统，如果没有则使用默认的
    const savedRule = localStorage.getItem('mahjong-scorepad-rule') || 'chineseClassical';
    setRuleSystem(savedRule);
    
    // 初始化UI
    initializeUI();
    
    // 绑定全局事件
    bindGlobalEvents();
    
    // 加载游戏状态
    if (window.gameState) {
        window.gameState.init();
    }
    
    // 确保所有模态对话框都是隐藏的
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
    document.getElementById('modal-overlay').classList.add('hidden');
    
    console.log('麻将记分器初始化完成');
}

// 注册所有规则系统
function registerRuleSystems() {
    window.availableRules = {
        japanese: new JapaneseMahjong(),
        chineseClassical: new ChineseClassicalMahjongVar(),
        hongKong: new HongKongMahjong()
    };
    
    console.log('已注册规则系统:', Object.keys(window.availableRules));
}

// 设置当前规则系统
function setRuleSystem(ruleId) {
    if (window.availableRules[ruleId]) {
        const oldRuleId = window.gameState?.settings?.ruleSystem;
        window.ruleSystem = window.availableRules[ruleId];
        
        // 更新游戏设置
        if (window.gameState) {
            window.gameState.settings.ruleSystem = ruleId;
            
            // 同步规则系统的设置到游戏状态
            if (window.ruleSystem.settings) {
                // 更新初始分数
                if (window.ruleSystem.settings.initialScore !== undefined) {
                    const oldInitialScore = window.gameState.settings.initialScore;
                    window.gameState.settings.initialScore = window.ruleSystem.settings.initialScore;
                    
                    // 如果是切换规则（而不是初始加载），且初始分数不同，询问是否重置分数
                    if (oldRuleId && oldRuleId !== ruleId && oldInitialScore !== window.ruleSystem.settings.initialScore) {
                        const shouldReset = confirm(`规则系统已切换到${window.ruleSystem.name}。\n初始分数已更改为${window.ruleSystem.settings.initialScore}点。\n是否重置所有玩家分数？`);
                        if (shouldReset) {
                            Object.keys(window.gameState.players).forEach(position => {
                                window.gameState.players[position].score = window.ruleSystem.settings.initialScore;
                            });
                        }
                    }
                }
                
                // 同步其他相关设置
                if (window.ruleSystem.settings.targetScore !== undefined) {
                    window.gameState.settings.targetScore = window.ruleSystem.settings.targetScore;
                }
                if (window.ruleSystem.settings.minScore !== undefined) {
                    window.gameState.settings.minScore = window.ruleSystem.settings.minScore;
                }
            }
            
            window.gameState.updateUI();
            window.gameState.saveToStorage();
        }
        
        // 保存规则选择到本地存储
        localStorage.setItem('mahjong-scorepad-rule', ruleId);
        
        // 更新解析器表示法
        if (window.mahjongParser) {
            // 根据规则设置合适的表示法
            const pattern = getRulePattern(ruleId);
            window.mahjongParser.setPattern(pattern);
        }
        
        // 更新UI本地化
        updateUILocalization();
        
        console.log('已切换到规则系统:', window.ruleSystem.name);
        
        // 显示成功消息
        if (window.uiController) {
            window.uiController.showSuccess(`已切换到${window.ruleSystem.name}`);
        }
    } else {
        console.error('未知的规则系统:', ruleId);
    }
}

// 根据规则系统获取推荐的表示法
function getRulePattern(ruleId) {
    const patterns = {
        'japanese': 'standard',
        'hongkong': 'relaxed',  // 香港麻将使用宽松模式支持中文
        'chinese': 'relaxed'    // 中国麻将使用宽松模式支持中文
    };
    return patterns[ruleId] || 'relaxed';
}

// 更新UI本地化
function updateUILocalization() {
    if (!window.ruleSystem) return;
    
    const strings = window.ruleSystem.getLocalizedStrings();
    
    // 更新分数盘显示格式
    if (window.gameState) {
        window.gameState.updateGameInfo();
    }
    
    // 更新牌型输入提示
    updateTileInputPlaceholders();
}

// 更新牌型输入提示
function updateTileInputPlaceholders() {
    if (!window.mahjongParser) return;
    
    const currentPattern = window.mahjongParser.currentPattern;
    const example = window.mahjongParser.getPatternExample(currentPattern);
    
    const handTilesInput = document.getElementById('hand-tiles');
    const winTileInput = document.getElementById('win-tile');
    const meldsInput = document.getElementById('melds');
    
    if (handTilesInput) {
        handTilesInput.placeholder = `例: ${example}`;
    }
    
    if (winTileInput) {
        if (currentPattern === 'relaxed') {
            winTileInput.placeholder = '例: 东, 1z, 发';
        } else {
            const pattern = window.mahjongParser.patterns[currentPattern];
            winTileInput.placeholder = `例: 1${pattern.honor}`;
        }
    }
    
    if (meldsInput) {
        if (currentPattern === 'relaxed') {
            meldsInput.placeholder = '例: 111万,456筒,(1111万), 111m,456p,(1111m)';
        } else {
            const pattern = window.mahjongParser.patterns[currentPattern];
            meldsInput.placeholder = `例: 111${pattern.man},456${pattern.pin},(1111${pattern.man})`;
        }
    }
}

// 初始化UI
function initializeUI() {
    // 设置版本信息
    const versionEl = document.createElement('div');
    versionEl.className = 'version-info';
    versionEl.textContent = 'v1.0.0';
    versionEl.style.cssText = `
        position: fixed; 
        bottom: 5px; 
        left: 5px; 
        font-size: 10px; 
        color: rgba(255,255,255,0.5); 
        z-index: 1000;
    `;
    document.body.appendChild(versionEl);
    
    // 检查触摸设备
    if (isTouchDevice()) {
        document.body.classList.add('touch-device');
    }
    
    // 设置主题
    applyTheme();
}

// 绑定全局事件
function bindGlobalEvents() {
    // 防止意外刷新
    window.addEventListener('beforeunload', (e) => {
        if (window.gameState && window.gameState.history.length > 0) {
            e.preventDefault();
            e.returnValue = '确定要离开吗？游戏数据将会保存。';
        }
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (window.gameState) {
                window.gameState.saveToStorage();
                if (window.uiController) {
                    window.uiController.showSuccess('游戏已保存');
                }
            }
        }
        
        // 空格键: 流局
        if (e.code === 'Space' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            if (window.uiController && !window.uiController.isWinMode) {
                window.uiController.showDrawDialog();
            }
        }
    });
    
    // 触摸事件优化
    if (isTouchDevice()) {
        // 禁用双击放大
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 优化触摸反馈
        document.addEventListener('touchstart', (e) => {
            if (e.target.matches('.player, .center, button')) {
                e.target.style.transform = 'scale(0.95)';
            }
        });
        
        document.addEventListener('touchend', (e) => {
            if (e.target.matches('.player, .center, button')) {
                setTimeout(() => {
                    e.target.style.transform = '';
                }, 100);
            }
        });
    }
}

// 检查是否为触摸设备
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// 应用主题
function applyTheme() {
    // 检查系统深色模式偏好
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-theme');
    }
    
    // 监听主题变化
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.matches);
        });
    }
}

// 主菜单功能
function toggleMainMenu() {
    const menu = document.getElementById('main-menu');
    menu.classList.toggle('collapsed');
}

function rotateScorepad() {
    if (window.gameState) {
        window.gameState.rotateScorepad();
    }
}

function showRoundDialog() {
    // 创建圈局设置对话框
    const modal = createRoundDialog();
    document.body.appendChild(modal);
    if (window.uiController) {
        window.uiController.showModal(modal.id);
    }
}

function showRulesDialog() {
    // 先移除已存在的规则选择对话框
    const existingDialog = document.getElementById('rules-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // 创建规则选择对话框
    const modal = createRulesDialog();
    document.body.appendChild(modal);
    if (window.uiController) {
        window.uiController.showModal(modal.id);
    }
}

function showRuleSettingsDialog() {
    if (!window.ruleSystem) {
        alert('请先选择规则系统');
        return;
    }
    
    // 先移除已存在的规则设置对话框
    const existingDialog = document.getElementById('rule-settings-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // 创建规则设置对话框
    const modal = createRuleSettingsDialog();
    document.body.appendChild(modal);
    if (window.uiController) {
        window.uiController.showModal(modal.id);
    }
}

function showGameHistory() {
    if (window.uiController && window.gameHistory) {
        const history = window.gameHistory.getAllRecords();
        window.uiController.displayHistory(history, '游戏记录');
    }
}

function exportData() {
    if (!window.gameState) return;
    
    const data = JSON.stringify(window.gameState.exportData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahjong-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    if (window.uiController) {
        window.uiController.showSuccess('数据已导出');
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (window.gameState && window.gameState.importData(data)) {
                        if (window.uiController) {
                            window.uiController.showSuccess('数据导入成功');
                        }
                    } else {
                        throw new Error('导入失败');
                    }
                } catch (err) {
                    alert('导入失败：' + err.message);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function newGame() {
    if (confirm('确定要开始新游戏吗？当前游戏数据将被清除。')) {
        if (window.gameState) {
            window.gameState.resetGame();
        }
        if (window.gameHistory) {
            // 不清除历史记录，只重置游戏状态
        }
        if (window.uiController) {
            window.uiController.showSuccess('新游戏已开始');
        }
    }
}

function resetScores() {
    if (confirm('确定要重置所有分数吗？')) {
        if (window.gameState) {
            const initialScore = window.gameState.settings.initialScore;
            Object.keys(window.gameState.players).forEach(position => {
                window.gameState.players[position].score = initialScore;
            });
            window.gameState.updateUI();
            window.gameState.saveToStorage();
        }
        if (window.uiController) {
            window.uiController.showSuccess('分数已重置');
        }
    }
}

// 创建动态对话框的辅助函数
function createRoundDialog() {
    const modal = document.createElement('div');
    modal.id = 'round-dialog';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>设定圈局</h3>
            <div class="round-setting">
                <label>
                    圈风:
                    <select id="wind-select">
                        <option value="east">东</option>
                        <option value="south">南</option>
                        <option value="west">西</option>
                        <option value="north">北</option>
                    </select>
                </label>
                <label>
                    局数:
                    <input type="number" id="round-input" min="1" max="8" value="1">
                </label>
            </div>
            <div class="button-group">
                <button onclick="confirmRoundSetting()">确定</button>
                <button onclick="closeModal()">取消</button>
            </div>
        </div>
    `;
    return modal;
}

function createRulesDialog() {
    const modal = document.createElement('div');
    modal.id = 'rules-dialog';
    modal.className = 'modal hidden';
    
    let rulesHTML = '<div class="rule-list">';
    Object.keys(window.availableRules).forEach(ruleId => {
        const rule = window.availableRules[ruleId];
        const isSelected = window.ruleSystem === rule;
        rulesHTML += `
            <div class="rule-item ${isSelected ? 'selected' : ''}" onclick="selectRule('${ruleId}')">
                <h4>${rule.name}</h4>
                <p>${rule.description}</p>
            </div>
        `;
    });
    rulesHTML += '</div>';
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>选择规则</h3>
            ${rulesHTML}
            <div class="button-group">
                <button onclick="closeModal()">关闭</button>
            </div>
        </div>
    `;
    return modal;
}

function createRuleSettingsDialog() {
    const settings = window.ruleSystem.getSettingsDefinition();
    const modal = document.createElement('div');
    modal.id = 'rule-settings-dialog';
    modal.className = 'modal hidden';
    
    let settingsHTML = '<div class="rule-settings">';
    Object.keys(settings).forEach(groupName => {
        settingsHTML += `<div class="setting-group"><h4>${groupName}</h4>`;
        Object.keys(settings[groupName]).forEach(settingKey => {
            const setting = settings[groupName][settingKey];
            const currentValue = window.ruleSystem.settings[settingKey] || setting.default;
            
            settingsHTML += '<div class="setting-item">';
            settingsHTML += `<label>${setting.label}</label>`;
            
            if (setting.type === 'boolean') {
                settingsHTML += `<input type="checkbox" id="setting-${settingKey}" ${currentValue ? 'checked' : ''}>`;
            } else if (setting.type === 'number') {
                settingsHTML += `<input type="number" id="setting-${settingKey}" value="${currentValue}" 
                    min="${setting.min || 0}" max="${setting.max || 9999}">`;
            } else if (setting.type === 'select') {
                settingsHTML += `<select id="setting-${settingKey}">`;
                setting.options.forEach(option => {
                    settingsHTML += `<option value="${option.value}" ${option.value === currentValue ? 'selected' : ''}>${option.label}</option>`;
                });
                settingsHTML += '</select>';
            }
            settingsHTML += '</div>';
        });
        settingsHTML += '</div>';
    });
    settingsHTML += '</div>';
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${window.ruleSystem.name} - 规则设置</h3>
            ${settingsHTML}
            <div class="button-group">
                <button onclick="saveRuleSettings()">保存</button>
                <button onclick="closeModal()">取消</button>
            </div>
        </div>
    `;
    return modal;
}

function createHistoryDialog() {
    const modal = document.createElement('div');
    modal.id = 'history-dialog';
    modal.className = 'modal hidden';
    
    const history = window.gameHistory ? window.gameHistory.getAllRecords() : [];
    const recentHistory = history.slice(0, 20); // 只显示最近20条
    
    let historyHTML = '<div class="history-container">';
    if (recentHistory.length === 0) {
        historyHTML += '<p>暂无记录</p>';
    } else {
        recentHistory.forEach(record => {
            const formatted = window.gameHistory.formatRecord(record);
            historyHTML += `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-round">${formatted.round}</span>
                        <span class="history-time">${formatted.datetime}</span>
                    </div>
                    <div class="history-details">${formatted.description}</div>
                </div>
            `;
        });
    }
    historyHTML += '</div>';
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>游戏记录</h3>
            ${historyHTML}
            <div class="button-group">
                <button onclick="exportHistory()">导出</button>
                <button onclick="clearHistory()">清空</button>
                <button onclick="closeModal()">关闭</button>
            </div>
        </div>
    `;
    return modal;
}

// 显示表示法选择对话框
function showPatternDialog() {
    if (!window.mahjongParser) return;
    
    const patterns = window.mahjongParser.getAvailablePatterns();
    const patternList = document.getElementById('pattern-list');
    const currentPattern = window.mahjongParser.currentPattern;
    
    // 生成表示法选项
    patternList.innerHTML = patterns.map(pattern => `
        <label class="pattern-option">
            <input type="radio" name="pattern" value="${pattern.key}" 
                   ${pattern.key === currentPattern ? 'checked' : ''}>
            <div class="pattern-info">
                <strong>${pattern.name}</strong>
                <div class="pattern-example-small">${pattern.example}</div>
            </div>
        </label>
    `).join('');
    
    // 更新示例显示
    updatePatternExample();
    
    // 添加选项变化监听
    const radios = patternList.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
        radio.addEventListener('change', updatePatternExample);
    });
    
    if (window.uiController) {
        window.uiController.showModal('pattern-dialog');
    }
}

// 更新表示法示例
function updatePatternExample() {
    const selectedRadio = document.querySelector('input[name="pattern"]:checked');
    const exampleText = document.getElementById('pattern-example-text');
    
    if (selectedRadio && window.mahjongParser) {
        const example = window.mahjongParser.getPatternExample(selectedRadio.value);
        exampleText.textContent = example;
    }
}

// 应用表示法更改
function applyPatternChange() {
    const selectedRadio = document.querySelector('input[name="pattern"]:checked');
    
    if (selectedRadio && window.mahjongParser) {
        const newPattern = selectedRadio.value;
        const oldPattern = window.mahjongParser.currentPattern;
        
        if (newPattern !== oldPattern) {
            // 设置新的表示法
            window.mahjongParser.setPattern(newPattern);
            
            // 更新输入提示
            updateTileInputPlaceholders();
            
            // 显示成功消息
            if (window.uiController) {
                const patternName = window.mahjongParser.getPatternName(newPattern);
                window.uiController.showSuccess(`已切换到${patternName}`);
            }
            
            console.log('表示法已切换到:', newPattern);
        }
    }
    
    if (window.uiController) {
        window.uiController.closeModal();
    }
}

// 对话框回调函数
function confirmRoundSetting() {
    const wind = document.getElementById('wind-select').value;
    const round = parseInt(document.getElementById('round-input').value);
    
    if (window.gameState) {
        window.gameState.setRound(wind, round);
    }
    
    if (window.uiController) {
        window.uiController.closeModal();
        window.uiController.showSuccess('圈局已设置');
    }
}

// 更新规则选择UI的高亮状态
function updateRuleSelectionUI(selectedRuleId) {
    console.log('Updating rule selection UI for:', selectedRuleId);
    const rulesDialog = document.getElementById('rules-dialog');
    if (!rulesDialog) {
        console.log('Rules dialog not found');
        return;
    }
    
    // 移除所有现有的选中状态
    rulesDialog.querySelectorAll('.rule-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 通过onclick属性找到对应的规则项并添加选中状态
    rulesDialog.querySelectorAll('.rule-item').forEach(item => {
        const onclickAttr = item.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`selectRule('${selectedRuleId}')`)) {
            console.log('Adding selected class to rule item:', selectedRuleId);
            item.classList.add('selected');
        }
    });
}

function selectRule(ruleId) {
    console.log('Selecting rule:', ruleId);
    setRuleSystem(ruleId);
    
    // 更新规则选择对话框中的高亮状态
    updateRuleSelectionUI(ruleId);
    
    // 添加短暂延迟让用户看到选择反馈，然后关闭对话框
    setTimeout(() => {
        if (window.uiController) {
            window.uiController.closeModal();
        }
    }, 300);
}

function saveRuleSettings() {
    const settings = window.ruleSystem.getSettingsDefinition();
    const newSettings = {};
    
    Object.keys(settings).forEach(groupName => {
        Object.keys(settings[groupName]).forEach(settingKey => {
            const element = document.getElementById(`setting-${settingKey}`);
            if (element) {
                if (element.type === 'checkbox') {
                    newSettings[settingKey] = element.checked;
                } else if (element.type === 'number') {
                    newSettings[settingKey] = parseInt(element.value);
                } else {
                    newSettings[settingKey] = element.value;
                }
            }
        });
    });
    
    window.ruleSystem.updateSettings(newSettings);
    
    // 同步重要设置到游戏状态
    if (window.gameState) {
        if (newSettings.initialScore !== undefined) {
            const shouldUpdatePlayers = confirm('初始分数已更改，是否重置所有玩家分数？');
            if (shouldUpdatePlayers) {
                Object.keys(window.gameState.players).forEach(position => {
                    window.gameState.players[position].score = newSettings.initialScore;
                });
            }
            window.gameState.settings.initialScore = newSettings.initialScore;
        }
        
        if (newSettings.targetScore !== undefined) {
            window.gameState.settings.targetScore = newSettings.targetScore;
        }
        
        if (newSettings.minScore !== undefined) {
            window.gameState.settings.minScore = newSettings.minScore;
        }
        
        window.gameState.updateUI();
        window.gameState.saveToStorage();
    }
    
    if (window.uiController) {
        window.uiController.closeModal();
        window.uiController.showSuccess('设置已保存');
    }
}

function exportHistory() {
    if (!window.gameHistory) return;
    
    const data = window.gameHistory.exportToJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahjong-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
        if (window.gameHistory) {
            window.gameHistory.clearHistory();
        }
        if (window.uiController) {
            window.uiController.closeModal();
            window.uiController.showSuccess('历史记录已清空');
        }
    }
}

// 撤回最新操作
function undoLastOperation() {
    if (!window.gameHistory) {
        alert('历史记录系统不可用');
        return;
    }
    
    if (!window.gameHistory.canUndo()) {
        alert('没有可撤回的操作');
        return;
    }
    
    const lastOperation = window.gameHistory.getLastOperationDescription();
    if (!lastOperation) {
        alert('无法获取最新操作信息');
        return;
    }
    
    // 确认撤回操作
    const confirmMessage = `确定要撤回以下操作吗？\n\n${lastOperation.description}\n时间：${lastOperation.timestamp}\n\n此操作将恢复到该操作执行前的游戏状态。`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const result = window.gameHistory.undoLastOperation();
        
        // 显示成功消息
        if (window.uiController) {
            window.uiController.showSuccess(`已撤回操作：${result.undoneRecord.type}`);
            
            // 更新历史记录显示
            setTimeout(() => {
                const history = window.gameHistory ? window.gameHistory.getAllRecords() : [];
                window.uiController.displayHistory(history, '游戏记录');
            }, 500);
        }
        
        console.log('撤回操作成功:', result);
    } catch (error) {
        console.error('撤回操作失败:', error);
        alert(`撤回操作失败：${error.message}`);
    }
}

// 帮助菜单功能实现

// 显示役种说明对话框
function showYakuDialog() {
    // 获取当前规则系统的役种信息
    let yakuContent = '';
    
    if (window.ruleSystem && window.ruleSystem.getSupportedYaku) {
        const yakuList = window.ruleSystem.getSupportedYaku();
        
        if (yakuList && yakuList.length > 0) {
            // 按分类组织役种
            const categories = {};
            yakuList.forEach(yaku => {
                const category = yaku.category || '其他';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(yaku);
            });
            
            // 生成HTML内容
            yakuContent = Object.keys(categories).map(categoryName => {
                const yakuItems = categories[categoryName].map(yaku => {
                    const value = typeof yaku.fan === 'number' ? `${yaku.fan}翻` : yaku.fan;
                    return `
                        <li class="yaku-item">
                            <div>
                                <div class="yaku-name">${yaku.name}</div>
                                ${yaku.description ? `<div class="yaku-description">${yaku.description}</div>` : ''}
                            </div>
                            <div class="yaku-value">${value}</div>
                        </li>
                    `;
                }).join('');
                
                return `
                    <div class="yaku-category">
                        <div class="yaku-category-header">${categoryName}</div>
                        <ul class="yaku-list">
                            ${yakuItems}
                        </ul>
                    </div>
                `;
            }).join('');
        } else {
            yakuContent = '<p style="text-align: center; color: #666;">当前规则系统没有提供役种信息</p>';
        }
    } else {
        yakuContent = `
            <div class="yaku-category">
                <div class="yaku-category-header">基本役种示例</div>
                <ul class="yaku-list">
                    <li class="yaku-item">
                        <div>
                            <div class="yaku-name">立直</div>
                            <div class="yaku-description">门前清状态下宣告立直</div>
                        </div>
                        <div class="yaku-value">1翻</div>
                    </li>
                    <li class="yaku-item">
                        <div>
                            <div class="yaku-name">断幺九</div>
                            <div class="yaku-description">全部由2-8的数牌组成</div>
                        </div>
                        <div class="yaku-value">1翻</div>
                    </li>
                    <li class="yaku-item">
                        <div>
                            <div class="yaku-name">平和</div>
                            <div class="yaku-description">四副顺子加一对将牌</div>
                        </div>
                        <div class="yaku-value">1翻</div>
                    </li>
                    <li class="yaku-item">
                        <div>
                            <div class="yaku-name">一般高</div>
                            <div class="yaku-description">有两副相同的顺子</div>
                        </div>
                        <div class="yaku-value">1翻</div>
                    </li>
                </ul>
            </div>
            <p style="text-align: center; color: #666; margin-top: 15px;">
                请选择具体的规则系统以查看完整役种信息
            </p>
        `;
    }
    
    // 更新对话框内容
    document.getElementById('yaku-content').innerHTML = yakuContent;
    
    // 显示对话框
    showModalDialog('yaku-dialog');
}

// 显示帮助文档对话框
function showHelp() {
    showModalDialog('help-dialog');
}

// 显示关于对话框
function showAbout() {
    showModalDialog('about-dialog');
}

// 跳转到分析工具
function jumpToAnalyseTool() {
    // 检查分析工具页面是否存在
    const analyseTool = 'analyse-tool.html';
    
    // 在新窗口中打开分析工具
    try {
        window.open(analyseTool, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    } catch (error) {
        // 如果无法打开新窗口，尝试在当前窗口中导航
        if (confirm('即将跳转到分析工具页面，是否继续？\n注意：当前对局数据不会丢失。')) {
            window.location.href = analyseTool;
        }
    }
}

// 显示模态对话框的通用方法
function showModalDialog(modalId) {
    if (window.uiController && window.uiController.showModal) {
        window.uiController.showModal(modalId);
    } else {
        // 备用方案：直接操作DOM
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById(modalId);
        if (overlay && modal) {
            overlay.classList.remove('hidden');
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }
}

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('全局错误:', e.error);
    // 可以在这里添加错误报告逻辑
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的Promise拒绝:', e.reason);
    // 可以在这里添加错误报告逻辑
});

// 添加错误防护和调试功能
window.addEventListener('error', function(e) {
    console.error('JavaScript错误:', e.error);
    console.error('错误详情:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
    });
});

// 确保关键的全局函数存在
function ensureGlobalFunctions() {
    // 如果某些函数不存在，提供备用实现
    if (typeof window.closeModal !== 'function') {
        window.closeModal = function() {
            console.log('closeModal备用函数被调用');
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.add('hidden');
            });
            document.getElementById('modal-overlay').classList.add('hidden');
        };
    }
    
    if (typeof window.showPlayerMenu !== 'function') {
        window.showPlayerMenu = function(position) {
            console.log('showPlayerMenu备用函数被调用:', position);
        };
    }
    
    if (typeof window.handleCenterClick !== 'function') {
        window.handleCenterClick = function() {
            console.log('handleCenterClick备用函数被调用');
        };
    }
}

// 在DOM加载完成后确保函数存在
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(ensureGlobalFunctions, 100);
});

// 导出全局函数
window.toggleMainMenu = toggleMainMenu;
window.rotateScorepad = rotateScorepad;
window.showRoundDialog = showRoundDialog;
window.showRulesDialog = showRulesDialog;
window.showRuleSettingsDialog = showRuleSettingsDialog;
window.showPatternDialog = showPatternDialog;
window.applyPatternChange = applyPatternChange;
window.showGameHistory = showGameHistory;
window.exportData = exportData;
window.importData = importData;
window.newGame = newGame;
window.resetScores = resetScores;
window.confirmRoundSetting = confirmRoundSetting;
window.selectRule = selectRule;
window.saveRuleSettings = saveRuleSettings;
window.exportHistory = exportHistory;
window.clearHistory = clearHistory;

// 导出帮助菜单相关函数
window.showYakuDialog = showYakuDialog;
window.showHelp = showHelp;
window.showAbout = showAbout;
window.jumpToAnalyseTool = jumpToAnalyseTool;
window.showYakuDialog = showYakuDialog;
window.showHelp = showHelp;
window.showAbout = showAbout;
window.jumpToAnalyseTool = jumpToAnalyseTool;

//# sourceMappingURL=main.js.map
