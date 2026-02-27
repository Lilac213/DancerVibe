import React, { useEffect, useState } from 'react';
import { Input, Button, List, Card, message, Tag, Select } from 'antd';
import { SearchOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const WechatCrawler: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [configId, setConfigId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const res = await axios.get(apiUrl('/api/configs/options'));
      setConfigs(res.data || []);
    };
    load();
  }, []);

  const handleCrawl = async () => {
    if (!url && !configId) {
      message.warning('Please enter a valid WeChat article URL');
      return;
    }
    
    setLoading(true);
    try {
      const selected = configs.find((c: any) => c.id === configId);
      const payload = {
        url: url || selected?.wechat_url,
        studio: selected?.studio,
        branch: selected?.branch,
        config_id: selected?.id,
        template_name: selected?.template_name
      };
      const res = await axios.post(apiUrl('/api/crawler/crawl'), payload);
      
      if (res.data && res.data.data) {
        message.success('Crawl started successfully!');
        setResults(res.data.data || []); 
      }
    } catch (err) {
      message.error('Failed to start crawler');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>WeChat Article Crawler</h2>
      <Card title="New Task">
        <div style={{ display: 'flex', gap: 10 }}>
          <Select
            placeholder="选择舞室配置"
            style={{ width: 260 }}
            allowClear
            value={configId}
            onChange={setConfigId}
            options={configs.map((c: any) => ({
              value: c.id,
              label: `${c.studio || ''} ${c.branch || ''} ${c.wechat_url || ''}`
            }))}
          />
          <Input 
            placeholder="Paste WeChat article URL here (e.g. https://mp.weixin.qq.com/s/...)" 
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleCrawl} loading={loading}>
            Start Crawl
          </Button>
        </div>
      </Card>

      <Card title="Recent Tasks" style={{ marginTop: 24 }}>
        <List
          itemLayout="horizontal"
          dataSource={results}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                avatar={item.image_path ? <img src={item.image_path} alt="crawl-result" style={{ width: 100, objectFit: 'cover' }} /> : null}
                title={<a href="#">Task #{index + 1}</a>}
                description={
                  <div>
                    <Tag color={item.ocr_status === 'success' ? 'success' : 'error'}>{item.ocr_status}</Tag>
                    <span>{item.image_path || item.error_message || ''}</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {results.length === 0 && !loading && <div style={{ textAlign: 'center', color: '#999' }}>No recent tasks</div>}
      </Card>
    </div>
  );
};

export default WechatCrawler;
