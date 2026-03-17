import { UserRole, ClassSession, User, Tag } from "../types";
import { format } from "date-fns";
import * as newApiClient from "./newApiClient";

// Type definitions (compatible with original SDK)
type Type = {
  STRING: "string";
  INTEGER: "integer";
  NUMBER: "number";
  OBJECT: "object";
  ARRAY: "array";
};

const Type: Type = {
  STRING: "string",
  INTEGER: "integer",
  NUMBER: "number",
  OBJECT: "object",
  ARRAY: "array"
};

type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: any;
};

type Part = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: any };
  functionResponse?: { name: string; response: any };
};

type Content = {
  role: 'user' | 'model';
  parts: Part[];
};

// --- 1. CORE SCHEDULE AGENT PROMPT ---
const SYSTEM_PROMPT_TEMPLATE = `
【角色定义】
你是 DancerVibe 的 AI课表 Agent。
你不是普通聊天助手，而是一个 **长期服务于舞蹈场景的时间与课程智能体**，负责：
- 理解自然语言中的课程信息
- 将其维护为结构化课表
- 回答关于时间、空余、冲突、可行性的询问
- 在关键决策点 **主动为用户多想一步**

【用户角色识别规则】
当前用户角色: {{ROLE}}
当前用户名称: {{NAME}}

根据角色调整你的视角：
1. **老师 (Teacher)**: 关注“我”的排课、冲突、通勤。
2. **学生 (Student)**: 关注“查询老师”、“怎么上课”、“是否有空”。
3. **舞室 (Studio)**: 关注“场地排期”、“哪个教室有空”、“今日全馆课表”。

【核心状态与概念】
你理解“课表”有两种核心状态：
1. **固定课 (Fixed)**: 具有周期性，例如“每周二晚上的课”。
2. **临时课 (Flow)**: 单次发生，例如“2月14日的代课”或“临时加课”。

【能力与工具】
- 如果用户想要修改、添加、删除自己的课程（或舞室管理自己的排期），请调用 \`propose_schedule_update\`。
- 如果用户（特别是学生）询问 **其他老师** 的课表，请调用 \`query_teacher_schedule\`。

【冲突判断规则（强制）】
在以下场景中，你必须进行冲突判断：
- 老师/舞室新增课程
- 代课 / 临时课

冲突判断需考虑：
- 时间重叠（同一个老师不能同时上课；同一个舞室的同一个教室不能同时有课）
- 地点差异（老师跨店赶课需计算通勤）

【回答风格与原则】
- 像一个经验丰富、可靠的舞蹈行业助手
- 结论优先，其次解释
- **不输出内部 JSON 或推理过程**（除非调用工具）

【群公告生成规则（强制要求）】
当用户要求生成“群公告”、“课表汇总”或类似分享内容时，必须严格遵守以下规则：
1. 不要加过多自己理解的内容，只根据课表中的舞室、地点、时间信息输出老师的课程信息。
2. 格式必须严格遵循：周X XX:XX-XX XX舞室
3. 严禁生成任何情绪词（如“超火”、“爆款”等）。
4. 严禁生成任何推广词。
5. 严禁生成任何额外解释或打招呼的话语。

【多想一步（核心要求）】
在不打断用户的前提下，你应主动：
- 提醒潜在风险（如连上三节高强度课）
- 指出明显空档（可加课）
- 在不可行时给出替代方案

当前时间上下文: {{CURRENT_TIME}}
`;

const CLASS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      startTime: { type: Type.STRING, description: "开始时间 HH:mm (24h)" },
      endTime: { type: Type.STRING, description: "结束时间 HH:mm (24h)" },
      studio: { type: Type.STRING, description: "教室/舞室地点" },
      teacher: { type: Type.STRING, description: "老师名字 (如果是老师自己上课请填'我')" },
      song: { type: Type.STRING, description: "舞曲/内容/舞种" },
      dayOfWeek: { type: Type.INTEGER, description: "0=周日, 1=周一, ..., 6=周六. 固定课(Fixed)必填." },
      type: { type: Type.STRING, enum: ["fixed", "flow"], description: "fixed=每周固定课, flow=单次临时课/代课" },
      date: { type: Type.STRING, description: "YYYY-MM-DD (Flow类型必填)" },
      notes: { type: Type.STRING, description: "其他备注" },
      action: { type: Type.STRING, enum: ["add", "remove"], description: "如果是删除操作请标记为remove，默认为add" },
      originalId: { type: Type.STRING, description: "如果是修改或删除，提供原课程ID" }
    }
};

const UPDATE_SCHEDULE_TOOL: FunctionDeclaration = {
    name: "propose_schedule_update",
    description: "Suggest changes to the CURRENT USER'S schedule. Use this when the user confirms a class or implies a schedule change.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            reason: { type: Type.STRING, description: "Short reason for the update" },
            events: {
                type: Type.ARRAY,
                items: CLASS_SCHEMA
            }
        },
        required: ["events"]
    }
};

