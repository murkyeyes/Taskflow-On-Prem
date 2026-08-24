import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import * as settingsApi from '../api/settings.api';
import useAuth from '../hooks/useAuth';

const messages = {
  en: {
    settings: 'Settings', personal: 'Personal', administration: 'Administration',
    general: 'General', notifications: 'Notifications', system: 'System', apps: 'Apps', spaces: 'Spaces', workItems: 'Work items',
    backToTaskflow: '← Back to Taskflow', generalSettings: 'General settings', generalDescription: 'Manage your language, time zone, and account password.',
    regionalPreferences: 'Regional preferences', language: 'Language', timeZone: 'Time zone', savePreferences: 'Save preferences',
    changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password', changePasswordButton: 'Change password',
    generalSaved: 'General settings saved.', notificationSettings: 'Notification settings', notificationDescription: 'Choose how Taskflow notifies your account.',
    emailNotifications: 'Email notifications', emailNotificationsDescription: 'Receive account and work updates by email.',
    inAppNotifications: 'In-app notifications', inAppNotificationsDescription: 'Show updates inside Taskflow.', saveNotifications: 'Save notifications', notificationsSaved: 'Notification settings saved.',
    english: 'English', vietnamese: 'Tiếng Việt', passwordUpdated: 'Password updated.',
  },
  vi: {
    settings: 'Cài đặt', personal: 'Cá nhân', administration: 'Quản trị',
    general: 'Chung', notifications: 'Thông báo', system: 'Hệ thống', apps: 'Ứng dụng', spaces: 'Không gian', workItems: 'Công việc',
    backToTaskflow: '← Quay lại Taskflow', generalSettings: 'Cài đặt chung', generalDescription: 'Quản lý ngôn ngữ, múi giờ và mật khẩu tài khoản.',
    regionalPreferences: 'Tùy chọn khu vực', language: 'Ngôn ngữ', timeZone: 'Múi giờ', savePreferences: 'Lưu tùy chọn',
    changePassword: 'Đổi mật khẩu', currentPassword: 'Mật khẩu hiện tại', newPassword: 'Mật khẩu mới', changePasswordButton: 'Đổi mật khẩu',
    generalSaved: 'Đã lưu cài đặt chung.', notificationSettings: 'Cài đặt thông báo', notificationDescription: 'Chọn cách Taskflow gửi thông báo cho tài khoản của bạn.',
    emailNotifications: 'Thông báo qua email', emailNotificationsDescription: 'Nhận cập nhật tài khoản và công việc qua email.',
    inAppNotifications: 'Thông báo trong ứng dụng', inAppNotificationsDescription: 'Hiển thị cập nhật trong Taskflow.', saveNotifications: 'Lưu thông báo', notificationsSaved: 'Đã lưu cài đặt thông báo.',
    english: 'English', vietnamese: 'Tiếng Việt', passwordUpdated: 'Đã cập nhật mật khẩu.',
  },
};

