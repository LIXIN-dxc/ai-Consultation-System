"""
AI智能医疗诊断系统 - 后端服务
使用Flask框架提供API服务，接入OpenRouter AI
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import json
import requests
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
# 加载.env文件（需先安装：pip install python-dotenv）
load_dotenv()

# 从环境变量读取密钥
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')
if not OPENROUTER_API_KEY:
    raise ValueError("未配置OPENROUTER_API_KEY环境变量")


app = Flask(__name__)
CORS(app)

# 存储会话历史（生产环境建议改用Redis/数据库）
session_store = {}

# OpenRouter API配置
OPENROUTER_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')


def call_ai(messages, temperature=0.7):
    """调用OpenRouter AI接口"""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek-r1-250528",
        "messages": messages,
        "temperature": temperature
    }

    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        print(f"AI调用失败: {e}")
        return None


def get_system_prompt():
    """获取系统提示词"""
    return """你是一位专业的AI医疗助手，具备丰富的临床医学知识。你的任务是通过问诊收集患者信息并生成诊断报告。

【重要规则】
1. 你会先收到患者的基本信息和症状描述（这是患者自述，不算问诊轮次）
2. 你需要基于这些信息，主动提出3-5轮问题来深入挖掘关键信息
3. 每轮只能问1-2个具体问题，要简洁、有针对性
4. 问诊轮次从"第1轮"开始计数（即你提出的第一个问题）
5. 当问诊满5轮且信息足够做出判断时，输出【诊断完成】标记
6. 然后必须按固定JSON格式返回完整诊断报告

【问诊策略建议】
- 第1轮：针对主要症状的细节（性质、程度、时间特点）
- 第2轮：伴随症状和鉴别诊断关键点
- 第3轮：既往史、家族史、危险因素
- 第4轮：补充关键信息或验证假设
- 第5轮：最终确认或结束问诊
根据具体情况而定

【结束条件】
满足以下任两个条件时必须结束：
1. 已经提问5轮（必须明确告知患者"问诊完成"）
2. 发现危险信号需要立即就医
3. 信息已足够做出明确诊断

【输出格式】
结束问诊时，必须包含：
1. 文本：【诊断完成】
2. 然后输出JSON格式的诊断报告

JSON格式要求：
{
    "mainDiagnosis": "主要诊断名称",
    "confidence": 85,
    "confidenceReason": "基于...症状，符合...诊断标准",
    "severity": "轻度/中度/重度",
    "differentialDiagnosis": ["鉴别诊断1：理由", "鉴别诊断2：理由"],
    "pathology": {
        "mechanism": "病理机制详细说明",
        "supportingPoints": ["支持点1", "支持点2"],
        "againstPoints": ["不支持点1"]
    },
    "medications": [
        {
            "name": "药品通用名",
            "usage": "用法用量",
            "insurance": "甲类/乙类/自费",
            "contraindication": "禁忌症"
        }
    ],
    "treatment": {
        "nonMedication": ["建议1", "建议2"],
        "lifestyle": ["建议1", "建议2"],
        "followUp": ["随访建议1"]
    },
    "warnings": ["危险信号1", "危险信号2"],
    "disclaimer": "本报告由AI生成，仅供参考，不能替代专业医生的诊断。如有不适，请及时就医。"
}

注意：平时问诊时只返回纯文本问题，不要返回JSON。只有在确定诊断完成时才返回JSON格式报告。"""


@app.route('/')
def index():
    """渲染主页面"""
    return render_template('index.html')


@app.route('/api/start_consultation', methods=['POST'])
def start_consultation():
    """
    【接口1】开始问诊
    前端传入：患者基本信息、症状、病史等
    后端：创建会话，AI分析信息后提出第1个问题（这是AI的第1轮提问）
    """
    data = request.json or {}
    session_id = str(uuid.uuid4())

    # 提取患者信息
    patient_info = {
        'name': data.get('name', ''),
        'gender': data.get('gender', ''),
        'age': data.get('age', ''),
        'allergies': data.get('allergies', []),
        'medicalHistory': data.get('medicalHistory', []),
        'medications': data.get('medications', ''),
        'smoking': data.get('smoking', ''),
        'drinking': data.get('drinking', ''),
        'symptoms': data.get('symptoms', []),
        'symptomDetail': data.get('symptomDetail', '')
    }

    # 初始化会话
    # 【关键修改】consultation_round 记录AI的问诊轮次（从1开始）
    # patient_info_round 记录患者提供信息的轮次（不算在问诊轮次内）
    session_store[session_id] = {
        'messages': [
            {"role": "system", "content": get_system_prompt()}
        ],
        'consultation_round': 0,  # AI问诊轮次（0=还未开始提问）
        'patient_info_round': 1,  # 患者信息轮次（固定为1，不算问诊）
        'patient_info': patient_info,
        'started_at': datetime.now().isoformat(),
        'is_complete': False,
        'final_report': None
    }

    # 构建患者信息摘要
    patient_summary = f"""
