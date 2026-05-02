# ai-Consultation-System
An AI-based online consultation system that simulates the doctor consultation process through natural language interaction, helping users preliminarily analyze health issues.

# AI智能医疗诊断系统

一个基于Web的AI辅助医疗诊断系统，通过多轮对话问诊，为患者提供初步诊断建议和治疗方案。

## 功能特点

- **六步完整流程**：免责声明 → 基本信息 → 症状选择 → AI问诊 → 诊断报告 → 导出
- **智能症状选择**：支持多身体部位、多症状选择
- **AI多轮问诊**：3-5轮智能对话，深入了解病情
- **完整诊断报告**：包含主要诊断、置信度评估、严重程度、鉴别诊断、病理分析、药物治疗方案、治疗建议、警示信号
- **报告导出**：支持文本和JSON格式导出

## 系统架构

```
ai_medical_system/
├── app.py                 # Flask后端主程序
├── requirements.txt       # Python依赖
├── start.sh              # Linux/Mac启动脚本
├── start.bat             # Windows启动脚本
├── README.md             # 项目说明
├── static/
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       └── app.js        # 前端逻辑
└── templates/
    └── index.html        # 主页面
```
