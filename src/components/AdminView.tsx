/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  Plus, 
  ShieldCheck, 
  FileText, 
  History, 
  Trash, 
  Database,
  Tag,
  Users,
  ShieldAlert
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  WarrantyPolicy, 
  AuditLog 
} from '../utils/store.ts';
import { adminApi } from '../api/adminApi.ts';

interface AdminViewProps {
  brands: Brand[];
  categories: any[];
  models: ProductModel[];
  policies: WarrantyPolicy[];
  auditLogs: AuditLog[];
  lang: Language;
  onAddBrand: (brand: Brand) => void;
  onAddModel: (model: ProductModel) => void;
  onAddPolicy: (policy: WarrantyPolicy) => void;
  onUpdatePolicy: (id: string, durationYears: number) => void;
  onLogAudit: (action: string, details: string) => void;
}

export default function AdminView({
  brands,
  categories,
  models,
  policies,
  auditLogs,
  lang,
  onAddBrand,
  onAddModel,
  onAddPolicy,
  onUpdatePolicy,
  onLogAudit
}: AdminViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'users';

  // Forms state
  const [newBrandNameAr, setNewBrandNameAr] = useState<string>('');
  const [newBrandNameEn, setNewBrandNameEn] = useState<string>('');
  const [newBrandId, setNewBrandId] = useState<string>('');

  const [newModelName, setNewModelName] = useState<string>('');
  const [newModelCategory, setNewModelCategory] = useState<string>('');
  const [newModelBrandId, setNewModelBrandId] = useState<string>('');

  const [policyTargetType, setPolicyTargetType] = useState<'category' | 'brand' | 'model'>('category');
  const [policyTargetId, setPolicyTargetId] = useState<string>('');
  const [policyDuration, setPolicyDuration] = useState<number>(10);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!policyTargetId && categories[0]?.id) setPolicyTargetId(categories[0].id);
    if (!newModelBrandId && brands[0]?.id) setNewModelBrandId(brands[0].id);
    if (!newModelCategory && categories[0]?.id) setNewModelCategory(categories[0].id);
    if (currentSubTab !== 'users' && currentSubTab !== 'roles') return;
    setUsersLoading(true);
    adminApi.getUsers().then(setAdminUsers).catch(err => console.error('[ADMIN USERS]', err)).finally(() => setUsersLoading(false));
  }, [currentSubTab, categories, brands, policyTargetId, newModelBrandId, newModelCategory]);

  // Egypt warranty durations as per spec (1 to 15 years)
  const allowedDurations = Array.from({ length: 15 }, (_, i) => i + 1);

  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandNameAr.trim() || !newBrandNameEn.trim()) return;

    onAddBrand({
      id: crypto.randomUUID(),
      nameAr: newBrandNameAr.trim(),
      nameEn: newBrandNameEn.trim()
    });

    setNewBrandId('');
    setNewBrandNameAr('');
    setNewBrandNameEn('');
  };

  const handleCreateModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    const newId = crypto.randomUUID();
    onAddModel({
      id: newId,
      brandId: newModelBrandId,
      category: newModelCategory,
      name: newModelName.trim()
    });

    setNewModelName('');
  };

  const handleUpdatePolicy = (policyId: string, duration: number) => {
    onUpdatePolicy(policyId, Number(duration));
  };

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if policy already exists
    const existing = policies.find(p => p.targetType === policyTargetType && p.targetId === policyTargetId);
    if (existing) {
      handleUpdatePolicy(existing.id, policyDuration);
      return;
    }

    const newId = crypto.randomUUID();
    onAddPolicy({
      id: newId,
      targetType: policyTargetType,
      targetId: policyTargetId,
      durationYears: policyDuration
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            {t.adminPanel}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.system_config}</p>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: 'users', label: lang === 'ar' ? 'المستخدمين' : 'Users', icon: Users },
            { id: 'roles', label: lang === 'ar' ? 'الأدوار' : 'Roles', icon: ShieldAlert },
            { id: 'audit', label: lang === 'ar' ? 'التدقيق' : 'Audit', icon: History },
            { id: 'settings', label: lang === 'ar' ? 'الإعدادات' : 'Settings', icon: Settings },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/admin/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentSubTab === st.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <st.icon className="w-3.5 h-3.5" />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Master Data Editor (Left) - Visible on settings/users */}
        {(currentSubTab === 'settings' || currentSubTab === 'users') && (
          <div className="lg:col-span-4 space-y-6">
             {/* ... form content ... */}
          {/* Add Brand */}
          <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>{t.add_brand}</span>
            </h3>

            <form onSubmit={handleCreateBrand} className="space-y-3 text-xs text-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold">الاسم بالعربية *</label>
                <input
                  type="text"
                  required
                  value={newBrandNameAr}
                  onChange={(e) => setNewBrandNameAr(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-2"
                  placeholder="ريبوند ميموري"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold">الاسم بالإنجليزية *</label>
                <input
                  type="text"
                  required
                  value={newBrandNameEn}
                  onChange={(e) => setNewBrandNameEn(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-2"
                  placeholder="Rebound Memory"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة العلامة للماستر</span>
              </button>
            </form>
          </div>

          {/* Add Model */}
          <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>{t.add_model}</span>
            </h3>

            <form onSubmit={handleCreateModel} className="space-y-3 text-xs text-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold">العلامة التابعة *</label>
                <select
                  value={newModelBrandId}
                  onChange={(e) => setNewModelBrandId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-2"
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{lang === 'ar' ? b.nameAr : b.nameEn}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold">الفئة المعتمدة *</label>
                <select
                  value={newModelCategory}
                  onChange={(e) => setNewModelCategory(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-2"
                >
                  {categories.map((c:any) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.name_ar : c.name_en}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold">اسم موديل المنتج المكتوب *</label>
                <input
                  type="text"
                  required
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-2"
                  placeholder="سيلفر توب بلس ٢٨سم"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة الموديل للماستر</span>
              </button>
            </form>
          </div>
        </div>
      )}

        {/* Policies and Audit logs (Right) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Default Policies Settings (Visible on settings) */}
          {currentSubTab === 'settings' && (
            <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                <span>هرمية سياسات الضمان وضوابط التخصيص</span>
              </h3>
              {/* ... policies content ... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {policies.map(p => (
                    <div key={p.id} className="p-3 border border-slate-100 bg-white/50 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-700 block capitalize">
                          {p.targetType === 'category' ? `فئة: ${p.targetId}` : `علامة: ${p.targetId}`}
                        </span>
                        <span className="text-[10px] text-slate-400">تطبيق تلقائي عند إصدار الرقم</span>
                      </div>

                      <div className="flex items-center gap-1 font-mono">
                        <select
                          value={p.durationYears}
                          onChange={(e) => handleUpdatePolicy(p.id, Number(e.target.value))}
                          className="bg-white border border-slate-200 rounded p-1 text-xs"
                        >
                          {allowedDurations.map(y => (
                            <option key={y} value={y}>{y} {lang === 'ar' ? 'سنة' : 'yrs'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add policy form */}
                <form onSubmit={handleCreatePolicy} className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3.5 text-xs text-slate-700">
                  <span className="font-bold text-slate-800 block">تخصيص قاعدة تغطية ضمان بديلة</span>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 font-semibold">مستوى التهيئة</label>
                      <select
                        value={policyTargetType}
                        onChange={(e) => setPolicyTargetType(e.target.value as any)}
                        className="bg-white border border-slate-200 rounded p-1.5 text-xs"
                      >
                        <option value="category">فئة (Category)</option>
                        <option value="brand">علامة (Brand)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 font-semibold">اختر المعرف</label>
                      {policyTargetType === 'category' ? (
                        <select
                          value={policyTargetId}
                          onChange={(e) => setPolicyTargetId(e.target.value)}
                          className="bg-white border border-slate-200 rounded p-1.5 text-xs"
                        >
                          {categories.map((c:any) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.name_ar : c.name_en}</option>)}
                        </select>
                      ) : (
                        <select
                          value={policyTargetId}
                          onChange={(e) => setPolicyTargetId(e.target.value)}
                          className="bg-white border border-slate-200 rounded p-1.5 text-xs"
                        >
                          {brands.map(b => (
                            <option key={b.id} value={b.id}>{b.nameEn}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 font-semibold">فترة سريان الضمان المحددة</label>
                    <select
                      value={policyDuration}
                      onChange={(e) => setPolicyDuration(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded p-1.5 text-xs"
                    >
                      {allowedDurations.map(y => (
                        <option key={y} value={y}>{y} {lang === 'ar' ? 'سنة كاملة' : 'years'}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-center"
                  >
                    حفظ القاعدة البديلة
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Audit Logs Trail (Visible on audit) */}
          {(currentSubTab === 'audit' || currentSubTab === 'settings') && (
            <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <History className="w-4.5 h-4.5 text-emerald-600" />
                <span>{t.audit_trail}</span>
              </h3>
              {/* ... audit table remains ... */}
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-[11px] text-slate-600 text-right">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold">
                      <th className="pb-2">{t.audit_actor}</th>
                      <th className="pb-2">{t.audit_action}</th>
                      <th className="pb-2">{t.audit_details}</th>
                      <th className="pb-2">{t.audit_time}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-mono">
                    {[...auditLogs].reverse().map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2 text-slate-700 font-semibold">{log.actor}</td>
                        <td className="py-2">
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500 font-sans max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-2 text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roles section (Visible on roles) */}
          {(currentSubTab === 'users' || currentSubTab === 'roles') && (
            <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Users className="w-4 h-4 text-emerald-600" />{lang === 'ar' ? 'المستخدمون والأدوار الفعلية' : 'Live Users & Roles'}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Role changes are committed through the administrator RPC and audit trail.</p>
                </div>
                <button onClick={() => adminApi.getUsers().then(setAdminUsers)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">تحديث</button>
              </div>
              {usersLoading ? <div className="py-8 text-center text-xs text-slate-400">جاري تحميل المستخدمين...</div> : (
                <div className="space-y-2">
                  {adminUsers.map((u:any) => (
                    <div key={u.id} className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-center border border-slate-100 rounded-xl p-3 bg-white/70">
                      <div><div className="text-xs font-bold text-slate-800">{u.full_name}</div><div className="text-[10px] text-slate-400 font-mono">{u.email}</div></div>
                      <select value={u.role_name} onChange={async e => { try { await adminApi.setUserRole(u.id, e.target.value); setAdminUsers(prev => prev.map(x => x.id === u.id ? { ...x, role_name: e.target.value } : x)); } catch(err) { console.error('[ADMIN ROLE UPDATE]', err); alert('تعذر حفظ الدور في قاعدة البيانات.'); } }} className="bg-white border border-slate-200 rounded-lg p-2 text-xs">
                        <option value="Unassigned">Unassigned</option>
                        <option value="Administrator">Administrator</option>
                        <option value="Production Manager">Production Manager</option>
                        <option value="Production Operator">Production Operator</option>
                        <option value="Printing Operator">Printing Operator</option>
                        <option value="Warranty Officer">Warranty Officer</option>
                        <option value="Customer Service Agent">Customer Service Agent</option>
                        <option value="Service Manager">Service Manager</option>
                      </select>
                    </div>
                  ))}
                  {!adminUsers.length && <div className="py-8 text-center text-xs text-slate-400">لا يوجد مستخدمون ظاهرون حالياً.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
