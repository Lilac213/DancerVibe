import React, { useState } from 'react';
import { Layout, Menu, Select, theme } from 'antd';
import {
  DashboardOutlined,
  WechatOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminSystem from './pages/AdminSystem';
import WechatCrawler from './pages/WechatCrawler';
import ManualUpload from './pages/ManualUpload';
import { useI18n } from './lib/i18n';

const { Header, Content, Footer, Sider } = Layout;

const App: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const { lang, setLang, t } = useI18n();

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider breakpoint="lg" collapsedWidth="0">
          <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
          <Menu
            theme="dark"
            mode="inline"
            defaultSelectedKeys={['admin']}
            items={[
              {
                key: 'admin',
                icon: <SettingOutlined />,
                label: <Link to="/">{t('menu.adminSystem')}</Link>,
              },
              {
                key: 'crawler',
                icon: <WechatOutlined />,
                label: <Link to="/crawler">{t('menu.crawler')}</Link>,
              },
              {
                key: 'upload',
                icon: <DashboardOutlined />,
                label: <Link to="/upload">{t('menu.upload')}</Link>,
              },
            ]}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Select
              value={lang}
              onChange={(v) => setLang(v)}
              options={[
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' }
              ]}
              style={{ width: 120 }}
            />
          </Header>
          <Content style={{ margin: '24px 16px 0' }}>
            <div style={{ padding: 24, minHeight: 360, background: colorBgContainer }}>
              <Routes>
                <Route path="/" element={<AdminSystem />} />
                <Route path="/crawler" element={<WechatCrawler />} />
                <Route path="/upload" element={<ManualUpload />} />
              </Routes>
            </div>
          </Content>
          <Footer style={{ textAlign: 'center' }}>DancerVibe Admin ©2026</Footer>
        </Layout>
      </Layout>
    </Router>
  );
};

export default App;