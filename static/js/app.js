/**
 * 智能医疗诊断系统 - 前端交互逻辑
 * 面向小白：详细注释每一部分功能
 */

// ========== 全局变量 ==========
let currentStep = 1;           // 当前步骤（1-6）
let sessionId = null;          // 后端会话ID
let currentReport = null;      // 诊断报告数据
let isConsulting = false;      // 是否正在问诊中

// 新增：存储选中的身体部位和症状
let selectedBodyParts = [];    // 存储选中的身体部位（多选）
let selectedSymptoms = [];     // 存储所有选中的症状（包含部位信息）

// 症状数据库（身体部位 -> 症状列表）
const symptomDatabase = {
    '头部': ['头痛', '头晕', '眩晕', '失眠', '记忆力减退', '注意力不集中', '偏头痛', '头胀'],
    '眼部': ['视力模糊', '眼痛', '眼红', '流泪', '眼干', '视物重影', '畏光'],
    '耳部': ['耳鸣', '听力下降', '耳痛', '耳流脓', '耳闷', '眩晕'],
    '鼻部': ['鼻塞', '流涕', '鼻痒', '打喷嚏', '鼻出血', '嗅觉减退'],
    '咽喉': ['咽痛', '咽干', '咽痒', '咳嗽', '声音嘶哑', '吞咽困难', '异物感'],
    '胸部': ['胸痛', '胸闷', '咳嗽', '咳痰', '呼吸困难', '气喘', '心悸'],
    '心脏': ['心悸', '心慌', '胸闷', '胸痛', '气短', '心律不齐'],
    '腹部': ['腹痛', '腹胀', '恶心', '呕吐', '腹泻', '便秘', '食欲不振', '反酸', '烧心'],
    '腰背': ['腰痛', '背痛', '腰酸', '活动受限', '僵硬'],
    '腰部': ['腰痛', '腰酸', '腰部僵硬', '活动受限', '下肢麻木'],
    '四肢': ['肢体麻木', '肢体无力', '关节疼痛', '肌肉酸痛', '水肿', '抽筋'],
    '关节': ['关节疼痛', '关节肿胀', '关节僵硬', '活动受限', '关节红肿', '晨僵'],
    '皮肤': ['皮疹', '瘙痒', '红肿', '脱皮', '水疱', '皮肤干燥', '出血点', '黄疸', '红斑'],
    '精神心理': ['焦虑', '抑郁', '失眠', '情绪波动', '疲劳', '注意力不集中', '易怒']
};

// ========== 页面加载完成后初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();   // 绑定所有按钮事件
    initTagSelectors();     // 初始化多选标签
    initBodyPartSelector(); // 初始化身体部位选择（已改为多选）
    updateStepDisplay();    // 显示当前步骤
});

// ========== 初始化事件监听 ==========
function initEventListeners() {

    // 【步骤1】免责声明
    const agreeCheck = document.getElementById('agreeCheck');
    const btnStep1Next = document.getElementById('btnStep1Next');

    agreeCheck.addEventListener('change', function() {
        btnStep1Next.disabled = !this.checked;
    });

    btnStep1Next.addEventListener('click', () => goToStep(2));

    // 【步骤2】基本信息
    document.getElementById('btnStep2Prev').addEventListener('click', () => goToStep(1));
    document.getElementById('btnStep2Next').addEventListener('click', saveStep2AndGo);

    // 用药详情显示/隐藏
    document.getElementById('takingMedication').addEventListener('change', function() {
        const detail = document.querySelector('.medication-detail');
        detail.style.display = this.value === '是' ? 'block' : 'none';
    });

    // 【步骤3】症状选择
    document.getElementById('btnStep3Prev').addEventListener('click', () => goToStep(2));
    document.getElementById('btnStep3Next').addEventListener('click', saveStep3AndGo);

    // 【步骤4】AI问诊
    document.getElementById('btnStep4Prev').addEventListener('click', () => {
        if (confirm('返回将重新开始问诊，确定吗？')) {
            resetConsultation();
            goToStep(3);
        }
    });
    document.getElementById('btnSendMessage').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });

    // 【步骤5】诊断报告
    document.getElementById('btnRestart').addEventListener('click', restart);
    document.getElementById('btnExport').addEventListener('click', () => goToStep(6));

    // 【步骤6】导出
    document.getElementById('btnStep6Prev').addEventListener('click', () => goToStep(5));

    // 导出选项
    document.querySelectorAll('.export-option').forEach(option => {
        option.addEventListener('click', function() {
            const format = this.dataset.format;
            exportReport(format);
        });
    });
}

