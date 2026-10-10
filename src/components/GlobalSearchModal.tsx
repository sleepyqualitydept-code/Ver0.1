/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Hash, 
  User, 
  FileText, 
  ShieldCheck, 
  RefreshCw, 
  ChevronRight,
  Sparkles,
  Phone,
  FileCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';
import { Language } from '../utils/translations.ts';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onNavigate: (tab: string, subTab: string, recordId?: string) => void;
}

interface SearchResult {
  match_type: 'customer' | 'serial' | 'service_case' | 'warranty' | 'order' | 'batch';
  record_id: string;
  display_text: string;
  meta: any;
}

export default function GlobalSearchModal({ isOpen, onClose, lang, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
  }, [isOpen]);

  const handleSearch = async (searchTerm: string) => {
    setQuery(searchTerm);
    if (!searchTerm || searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase.rpc('global_search', { p_query: searchTerm.trim() });
        if (!error && data) {
          setResults(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Global search RPC call warning:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'customer': return <User className="w-4 h-4 text-emerald-600" />;
      case 'serial': return <Hash className="w-4 h-4 text-indigo-600" />;
      case 'service_case': return <FileText className="w-4 h-4 text-amber-600" />;
      case 'warranty': return <ShieldCheck className="w-4 h-4 text-sky-600" />;
      default: return <Search className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleSelectResult = (item: SearchResult) => {
    onClose();
    switch (item.match_type) {
      case 'customer':
        onNavigate('cs', 'customers', item.record_id);
        break;
      case 'serial':
        onNavigate('serialization', 'search', item.display_text);
        break;
      case 'service_case':
        onNavigate('cs', 'cases', item.record_id);
        break;
      case 'warranty':
        onNavigate('warranty', 'search', item.display_text);
        break;
      default:
        onNavigate('dashboard', 'dashboard-home');
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Header Input */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث شامل (سيريال SLP، أمر ORD، دفعة BAT، عميل، هاتف، فاتورة، حالة CS)...' : 'Global Search (Serial SLP, Order ORD, Batch BAT, Customer, Phone, Invoice, Case CS)...'}
            className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400 font-medium"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 text-xs font-bold px-2">
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <div className="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">
              {lang === 'ar' ? 'جاري البحث الفوري في سجلات قاعدة البيانات...' : 'Searching master database records...'}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              {lang === 'ar' ? 'لم يتم العثور على مطابقات في النظام.' : 'No matching master records found.'}
            </div>
          )}

          {!loading && !query && (
            <div className="p-6 text-center text-xs text-slate-400">
              <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <span>{lang === 'ar' ? 'أدخل أي رمز كودي، رقم هاتف، أو اسم للبحث الشامل.' : 'Type any code, phone number, or name to perform unified search.'}</span>
            </div>
          )}

          {!loading && results.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectResult(item)}
              className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between border border-transparent hover:border-slate-200 mb-1"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  {getItemIcon(item.match_type)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-mono">
                    {item.display_text}
                  </h4>
                  <p className="text-[10px] text-slate-500 capitalize">
                    {item.match_type.replace('_', ' ')} {item.meta?.phone ? `• Phone: ${item.meta.phone}` : ''}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>Sleepee Single Source of Truth v1.0</span>
          <span>{results.length} matches found</span>
        </div>
      </div>
    </div>
  );
}
