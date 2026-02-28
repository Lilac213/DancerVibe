import os
import json
import requests
from typing import Dict, Optional

class LLMService:
    def __init__(self):
        # 使用 SiliconFlow 或其他兼容 OpenAI 接口的服务
        self.api_key = os.environ.get("LLM_API_KEY", "")
        self.base_url = os.environ.get("LLM_BASE_URL", "https://api.siliconflow.cn/v1")
        self.model = "Qwen/Qwen2.5-14B-Instruct"

    def parse_course_info(self, text: str) -> Optional[Dict]:
        """
        使用 LLM 解析复杂的课程文本
        Input: "Jazz基础 王小明 代课 李华 A教室"
        Output: {
            "course": "Jazz基础",
            "teacher": "王小明",
            "substitute": "李华",
            "room": "A教室",
            "style": "JAZZ"
        }
        """
        if not self.api_key:
            print("Warning: LLM_API_KEY not set, skipping LLM")
            return None

        prompt = f"""
        你是一个专业的舞蹈课表解析助手。请从以下文本中提取课程信息，并以严格的 JSON 格式输出。
        如果无法识别某个字段，请设为 null。不要包含任何 Markdown 标记。
        
        文本: "{text}"
        
        需要提取的字段:
        - course: 课程名称 (如 JAZZ基础, KPOP)
        - teacher: 老师名字 (如 NINA, 王小明)
        - style: 舞种风格 (如 JAZZ, HIPHOP, URBAN, KPOP)
        - level: 难度等级 (数字 1-5, 如果有圆点或星号请统计)
        
        示例输出:
        {{
            "course": "JAZZ基础",
            "teacher": "NINA",
            "style": "JAZZ",
            "level": 2
        }}
        """

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant that parses dance schedule text into JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1, # 低温度以保证确定性
                    "max_tokens": 200
                },
                timeout=5
            )
            
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                # 清洗 Markdown
                content = content.replace("```json", "").replace("```", "").strip()
                return json.loads(content)
            else:
                print(f"LLM Error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"LLM Exception: {e}")
            return None