// ========== 初始化多选标签 ==========
function initTagSelectors() {
    // 过敏史标签
    initTagSelector('allergySelector', 'allergies');
    // 既往病史标签
    initTagSelector('historySelector', 'medicalHistory');
}

function initTagSelector(containerId, dataKey) {
    const container = document.getElementById(containerId);
    const tags = container.querySelectorAll('.tag');

    tags.forEach(tag => {
        tag.addEventListener('click', function() {
            // 切换选中状态
            this.classList.toggle('selected');

            // 收集所有选中的值
            const selected = [];
            container.querySelectorAll('.tag.selected').forEach(t => {
                selected.push(t.dataset.value);
            });

            // 保存到patientData（通过data属性临时存储）
            container.dataset.selected = JSON.stringify(selected);
        });
    });
}

// ========== 【修改】初始化身体部位选择（支持多选）==========
function initBodyPartSelector() {
    const buttons = document.querySelectorAll('.body-part-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            const part = this.dataset.part;

            // 切换选中状态（多选模式）
            if (this.classList.contains('selected')) {
                // 取消选中
                this.classList.remove('selected');
                selectedBodyParts = selectedBodyParts.filter(p => p !== part);
            } else {
                // 选中
                this.classList.add('selected');
                if (!selectedBodyParts.includes(part)) {
                    selectedBodyParts.push(part);
                }
            }

            // 更新症状显示（显示所有选中部位的症状）
            updateSymptomsDisplay();
        });
    });
}

// 【新增】更新症状显示区域（显示所有选中部位的症状，按部位分组）
function updateSymptomsDisplay() {
    const container = document.getElementById('symptomSelector');

    if (selectedBodyParts.length === 0) {
        container.innerHTML = '<div class="symptom-placeholder">请先选择身体部位（可多选）</div>';
        return;
    }

    let html = '';

    // 为每个选中的部位创建一个症状组
    selectedBodyParts.forEach(part => {
        const symptoms = symptomDatabase[part] || [];
        if (symptoms.length > 0) {
            html += `
                <div class="symptom-group" data-part="${part}">
                    <div class="symptom-group-title">
                        <i class="fas fa-check-circle"></i> ${part}
                    </div>
                    <div class="symptom-tags">
                        ${symptoms.map(symptom => {
                            // 检查该症状是否已被选中
                            const isSelected = selectedSymptoms.some(s => s.name === symptom && s.part === part);
                            return `<span class="symptom-tag ${isSelected ? 'selected' : ''}" 
                                         data-symptom="${symptom}" 
                                         data-part="${part}">${symptom}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;

    // 绑定症状点击事件
    container.querySelectorAll('.symptom-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const symptom = this.dataset.symptom;
            const part = this.dataset.part;

            if (this.classList.contains('selected')) {
                // 取消选中
                this.classList.remove('selected');
                selectedSymptoms = selectedSymptoms.filter(s => !(s.name === symptom && s.part === part));
            } else {
                // 选中
                this.classList.add('selected');
                selectedSymptoms.push({ name: symptom, part: part });
            }

            // 更新汇总显示
            updateSymptomsSummary();
        });
    });

    // 更新汇总
    updateSymptomsSummary();
}

// 【新增】更新已选症状汇总显示
function updateSymptomsSummary() {
    // 更新全局数据
    const uniqueSymptoms = [...new Set(selectedSymptoms.map(s => s.name))];
    if (window.patientData) {
        window.patientData.symptoms = uniqueSymptoms;
        window.patientData.symptomsWithPart = selectedSymptoms;
        window.patientData.selectedBodyParts = selectedBodyParts;
    }

    // 如果有汇总显示区域，更新它
    const summaryEl = document.getElementById('symptomsSummary');
    if (summaryEl) {
        if (selectedSymptoms.length > 0) {
            summaryEl.innerHTML = `
                <div class="summary-box">
                    <strong>已选症状（${selectedSymptoms.length}个）：</strong>
                    ${selectedSymptoms.map(s => `<span class="summary-tag">${s.part}·${s.name}</span>`).join('')}
                </div>
            `;
            summaryEl.style.display = 'block';
        } else {
            summaryEl.style.display = 'none';
        }
    }
}

