/**
 * Sleepee workspace navigation.
 * Keeps implementation routes modular while presenting the agreed consolidated workspaces.
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Database, Factory, Hash, Printer, Sliders, ShieldCheck,
  Users, FileBarChart2, Settings, Globe, ChevronDown, ChevronRight, Layers,
  ClipboardList, Workflow, Headphones, PackageCheck
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';

interface SidebarProps { lang: Language; userRole?: string; }
interface RouteItem { id: string; label: string; path: string; roles: string[]; }
interface Workspace { id: string; label: string; icon: React.ComponentType<any>; defaultPath: string; subRoutes: RouteItem[]; }

const ROLE = {
  admin: 'Administrator', pm: 'Production Manager', po: 'Production Operator',
  print: 'Printing Operator', warranty: 'Warranty Officer', cs: 'Customer Service Agent',
  service: 'Service Manager', read: 'Read Only User'
};

function workspaceForPath(pathname: string): string {
  if (pathname.startsWith('/master-data') || pathname.startsWith('/manufacturing-engineering') || pathname.startsWith('/production') || pathname.startsWith('/serialization') || pathname.startsWith('/printing') || pathname.startsWith('/label-designer')) return 'manufacturing';
  if (pathname.startsWith('/warranty') || pathname.startsWith('/customer-service') || pathname.startsWith('/replacement')) return 'customer-experience';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/admin') || pathname.startsWith('/system')) return 'admin';
  if (pathname.startsWith('/verify')) return 'verify';
  return 'dashboard';
}

export default function Sidebar({ lang, userRole = ROLE.admin }: SidebarProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();
  const currentWorkspace = workspaceForPath(location.pathname);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [currentWorkspace]: true });
  const allOps = [ROLE.admin, ROLE.pm, ROLE.po];
  const customerOps = [ROLE.admin, ROLE.cs, ROLE.service];
  const printOps = [ROLE.admin, ROLE.print, ROLE.pm, ROLE.po];
  const workspaceList: Workspace[] = [
    {
      id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, defaultPath: '/dashboard',
      subRoutes: [{ id: 'dashboard-home', label: lang === 'ar' ? 'لوحة المؤشرات' : 'Overview', path: '/dashboard', roles: [ROLE.admin, ROLE.pm, ROLE.po, ROLE.print, ROLE.warranty, ROLE.cs, ROLE.service] }]
    },
    {
      id: 'manufacturing', label: lang === 'ar' ? 'مركز الإنتاج والتصنيع' : 'Production & Manufacturing', icon: Factory, defaultPath: '/production/planning',
      subRoutes: [
        { id: 'master-data', label: lang === 'ar' ? 'بيانات المنتجات الأساسية' : 'Product Master Data', path: '/master-data/categories', roles: [ROLE.admin, ROLE.pm] },
        { id: 'engineering', label: lang === 'ar' ? 'هندسة المنتج وBOM وRouting' : 'Product Engineering · BOM · Routing', path: '/manufacturing-engineering', roles: [ROLE.admin, ROLE.pm] },
        { id: 'quick-wizard', label: lang === 'ar' ? 'معالج الإنتاج السريع' : 'Quick Production Wizard', path: '/production/wizard', roles: allOps },
        { id: 'planning', label: lang === 'ar' ? 'تخطيط الإنتاج' : 'Production Planning', path: '/production/planning', roles: allOps },
        { id: 'orders', label: lang === 'ar' ? 'أوامر الإنتاج والاعتمادات' : 'Orders & Approvals', path: '/production/orders', roles: allOps },
        { id: 'batches', label: lang === 'ar' ? 'الدفعات ومراقبة التشغيل' : 'Batches & Monitoring', path: '/production/batches', roles: allOps },
        { id: 'serials', label: lang === 'ar' ? 'الأرقام التسلسلية والتتبع' : 'Serials & Traceability', path: '/serialization/search', roles: [ROLE.admin, ROLE.pm, ROLE.po, ROLE.print, ROLE.warranty, ROLE.cs, ROLE.service] },
        { id: 'templates', label: lang === 'ar' ? 'تصميم قوالب الملصقات' : 'Label Designer', path: '/label-designer/templates', roles: printOps },
        { id: 'printing', label: lang === 'ar' ? 'مركز الطباعة' : 'Printing Center', path: '/printing/queue', roles: printOps }
      ]
    },
    {
      id: 'customer-experience', label: lang === 'ar' ? 'مركز الضمان وخدمة العملاء' : 'Warranty & Customer Service', icon: Headphones, defaultPath: '/customer-service/customers',
      subRoutes: [
        { id: 'customers', label: lang === 'ar' ? 'ملف العميل 360' : 'Customer 360', path: '/customer-service/customers', roles: customerOps },
        { id: 'service-cases', label: lang === 'ar' ? 'حالات الخدمة والشكاوى' : 'Service Cases & Complaints', path: '/customer-service/cases', roles: customerOps },
        { id: 'warranty', label: lang === 'ar' ? 'الضمان والتفعيل والتحقق' : 'Warranty & Activations', path: '/warranty/dashboard', roles: [ROLE.admin, ROLE.warranty, ROLE.cs, ROLE.service, ROLE.pm, ROLE.po, ROLE.print, ROLE.read] },
        { id: 'replacements', label: lang === 'ar' ? 'الاستبدال والتعويضات' : 'Replacement & Compensation', path: '/replacement/requests', roles: [ROLE.admin, ROLE.service] }
      ]
    },
    {
      id: 'reports', label: lang === 'ar' ? 'التقارير والتحليلات' : 'Reports & Analytics', icon: FileBarChart2, defaultPath: '/reports/production',
      subRoutes: [{ id: 'reports-all', label: lang === 'ar' ? 'تقارير التشغيل والتحليل' : 'Operational Reports', path: '/reports/production', roles: [ROLE.admin, ROLE.pm, ROLE.service, ROLE.warranty] }]
    },
    {
      id: 'admin', label: t.mod_admin, icon: Settings, defaultPath: '/admin/users',
      subRoutes: [{ id: 'admin-center', label: lang === 'ar' ? 'المستخدمون والصلاحيات والتدقيق' : 'Users, Access & Audit', path: '/admin/users', roles: [ROLE.admin] }, { id: 'db-health', label: lang === 'ar' ? 'حالة قاعدة البيانات' : 'Database Status', path: '/system/database-status', roles: [ROLE.admin] }]
    },
    {
      id: 'verify', label: t.mod_public_portal, icon: Globe, defaultPath: '/verify',
      subRoutes: [{ id: 'verify-public', label: lang === 'ar' ? 'التحقق العام من المنتج والضمان' : 'Public Product Verification', path: '/verify', roles: [ROLE.admin, ROLE.pm, ROLE.po, ROLE.print, ROLE.warranty, ROLE.cs, ROLE.service] }]
    }
  ];

  const visibleWorkspaces = workspaceList
    .map((workspace) => ({ ...workspace, subRoutes: workspace.subRoutes.filter((route) => route.roles.includes(userRole)) }))
    .filter((workspace) => workspace.subRoutes.length > 0);

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none text-slate-300">
      <div className="p-5 border-b border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">S</div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none flex items-center gap-1.5">
              <span>{lang === 'ar' ? 'سـلـيـبـي' : 'Sleepee'}</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono rounded">v1.0</span>
            </h1>
            <span className="text-[10px] text-slate-400 font-medium leading-none block mt-1.5 truncate max-w-[180px]">
              {lang === 'ar' ? 'الشركة العربية لصناعة مراتب السوست والإسفنج' : 'Arabian Spring & Foam Mattresses Mfg. Company LTD'}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {visibleWorkspaces.map((workspace) => {
          const Icon = workspace.icon;
          const active = currentWorkspace === workspace.id;
          const isExpanded = expanded[workspace.id] || active;
          return (
            <div key={workspace.id} className="space-y-0.5">
              <button
                onClick={() => { navigate(workspace.defaultPath); setExpanded((prev) => ({ ...prev, [workspace.id]: !prev[workspace.id] })); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${active ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}
              >
                <div className="flex items-center gap-2.5 truncate"><Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} /><span className="truncate">{workspace.label}</span></div>
                {workspace.subRoutes.length > 0 && <span className="shrink-0 text-slate-300">{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : (lang === 'ar' ? <ChevronRight className="w-3.5 h-3.5 rotate-180" /> : <ChevronRight className="w-3.5 h-3.5" />)}</span>}
              </button>
              {isExpanded && workspace.subRoutes.length > 0 && (
                <div className={`${lang === 'ar' ? 'mr-5 border-r' : 'ml-5 border-l'} border-slate-800/80 pr-2 pl-2 space-y-1 my-1`}>
                  {workspace.subRoutes.map((route) => {
                    const isSubActive = route.path === '/dashboard' ? location.pathname.startsWith('/dashboard') : location.pathname === route.path || location.pathname.startsWith(`${route.path}/`) || (route.id === 'master-data' && location.pathname.startsWith('/master-data')) || (route.id === 'planning' && location.pathname.startsWith('/production/planning')) || (route.id === 'orders' && location.pathname.startsWith('/production/orders')) || (route.id === 'batches' && (location.pathname.startsWith('/production/batches') || location.pathname.startsWith('/production/monitoring')));
                    return (
                      <button key={route.id} onClick={() => navigate(route.path)} className={`w-full px-3 py-2 rounded-lg text-[11px] transition-all flex items-center gap-2 ${isSubActive ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`} style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSubActive ? 'bg-emerald-400' : 'bg-slate-700'}`} /><span className="truncate">{route.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-2 px-2 text-[10px] text-slate-500"><Layers className="w-3.5 h-3.5" /><span>{lang === 'ar' ? 'مراكز تشغيل موحدة · وحدات داخلية مستقلة' : 'Consolidated workspaces · modular internals'}</span></div>
        <div className="px-2 text-[9px] text-slate-600 font-mono">Sleepee · Supabase Workspace</div>
      </div>
    </aside>
  );
}
