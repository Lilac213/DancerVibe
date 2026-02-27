import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return new Response(JSON.stringify({ success: false, error: 'No audio file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const host = 'https://identify-cn-north-1.acrcloud.cn/v1/identify';
    const accessKey = 'b7dec7d529aa70616fccfb58aad3435e';
    const accessSecret = 'P1dSHUad2gJcpNaZYj9r85kWeO1PbvXA0T1vino7';
    
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = [
      'POST',
      '/v1/identify',
      accessKey,
      'audio',
      '1',
      timestamp
    ].join('\n');

    const encoder = new TextEncoder();
    const keyData = encoder.encode(accessSecret);
    const msgData = encoder.encode(stringToSign);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, msgData);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    const audioBytes = await audioFile.arrayBuffer();
    const acrFormData = new FormData();
    acrFormData.append('access_key', accessKey);
    acrFormData.append('sample_bytes', audioBytes.byteLength.toString());
    acrFormData.append('sample', new Blob([audioBytes]));
    acrFormData.append('timestamp', timestamp.toString());
    acrFormData.append('signature', signatureBase64);
    acrFormData.append('data_type', 'audio');
    acrFormData.append('signature_version', '1');

    const response = await fetch(host, {
      method: 'POST',
      body: acrFormData,
    });

    const result = await response.json();

    if (result.status.code !== 0 || !result.metadata?.music?.[0]) {
      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const music = result.metadata.music[0];
    
    return new Response(JSON.stringify({
      success: true,
      title: music.title,
      artist: music.artists[0].name,
      album: music.album?.name,
      confidence: music.score,
      acrcloudId: music.acrid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