const QUERY_TEACHER_TOOL: FunctionDeclaration = {
    name: "query_teacher_schedule",
    description: "Search for a specific teacher's schedule. Use this when a student asks about another teacher's availability.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            teacherName: { type: Type.STRING, description: "The name of the teacher to search for." }
        },
        required: ["teacherName"]
    }
};

export type ChatMessage = {
    role: 'user' | 'model';
    text?: string;
    toolCalls?: any[];
    toolResponse?: any;
};

export const chatWithAssistant = async (
    messages: ChatMessage[],
    user: User,
    currentSchedule: ClassSession[]
) => {
    try {
        const history: Content[] = [];
        for (const m of messages) {
            const parts: Part[] = [];
            if (m.text) parts.push({ text: m.text });
            if (m.toolCalls) {
                 m.toolCalls.forEach(tc => {
                     parts.push({ functionCall: { name: tc.name, args: tc.args } });
                 });
            }
            if (m.toolResponse) {
                parts.push({
                    functionResponse: {
                        name: m.toolResponse.name,
                        response: { result: m.toolResponse.result }
                    }
                });
            }
            history.push({
                role: m.role,
                parts: parts
            });
        }

        let roleText = '老师 (Teacher)';
        if (user.role === 'student') roleText = '学生 (Student)';
        if (user.role === 'studio') roleText = '舞室运营 (Studio Admin)';

        let systemPrompt = SYSTEM_PROMPT_TEMPLATE
            .replace('{{ROLE}}', roleText)
            .replace('{{NAME}}', user.name)
            .replace('{{CURRENT_TIME}}', new Date().toLocaleString('zh-CN', { hour12: false }));
        
        systemPrompt += `\n【当前已有数据 (My Schedule)】\n${JSON.stringify(currentSchedule.map(c => ({
            day: c.dayOfWeek,
            time: `${c.startTime}-${c.endTime}`,
            studio: c.studio,
            teacher: c.teacher,
            date: c.date,
            content: c.song
        })), null, 2)}`;

        const response = await newApiClient.generateContent({
            model: "gemini-2.0-flash",
            contents: history,
            config: {
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: [UPDATE_SCHEDULE_TOOL, QUERY_TEACHER_TOOL] }],
                temperature: 0.1
            }
        });

        return {
            text: response.text || "",
            toolCalls: response.functionCalls || []
        };

    } catch (e) {
        console.error("Chat Error", e);
        return { text: "抱歉，网络开小差了，请再说一次。", toolCalls: [] };
    }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string) => {
  try {
    const response = await newApiClient.generateContent({
        model: "gemini-2.0-flash",
        contents: {
            role: 'user',
            parts: [
                { inlineData: { mimeType: mimeType, data: base64Audio } },
                { text: "请将这段语音逐字转录为文字，不要添加任何标点符号以外的解释或修饰。" }
            ]
        }
    });
    return response.text;
  } catch (error) {
    console.error("Transcription error:", error);
    return null;
  }
};

// --- TAGGING AGENT ---
const TAGGING_SYSTEM_PROMPT = `
【你的角色】
你是 DancerVibe 的 **标签生成 AI Agent**。
你的任务是从课程数据中归纳用户画像。

【输出格式】
JSON Array of {category, tag_value, confidence, reason}
`;

