import React, { useState } from 'react';
import { Layout, Menu, Select, theme } from 'antd';
import {
  DashboardOutlined,
  UploadOutlined,
  WechatOutlined,
  SettingOutlined,
  TableOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ManualUpload from './pages/ManualUpload';
import WechatCrawler from './pages/WechatCrawler';
import TemplateManager from './pages/TemplateManager';
import OcrResults from './pages/OcrResults';
import AdminSystem from './pages/AdminSystem';
import DictionaryManager from './pages/DictionaryManager';
import AuditWorkbench from './pages/AuditWorkbench';
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
                label: <Link to="/admin-system">{t('menu.adminSystem')}</Link>,
              },
              {
                key: 'audit',
                icon: <CheckCircleOutlined />,
                label: <Link to="/audit">Audit</Link>,
              },
              {
                key: '1',
                icon: <DashboardOutlined />,
                label: <Link to="/">{t('menu.dashboard')}</Link>,
              },
              {
                key: '2',
                icon: <WechatOutlined />,
                label: <Link to="/crawler">{t('menu.crawler')}</Link>,
              },
              {
                key: '3',
                icon: <UploadOutlined />,
                label: <Link to="/upload">{t('menu.upload')}</Link>,
              },
              {
                key: '4',
                icon: <SettingOutlined />,
                label: <Link to="/templates">{t('menu.templates')}</Link>,
              },
              {
                key: '5',
                icon: <TableOutlined />,
                label: <Link to="/ocr-results">{t('menu.ocrResults')}</Link>,
              },
              {
                key: '6',
                icon: <TableOutlined />,
                label: <Link to="/dictionary">Dictionary</Link>,
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
                <Route path="/admin-system" element={<AdminSystem />} />
                <Route path="/audit" element={<AuditWorkbench />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/crawler" element={<WechatCrawler />} />
                <Route path="/upload" element={<ManualUpload />} />
                <Route path="/templates" element={<TemplateManager />} />
                <Route path="/ocr-results" element={<OcrResults />} />
                <Route path="/dictionary" element={<DictionaryManager />} />
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
