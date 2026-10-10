/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sliders, 
  Plus, 
  Search, 
  FileText, 
  Layout, 
  Eye, 
  Save, 
  Trash2, 
  Type, 
  QrCode, 
  Barcode, 
  Image as ImageIcon,
  MousePointer2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  History,
  Copy,
  UploadCloud,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Grid,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Hash,
  Box,
  Move,
  Lock,
  Unlock,
  Printer,
  Sparkles,
  Database,
  Tag,
  CheckSquare,
  Square,
  Minus,
  Shapes,
  Maximize,
  Minimize
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  ProductionBatch, 
  Serial,
  ProductionOrder,
  WarrantyPolicy
} from '../utils/store.ts';
import { 
  labelTemplatesApi, 
  LabelTemplate, 
  LabelElement, 
  TemplateStatus,
  DynamicFieldSource,
  getDefaultElements,
  OFFICIAL_SLEEPEE_LOGO_PATH
} from '../api/labelTemplatesApi.ts';
import { BarcodeSVG, QRCodeSVG } from '../utils/barcodeUtils.tsx';
import officialLogoImg from '../assets/images/sleepee_brand_logo_1791210733150.jpg';

interface LabelDesignerViewProps {
  lang: Language;
  categories: any[];
  brands: Brand[];
  models: ProductModel[];
  serials: Serial[];
  batches: ProductionBatch[];
  orders?: ProductionOrder[];
  policies?: WarrantyPolicy[];
  productSizes?: string[];
  productTypes?: any[];
  currentRole?: string;
  onLogAudit?: (action: string, details: string) => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export default function LabelDesignerView({
  lang,
  categories,
  brands,
  models,
  serials,
  batches,
  orders = [],
  policies = [],
  productSizes = [],
  productTypes = [],
  currentRole = 'Administrator',
  onLogAudit
}: LabelDesignerViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'templates';

  // Role Permissions (Strict Phase 08 Architecture: Administrator & Printing Operator only)
  const canEdit = ['Administrator', 'Printing Operator'].includes(currentRole);

  // State
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Canvas Settings
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSizeMm, setGridSizeMm] = useState<number>(1); // 1mm or 5mm
  const [selectedSerialForPreview, setSelectedSerialForPreview] = useState<string>('');

  // Toast / Messages
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [newSize, setNewSize] = useState<'100x50' | '100x80' | '100x100' | 'custom'>('100x100');
  const [customLabelWidth, setCustomLabelWidth] = useState('100');
  const [customLabelHeight, setCustomLabelHeight] = useState('80');

