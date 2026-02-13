// Qwen API 客户端适配器
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const API_KEY = 'sk-f9a4a08ce35e4412ade3624e6d3cfa27';

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: any };
  functionResponse?: { name: string; response: any };
}

interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

interface GenerateContentConfig {
  systemInstruction?: string | { parts: Part[] };
  tools?: any[];
  responseMimeType?: string;
  responseSchema?: any;
}

interface GenerateContentRequest {
  model: string;
  contents: Content | Content[];
  config?: GenerateContentConfig;
}

interface GenerateContentResponse {
  text: string;
  functionCalls?: Array<{ name: string; args: any }>;
}

const formatSystemInstruction = (instruction: string | { parts: Part[] } | undefined) => {
  if (!instruction) return undefined;
  if (typeof instruction === 'string') {
    return { parts: [{ text: instruction }] };
  }
  return instruction;
};

export const generateContent = async (
  request: GenerateContentRequest
): Promise<GenerateContentResponse> => {
  try {
    const { contents, config } = request;
    const formattedContents = Array.isArray(contents) ? contents : [contents];
    
    const messages: any[] = [];
    
    if (config?.systemInstruction) {
      const sysInst = formatSystemInstruction(config.systemInstruction);
      messages.push({
        role: 'system',
        content: sysInst.parts.map((p: Part) => p.text).join('')
      });
    }
    
    formattedContents.forEach((content: Content) => {
      const textContent = content.parts.filter(p => p.text).map(p => p.text).join('');
      if (textContent) {
        messages.push({
          role: content.role === 'model' ? 'assistant' : 'user',
          content: textContent
        });
      }
    });
    
    const qwenBody: any = { model: 'qwen-plus', messages };
    
    if (config?.responseMimeType === 'application/json') {
      qwenBody.response_format = { type: 'json_object' };
    }
    
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(qwenBody)
    });
    
    if (!response.ok) {
      throw new Error(`Qwen API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || '', functionCalls: undefined };
    
  } catch (error) {
    console.error('Qwen API Error:', error);
    throw error;
  }
};

export const models = {
  generateContent
};
