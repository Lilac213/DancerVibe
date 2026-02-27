import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 这里调用后端登录接口，或者简单地验证 token
      // 如果后端有专门的登录接口，使用那个接口
      // 如果没有，可以简单地验证 admin token
      
      // 假设我们使用 admin token 进行简单验证
      // 在实际生产环境中，应该有更完善的认证机制
      if (values.token) {
        localStorage.setItem('adminToken', values.token);
        
        // 验证 token 是否有效
        try {
          await axios.get(apiUrl('/api/admin/check-auth'), {
            headers: { 'x-admin-token': values.token }
          });
          message.success('登录成功');
          navigate('/');
        } catch (e) {
          // 如果后端没有 check-auth 接口，尝试访问其他受保护接口
          try {
            await axios.get(apiUrl('/api/configs'), {
              headers: { 'x-admin-token': values.token }
            });
            message.success('登录成功');
            navigate('/');
          } catch (err) {
            message.error('Token 无效');
            localStorage.removeItem('adminToken');
          }
        }
      } else {
        message.error('请输入 Token');
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error('登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f0f2f5',
      backgroundImage: 'url("https://gw.alipayobjects.com/zos/rmsportal/TVYTbAXWheQpRcWDaDMu.svg")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center 110%',
      backgroundSize: '100%',
    }}>
      <Card 
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        bodyStyle={{ padding: '40px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 8 }}>DancerVibe Admin</Title>
          <Text type="secondary">爬虫管理后台</Text>
        </div>
        
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="token"
            rules={[{ required: true, message: '请输入 Admin Token!' }]}
          >
            <Input.Password 
              prefix={<LockOutlined className="site-form-item-icon" />} 
              placeholder="Admin Token" 
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} icon={<LoginOutlined />}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