// ========== 步骤切换 ==========
function goToStep(step) {
    currentStep = step;
    updateStepDisplay();

    // 进入第4步：开始AI问诊
    if (step === 4 && !sessionId) {
        startAIConsultation();
    }

    // 进入第5步：显示报告
    if (step === 5 && currentReport) {
        displayReport(currentReport);
    }

    // 进入第6步：显示导出预览
    if (step === 6 && currentReport) {
        showExportPreview();
    }
}

function updateStepDisplay() {
    // 更新步骤导航栏
    document.querySelectorAll('.step-item').forEach(item => {
        const itemStep = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed');

        if (itemStep === currentStep) {
            item.classList.add('active');
        } else if (itemStep < currentStep) {
            item.classList.add('completed');
        }
    });

    // 显示对应内容区
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`step${currentStep}`).classList.add('active');

    window.scrollTo(0, 0);
}

// ========== 保存各步骤数据 ==========
function saveStep2AndGo() {
    // 收集基本信息
    const name = document.getElementById('patientName').value.trim();
    const gender = document.getElementById('patientGender').value;
    const age = document.getElementById('patientAge').value;

    // 验证必填
    if (!name || !gender || !age) {
        alert('请填写姓名、性别和年龄');
        return;
    }

    // 保存到全局（通过window对象传递）
    window.patientData = {
        name: name,
        gender: gender,
        age: age,
        allergies: getSelectedTags('allergySelector'),
        medicalHistory: getSelectedTags('historySelector'),
        otherAllergy: document.getElementById('otherAllergy').value,
        otherHistory: document.getElementById('otherHistory').value,
        medications: document.getElementById('takingMedication').value === '是'
            ? document.getElementById('medicationDetail').value
            : '否',
        smoking: document.getElementById('smokingHistory').value,
        drinking: document.getElementById('drinkingHistory').value
    };

    goToStep(3);
}

function getSelectedTags(containerId) {
    const container = document.getElementById(containerId);
    const selected = container.querySelectorAll('.tag.selected');
    return Array.from(selected).map(tag => tag.dataset.value);
}

// 【修改】保存步骤3数据（适配多选）
function saveStep3AndGo() {
    // 验证是否选择了症状
    if (selectedSymptoms.length === 0) {
        alert('请至少选择一个症状');
        return;
    }

    // 保存症状信息
    window.patientData.symptoms = [...new Set(selectedSymptoms.map(s => s.name))];
    window.patientData.symptomsWithPart = selectedSymptoms;
    window.patientData.selectedBodyParts = selectedBodyParts;
    window.patientData.symptomDetail = document.getElementById('symptomDetail').value;

    console.log('步骤3保存的数据:', window.patientData);

    goToStep(4);
}

// ========== AI问诊核心功能 ==========
async function startAIConsultation() {
    showLoading(true);
    isConsulting = true;

    try {
        // 调用后端：开始问诊
        const response = await fetch('/api/start_consultation', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(window.patientData)
        });

        const data = await response.json();

        if (data.success) {
            sessionId = data.sessionId;
            addMessageToChat('ai', data.message);
            updateProgress(1, 5);
        } else {
            alert('启动问诊失败：' + data.error);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('网络错误，请确保后端服务已启动（python app.py）');
    } finally {
        showLoading(false);
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || !isConsulting) return;

    // 显示用户消息
    addMessageToChat('user', message);
    input.value = '';
    showLoading(true);

    try {
        // 调用后端：继续问诊
        const response = await fetch('/api/consult', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                sessionId: sessionId,
                message: message
            })
        });

        const data = await response.json();

        if (data.success) {
            if (data.isComplete) {
                // 问诊完成，显示报告
                isConsulting = false;
                currentReport = data.report;
                addMessageToChat('ai', '✅ 问诊完成！正在生成诊断报告...');

                setTimeout(() => {
                    goToStep(5);
                }, 1500);
            } else {
                // 继续问诊
                addMessageToChat('ai', data.message);
                updateProgress(data.round, 5);
            }
        } else {
            alert('发送失败：' + data.error);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('网络错误');
    } finally {
        showLoading(false);
    }
}