【患者自述信息】（这是患者主动提供的信息，不算你的问诊轮次）

姓名：{patient_info['name']}
性别：{patient_info['gender']}
年龄：{patient_info['age']}
过敏史：{', '.join(patient_info['allergies']) if patient_info['allergies'] else '无'}
既往病史：{', '.join(patient_info['medicalHistory']) if patient_info['medicalHistory'] else '无'}
当前用药：{patient_info['medications']}
吸烟史：{patient_info['smoking']}
饮酒史：{patient_info['drinking']}

主诉症状：{', '.join(patient_info['symptoms']) if patient_info['symptoms'] else '未选择具体症状'}

症状详细描述：
{patient_info['symptomDetail'] or '患者未提供详细描述'}

【你的任务】
请分析以上患者自述信息，开始你的第1轮问诊。
提出1-2个最关键的问题，帮助明确诊断。
只返回你要问的问题（自然、简洁），不要加"第1轮"等前缀。
"""

    # 调用AI生成第1个问题
    ai_response = call_ai([
        {"role": "system", "content": get_system_prompt()},
        {"role": "user", "content": patient_summary}
    ])

    if not ai_response:
        return jsonify({'success': False, 'error': 'AI服务暂时不可用'}), 503

    # 保存到历史
    session_store[session_id]['messages'].append(
        {"role": "user", "content": "患者信息：" + json.dumps(patient_info, ensure_ascii=False)}
    )
    session_store[session_id]['messages'].append(
        {"role": "assistant", "content": ai_response}
    )
    # 【关键】这是AI的第1轮提问
    session_store[session_id]['consultation_round'] = 1

    return jsonify({
        'success': True,
        'message': ai_response,
        'round': 1,  # 返回给前端显示为第1轮
        'isComplete': False,
        'sessionId': session_id
    })


@app.route('/api/consult', methods=['POST'])
def consult():
    """
    【接口2】继续问诊
    前端传入：sessionId, message(用户的回答)
    后端：保存用户回答，AI判断是继续提问（第2-5轮）还是结束问诊返回报告
    """
    data = request.json or {}
    session_id = data.get('sessionId')
    user_message = data.get('message', '')

    if not session_id or session_id not in session_store:
        return jsonify({'success': False, 'error': '会话不存在或已过期'}), 400

    session = session_store[session_id]

    # 如果已经结束了，直接返回报告
    if session['is_complete']:
        return jsonify({
            'success': True,
            'message': '问诊已完成',
            'round': session['consultation_round'],
            'isComplete': True,
            'report': session['final_report'],
            'sessionId': session_id
        })

    # 保存用户回答
    session['messages'].append({"role": "user", "content": user_message})

    # 【关键】增加AI问诊轮次
    current_round = session['consultation_round'] + 1
    session['consultation_round'] = current_round

    # 构建提示，让AI决定是继续提问还是结束
    prompt = f"""
【当前状态】
这是你的第{current_round}轮问诊（最少3轮，最多5轮）。
前面患者已经提供了基本信息和症状描述，那是患者自述，不算你的问诊轮次。

【对话历史（仅AI问诊部分）】
""" + "\n".join([f"{m['role']}: {m['content']}" for m in session['messages'][-10:]]) + f"""

【判断】
请判断当前情况：
1. 如果已经问诊3-5轮，或信息足够做出诊断，或发现危险信号：
   → 输出【诊断完成】标记，然后输出JSON格式诊断报告
   
2. 如果未满3轮，或信息不足需要继续：
   → 继续提出1-2个关键问题（这是你的第{current_round}轮提问）

【当前】第{current_round}/5轮

