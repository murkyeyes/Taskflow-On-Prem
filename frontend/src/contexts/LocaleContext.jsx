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
    'Privileges and Space access': 'Đặc quyền và quyền truy cập Không gian', 'Application privilege': 'Đặc quyền ứng dụng', 'Account role': 'Vai trò tài khoản',
    'Overall Admin': 'Quản trị viên tổng', 'Admin': 'Quản trị viên', 'Member': 'Thành viên', 'Admin access': 'Quyền Quản trị viên',
    'Space administrator': 'Quản trị viên Không gian', 'Member access': 'Quyền thành viên', 'Legacy member access': 'Quyền thành viên cũ', 'Viewer access': 'Quyền xem', 'No access': 'Không có quyền truy cập',
    'Provision a login independently from any Space. Access is assigned after creation.': 'Tạo tài khoản đăng nhập độc lập với Không gian. Quyền truy cập được cấp sau khi tạo.',
    'Select an account to manage its privileges and Space permissions.': 'Chọn tài khoản để quản lý đặc quyền và quyền truy cập Không gian.',
    'Choose an existing account to grant or revoke privileges and access.': 'Chọn tài khoản hiện có để cấp hoặc thu hồi đặc quyền và quyền truy cập.',
    'Admins can administer every Space. Only the Overall Admin can change this privilege.': 'Quản trị viên có thể quản lý mọi Không gian. Chỉ Quản trị viên tổng mới có thể thay đổi đặc quyền này.',
    'This is the protected Overall Admin account. Its role cannot be revoked.': 'Đây là tài khoản Quản trị viên tổng được bảo vệ. Không thể thu hồi vai trò này.',
    'This account is an application Admin and has access to every Space. The Overall Admin can revoke this privilege above.': 'Tài khoản này là Quản trị viên ứng dụng và có quyền truy cập mọi Không gian. Quản trị viên tổng có thể thu hồi đặc quyền ở trên.',
    'Administrator access required': 'Yêu cầu quyền Quản trị viên', 'Return home': 'Về trang chủ', 'Select an account': 'Chọn một tài khoản', 'Saving…': 'Đang lưu…',
    'Delete account': 'Xóa tài khoản', 'Deleting this account revokes login and Space access while retaining all historical activity.': 'Xóa tài khoản sẽ thu hồi đăng nhập và quyền truy cập Không gian nhưng vẫn giữ toàn bộ lịch sử hoạt động.',
    'Log in to continue': 'Đăng nhập để tiếp tục', 'Use your Taskflow workspace account': 'Sử dụng tài khoản Taskflow của bạn', 'Email': 'Email', 'Password': 'Mật khẩu', 'Continue': 'Tiếp tục',
    'Need an account? Ask a Space administrator to create one for you.': 'Cần tài khoản? Hãy yêu cầu Quản trị viên Không gian tạo tài khoản cho bạn.',
    'Search': 'Tìm kiếm', 'Search spaces': 'Tìm Không gian', 'Filter by template': 'Lọc theo mẫu', 'Templates': 'Mẫu',
    'Preview a template for your next Space': 'Xem trước mẫu cho Không gian tiếp theo', 'More templates': 'Thêm mẫu',
    'Name': 'Tên', 'Key': 'Khóa', 'Access': 'Quyền truy cập', 'Open Space': 'Mở Không gian', 'No description provided.': 'Chưa có mô tả.',
    'No matching Spaces': 'Không có Không gian phù hợp', 'No Spaces assigned': 'Chưa được giao Không gian',
    'Try another search or template.': 'Hãy thử tìm kiếm hoặc mẫu khác.', 'Ask an Admin to assign you to a Space.': 'Hãy yêu cầu Quản trị viên giao Không gian cho bạn.',
    'Monthly backlogs': 'Danh sách chờ theo tháng', 'All months': 'Tất cả các tháng', 'Complete work history': 'Toàn bộ lịch sử công việc',
    'All months Backlog': 'Danh sách chờ của tất cả các tháng', 'Plan work and review reports by creation month.': 'Lập kế hoạch công việc và xem báo cáo theo tháng tạo.',
    'Monthly Backlog': 'Danh sách chờ theo tháng', 'Choose a month to open its complete report on the Kanban board.': 'Chọn một tháng để mở báo cáo đầy đủ trên bảng Kanban.',
    'Monthly report': 'Báo cáo tháng', 'No monthly reports yet.': 'Chưa có báo cáo theo tháng.',
    'Review reporting tasks by Space, assignee, and calendar day.': 'Xem công việc báo cáo theo Không gian, người được giao và ngày.',
    'Report year': 'Năm báo cáo', 'Report task': 'Công việc báo cáo', 'Report months': 'Các tháng báo cáo',
    'Previous months': 'Các tháng trước', 'Next months': 'Các tháng sau', 'No reports for this month.': 'Không có báo cáo trong tháng này.',
    'Unknown': 'Không xác định', 'Unassigned': 'Chưa giao',
    'Report filters': 'Bộ lọc báo cáo', 'Person': 'Người thực hiện', 'Report day': 'Ngày báo cáo', 'All days': 'Tất cả các ngày',
    'Search person by name': 'Tìm người theo tên', 'No matching people.': 'Không tìm thấy người phù hợp.',
    'Report links': 'Liên kết báo cáo', 'Paste a sharing link to view Excel, Word, or PDF reports online without storing file data in Taskflow.': 'Dán liên kết chia sẻ để xem báo cáo Excel, Word hoặc PDF trực tuyến mà không lưu dữ liệu tệp trong Taskflow.',
    'Document link': 'Liên kết tài liệu', 'Display name': 'Tên hiển thị', 'Add report link': 'Thêm liên kết báo cáo', 'Adding…': 'Đang thêm…',
    'No report links added.': 'Chưa thêm liên kết báo cáo.', 'This task is completed. Only an Admin can add or remove report links.': 'Công việc này đã hoàn tất. Chỉ Quản trị viên mới có thể thêm hoặc xóa liên kết báo cáo.',
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
