/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Database, 
  Layers, 
  Tag, 
  Box, 
  Maximize2, 
  Plus, 
  Search, 
  CheckCircle, 
  XCircle,
  Building,
  Sliders,
  Filter
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { Brand, ProductModel } from '../utils/store.ts';

interface MasterDataViewProps {
  lang: Language;
  brands: Brand[];
  models: ProductModel[];
  categories: any[];
  productTypes: any[];
  productSizes: string[];
  onAddBrand: (brand: Omit<Brand, 'id'>) => Promise<void>;
  onAddModel: (model: Omit<ProductModel, 'id'>) => Promise<void>;
}

export default function MasterDataView({
  lang,
  brands,
  models,
  categories,
  productTypes,
  productSizes,
  onAddBrand,
  onAddModel
}: MasterDataViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'categories';

  // Local form states
  const [newBrandAr, setNewBrandAr] = useState('');
  const [newBrandEn, setNewBrandEn] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('شاسي سوست');

  const subTabs = [
    { id: 'categories', label: lang === 'ar' ? 'الفئات (Categories)' : 'Categories' },
    { id: 'brands', label: lang === 'ar' ? 'العلامات التجارية (Brands)' : 'Brands' },
    { id: 'models', label: lang === 'ar' ? 'الموديلات (Models)' : 'Models' },
    { id: 'sizes', label: lang === 'ar' ? 'المقاسات (Sizes)' : 'Sizes' },
    { id: 'product-types', label: lang === 'ar' ? 'أنواع المنتجات (Product Types)' : 'Product Types' }
  ];

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandAr || !newBrandEn) return;
    await onAddBrand({
      nameAr: newBrandAr,
      nameEn: newBrandEn,
      name_ar: newBrandAr,
      name_en: newBrandEn,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setNewBrandAr('');
    setNewBrandEn('');
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName || !selectedBrandId) return;
    await onAddModel({
      brandId: selectedBrandId,
      brand_id: selectedBrandId,
      category: selectedCategory,
      category_id: selectedCategory,
      name: newModelName,
      name_ar: newModelName,
      name_en: newModelName,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setNewModelName('');
  };

  return (
    <div className="space-y-6">
      {/* Master Data Seed Warning */}
      {(brands.length === 0 || models.length === 0 || categories.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold">{lang === 'ar' ? 'لم يتم تهيئة البيانات الأساسية' : 'Master Data Not Seeded'}</p>
            <p className="text-xs opacity-80">{lang === 'ar' ? 'يرجى تشغيل ملف seed-master-data.sql لتفعيل النظام.' : 'Please execute seed-master-data.sql to initialize the platform.'}</p>
          </div>
        </div>
      )}

      {/* Module Title Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {t.mod_master_data}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'ar' ? 'المرجع المركزي الموحد للماستر داتا (العلامات، الموديلات، المقاسات)' : 'Single Source of Truth for Master Data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {subTabs.map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/master-data/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentSubTab === st.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* SubTab 1: Categories */}
      {currentSubTab === 'categories' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'فئات المنتجات الرئيسية' : 'Product Categories'}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-slate-400 text-xs">{lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}</div>
            ) : (
              categories.map(c => (
                <div key={c.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{c.name_ar || c.nameAr}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{c.name_en || c.nameEn}</p>
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                    {lang === 'ar' ? 'نشط' : 'Active'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SubTab 2: Brands */}
      {currentSubTab === 'brands' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>{t.add_brand}</span>
            </h3>
            <form onSubmit={handleCreateBrand} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {lang === 'ar' ? 'اسم العلامة (بالعربية)' : 'Brand Name (Arabic)'} *
                </label>
                <input
                  type="text"
                  required
                  value={newBrandAr}
                  onChange={(e) => setNewBrandAr(e.target.value)}
                  placeholder="سليبي / إيمارايتس"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {lang === 'ar' ? 'اسم العلامة (بالإنجليزية)' : 'Brand Name (English)'} *
                </label>
                <input
                  type="text"
                  required
                  value={newBrandEn}
                  onChange={(e) => setNewBrandEn(e.target.value)}
                  placeholder="Sleepee / Emareties"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.add_brand}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {lang === 'ar' ? 'العلامات التجارية المعتمدة بالمصنع' : 'Approved Factory Brands'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {brands.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-slate-400 text-xs">{lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}</div>
              ) : (
                brands.map(b => (
                  <div key={b.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{b.nameAr || b.name_ar}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{b.nameEn || b.name_en}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-md">
                      {b.id.toUpperCase().slice(0, 8)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Models */}
      {currentSubTab === 'models' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-600" />
              <span>{t.add_model}</span>
            </h3>
            <form onSubmit={handleCreateModel} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.brand_label} *
                </label>
                <select
                  required
                  disabled={brands.length === 0}
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-50"
                >
                  <option value="">{brands.length === 0 ? (lang === 'ar' ? 'لا يوجد علامات تجارية' : 'No brands available') : (lang === 'ar' ? 'اختر العلامة...' : 'Select Brand...')}</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.nameAr || b.name_ar}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.category} *
                </label>
                <select
                  required
                  disabled={categories.length === 0}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 disabled:opacity-50"
                >
                  <option value="">{categories.length === 0 ? (lang === 'ar' ? 'لا يوجد فئات' : 'No categories available') : (lang === 'ar' ? 'اختر الفئة...' : 'Select Category...')}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name_en || c.nameEn}>{lang === 'ar' ? (c.name_ar || c.nameAr) : (c.name_en || c.nameEn)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {lang === 'ar' ? 'اسم الموديل' : 'Model Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="ماريوت / كوين / هافانا"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.add_model}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {lang === 'ar' ? 'سجل الموديلات الفني' : 'Master Models Registry'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {models.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-slate-400 text-xs">{lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}</div>
              ) : (
                models.map(m => {
                  const bName = brands.find(b => b.id === m.brandId || b.id === m.brand_id)?.nameAr || 'سليبي';
                  return (
                    <div key={m.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{m.name || m.name_ar}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Brand: {bName} • Category: {m.category || m.category_id}</p>
                      </div>
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded-md text-[10px] font-mono">
                        {m.id.slice(0, 6)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SubTab 4: Sizes */}
      {currentSubTab === 'sizes' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-emerald-600" />
            <span>{t.standard_sizes}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {productSizes.length === 0 ? (
              <div className="col-span-6 py-8 text-center text-slate-400 text-xs">{lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}</div>
            ) : (
              productSizes.map((sz, idx) => (
                <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center">
                  <span className="text-xs font-mono font-bold text-slate-800 block">{sz}</span>
                  <span className="text-[10px] text-slate-400">سم (cm)</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SubTab 5: Product Types */}
      {currentSubTab === 'product-types' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'تصنيفات أنواع الإنتاج والمشاريع' : 'Product Types Classification'}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {productTypes.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-slate-400 text-xs">{lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}</div>
            ) : (
              productTypes.map(pt => (
                <div key={pt.code} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{pt.name_ar}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{pt.name_en}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-mono font-bold">
                    {pt.code}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