请直接回复：
- 情况1：先写【诊断完成】，然后换行，输出JSON报告
- 情况2：直接写下一个问题（不要加"第X轮"等前缀，自然提问即可）
"""

    ai_response = call_ai([
        {"role": "system", "content": get_system_prompt()},
        {"role": "user", "content": prompt}
    ])

    if not ai_response:
        return jsonify({'success': False, 'error': 'AI服务暂时不可用'}), 503

    # 保存AI回复
    session['messages'].append({"role": "assistant", "content": ai_response})

    # 检查是否包含诊断完成标记
    if '【诊断完成】' in ai_response or '[诊断完成]' in ai_response:
        # 提取JSON部分
        report = extract_report_from_response(ai_response)

        session['is_complete'] = True
        session['final_report'] = report

        return jsonify({
            'success': True,
            'message': '问诊完成，已生成诊断报告',
            'round': current_round,
            'isComplete': True,
            'report': report,
            'sessionId': session_id
        })

    # 【关键】如果已经超过5轮，强制结束
    if current_round >= 5:
        # 强制生成报告
        force_report = generate_force_report(session)
        session['is_complete'] = True
        session['final_report'] = force_report

        return jsonify({
            'success': True,
            'message': '问诊完成，已生成诊断报告',
            'round': current_round,
            'isComplete': True,
            'report': force_report,
            'sessionId': session_id
        })

    # 继续问诊
    return jsonify({
        'success': True,
        'message': ai_response,
        'round': current_round,
        'isComplete': False,
        'sessionId': session_id
    })


def extract_report_from_response(ai_response):
    """
    从AI响应中提取JSON报告
    """
    try:
        # 找到JSON开始的位置
        json_start = ai_response.find('{')
        json_end = ai_response.rfind('}') + 1

        if json_start == -1 or json_end == 0:
            raise ValueError("未找到JSON")

        json_str = ai_response[json_start:json_end]
        report = json.loads(json_str)

        # 确保所有必要字段存在
        default_report = {
            "mainDiagnosis": "诊断待定",
            "confidence": 0,
            "confidenceReason": "信息不足",
            "severity": "未知",
            "differentialDiagnosis": [],
            "pathology": {
                "mechanism": "暂无法确定",
                "supportingPoints": [],
                "againstPoints": []
            },
            "medications": [],
            "treatment": {
                "nonMedication": [],
                "lifestyle": [],
                "followUp": ["建议尽快就医明确诊断"]
            },
            "warnings": ["AI诊断存在局限性，建议咨询专业医生"],
            "disclaimer": "本报告由AI生成，仅供参考，不能替代专业医生的诊断。"
        }

        # 合并默认值
        for key, value in default_report.items():
            if key not in report:
                report[key] = value

        # 确保子字段存在
        if 'pathology' in report:
            for k, v in default_report['pathology'].items():
                if k not in report['pathology']:
                    report['pathology'][k] = v

        if 'treatment' in report:
            for k, v in default_report['treatment'].items():
                if k not in report['treatment']:
                    report['treatment'][k] = v

        return report

    except Exception as e:
        print(f"提取报告失败: {e}")
        print(f"AI响应: {ai_response}")
        return generate_fallback_report()


def generate_force_report(session):
    """
    强制生成报告（当AI没有正确结束时）
    """
    prompt = """基于以上问诊对话，请立即生成诊断报告。

必须严格按以下JSON格式返回：

{
    "mainDiagnosis": "主要诊断",
    "confidence": 70,
    "confidenceReason": "基于已有信息",
    "severity": "中度",
    "differentialDiagnosis": ["其他可能1", "其他可能2"],
    "pathology": {
        "mechanism": "机制说明",
        "supportingPoints": ["支持点"],
        "againstPoints": ["不支持点"]
    },
    "medications": [{"name": "药品", "usage": "用法", "insurance": "甲类", "contraindication": "禁忌"}],
    "treatment": {
        "nonMedication": ["建议1"],
        "lifestyle": ["建议1"],
        "followUp": ["随访建议"]
    },
    "warnings": ["注意事项"],
    "disclaimer": "本报告由AI生成，仅供参考。"
}

对话历史：
""" + "\n".join([f"{m['role']}: {m['content']}" for m in session['messages']])

    ai_response = call_ai([
        {"role": "system", "content": get_system_prompt()},
        {"role": "user", "content": prompt}
    ], temperature=0.3)

    if ai_response:
        return extract_report_from_response(ai_response)
    else:
        return generate_fallback_report()


def generate_fallback_report():
    """生成默认报告（当所有方法都失败时）"""
    return {
        "mainDiagnosis": "诊断失败",
        "confidence": 0,
        "confidenceReason": "系统无法生成诊断报告，请重新尝试或咨询医生",
        "severity": "未知",
        "differentialDiagnosis": ["无法确定"],
        "pathology": {
            "mechanism": "系统错误",
            "supportingPoints": [],
            "againstPoints": []
        },
        "medications": [],
        "treatment": {
            "nonMedication": ["建议咨询专业医生"],
            "lifestyle": [],
            "followUp": ["尽快就医"]
        },
        "warnings": ["系统异常，请勿依赖此结果"],
        "disclaimer": "系统错误，本报告无效。请重新尝试或咨询专业医生。"
    }


@app.route('/api/reset', methods=['POST'])
def reset_consultation():
    """重置会话"""
    data = request.json or {}
    session_id = data.get('sessionId')

    if session_id and session_id in session_store:
        del session_store[session_id]

    return jsonify({'success': True, 'message': '会话已重置'})


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=80)
# if __name__ == '__main__':
#     # 从环境变量读取debug状态，默认关闭
#     debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
#     app.run(debug=debug_mode, host='0.0.0.0', port=80)
