// NewAPI 中转站客户端适配器
// 兼容 Gemini API v1beta 格式

// @ts-ignore - Vite 会在构建时注入这些环境变量
const BASE_URL = process.env.NEWAPI_BASE_URL || 'https://docs.newapi.pro';
// @ts-ignore - Vite 会在构建时注入这些环境变量
const API_KEY = process.env.NEWAPI_API_KEY || '';

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
    const { model, contents, config } = request;
    
    // 格式化 contents
    const formattedContents = Array.isArray(contents) ? contents : [contents];
    
    // 构建请求体
    const body: any = {
      contents: formattedContents
    };
    
    if (config?.systemInstruction) {
      body.systemInstruction = formatSystemInstruction(config.systemInstruction);
    }
    
    if (config?.tools) {
      body.tools = config.tools;
    }
    
    if (config?.responseMimeType) {
      body.generationConfig = {
        responseMimeType: config.responseMimeType
      };
    }
    
    if (config?.responseSchema) {
      body.generationConfig = {
        ...body.generationConfig,
        responseSchema: config.responseSchema
      };
    }
    
    // 调用 NewAPI 中转站
    const url = `${BASE_URL}/v1beta/models/${model}:generateContent`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NewAPI Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // 解析响应
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No candidate in response');
    }
    
    const parts = candidate.content?.parts || [];
    
    // 提取文本
    const textParts = parts.filter((p: Part) => p.text);
    const text = textParts.map((p: Part) => p.text).join('');
    
    // 提取 function calls
    const functionCallParts = parts.filter((p: Part) => p.functionCall);
    const functionCalls = functionCallParts.map((p: Part) => ({
      name: p.functionCall!.name,
      args: p.functionCall!.args
    }));
    
    return {
      text,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined
    };
    
  } catch (error) {
    console.error('NewAPI Client Error:', error);
    throw error;
  }
};

export const models = {
  generateContent
};
