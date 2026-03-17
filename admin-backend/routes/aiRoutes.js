const express = require('express');
const router = express.Router();
const axios = require('axios');

const DASH_SCOPE_KEY = process.env.DASH_SCOPE_KEY || 'sk-f9a4a08ce35e4412ade3624e6d3cfa27';

// 1. 获取课程接口 (mock /api/courses)
router.get('/courses', (req, res) => {
    // You could fetch from Supabase here, but we will just return success 
    res.json({ success: true, message: 'Use frontend existing data or connect to supabase.' });
});

// 2. 生成群公告
router.post('/generate_announcement', async (req, res) => {
    try {
        const { scheduleData, teacherName } = req.body;
        
        const systemPrompt = `
你是一个专业的街舞主理人助理。
【群公告生成规则（强制要求）】
当用户要求生成“群公告”、“课表汇总”或类似分享内容时，必须严格遵守以下规则：
1. 不要加过多自己理解的内容，只根据课表中的舞室、地点、时间信息输出老师的课程信息。
2. 格式必须严格遵循：周X XX:XX-XX XX舞室
3. 严禁生成任何情绪词（如“超火”、“爆款”等）。
4. 严禁生成任何推广词。
5. 严禁生成任何额外解释或打招呼的话语。
        `;

        const userPrompt = `请为老师 ${teacherName} 生成本周课表群公告。\n课表数据：\n${JSON.stringify(scheduleData)}`;

        const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            model: 'qwen-plus',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${DASH_SCOPE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, text: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Qwen API error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '生成失败' });
    }
});

// 3. 生成AI海报背景
router.post('/generate_poster', async (req, res) => {
    try {
        const { prompt, size } = req.body; // size e.g. "1:1", "3:4", "9:16"
        
        // Convert ratio to pixels for Wanxiang API
        let width = 1024;
        let height = 1024;
        if (size === '3:4') {
            width = 768;
            height = 1024;
        } else if (size === '9:16') {
            width = 576;
            height = 1024;
        }

        // Call Tongyi Wanxiang API (wanx-v1)
        const response = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
            model: 'wanx-v1',
            input: {
                prompt: prompt || '时尚街舞教室背景，炫酷霓虹灯光，高对比度，适合作为海报背景'
            },
            parameters: {
                style: '<photography>',
                size: `${width}*${height}`,
                n: 1
            }
        }, {
            headers: {
                'Authorization': `Bearer ${DASH_SCOPE_KEY}`,
                'X-DashScope-Async': 'enable',
                'Content-Type': 'application/json'
            }
        });

        const taskId = response.data.output.task_id;
        
        // Wait for task completion (simple polling)
        let resultUrl = '';
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const taskRes = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${DASH_SCOPE_KEY}` }
            });
            if (taskRes.data.output.task_status === 'SUCCEEDED') {
                resultUrl = taskRes.data.output.results[0].url;
                break;
            }
            if (taskRes.data.output.task_status === 'FAILED') {
                throw new Error(taskRes.data.output.message);
            }
        }

        res.json({ success: true, imageUrl: resultUrl });
    } catch (error) {
        console.error('Wanxiang API error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '生成海报背景失败' });
    }
});

module.exports = router;