  // History version inspection modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Drag & Drop / Resize Interaction State
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; elX: number; elY: number } | null>(null);
  const isResizingRef = useRef<boolean>(false);
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; elX: number; elY: number; elW: number; elH: number } | null>(null);

  // Sub-tabs
  const subTabs = [
    { id: 'templates', label: lang === 'ar' ? 'مكتبة القوالب (Templates)' : 'Template Library' },
    { id: 'editor', label: lang === 'ar' ? 'محرر التصميم المرئي (Editor)' : 'Visual Editor' },
    { id: 'preview', label: lang === 'ar' ? 'المعاينة والربط الفعلي (Preview)' : 'Live Preview' }
  ];

  // Scale factor: 4 physical screen pixels per millimeter at 100% zoom
  const scaleFactor = 4 * (zoomLevel / 100);

  // Load templates from PostgreSQL
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await labelTemplatesApi.getAll();
      setTemplates(data);
      if (!selectedTemplate && data.length > 0) {
        setSelectedTemplate(data[0]);
      } else if (selectedTemplate) {
        const refreshed = data.find(t => t.id === selectedTemplate.id);
        if (refreshed) setSelectedTemplate(refreshed);
      }
    } catch (err) {
      console.error('[LOAD TEMPLATES ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Initialize selected serial for preview
  useEffect(() => {
    if (!selectedSerialForPreview && serials.length > 0) {
      setSelectedSerialForPreview(serials[0].id);
    }
  }, [serials, selectedSerialForPreview]);

  // Active element in editor
  const activeElement = selectedTemplate?.template_json?.elements?.find(e => e.id === activeElementId) || null;

  // ==========================================================================
  // REAL DATABASE RECORD RESOLVER (Zero Mock/Fake Data — Canonical Data Flow)
  // ==========================================================================
  const resolveDatabaseRecord = useCallback((serialId: string) => {
    const notAvail = 'Not Available';
    const matchedSerial = serialId ? (serials.find(s => s.id === serialId) || null) : null;
    if (!matchedSerial) {
      return {
        serialNumber: notAvail,
        batchNumber: notAvail,
        orderNumber: notAvail,
        brandName: notAvail,
        modelName: notAvail,
        categoryName: notAvail,
        sizeText: notAvail,
        warrantyYears: null as number | null,
        warrantyText: notAvail,
        productionDate: notAvail,
        status: notAvail,
        qrUrl: notAvail
      };
    }

    // 1. Resolve Serial Number & Production Date
    const rawSerial = matchedSerial as any;
    const serialNumber = rawSerial.serial_number || matchedSerial.serialNumber || notAvail;
    const batchId = rawSerial.batch_id || matchedSerial.batchId || rawSerial.production_batches?.id;
    const modelId = rawSerial.model_id || matchedSerial.modelId || rawSerial.models?.id;
    const productionDate = rawSerial.production_date || rawSerial.created_at?.slice(0, 10) || matchedSerial.createdAt?.slice(0, 10) || notAvail;

    // 2. Resolve Batch
    const matchedBatch = batchId ? (batches.find(b => b.id === batchId) || rawSerial.production_batches) : null;
    const rawBatch = matchedBatch as any;
    const batchNumber = rawBatch?.batch_number || matchedBatch?.batchNumber || notAvail;
    const orderId = rawBatch?.production_order_id || matchedBatch?.orderId || rawBatch?.production_orders?.id;

    // 3. Resolve Production Order & Production Order Lines
    const matchedOrder = orderId ? (orders.find(o => o.id === orderId) || rawBatch?.production_orders) : null;
    const rawOrder = matchedOrder as any;
    const orderNumber = rawOrder?.order_number || matchedOrder?.orderNumber || notAvail;
    const orderLines = rawOrder?.production_order_lines || [];
    const matchedLine = modelId ? (orderLines.find((l: any) => l.model_id === modelId) || null) : null;

    // 4. Resolve Model
    const matchedModel = modelId ? (models.find(m => m.id === modelId) || rawSerial.models || matchedLine?.models) : null;
    const modelName = matchedModel?.name_ar || matchedModel?.name_en || matchedModel?.name || notAvail;

    // 5. Resolve Brand
    const brandId = matchedModel?.brand_id || matchedModel?.brandId || matchedLine?.brand_id || rawSerial.models?.brands?.id;
    const matchedBrand = brandId ? (brands.find(b => b.id === brandId) || rawSerial.models?.brands || matchedLine?.brands) : null;
    const brandName = matchedBrand?.name_ar || matchedBrand?.name_en || matchedBrand?.name || notAvail;

    // 6. Resolve Category
    const categoryId = matchedModel?.category_id || matchedLine?.category_id;
    const matchedCategory = categoryId ? (categories.find(c => c.id === categoryId) || rawSerial.models?.categories) : null;
    const categoryName = matchedCategory?.name_ar || matchedCategory?.name_en || notAvail;

    // 7. Resolve Size from Production Order Line / Serial
    let sizeText = notAvail;
    if (matchedLine && matchedLine.width_cm && matchedLine.length_cm) {
      sizeText = `${matchedLine.width_cm}×${matchedLine.length_cm}${matchedLine.height_cm ? `×${matchedLine.height_cm}` : ''} cm`;
    } else if (matchedSerial.size) {
      sizeText = matchedSerial.size;
    }

    // 8. Resolve Warranty Policy strictly from database
    let warrantyYears: number | null = null;
    if (modelId) {
      const modelPolicy = policies.find((p: any) => (p.targetType === 'model' || p.target_type === 'model' || p.level_type === 'model') && (p.targetId === modelId || p.target_id === modelId || p.model_id === modelId));
      if (modelPolicy) warrantyYears = modelPolicy.durationYears || modelPolicy.duration_years || null;
    }
    if (warrantyYears === null && brandId) {
      const brandPolicy = policies.find((p: any) => (p.targetType === 'brand' || p.target_type === 'brand' || p.level_type === 'brand') && (p.targetId === brandId || p.target_id === brandId || p.brand_id === brandId));
      if (brandPolicy) warrantyYears = brandPolicy.durationYears || brandPolicy.duration_years || null;
    }
    if (warrantyYears === null && categoryId) {
      const catPolicy = policies.find((p: any) => (p.targetType === 'category' || p.target_type === 'category' || p.level_type === 'category') && (p.targetId === categoryId || p.target_id === categoryId || p.category_id === categoryId));
      if (catPolicy) warrantyYears = catPolicy.durationYears || catPolicy.duration_years || null;
    }
    if (warrantyYears === null && matchedSerial.warrantyDurationYears) {
      warrantyYears = matchedSerial.warrantyDurationYears;
    }

    const warrantyText = warrantyYears !== null 
      ? (lang === 'ar' ? `ضمان معتمد ${warrantyYears} سنوات` : `${warrantyYears} Years Official Warranty`)
      : notAvail;

    const qrUrl = serialNumber !== notAvail ? `https://sleepee.com/verify?serial=${encodeURIComponent(serialNumber)}` : notAvail;

    return {
      serialNumber,
      batchNumber,
      orderNumber,
      brandName,
      modelName,
      categoryName,
      sizeText,
      warrantyYears,
      warrantyText,
      productionDate,
      status: matchedSerial.status || notAvail,
      qrUrl
    };
  }, [serials, batches, orders, models, brands, categories, policies, lang]);

  const resolvedPreviewData = resolveDatabaseRecord(selectedSerialForPreview);

  // Dynamic value getter for any element
  const getDynamicFieldValue = (mapping?: DynamicFieldSource, staticVal?: string): string => {
    if (!mapping) return staticVal || '';
    switch (mapping) {
      case 'brand':
        return resolvedPreviewData.brandName;
      case 'model':
        return resolvedPreviewData.modelName;
      case 'size':
        return resolvedPreviewData.sizeText;
      case 'warranty':
        return resolvedPreviewData.warrantyText;
      case 'serial':
        return resolvedPreviewData.serialNumber;
      case 'batch':
        return resolvedPreviewData.batchNumber;
      case 'production_date':
        return resolvedPreviewData.productionDate;
      default:
        return staticVal || '';
    }
  };

  // Canvas element property updater
  const updateElementProps = (elementId: string, updates: Partial<LabelElement>) => {
    if (!selectedTemplate) return;
    const currentElements = selectedTemplate.template_json.elements || [];
    const updated = currentElements.map(el => el.id === elementId ? { ...el, ...updates } : el);

    setSelectedTemplate({
      ...selectedTemplate,
      template_json: {
        ...selectedTemplate.template_json,
        elements: updated
      }
    });
  };

  // ==========================================================================
  // REAL DRAG & DROP AND RESIZE IMPLEMENTATION (Millimetric with zoom & bounds)
  // ==========================================================================

  // Snap coordinate helper
  const snapValue = (val: number, step: number) => {
    if (!snapToGrid) return Math.round(val);
    return Math.round(val / step) * step;
  };

  // 1. Element Pointer Down -> Drag Move
  const handleElementPointerDown = (e: React.PointerEvent, element: LabelElement) => {
    if (!canEdit || !selectedTemplate) return;
    e.stopPropagation();
    setActiveElementId(element.id);

    isDraggingRef.current = true;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      elX: element.x,
      elY: element.y
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current || !selectedTemplate) return;
      
      const deltaScreenX = moveEvent.clientX - dragStartRef.current.clientX;
      const deltaScreenY = moveEvent.clientY - dragStartRef.current.clientY;

      const deltaMmX = deltaScreenX / scaleFactor;
      const deltaMmY = deltaScreenY / scaleFactor;

      let newX = dragStartRef.current.elX + deltaMmX;
      let newY = dragStartRef.current.elY + deltaMmY;

      // Snap to grid
      newX = snapValue(newX, gridSizeMm);
      newY = snapValue(newY, gridSizeMm);

      // Clamp within label boundaries
      const maxX = selectedTemplate.label_width - element.width;
      const maxY = selectedTemplate.label_height - element.height;

      newX = Math.max(0, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));

      updateElementProps(element.id, { x: newX, y: newY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // 2. Resize Handle Pointer Down -> Resize Element
  const handleResizePointerDown = (e: React.PointerEvent, handle: ResizeHandle, element: LabelElement) => {
    if (!canEdit || !selectedTemplate) return;
    e.stopPropagation();

    isResizingRef.current = true;
    resizeHandleRef.current = handle;
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      elX: element.x,
      elY: element.y,
      elW: element.width,
      elH: element.height
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current || !resizeStartRef.current || !selectedTemplate) return;

      const deltaScreenX = moveEvent.clientX - resizeStartRef.current.clientX;
      const deltaScreenY = moveEvent.clientY - resizeStartRef.current.clientY;

      const deltaMmX = deltaScreenX / scaleFactor;
      const deltaMmY = deltaScreenY / scaleFactor;

      let { elX, elY, elW, elH } = resizeStartRef.current;
      const canvasW = selectedTemplate.label_width;
      const canvasH = selectedTemplate.label_height;
      const minW = 4;
      const minH = 2;

      if (handle.includes('e')) {
        elW = Math.max(minW, Math.min(canvasW - elX, elW + deltaMmX));
        elW = snapValue(elW, gridSizeMm);
      }
      if (handle.includes('s')) {
        elH = Math.max(minH, Math.min(canvasH - elY, elH + deltaMmY));
        elH = snapValue(elH, gridSizeMm);
      }
      if (handle.includes('w')) {
        const proposedW = elW - deltaMmX;
        if (proposedW >= minW && elX + deltaMmX >= 0) {
          elW = snapValue(proposedW, gridSizeMm);
          elX = snapValue(elX + deltaMmX, gridSizeMm);
        }
      }
      if (handle.includes('n')) {
        const proposedH = elH - deltaMmY;
        if (proposedH >= minH && elY + deltaMmY >= 0) {
          elH = snapValue(proposedH, gridSizeMm);
          elY = snapValue(elY + deltaMmY, gridSizeMm);
        }
      }

      updateElementProps(element.id, {
        x: elX,
        y: elY,
        width: elW,
        height: elH
      });
    };

    const handlePointerUp = () => {
      isResizingRef.current = false;
      resizeHandleRef.current = null;
      resizeStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // 3. HTML5 Drag & Drop from Toolbox to Canvas
  const handleToolboxDragStart = (e: React.DragEvent, type: LabelElement['type'], mapping?: DynamicFieldSource) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, mapping }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !canvasRef.current) return;

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { type, mapping } = JSON.parse(dataStr);

      const rect = canvasRef.current.getBoundingClientRect();
      const dropPixelX = e.clientX - rect.left;
      const dropPixelY = e.clientY - rect.top;

      let dropMmX = snapValue(dropPixelX / scaleFactor, gridSizeMm);
      let dropMmY = snapValue(dropPixelY / scaleFactor, gridSizeMm);

      const defaultW = type === 'barcode' ? 60 : (type === 'qr' ? 22 : (type === 'line' ? 80 : (type === 'logo' ? 45 : 40)));
      const defaultH = type === 'barcode' ? 16 : (type === 'qr' ? 22 : (type === 'line' ? 2 : (type === 'logo' ? 18 : 12)));

      dropMmX = Math.max(0, Math.min(selectedTemplate.label_width - defaultW, dropMmX));
      dropMmY = Math.max(0, Math.min(selectedTemplate.label_height - defaultH, dropMmY));

      const newId = `el-${Date.now().toString(36)}`;
      const newEl: LabelElement = {
        id: newId,
        type,
        name: type === 'barcode' ? 'Barcode (Code128)' : (type === 'qr' ? 'Warranty QR Code' : (type === 'logo' ? 'Official Company Logo' : (type === 'line' ? 'Horizontal Line' : (type === 'rectangle' ? 'Rectangle Box' : `${type.toUpperCase()} Field`)))),
        x: dropMmX,
        y: dropMmY,
        width: defaultW,
        height: defaultH,
        fontSize: 12,
        fontWeight: ['brand', 'model', 'serial'].includes(type) ? 'bold' : 'normal',
        textAlign: 'left',
        visible: true,
        staticValue: type === 'logo' ? OFFICIAL_SLEEPEE_LOGO_PATH : (type === 'text' ? 'Static Label Text' : (type === 'image' ? OFFICIAL_SLEEPEE_LOGO_PATH : undefined)),
        mapping: mapping || (type === 'brand' || type === 'model' || type === 'serial' || type === 'batch' || type === 'date' || type === 'size' || type === 'warranty' ? (type === 'date' ? 'production_date' : type) : undefined)
      };

      setSelectedTemplate({
        ...selectedTemplate,
        template_json: {
          ...selectedTemplate.template_json,
          elements: [...(selectedTemplate.template_json.elements || []), newEl]
        }
      });
      setActiveElementId(newId);
    } catch (err) {
      console.error('[CANVAS DROP ERROR]', err);
    }
  };

  // 4. Keyboard Shortcuts for Precision Nudging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeElement || !selectedTemplate || currentSubTab !== 'editor') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      const step = e.shiftKey ? 5 : 1;
      let newX = activeElement.x;
      let newY = activeElement.y;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        newX = Math.max(0, activeElement.x - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        newX = Math.min(selectedTemplate.label_width - activeElement.width, activeElement.x + step);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newY = Math.max(0, activeElement.y - step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        newY = Math.min(selectedTemplate.label_height - activeElement.height, activeElement.y + step);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleRemoveElement(activeElement.id);
        return;
      } else if (e.key === 'Escape') {
        setActiveElementId(null);
        return;
      }

      if (newX !== activeElement.x || newY !== activeElement.y) {
        updateElementProps(activeElement.id, { x: newX, y: newY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeElement, selectedTemplate, currentSubTab]);

  // Add new element to canvas via button click (FIX 05 - Full Static Toolbox)
  const handleAddElement = (type: LabelElement['type'], mapping?: DynamicFieldSource) => {
    if (!selectedTemplate) return;
    const elements = selectedTemplate.template_json.elements || [];
    const newId = `el-${Date.now().toString(36)}`;

    let defaultW = 40;
    let defaultH = 12;
    let defaultName = `${type.toUpperCase()} Field`;
    let defaultStaticVal: string | undefined = undefined;

    if (type === 'logo') {
      defaultW = 45;
      defaultH = 18;
      defaultName = 'Official Company Logo';
      defaultStaticVal = OFFICIAL_SLEEPEE_LOGO_PATH;
    } else if (type === 'barcode') {
      defaultW = 60;
      defaultH = 16;
      defaultName = 'Barcode (Code128)';
    } else if (type === 'qr') {
      defaultW = 22;
      defaultH = 22;
      defaultName = 'Warranty QR Code';
    } else if (type === 'line') {
      defaultW = 85;
      defaultH = 2;
      defaultName = 'Divider Line';
    } else if (type === 'rectangle') {
      defaultW = 85;
      defaultH = 30;
      defaultName = 'Rectangle Frame';
    } else if (type === 'shape') {
      defaultW = 40;
      defaultH = 20;
      defaultName = 'Container Box';
    } else if (type === 'image') {
      defaultW = 30;
      defaultH = 30;
      defaultName = 'Custom Image';
      defaultStaticVal = OFFICIAL_SLEEPEE_LOGO_PATH;
    } else if (type === 'text') {
      defaultW = 45;
      defaultH = 12;
      defaultName = 'Static Text';
      defaultStaticVal = 'Official Label Text';
    }

    const newEl: LabelElement = {
      id: newId,
      type,
      name: defaultName,
      x: 10,
      y: 10,
      width: defaultW,
      height: defaultH,
      fontSize: 12,
      fontWeight: ['brand', 'model', 'serial'].includes(type) ? 'bold' : 'normal',
      textAlign: 'left',
      visible: true,
      staticValue: defaultStaticVal,
      mapping: mapping || (type === 'brand' || type === 'model' || type === 'serial' || type === 'batch' || type === 'date' || type === 'size' || type === 'warranty' ? (type === 'date' ? 'production_date' : type) : undefined)
    };

    setSelectedTemplate({
      ...selectedTemplate,
      template_json: {
        ...selectedTemplate.template_json,
        elements: [...elements, newEl]
      }
    });
    setActiveElementId(newId);
  };

  // Remove element
  const handleRemoveElement = (elementId: string) => {
    if (!selectedTemplate) return;
    const updated = (selectedTemplate.template_json.elements || []).filter(e => e.id !== elementId);
    setSelectedTemplate({
      ...selectedTemplate,
      template_json: {
        ...selectedTemplate.template_json,
        elements: updated
      }
    });
    if (activeElementId === elementId) setActiveElementId(null);
  };

  // Layer order management
  const handleMoveLayer = (elementId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!selectedTemplate) return;
    const elements = [...(selectedTemplate.template_json.elements || [])];
    const index = elements.findIndex(e => e.id === elementId);
    if (index === -1) return;

    const el = elements[index];
    elements.splice(index, 1);

    if (direction === 'top') {
      elements.push(el);
    } else if (direction === 'bottom') {
      elements.unshift(el);
    } else if (direction === 'up') {
      elements.splice(Math.min(elements.length, index + 1), 0, el);
    } else if (direction === 'down') {
      elements.splice(Math.max(0, index - 1), 0, el);
    }

    setSelectedTemplate({
      ...selectedTemplate,
      template_json: {
        ...selectedTemplate.template_json,
        elements
      }
    });
  };

  // Alignment & Distribution handler (FIX 06 - Layout Tools)
  const handleAlign = (alignment: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => {
    if (!activeElement || !selectedTemplate) return;
    const canvasW = 100;
    const canvasH = selectedTemplate.label_height;

    let newX = activeElement.x;
    let newY = activeElement.y;

    if (alignment === 'left') newX = 5;
    if (alignment === 'right') newX = canvasW - activeElement.width - 5;
    if (alignment === 'center-h') newX = Math.round((canvasW - activeElement.width) / 2);
    if (alignment === 'top') newY = 5;
    if (alignment === 'bottom') newY = canvasH - activeElement.height - 5;
    if (alignment === 'center-v') newY = Math.round((canvasH - activeElement.height) / 2);

    updateElementProps(activeElement.id, { x: newX, y: newY });
  };

  // Distribute Elements Evenly (FIX 06)
  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    if (!selectedTemplate) return;
    const elements = [...(selectedTemplate.template_json.elements || [])];
    if (elements.length < 3) return;

    if (axis === 'horizontal') {
      // Sort by X
      elements.sort((a, b) => a.x - b.x);
      const minX = elements[0].x;
      const last = elements[elements.length - 1];
      const maxX = last.x + last.width;
      const totalElementsWidth = elements.reduce((acc, el) => acc + el.width, 0);
      const availableSpace = maxX - minX - totalElementsWidth;
      const gap = availableSpace / (elements.length - 1);

      let currentX = minX;
      elements.forEach(el => {
        el.x = Math.round(currentX);
        currentX += el.width + gap;
      });
    } else {
      // Sort by Y
      elements.sort((a, b) => a.y - b.y);
      const minY = elements[0].y;
      const last = elements[elements.length - 1];
      const maxY = last.y + last.height;
      const totalElementsHeight = elements.reduce((acc, el) => acc + el.height, 0);
      const availableSpace = maxY - minY - totalElementsHeight;
      const gap = availableSpace / (elements.length - 1);

      let currentY = minY;
      elements.forEach(el => {
        el.y = Math.round(currentY);
        currentY += el.height + gap;
      });
    }

    setSelectedTemplate({
      ...selectedTemplate,
      template_json: {
        ...selectedTemplate.template_json,
        elements
      }
    });
  };

  // Create Template Handler
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!newTemplateName.trim() || !newCategoryId) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال اسم القالب واختيار الفئة المستهدفة' : 'Please provide template name and category.');
      return;
    }
    const labelWidth = newSize === 'custom' ? Number(customLabelWidth) : 100;
    const labelHeight = newSize === '100x50' ? 50 : newSize === '100x80' ? 80 : newSize === '100x100' ? 100 : Number(customLabelHeight);
    if (!Number.isInteger(labelWidth) || !Number.isInteger(labelHeight) || labelWidth <= 0 || labelHeight <= 0) {
      setErrorMsg(lang === 'ar' ? 'أدخل عرضًا وارتفاعًا صحيحين بالمليمتر.' : 'Enter valid integer label width and height in millimeters.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);

    try {
      const created = await labelTemplatesApi.create({
        name: newTemplateName.trim(),
        categoryId: newCategoryId,
        labelWidth,
        labelHeight
      });

      onLogAudit?.('TEMPLATE_CREATED', `Created label template ${created.name} (${created.label_width}x${created.label_height}mm)`);

      setSuccessMsg(lang === 'ar' ? `تم إنشاء القالب (${created.name}) بنجاح بحالة مسودة [DRAFT]!` : `Template created successfully in [DRAFT] status!`);
      setIsNewModalOpen(false);
      setNewTemplateName('');
      setSelectedTemplate(created);
      await loadTemplates();
      navigate('/label-designer/editor');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create template.');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Template Layout Handler
  const handleSaveTemplateLayout = async () => {
    if (!canEdit || !selectedTemplate) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updated = await labelTemplatesApi.update(selectedTemplate.id, {
        elements: selectedTemplate.template_json.elements
      });
      setSelectedTemplate(updated);
      onLogAudit?.('TEMPLATE_UPDATED', `Updated layout of template ${updated.name}`);
      setSuccessMsg(lang === 'ar' ? 'تم حفظ تعديلات تصميم القالب بنجاح في قاعدة البيانات!' : 'Template layout saved to PostgreSQL!');
      await loadTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save template layout.');
    } finally {
      setActionLoading(false);
    }
  };

  // Publish Template Handler
  const handlePublishTemplate = async () => {
    if (!canEdit || !selectedTemplate) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const published = await labelTemplatesApi.publish(selectedTemplate.id, currentRole);
      setSelectedTemplate(published);
      onLogAudit?.('TEMPLATE_PUBLISHED', `Published template ${published.name} (v${published.template_json.version})`);
      setSuccessMsg(lang === 'ar' 
        ? `تم نشر وتفعيل القالب (${published.name}) بالإصدار v${published.template_json.version} بنجاح! أصبح متاحاً الآن لمركز الطباعة.`
        : `Template published successfully (v${published.template_json.version})! Now active for Printing Center.`
      );
      await loadTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish template.');
    } finally {
      setActionLoading(false);
    }
  };

  // Deactivate Template Handler
  const handleDeactivateTemplate = async (templateId: string) => {
    if (!canEdit) return;
    setActionLoading(true);
    try {
      await labelTemplatesApi.deactivate(templateId);
      onLogAudit?.('TEMPLATE_DEACTIVATED', `Deactivated template ${templateId}`);
      setSuccessMsg(lang === 'ar' ? 'تم تعطيل القالب بنجاح وتحويل حالته إلى غير نشط.' : 'Template deactivated successfully.');
      await loadTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to deactivate template.');
    } finally {
      setActionLoading(false);
    }
  };

  // Duplicate Template Handler
  const handleDuplicateTemplate = async (templateId: string) => {
    if (!canEdit) return;
    setActionLoading(true);
    try {
      const dup = await labelTemplatesApi.duplicate(templateId, currentRole);
      onLogAudit?.('TEMPLATE_DUPLICATED', `Duplicated template into ${dup.name}`);
      setSuccessMsg(lang === 'ar' ? `تم استنساخ القالب (${dup.name}) بنجاح كمسودة جديدة!` : `Template duplicated as draft!`);
      setSelectedTemplate(dup);
      await loadTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to duplicate template.');
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Version Handler (FIX 04)
  const handleRestoreVersion = async (targetVersion: string) => {
    if (!canEdit || !selectedTemplate) return;
    setActionLoading(true);
    try {
      const restored = await labelTemplatesApi.restore(selectedTemplate.id, targetVersion, currentRole);
      setSelectedTemplate(restored);
      onLogAudit?.('TEMPLATE_RESTORED', `Restored template ${restored.name} from version ${targetVersion}`);
      setSuccessMsg(lang === 'ar' 
        ? `تم استعادة النسخة (${targetVersion}) بنجاح كإصدار جديد نشط (v${restored.template_json.version})!`
        : `Version ${targetVersion} restored successfully as new active version v${restored.template_json.version}!`
      );
      setIsHistoryModalOpen(false);
      await loadTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore template version.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>{lang === 'ar' ? 'مركز تصميم وتخصيص قوالب الملصقات' : 'Label Designer Center'}</span>
              {selectedTemplate && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  selectedTemplate.template_json?.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  selectedTemplate.template_json?.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {selectedTemplate.template_json?.status} v{selectedTemplate.template_json?.version || '1.0'}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'ar' ? 'المحرر المرئي بالسحب والإفلات لبناء ونشر قوالب الباركود الحرارية لطابعات Zebra ZD220' : 'Visual drag & drop template designer & publisher for Zebra ZD220 thermal labels'}
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-stretch sm:self-auto justify-center overflow-x-auto">
          {subTabs.map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/label-designer/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                currentSubTab === st.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Status Banner Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-900">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 1: TEMPLATES LIBRARY */}
      {/* ==================================================================== */}
      {currentSubTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Layout className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'مكتبة قوالب الطباعة المسجلة في PostgreSQL' : 'Persistent Label Template Library'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' ? 'إدارة وإصدارات قوالب التصميم المعتمدة لكل فئة ومقاس حراري (قاعدة: قالب منشور واحد نشط لكل فئة ومقاس)' : 'Manage published and draft templates per category and label size'}
              </p>
            </div>

            {canEdit && (
              <button
                onClick={() => {
                  setIsNewModalOpen(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'قالب جديد' : 'New Template'}</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {lang === 'ar' ? 'جاري تحميل القوالب من قاعدة البيانات...' : 'Loading templates from PostgreSQL...'}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Layout className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'لا توجد قوالب طباعة مسجلة حالياً في قاعدة البيانات' : 'No label templates found in database.'}
                </p>
                {canEdit && (
                  <button
                    onClick={() => setIsNewModalOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100"
                  >
                    {lang === 'ar' ? 'إنشاء أول قالب للطباعة' : 'Create First Template'}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">{lang === 'ar' ? 'اسم القالب' : 'Template Name'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الفئة' : 'Category'}</th>
                      <th className="p-3">{lang === 'ar' ? 'المقاس' : 'Size'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الإصدار' : 'Version'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="p-3">{lang === 'ar' ? 'تاريخ التحديث' : 'Updated Date'}</th>
                      <th className="p-3 text-center">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {templates.map(tmpl => {
                      const isPub = tmpl.template_json?.status === 'published';
                      const isDrf = tmpl.template_json?.status === 'draft';

                      return (
                        <tr key={tmpl.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {tmpl.name}
                          </td>
                          <td className="p-3 font-medium text-slate-600 dark:text-slate-300">
                            {tmpl.categories?.name_ar || tmpl.categories?.name_en || (lang === 'ar' ? 'مراتب وسوست' : 'Mattresses')}
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-600">
                            {tmpl.label_width}×{tmpl.label_height} mm
                          </td>
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                            v{tmpl.template_json?.version || '1.0'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              isPub ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              isDrf ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {tmpl.template_json?.status || (tmpl.is_active ? 'published' : 'inactive')}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-400 text-[10px]">
                            {new Date(tmpl.updated_at || tmpl.created_at || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-center space-x-1.5 space-x-reverse">
                            <button
                              onClick={() => {
                                setSelectedTemplate(tmpl);
                                navigate('/label-designer/editor');
                              }}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedTemplate(tmpl);
                                navigate('/label-designer/preview');
                              }}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
                            </button>

                            {canEdit && isDrf && (
                              <button
                                onClick={async () => {
                                  setSelectedTemplate(tmpl);
                                  await handlePublishTemplate();
                                }}
                                disabled={actionLoading}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <UploadCloud className="w-3 h-3" />
                                <span>{lang === 'ar' ? 'نشر' : 'Publish'}</span>
                              </button>
                            )}

                            {canEdit && isPub && (
                              <button
                                onClick={() => handleDeactivateTemplate(tmpl.id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                              >
                                {lang === 'ar' ? 'تعطيل' : 'Deactivate'}
                              </button>
                            )}

                            {canEdit && (
                              <button
                                onClick={() => handleDuplicateTemplate(tmpl.id)}
                                disabled={actionLoading}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                                title="Duplicate template"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 2: VISUAL DRAG & DROP TEMPLATE EDITOR */}
      {/* ==================================================================== */}
      {currentSubTab === 'editor' && (
        <div className="space-y-4">
          {/* Editor Top Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const t = templates.find(item => item.id === e.target.value);
                  if (t) setSelectedTemplate(t);
                }}
                className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.label_width}×{t.label_height}mm) [v{t.template_json?.version}]
                  </option>
                ))}
              </select>

              {selectedTemplate && (
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg">
                  Canvas: {selectedTemplate.label_width}×{selectedTemplate.label_height} mm
                </span>
              )}
            </div>

            {/* Alignment & Distribution Tools (FIX 06) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => handleAlign('left')} 
                disabled={!activeElement}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-600 dark:text-slate-300" 
                title="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleAlign('center-h')} 
                disabled={!activeElement}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-600 dark:text-slate-300" 
                title="Center Horizontally"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleAlign('right')} 
                disabled={!activeElement}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-600 dark:text-slate-300" 
                title="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
              <button 
                onClick={() => handleAlign('top')} 
                disabled={!activeElement}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-600 dark:text-slate-300" 
                title="Align Top"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleAlign('center-v')} 
                disabled={!activeElement}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-600 dark:text-slate-300" 
                title="Center Vertically"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleAlign('bottom')} 
                disabled={!activeElement}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-600 dark:text-slate-300" 
                title="Align Bottom"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
              {/* Distribution tools */}
              <button
                onClick={() => handleDistribute('horizontal')}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-[10px] font-bold"
                title="Distribute Horizontally"
              >
                Distribute ↔
              </button>
              <button
                onClick={() => handleDistribute('vertical')}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-[10px] font-bold"
                title="Distribute Vertically"
              >
                Distribute ↕
              </button>
            </div>

            {/* Canvas Zoom & Grid */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                  snapToGrid ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
                title="Toggle Snap to Grid"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Snap {gridSizeMm}mm</span>
              </button>

              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                  showGrid ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
                title="Toggle Background Grid"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 w-12 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Save & Publish Buttons */}
            {canEdit && selectedTemplate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{lang === 'ar' ? 'سجل الإصدارات' : 'History'}</span>
                </button>

                <button
                  onClick={handleSaveTemplateLayout}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'حفظ التعديلات' : 'Save Layout'}</span>
                </button>

                <button
                  onClick={handlePublishTemplate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'نشر واعتماد القالب' : 'Publish Template'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Editor Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Real Static & Dynamic Toolbox (FIX 05) */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {lang === 'ar' ? 'عناصر التصميم (Toolbox)' : 'Element Toolbox'}
                </h4>
                <span className="text-[10px] text-indigo-600 font-semibold">Drag or Click</span>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase">{lang === 'ar' ? 'عناصر ثابتة ورسومية' : 'Static & Graphic Elements'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Official Logo */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleToolboxDragStart(e, 'logo')}
                    onClick={() => handleAddElement('logo')}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-grab active:cursor-grabbing select-none"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Official Logo</span>
                  </div>

                  {/* Static Text */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleToolboxDragStart(e, 'text')}
                    onClick={() => handleAddElement('text')}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-grab active:cursor-grabbing select-none"
                  >
                    <Type className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Static Text</span>
                  </div>

                  {/* Shapes */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleToolboxDragStart(e, 'shape')}
                    onClick={() => handleAddElement('shape')}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-grab active:cursor-grabbing select-none"
                  >
                    <Shapes className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Shape Box</span>
                  </div>

                  {/* Lines */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleToolboxDragStart(e, 'line')}
                    onClick={() => handleAddElement('line')}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-grab active:cursor-grabbing select-none"
                  >
                    <Minus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Divider Line</span>
                  </div>

                  {/* Rectangles */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleToolboxDragStart(e, 'rectangle')}
                    onClick={() => handleAddElement('rectangle')}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-grab active:cursor-grabbing select-none"
                  >
                    <Square className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rectangle</span>
                  </div>

                  {/* Images */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleToolboxDragStart(e, 'image')}
                    onClick={() => handleAddElement('image')}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-grab active:cursor-grabbing select-none"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Custom Image</span>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-400 uppercase pt-2">{lang === 'ar' ? 'حقول ديناميكية مرتبطة بقاعدة البيانات' : 'Dynamic Database Fields'}</p>
                <div className="space-y-1.5">
                  {[
                    { type: 'brand', label: 'Brand Name', icon: Box, mapping: 'brand' },
                    { type: 'model', label: 'Product Model', icon: Box, mapping: 'model' },
                    { type: 'size', label: 'Product Dimensions', icon: Box, mapping: 'size' },
                    { type: 'warranty', label: 'Warranty Policy', icon: ShieldCheck, mapping: 'warranty' },
                    { type: 'serial', label: 'Serial Number', icon: Hash, mapping: 'serial' },
                    { type: 'batch', label: 'Batch Number', icon: Hash, mapping: 'batch' },
                    { type: 'date', label: 'Production Date', icon: Calendar, mapping: 'production_date' },
                    { type: 'barcode', label: 'Barcode (Code128)', icon: Barcode, mapping: 'serial' },
                    { type: 'qr', label: 'Warranty QR Code', icon: QrCode, mapping: 'serial' }
                  ].map((field: any) => {
                    const IconComponent = field.icon;
                    return (
                      <div
                        key={field.type}
                        draggable={true}
                        onDragStart={(e) => handleToolboxDragStart(e, field.type, field.mapping)}
                        onClick={() => handleAddElement(field.type, field.mapping)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-between transition-colors cursor-grab active:cursor-grabbing select-none"
                      >
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{field.label}</span>
                        </div>
                        <Plus className="w-3 h-3 text-slate-400" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Layer Ordering Panel */}
              {selectedTemplate && selectedTemplate.template_json?.elements?.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Canvas Layers</span>
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {selectedTemplate.template_json.elements.slice().reverse().map((el) => (
                      <div
                        key={el.id}
                        onClick={() => setActiveElementId(el.id)}
                        className={`p-1.5 rounded-lg text-[11px] flex items-center justify-between cursor-pointer ${
                          el.id === activeElementId
                            ? 'bg-indigo-100 text-indigo-900 font-bold dark:bg-indigo-950 dark:text-indigo-200'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{el.name}</span>
                        {el.id === activeElementId && (
                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleMoveLayer(el.id, 'up')} className="p-0.5 hover:text-indigo-600" title="Move Up">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleMoveLayer(el.id, 'down')} className="p-0.5 hover:text-indigo-600" title="Move Down">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Center Column: Visual Drag & Drop Canvas */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[520px] overflow-auto">
              {selectedTemplate ? (
                <div className="flex flex-col items-center select-none">
                  {/* Top Millimeter Ruler */}
                  <div 
                    className="h-5 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-end justify-between px-1 text-[8px] font-mono text-slate-500 rounded-t-sm"
                    style={{ width: `${selectedTemplate.label_width * scaleFactor}px` }}
                  >
                    <span>0mm</span>
                    <span>25mm</span>
                    <span>50mm</span>
                    <span>75mm</span>
                    <span>100mm</span>
                  </div>

                  <div className="flex">
                    {/* Left Millimeter Ruler */}
                    <div 
                      className="w-5 bg-slate-200 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 flex flex-col justify-between py-1 text-[8px] font-mono text-slate-500 rounded-l-sm text-center"
                      style={{ height: `${selectedTemplate.label_height * scaleFactor}px` }}
                    >
                      <span>0</span>
                      {selectedTemplate.label_height === 100 && <span>50</span>}
                      <span>{selectedTemplate.label_height}</span>
                    </div>

                    {/* Visual Canvas */}
                    <div 
                      ref={canvasRef}
                      onDragOver={handleCanvasDragOver}
                      onDrop={handleCanvasDrop}
                      className={`relative bg-white shadow-2xl rounded-sm border-2 border-slate-800 dark:border-slate-600 select-none overflow-hidden ${
                        showGrid ? 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]' : ''
                      }`}
                      style={{
                        width: `${selectedTemplate.label_width * scaleFactor}px`,
                        height: `${selectedTemplate.label_height * scaleFactor}px`,
                        transformOrigin: 'top center'
                      }}
                      onClick={() => setActiveElementId(null)}
                    >
                      {/* Canvas Elements Rendering */}
                      {selectedTemplate.template_json?.elements?.map(el => {
                        const isSelected = el.id === activeElementId;

                        return (
                          <div
                            key={el.id}
                            onPointerDown={(e) => handleElementPointerDown(e, el)}
                            style={{
                              left: `${el.x * scaleFactor}px`,
                              top: `${el.y * scaleFactor}px`,
                              width: `${el.width * scaleFactor}px`,
                              height: `${el.height * scaleFactor}px`,
                              position: 'absolute'
                            }}
                            className={`p-1 rounded-sm flex items-center justify-center overflow-hidden border select-none ${
                              isSelected 
                                ? 'border-indigo-600 ring-2 ring-indigo-500/50 bg-indigo-50/20 z-30 cursor-move' 
                                : 'border-dashed border-slate-300 hover:border-slate-500 z-10 cursor-pointer'
                            }`}
                          >
                            {/* Official Logo Rendering (FIX 07) */}
                            {el.type === 'logo' && (
                              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                <img 
                                  src={officialLogoImg} 
                                  alt="Sleepee Official Logo" 
                                  className="w-full h-full object-contain pointer-events-none select-none"
                                />
                              </div>
                            )}

                            {/* Image Rendering */}
                            {el.type === 'image' && (
                              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                <img 
                                  src={el.staticValue || officialLogoImg} 
                                  alt="Image" 
                                  className="w-full h-full object-contain pointer-events-none select-none"
                                />
                              </div>
                            )}

                            {/* Line Rendering */}
                            {el.type === 'line' && (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-full h-0.5 bg-slate-900" />
                              </div>
                            )}

                            {/* Rectangle / Shape Rendering */}
                            {(el.type === 'rectangle' || el.type === 'shape') && (
                              <div className={`w-full h-full border-2 border-slate-900 ${el.type === 'shape' ? 'rounded-lg bg-slate-50/30' : 'bg-transparent'}`} />
                            )}

                            {/* QR Code */}
                            {el.type === 'qr' && (
                              <div className="w-full h-full flex flex-col items-center justify-center p-0.5">
                                <QRCodeSVG value={resolvedPreviewData.qrUrl !== 'Not Available' ? resolvedPreviewData.qrUrl : 'https://sleepee.com/verify'} size={Math.min(el.width, el.height) * scaleFactor - 8} />
                              </div>
                            )}

                            {/* Barcode */}
                            {el.type === 'barcode' && (
                              <div className="w-full h-full flex flex-col items-center justify-center p-0.5">
                                <BarcodeSVG value={resolvedPreviewData.serialNumber !== 'Not Available' ? resolvedPreviewData.serialNumber : 'SLP-PREVIEW'} height={el.height * scaleFactor - 12} />
                              </div>
                            )}

                            {/* Text & Dynamic Fields */}
                            {!['logo', 'image', 'line', 'rectangle', 'shape', 'qr', 'barcode'].includes(el.type) && (
                              <div 
                                style={{
                                  fontSize: `${(el.fontSize || 12) * (zoomLevel / 100)}px`,
                                  fontWeight: el.fontWeight || 'normal',
                                  textAlign: el.textAlign || 'left'
                                }}
                                className="w-full truncate text-slate-900 font-sans select-none"
                              >
                                {el.mapping ? getDynamicFieldValue(el.mapping, el.name) : (el.staticValue || el.name)}
                              </div>
                            )}

                            {/* Active Selection Bounding Box & 8 Resize Handles */}
                            {isSelected && canEdit && (
                              <>
                                {/* Coordinates Overlay Badge */}
                                <div className="absolute -top-5 left-0 bg-indigo-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap z-40">
                                  X:{el.x} Y:{el.y} W:{el.width} H:{el.height} mm
                                </div>

                                {/* Top-Left */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'nw', el)} 
                                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize z-40" 
                                />
                                {/* Top-Center */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'n', el)} 
                                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ns-resize z-40" 
                                />
                                {/* Top-Right */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'ne', el)} 
                                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize z-40" 
                                />
                                {/* Middle-Right */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'e', el)} 
                                  className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ew-resize z-40" 
                                />
                                {/* Bottom-Right */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'se', el)} 
                                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize z-40" 
                                />
                                {/* Bottom-Center */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 's', el)} 
                                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ns-resize z-40" 
                                />
                                {/* Bottom-Left */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'sw', el)} 
                                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize z-40" 
                                />
                                {/* Middle-Left */}
                                <div 
                                  onPointerDown={(e) => handleResizePointerDown(e, 'w', el)} 
                                  className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ew-resize z-40" 
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs">
                  {lang === 'ar' ? 'اختر قالباً لبدء التعديل' : 'Select a template to start designing.'}
                </div>
              )}
            </div>

            {/* Right Column: Properties Panel */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b pb-2">
                {lang === 'ar' ? 'خصائص العنصر المحدد (Properties)' : 'Element Properties'}
              </h4>

              {activeElement ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Field Label Name</label>
                    <input
                      type="text"
                      value={activeElement.name}
                      onChange={(e) => updateElementProps(activeElement.id, { name: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">X Position (mm)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={activeElement.x}
                        onChange={(e) => updateElementProps(activeElement.id, { x: Number(e.target.value) || 0 })}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Y Position (mm)</label>
                      <input
                        type="number"
                        min={0}
                        max={selectedTemplate?.label_height || 100}
                        value={activeElement.y}
                        onChange={(e) => updateElementProps(activeElement.id, { y: Number(e.target.value) || 0 })}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Width (mm)</label>
                      <input
                        type="number"
                        min={4}
                        max={100}
                        value={activeElement.width}
                        onChange={(e) => updateElementProps(activeElement.id, { width: Number(e.target.value) || 10 })}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Height (mm)</label>
                      <input
                        type="number"
                        min={2}
                        max={selectedTemplate?.label_height || 100}
                        value={activeElement.height}
                        onChange={(e) => updateElementProps(activeElement.id, { height: Number(e.target.value) || 10 })}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  {!['qr', 'barcode', 'logo', 'line', 'rectangle', 'shape', 'image'].includes(activeElement.type) && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Font Size (pt)</label>
                          <input
                            type="number"
                            min={8}
                            max={32}
                            value={activeElement.fontSize || 12}
                            onChange={(e) => updateElementProps(activeElement.id, { fontSize: Number(e.target.value) || 12 })}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Font Weight</label>
                          <select
                            value={activeElement.fontWeight || 'normal'}
                            onChange={(e) => updateElementProps(activeElement.id, { fontWeight: e.target.value })}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                          >
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                            <option value="900">Black / Ultra</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Text Alignment</label>
                        <div className="grid grid-cols-3 gap-1">
                          {(['left', 'center', 'right'] as const).map(align => (
                            <button
                              key={align}
                              type="button"
                              onClick={() => updateElementProps(activeElement.id, { textAlign: align })}
                              className={`py-1.5 rounded-lg border text-center font-bold capitalize ${
                                (activeElement.textAlign || 'left') === align
                                  ? 'bg-indigo-600 text-white border-indigo-700'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200'
                              }`}
                            >
                              {align}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Dynamic Database Source</label>
                    <select
                      value={activeElement.mapping || ''}
                      onChange={(e) => updateElementProps(activeElement.id, { mapping: (e.target.value as any) || undefined })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-indigo-600"
                    >
                      <option value="">Static / Custom Text</option>
                      <option value="brand">Brand (brands.name)</option>
                      <option value="model">Model (models.name)</option>
                      <option value="size">Dimensions (production_order_lines)</option>
                      <option value="warranty">Warranty Policy (warranty_policies)</option>
                      <option value="serial">Serial Number (serial_numbers.serial_number)</option>
                      <option value="batch">Batch Number (production_batches.batch_number)</option>
                      <option value="production_date">Production Date (serial_numbers.production_date)</option>
                    </select>
                  </div>

                  {!activeElement.mapping && activeElement.type === 'text' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Static Text Content</label>
                      <input
                        type="text"
                        value={activeElement.staticValue || ''}
                        onChange={(e) => updateElementProps(activeElement.id, { staticValue: e.target.value })}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => handleRemoveElement(activeElement.id)}
                    className="w-full py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold flex items-center justify-center gap-1.5 mt-4"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'حذف العنصر' : 'Remove Element'}</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {lang === 'ar' ? 'انقر على أي عنصر في مساحة العمل لتعديل خصائصه بالسحب أو الإدخال' : 'Click any element on the canvas to edit its properties or drag handles.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 3: LIVE DATABASE PREVIEW & DATA BINDING (FIX 02) */}
      {/* ==================================================================== */}
      {currentSubTab === 'preview' && (
        <div className="space-y-6">
          {/* Selector & Data Binding Bar */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="min-w-[220px]">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Select Label Template</label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const t = templates.find(item => item.id === e.target.value);
                    if (t) setSelectedTemplate(t);
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} [{t.template_json?.status?.toUpperCase()}] ({t.label_width}×{t.label_height}mm)
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[260px]">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Bind Live Serial Record from Database</label>
                <select
                  value={selectedSerialForPreview}
                  onChange={(e) => setSelectedSerialForPreview(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200"
                >
                  {serials.length === 0 ? (
                    <option value="">No serial records available in database</option>
                  ) : (
                    serials.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.serialNumber || (s as any).serial_number} [{s.status.toUpperCase()}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200/40 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Database Binding: Active</span>
              </span>
            </div>
          </div>

          {/* Preview Workspace: Label Output & Resolved Data Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Live Rendered Thermal Label Canvas */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-h-[480px]">
              {selectedTemplate ? (
                <div 
                  className="relative bg-white text-slate-900 border-2 border-slate-900 shadow-2xl rounded-sm p-4 overflow-hidden select-none"
                  style={{
                    width: `${selectedTemplate.label_width * 4}px`,
                    height: `${selectedTemplate.label_height * 4}px`
                  }}
                >
                  {selectedTemplate.template_json?.elements?.map(el => (
                    <div
                      key={el.id}
                      style={{
                        left: `${el.x * 4}px`,
                        top: `${el.y * 4}px`,
                        width: `${el.width * 4}px`,
                        height: `${el.height * 4}px`,
                        fontSize: `${el.fontSize || 12}px`,
                        fontWeight: el.fontWeight || 'normal',
                        textAlign: el.textAlign || 'left',
                        position: 'absolute'
                      }}
                      className="flex items-center"
                    >
                      {/* Official Logo */}
                      {el.type === 'logo' && (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden">
                          <img 
                            src={officialLogoImg} 
                            alt="Official Sleepee Logo" 
                            className="w-full h-full object-contain pointer-events-none select-none"
                          />
                        </div>
                      )}

                      {/* Custom Image */}
                      {el.type === 'image' && (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden">
                          <img 
                            src={el.staticValue || officialLogoImg} 
                            alt="Image" 
                            className="w-full h-full object-contain pointer-events-none select-none"
                          />
                        </div>
                      )}

                      {/* Line */}
                      {el.type === 'line' && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-full h-0.5 bg-slate-900" />
                        </div>
                      )}

                      {/* Rectangle & Shape */}
                      {(el.type === 'rectangle' || el.type === 'shape') && (
                        <div className={`w-full h-full border-2 border-slate-900 ${el.type === 'shape' ? 'rounded-lg' : ''}`} />
                      )}

                      {/* QR Code */}
                      {el.type === 'qr' && (
                        <div className="w-full h-full flex items-center justify-center p-0.5">
                          {resolvedPreviewData.qrUrl !== 'Not Available' ? (
                            <QRCodeSVG value={resolvedPreviewData.qrUrl} size={Math.min(el.width, el.height) * 4 - 8} />
                          ) : (
                            <div className="text-[9px] font-mono text-slate-400">Not Available</div>
                          )}
                        </div>
                      )}

                      {/* Barcode */}
                      {el.type === 'barcode' && (
                        <div className="w-full h-full flex flex-col items-center justify-center p-0.5">
                          {resolvedPreviewData.serialNumber !== 'Not Available' ? (
                            <BarcodeSVG value={resolvedPreviewData.serialNumber} height={el.height * 4 - 12} />
                          ) : (
                            <div className="text-[9px] font-mono text-slate-400">Not Available</div>
                          )}
                        </div>
                      )}

                      {/* Text / Dynamic Fields */}
                      {!['logo', 'image', 'line', 'rectangle', 'shape', 'qr', 'barcode'].includes(el.type) && (
                        <div className="w-full truncate text-slate-900 font-sans">
                          {getDynamicFieldValue(el.mapping, el.staticValue)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs">
                  {lang === 'ar' ? 'لا يوجد قالب محدد للمعاينة' : 'No template selected for preview.'}
                </div>
              )}
            </div>

            {/* Resolved Data Inspector Panel (FIX 02) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b pb-3">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>{lang === 'ar' ? 'بيانات الربط الفعلي من قاعدة البيانات' : 'Resolved Live Database Entities'}</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Serial Record (serial_numbers)</span>
                  <p className="font-mono font-bold text-indigo-600 text-sm">{resolvedPreviewData.serialNumber}</p>
                  <p className="text-[11px] text-slate-500">Status: <span className="font-bold uppercase text-emerald-600">{resolvedPreviewData.status}</span></p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Batch Number</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-white">{resolvedPreviewData.batchNumber}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Production Order</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-white">{resolvedPreviewData.orderNumber}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Product Model & Brand</span>
                  <p className="font-bold text-slate-900 dark:text-white">{resolvedPreviewData.brandName} - {resolvedPreviewData.modelName}</p>
                  <p className="text-[11px] text-slate-500">Category: {resolvedPreviewData.categoryName}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Dimensions</span>
                    <p className="font-bold text-slate-800 dark:text-white">{resolvedPreviewData.sizeText}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Production Date</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-white">{resolvedPreviewData.productionDate}</p>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl space-y-1 border border-indigo-200/50">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase block">Warranty Policy Coverage</span>
                  <p className="font-bold text-indigo-900 dark:text-indigo-200">{resolvedPreviewData.warrantyText}</p>
                  <p className="font-mono text-[10px] text-slate-400 truncate">{resolvedPreviewData.qrUrl}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NEW TEMPLATE CREATION */}
      {/* ==================================================================== */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>{lang === 'ar' ? 'إنشاء قالب طباعة جديد' : 'Create New Label Template'}</span>
              </h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'اسم القالب *' : 'Template Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: قالب مراتب سوست قياسي 100x100' : 'e.g., Mattress Standard 100x100 Label'}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'الفئة المستهدفة *' : 'Target Product Category *'}
                </label>
                <select
                  required
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="">{lang === 'ar' ? 'اختر فئة المنتج...' : 'Select Category...'}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name_ar || c.name_en || c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'مقاس الملصق الحراري (Zebra ZD220) *' : 'Supported Label Size (Zebra ZD220) *'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: '100x100', title: '100×100 mm' },
                    { value: '100x80', title: '100×80 mm' },
                    { value: '100x50', title: '100×50 mm' },
                    { value: 'custom', title: lang === 'ar' ? 'مقاس مخصص' : 'Custom size' }
                  ] as const).map((preset) => (
                    <button key={preset.value} type="button" onClick={() => setNewSize(preset.value)}
                      className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors ${newSize === preset.value ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'}`}>
                      {preset.title}
                    </button>
                  ))}
                </div>
                {newSize === 'custom' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div><label className="text-[11px] font-semibold text-slate-600 block mb-1">{lang === 'ar' ? 'العرض (مم)' : 'Width (mm)'}</label><input type="number" min="1" step="1" value={customLabelWidth} onChange={(e) => setCustomLabelWidth(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" /></div>
                    <div><label className="text-[11px] font-semibold text-slate-600 block mb-1">{lang === 'ar' ? 'الارتفاع (مم)' : 'Height (mm)'}</label><input type="number" min="1" step="1" value={customLabelHeight} onChange={(e) => setCustomLabelHeight(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" /></div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  {lang === 'ar' ? 'إنشاء القالب والانتقال للمحرر' : 'Create & Open Editor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VERSION HISTORY INSPECTION (FIX 03 & FIX 04) */}
      {/* ==================================================================== */}
      {isHistoryModalOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>{lang === 'ar' ? 'سجل إصدارات القالب' : 'Template Version History'} ({selectedTemplate.name})</span>
              </h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto text-xs">
              {(!selectedTemplate.template_json?.version_history || selectedTemplate.template_json.version_history.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  {lang === 'ar' ? 'هذا هو الإصدار الأولي للقالب (v1.0)' : 'This is the initial version (v1.0). No previous versions recorded.'}
                </div>
              ) : (
                selectedTemplate.template_json.version_history.map((vh, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-indigo-600 block">Version {vh.version}</span>
                      <span className="text-[10px] text-slate-400">{new Date(vh.published_at).toLocaleString()}</span>
                      {vh.notes && <p className="text-[10px] text-slate-500 mt-0.5">{vh.notes}</p>}
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleRestoreVersion(vh.version)}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[10px] font-bold"
                      >
                        {lang === 'ar' ? 'استعادة هذه النسخة' : 'Restore Version'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t text-right">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
