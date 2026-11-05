export const portalMode = window.desktopApp?.mode || (import.meta.env.VITE_PORTAL === 'admin' ? 'admin' : 'intern');
export const isAdminPortal = portalMode === 'admin';
// The Admin/Server app serves admins and mentors; the backend filters data per role.
export const portalRoles = isAdminPortal ? ['ADMIN', 'MENTOR'] : ['INTERN'];
export const allowedInPortal = role => portalRoles.includes(role);
export const tokenKey = 'ims-' + portalMode + '-token';
export const portalTitle = isAdminPortal ? 'InternFlow — Admin / Server' : 'InternFlow — Thực tập sinh';
export const canManage = role => role === 'ADMIN' || role === 'MENTOR';
document.title = portalTitle;
