import React, { useState, useEffect } from 'react';
import { Layout, Menu, Select, theme, Spin } from 'antd';
import {
  DashboardOutlined,
  UploadOutlined,
  WechatOutlined,
  SettingOutlined,
  TableOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ManualUpload from './pages/ManualUpload';
import WechatCrawler from './pages/WechatCrawler';
import TemplateEditor from './pages/TemplateEditor';
import OcrResults from './pages/OcrResults';
import AdminSystem from './pages/AdminSystem';
import Login from './pages/Login';
import { useI18n } from './lib/i18n';

const { Header, Content, Footer, Sider } = Layout;

// 简单的路由保护组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('adminToken');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const { lang, setLang, t } = useI18n();
  
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/login';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={[window.location.pathname.split('/')[1] || 'dashboard']}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: <Link to="/">{t('menu.dashboard')}</Link>,
            },
            {
              key: 'admin-system',
              icon: <SettingOutlined />,
              label: <Link to="/admin-system">{t('menu.adminSystem')}</Link>,
            },
            {
              key: 'crawler',
              icon: <WechatOutlined />,
              label: <Link to="/crawler">{t('menu.crawler')}</Link>,
            },
            {
              key: 'upload',
              icon: <UploadOutlined />,
              label: <Link to="/upload">{t('menu.upload')}</Link>,
            },
            {
              key: 'templates',
              icon: <SettingOutlined />,
              label: <Link to="/templates">{t('menu.templates')}</Link>,
            },
            {
              key: 'ocr-results',
              icon: <TableOutlined />,
              label: <Link to="/ocr-results">{t('menu.ocrResults')}</Link>,
            },
            {
              type: 'divider',
            },
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: <a onClick={handleLogout}>退出登录</a>,
              danger: true,
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
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>DancerVibe Admin ©2026</Footer>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/admin-system" element={
          <PrivateRoute>
            <AppLayout>
              <AdminSystem />
            </AppLayout>
          </PrivateRoute>
        } />
        
        <Route path="/" element={
          <PrivateRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </PrivateRoute>
        } />
        
        <Route path="/crawler" element={
          <PrivateRoute>
            <AppLayout>
              <WechatCrawler />
            </AppLayout>
          </PrivateRoute>
        } />
        
        <Route path="/upload" element={
          <PrivateRoute>
            <AppLayout>
              <ManualUpload />
            </AppLayout>
          </PrivateRoute>
        } />
        
        <Route path="/templates" element={
          <PrivateRoute>
            <AppLayout>
              <TemplateEditor />
            </AppLayout>
          </PrivateRoute>
        } />
        
        <Route path="/ocr-results" element={
          <PrivateRoute>
            <AppLayout>
              <OcrResults />
            </AppLayout>
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
};

export default App;