// ========== 界面更新辅助函数 ==========
function addMessageToChat(sender, text) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${sender}`;

    const isAI = sender === 'ai';
    const icon = isAI ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    const name = isAI ? 'AI医生' : window.patientData?.name || '您';
    const time = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});

    div.innerHTML = `
        <div class="message-avatar">${icon}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-name">${name}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${formatMessage(text)}</div>
        </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight; // 滚动到底部
}

function formatMessage(text) {
    // 简单的文本格式化（换行等）
    return text.replace(/\n/g, '<br>');
}

function updateProgress(current, total) {
    document.getElementById('consultProgress').textContent = `第 ${current} / ${total} 轮`;

    const percentage = (current / total) * 100;
    document.getElementById('progressFill').style.width = percentage + '%';

    // 更新阶段文字
    const phaseEl = document.getElementById('consultPhase');
    if (current === 1) phaseEl.textContent = '基础问诊';
    else if (current === 2) phaseEl.textContent = '症状确认';
    else if (current === 3) phaseEl.textContent = '病史询问';
    else if (current >= 4) phaseEl.textContent = '深入分析';
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// ========== 诊断报告展示 ==========
function displayReport(report) {
    const container = document.getElementById('reportContainer');

    // 置信度颜色
    const confidenceColor = report.confidence >= 80 ? 'high' :
                           report.confidence >= 60 ? 'medium' : 'low';

    // 严重程度颜色
    const severityClass = report.severity === '重度' ? 'severe' :
                         report.severity === '中度' ? 'moderate' : 'mild';

    container.innerHTML = `
        <div class="report-header">
            <div class="diagnosis-main">
                <h3>主要诊断</h3>
                <div class="diagnosis-name">${report.mainDiagnosis}</div>
                <div class="diagnosis-tags">
                    <span class="severity-tag ${severityClass}">${report.severity}</span>
                    <span class="confidence-tag ${confidenceColor}">置信度 ${report.confidence}%</span>
                </div>
                <p class="confidence-reason">${report.confidenceReason}</p>
            </div>
        </div>
        
        <div class="report-section">
            <h4><i class="fas fa-stethoscope"></i> 鉴别诊断</h4>
            <ul class="differential-list">
                ${report.differentialDiagnosis.map(d => `<li>${d}</li>`).join('')}
            </ul>
        </div>
        
        <div class="report-section">
            <h4><i class="fas fa-microscope"></i> 病理机制</h4>
            <p class="mechanism">${report.pathology.mechanism}</p>
            
            <div class="evidence-box">
                <div class="evidence-support">
                    <h5>支持点</h5>
                    <ul>${report.pathology.supportingPoints.map(p => `<li>${p}</li>`).join('')}</ul>
                </div>
                <div class="evidence-against">
                    <h5>不支持点</h5>
                    <ul>${report.pathology.againstPoints.map(p => `<li>${p}</li>`).join('')}</ul>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4><i class="fas fa-pills"></i> 用药建议</h4>
            <div class="medication-list">
                ${report.medications.map(med => `
                    <div class="medication-item">
                        <div class="med-header">
                            <strong>${med.name}</strong>
                            <span class="insurance-tag">${med.insurance}</span>
                        </div>
                        <div class="med-usage">${med.usage}</div>
                        <div class="med-warning">⚠️ 禁忌：${med.contraindication}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="report-section">
            <h4><i class="fas fa-hand-holding-medical"></i> 治疗建议</h4>
            
            <div class="treatment-subsection">
                <h5>非药物治疗</h5>
                <ul>${report.treatment.nonMedication.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>
            
            <div class="treatment-subsection">
                <h5>生活方式调整</h5>
                <ul>${report.treatment.lifestyle.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>
            
            <div class="treatment-subsection">
                <h5>随访计划</h5>
                <ul>${report.treatment.followUp.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>
        </div>
        
        <div class="report-section warning-section">
            <h4><i class="fas fa-exclamation-triangle"></i> 危险信号（需立即就医）</h4>
            <ul class="warning-list">
                ${report.warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
        </div>
        
        <div class="report-disclaimer">
            <i class="fas fa-info-circle"></i>
            <p>${report.disclaimer || '本报告由AI生成，仅供参考，不能替代专业医生的诊断。如有不适，请及时就医。'}</p>
        </div>
    `;
}

// ========== 导出功能 ==========
function showExportPreview() {
    const preview = document.getElementById('exportPreview');
    const text = generateReportText();
    preview.innerHTML = `<pre>${text}</pre>`;
}

function generateReportText() {
    if (!currentReport) return '';

    const r = currentReport;
    let text = `智能医疗诊断报告\n`;
    text += `================\n\n`;
    text += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    text += `患者：${window.patientData?.name || '未知'}\n`;
    text += `性别：${window.patientData?.gender || '未知'}  年龄：${window.patientData?.age || '未知'}\n\n`;

    text += `【主要诊断】\n${r.mainDiagnosis}\n`;
    text += `严重程度：${r.severity}  置信度：${r.confidence}%\n`;
    text += `置信度说明：${r.confidenceReason}\n\n`;

    text += `【鉴别诊断】\n${r.differentialDiagnosis.join('\n')}\n\n`;

    text += `【病理机制】\n${r.pathology.mechanism}\n\n`;

    text += `【用药建议】\n`;
    r.medications.forEach(m => {
        text += `- ${m.name}（${m.insurance}）\n`;
        text += `  用法：${m.usage}\n`;
        text += `  禁忌：${m.contraindication}\n\n`;
    });

    text += `【治疗建议】\n`;
    text += `非药物治疗：\n${r.treatment.nonMedication.map(x => '- ' + x).join('\n')}\n\n`;
    text += `生活方式：\n${r.treatment.lifestyle.map(x => '- ' + x).join('\n')}\n\n`;
    text += `随访计划：\n${r.treatment.followUp.map(x => '- ' + x).join('\n')}\n\n`;

    text += `【危险信号】\n${r.warnings.map(x => '⚠️ ' + x).join('\n')}\n\n`;

    text += `【免责声明】\n${r.disclaimer || '本报告由AI生成，仅供参考，不能替代专业医生的诊断。'}\n`;

    return text;
}

function exportReport(format) {
    if (!currentReport) return;

    if (format === 'txt') {
        const text = generateReportText();
        downloadFile(text, `诊断报告_${window.patientData?.name || '患者'}_${new Date().toISOString().slice(0,10)}.txt`, 'text/plain');
    } else if (format === 'json') {
        const json = JSON.stringify({
            patientInfo: window.patientData,
            report: currentReport,
            generatedAt: new Date().toISOString()
        }, null, 2);
        downloadFile(json, `诊断报告_${window.patientData?.name || '患者'}_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ========== 重置和重启 ==========

// 【修改】重置症状选择
function resetSymptomSelection() {
    selectedBodyParts = [];
    selectedSymptoms = [];

    // 清除UI
    document.querySelectorAll('.body-part-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById('symptomSelector').innerHTML = '<div class="symptom-placeholder">请先选择身体部位（可多选）</div>';

    // 清除汇总
    const summaryEl = document.getElementById('symptomsSummary');
    if (summaryEl) summaryEl.style.display = 'none';
}

function resetConsultation() {
    // 重置会话
    if (sessionId) {
        fetch('/api/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({sessionId: sessionId})
        }).catch(e => console.log('Reset error:', e));
    }

    sessionId = null;
    currentReport = null;
    isConsulting = false;

    // 清空聊天
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatInput').value = '';
    document.getElementById('progressFill').style.width = '20%';
    document.getElementById('consultProgress').textContent = '第 1 / 5 轮';
}

function restart() {
    if (confirm('确定要重新开始吗？所有数据将被清空。')) {
        resetConsultation();
        resetSymptomSelection(); // 重置症状选择

        // 重置所有表单
        document.getElementById('agreeCheck').checked = false;
        document.getElementById('btnStep1Next').disabled = true;

        document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
            input.value = '';
        });
        document.querySelectorAll('select').forEach(select => {
            select.value = '';
        });
        document.querySelectorAll('.tag.selected').forEach(tag => {
            tag.classList.remove('selected');
        });

        goToStep(1);
    }
}