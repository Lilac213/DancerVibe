// 测试 Gemini API 调用
const BASE_URL = 'https://docs.newapi.pro';
const API_KEY = 'AIzaSyAoiHU0caH3n7a-dwx2Zg66h2cojIEVjEw';

async function testGeminiAPI() {
  console.log('🧪 开始测试 Gemini API...\n');
  
  const url = `${BASE_URL}/v1beta/models/gemini-2.0-flash:generateContent`;
  
  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: '你好，请回复"测试成功"' }]
    }]
  };
  
  try {
    console.log('📡 发送请求到:', url);
    console.log('🔑 使用 API Key:', API_KEY.substring(0, 20) + '...\n');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });
    
    console.log('📊 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 错误响应:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ 响应数据:', JSON.stringify(data, null, 2));
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      console.log('\n✨ AI 回复:', text);
      console.log('\n🎉 测试成功！Gemini API 工作正常');
    } else {
      console.log('\n⚠️ 未找到文本响应');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

testGeminiAPI();