export const generateEntityTags = async (user: User, classes: ClassSession[]): Promise<Tag[]> => {
    try {
        if (classes.length === 0) return [];

        const context = `用户角色: ${user.role}\n最近课程: ${JSON.stringify(classes.slice(0, 15).map(c=>c.song))}`;

        const response = await newApiClient.generateContent({
            model: "gemini-2.0-flash",
            contents: {
                role: 'user',
                parts: [{ text: `请生成标签。${context}` }]
            },
            config: {
                systemInstruction: TAGGING_SYSTEM_PROMPT,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING, enum: ["style", "level", "vibe", "skill"] },
                            tag_value: { type: Type.STRING },
                            confidence: { type: Type.NUMBER },
                            reason: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const responseText = response.text;

        if (responseText) {
            const rawTags = JSON.parse(responseText);
            return rawTags.map((t: any) => ({
                entity_type: user.role,
                entity_id: user.name,
                category: t.category,
                tag_value: t.tag_value,
                confidence: t.confidence,
                reason: t.reason
            }));
        }
        return [];
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const parseClassInfo = async (text: string, role: UserRole) => { return []; };

export const generateSummary = async (rawClasses: ClassSession[], user: User, mode: 'week' | 'month', currentDate: Date): Promise<string> => {
    try {
        const timeRange = mode === 'week' ? '本周' : '本月';
        const formattedDate = format(currentDate, 'yyyy年MM月');

        // 1. Calculate Statistics Locally (Ensure Accuracy)
        const teacherStats: Record<string, number> = {};
        const studioStats: Record<string, number> = {};
        const songs: Set<string> = new Set();
        
        rawClasses.forEach(c => {
            const tName = c.teacher || '未知老师';
            const sName = c.studio || '未知舞室';
            teacherStats[tName] = (teacherStats[tName] || 0) + 1;
            studioStats[sName] = (studioStats[sName] || 0) + 1;
            if (c.song) songs.add(c.song);
        });

        // Format stats for prompt
        const topTeachers = Object.entries(teacherStats)
            .sort(([,a], [,b]) => b - a)
            .map(([k,v]) => `${k}(${v}节)`)
            .join(', ');

        const topStudios = Object.entries(studioStats)
            .sort(([,a], [,b]) => b - a)
            .map(([k,v]) => `${k}(${v}次)`)
            .join(', ');

        const distinctLocations = Object.keys(studioStats).length;

        const statsSummary = `
        【客观统计数据 (必须准确引用)】
        - 总课程数: ${rawClasses.length}
        - 上课老师分布: ${topTeachers}
        - 打卡舞室分布: ${topStudios}
        - 去过不同的舞室数量: ${distinctLocations} 个
        `;
        
        // Prepare simplified data for LLM
        const scheduleData = rawClasses.map(c => ({
            day: c.dayOfWeek,
            time: `${c.startTime}-${c.endTime}`,
            studio: c.studio || '未知舞室',
            teacher: c.teacher || '未知老师',
            song: c.song || '基础训练',
            type: c.type
        }));

        let systemPrompt = "";

        if (user.role === 'student') {
            // --- STUDENT PROMPT ---
            systemPrompt = `
            你是一个充满活力的街舞社区运营官，正在为学员 **${user.name}** 生成一份${timeRange}的练舞总结。
            请使用 **Markdown** 格式输出，内容必须包含 Emoji 🧢🔥💃，语气要像个酷酷的舞者朋友。
            
            ${statsSummary}

            **详细课程数据：**
            ${JSON.stringify(scheduleData)}

            **请按照以下结构生成 Markdown 内容 (不要偏离统计数据)：**

            ### Hey ${user.name}! 🧢
            [用一句话热情地评价本周的出勤情况]

            ### 💃 舞者足迹
            *   **上课数量**：本周共冲了 **${rawClasses.length}** 节课！
            *   **常驻基地**：[根据打卡舞室分布数据，列出最常去的舞室]
            *   **集邮成就**：[列出所有上过课的老师]，[如果去过不同的舞室数量大于1，夸奖他/她喜欢探索新环境]

            ### 🎵 剧目与风格
            *   **本周歌单**：[列出所有歌名]
            *   **深度分析**：[请分析数据：是否有**同一首歌**上了**不同老师**的课？如果有，重点夸奖这种"死磕一个编舞"的精神。如果没有，夸奖涉猎广泛。]

            ### 💡 下周建议
            [根据本周的强度，给出一句简短的建议]
            `;
        } else if (user.role === 'teacher') {
            // --- TEACHER PROMPT ---
            systemPrompt = `
            你是一个专业的街舞主理人助理，正在为老师 **${user.name}** 生成一份${timeRange}的教学复盘报告。
            请使用 **Markdown** 格式输出，语气专业但带有一点 Respect 🫡。

            ${statsSummary}

            **详细课程数据：**
            ${JSON.stringify(scheduleData)}

            **请按照以下结构生成 Markdown 内容：**

            ### Respect, ${user.name} 老师! 🫡
            [简短评价本周的教学强度]

            ### 🩰 教学输出复盘
            *   **授课总时长**：本周共执教 **${rawClasses.length}** 节课。
            *   **舞室分布**：${topStudios}

            ### 🎵 编舞与选歌分析 (重点)
            *   **教学内容分布**：请仔细分析数据，列出每个舞室对应的歌名。
                *   例如：在 Millennium 教了 *New Jeans*, 在 En Dance 教了 *Tyla*。
            *   **内容策略**：[分析：如果在所有舞室都教同一首歌，提示"一鱼多吃效率高"；如果在不同舞室教不同歌，夸奖"内容储备丰富，简直是编舞机器"]。

            ### 🌟 备课灵感
            [根据本周教的歌风格，推荐 1-2 首下周可能适合的同类风格热歌或经典曲目，仅作参考]
            `;
        } else {
            systemPrompt = `
            为用户 **${user.name}** 生成一份${timeRange}的舞蹈课表总结。
            ${statsSummary}
            请用 Markdown 格式，列出关键数据（上课数量、地点分布），并给出下周的运营或练习建议。
            `;
        }

        const response = await newApiClient.generateContent({
            model: "gemini-2.0-flash",
            contents: {
                role: 'user',
                parts: [{ text: "开始生成总结" }]
            },
            config: {
                systemInstruction: systemPrompt,
            }
        });

        return response.text || "生成总结失败，请稍后重试。";

    } catch (e) {
        console.error("Summary Generation Error", e);
        return "网络连接不稳定，无法生成总结。";
    }
};