// UI copy is translated at the document boundary as well as through React's
// shared settings components. This keeps pages that receive labels from the
// API (board columns, status chips, and workspace tabs) in the selected locale.
const documentTranslations = {
  vi: {
    'Loading…': 'Đang tải…', 'Spaces': 'Không gian', 'Space': 'Không gian', 'Choose a Space': 'Chọn một Không gian',
    'Taskflow home': 'Trang chủ Taskflow', 'Open a Space to view its work. Your sidebar always shows the same accessible Spaces.': 'Mở một Không gian để xem công việc. Thanh bên luôn hiển thị các Không gian bạn được truy cập.',
    'Create Space': 'Tạo Không gian', 'Create account': 'Tạo tài khoản', 'Sign out': 'Đăng xuất', 'Personal settings': 'Cài đặt cá nhân',
    'Summary': 'Tổng quan', 'Backlog': 'Danh sách chờ', 'Board': 'Bảng', 'Development': 'Phát triển', 'Timeline': 'Dòng thời gian', 'Docs': 'Tài liệu', 'Forms': 'Biểu mẫu',
    'Space settings': 'Cài đặt Không gian', 'Settings': 'Cài đặt', 'Create issue': 'Tạo công việc', 'Create sprint': 'Tạo sprint', 'Complete sprint': 'Hoàn tất sprint',
    'Filter': 'Bộ lọc', 'Group': 'Nhóm', 'Everyone': 'Mọi người', 'Status': 'Trạng thái', 'Assignee': 'Người được giao', 'Priority': 'Mức độ ưu tiên',
    'All statuses': 'Tất cả trạng thái', 'All priorities': 'Tất cả mức độ ưu tiên', 'Clear filters': 'Xóa bộ lọc', 'Created on': 'Ngày tạo', 'Completed on': 'Ngày hoàn tất',
    'To Do': 'Cần làm', 'In Progress': 'Đang thực hiện', 'In Review': 'Đang duyệt', 'Done': 'Hoàn tất', 'Add column': 'Thêm cột', 'Add workflow status': 'Thêm trạng thái quy trình',
    'Back to board': '← Quay lại bảng', 'Edit issue': 'Chỉnh sửa công việc', 'No description.': 'Không có mô tả.', 'Type': 'Loại', 'Created': 'Đã tạo', 'Completed': 'Đã hoàn tất',
    'This task is completed. Only an Admin can edit its fields or status.': 'Công việc này đã hoàn tất. Chỉ Quản trị viên mới có thể chỉnh sửa trường hoặc trạng thái.',
    'Report files': 'Tệp báo cáo', 'Upload PDF, Word, or Excel reports. Maximum file size: 10 MB.': 'Tải lên báo cáo PDF, Word hoặc Excel. Kích thước tối đa: 10 MB.',
    'No report files uploaded.': 'Chưa có tệp báo cáo.', 'Download': 'Tải xuống', 'Delete': 'Xóa', 'Save': 'Lưu', 'Cancel': 'Hủy', 'Submit response': 'Gửi phản hồi',
    'Project docs': 'Tài liệu Không gian', 'Pages': 'Trang', 'New doc': '＋ Tài liệu mới', 'Save page': 'Lưu trang', 'No pages yet.': 'Chưa có trang nào.',
    'Project forms': 'Biểu mẫu Không gian', 'Responses': 'Phản hồi', 'Active': 'Đang hoạt động', 'Closed': 'Đã đóng', 'No activity yet.': 'Chưa có hoạt động.',
    'Your project at a glance': 'Tổng quan Không gian', 'Live reporting from issues, priorities, workload, and recent workflow activity.': 'Báo cáo trực tiếp về công việc, ưu tiên, khối lượng và hoạt động quy trình gần đây.',
    'Status overview': 'Tổng quan trạng thái', 'A snapshot of your work items.': 'Tổng quan các công việc của bạn.', 'View board': 'Xem bảng', 'Total issues': 'Tổng số công việc',
    'Recent activity': 'Hoạt động gần đây', 'What is happening across the project.': 'Những gì đang diễn ra trong Không gian.', 'Priority breakdown': 'Phân bổ ưu tiên', 'Types of work': 'Loại công việc', 'Team workload': 'Khối lượng nhóm', 'Epic progress': 'Tiến độ Epic',
    'No issues here.': 'Không có công việc ở đây.', 'No development links yet': 'Chưa có liên kết phát triển.', 'Add link': 'Thêm liên kết', 'Remove': 'Gỡ bỏ',
    'Administration': 'Quản trị', 'Accounts and Space access': 'Tài khoản và quyền truy cập Không gian', 'Existing accounts': 'Tài khoản hiện có', 'Space access': 'Quyền truy cập Không gian',
    'Administrator access required': 'Yêu cầu quyền Quản trị viên', 'Return home': 'Về trang chủ', 'Select an account': 'Chọn một tài khoản', 'Saving…': 'Đang lưu…',
    'Log in to continue': 'Đăng nhập để tiếp tục', 'Use your Taskflow workspace account': 'Sử dụng tài khoản Taskflow của bạn', 'Email': 'Email', 'Password': 'Mật khẩu', 'Continue': 'Tiếp tục',
    'Need an account? Ask a Space administrator to create one for you.': 'Cần tài khoản? Hãy yêu cầu Quản trị viên Không gian tạo tài khoản cho bạn.',
  },
};
const reverseDocumentTranslations = Object.fromEntries(Object.entries(documentTranslations.vi).map(([english, vietnamese]) => [vietnamese, english]));

function applyDocumentTranslations(locale) {
  const dictionary = documentTranslations[locale] || {};
  const originalText = applyDocumentTranslations.textNodes || (applyDocumentTranslations.textNodes = new WeakMap());
  const originalAttrs = applyDocumentTranslations.attributes || (applyDocumentTranslations.attributes = new WeakMap());
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const raw = originalText.has(node) ? originalText.get(node) : node.nodeValue;
    const source = reverseDocumentTranslations[raw.trim()] || raw;
    originalText.set(node, source);
    const trimmed = source.trim();
    const translated = dictionary[trimmed] || trimmed;
    const nextValue = source.replace(trimmed, translated);
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  }
  document.querySelectorAll('input,textarea,button,[title],[aria-label]').forEach((element) => {
    const attrs = originalAttrs.get(element) || {};
    ['placeholder', 'title', 'aria-label'].forEach((name) => {
      if (!element.hasAttribute(name)) return;
      if (attrs[name] === undefined) attrs[name] = reverseDocumentTranslations[element.getAttribute(name)] || element.getAttribute(name);
      const nextValue = dictionary[attrs[name]] || attrs[name];
      if (element.getAttribute(name) !== nextValue) element.setAttribute(name, nextValue);
    });
    originalAttrs.set(element, attrs);
  });
}

export const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const { user } = useAuth();
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    let active = true;
    if (!user) { setLocale('en'); document.documentElement.lang = 'en'; return undefined; }
    settingsApi.getPreferences().then(({ preferences }) => {
      if (active && messages[preferences.locale]) setLocale(preferences.locale);
    }).catch(() => { /* SettingsPage reports its own request errors. */ });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    document.documentElement.lang = locale;
    applyDocumentTranslations(locale);
    const observer = new MutationObserver(() => applyDocumentTranslations(locale));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t: (key) => messages[locale]?.[key] ?? messages.en[key] ?? key }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
