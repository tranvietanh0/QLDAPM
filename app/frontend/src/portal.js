export const portalMode = window.desktopApp?.mode || (import.meta.env.VITE_PORTAL === 'admin' ? 'admin' : 'intern');
export const isAdminPortal = portalMode === 'admin';
export const portalRole = isAdminPortal ? 'ADMIN' : 'INTERN';
export const tokenKey = 'ims-' + portalMode + '-token';
export const portalTitle = isAdminPortal ? 'InternFlow — Admin / Server' : 'InternFlow — Thực tập sinh';
export const canManage = role => role === 'ADMIN' || role === 'MENTOR';
document.title = portalTitle;
