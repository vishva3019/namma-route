import React, { useState } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface BottomSheetProps {
  children: React.ReactNode;
  title?: string;
  isOpen: boolean;
  onClose?: () => void;
  defaultHeight?: 'peek' | 'half' | 'full';
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  title,
  isOpen,
  onClose,
  defaultHeight = 'half',
}) => {
  const [heightMode, setHeightMode] = useState<'peek' | 'half' | 'full'>(defaultHeight);

  if (!isOpen) return null;

  let heightClasses = 'h-1/3';
  if (heightMode === 'peek') heightClasses = 'h-24';
  else if (heightMode === 'half') heightClasses = 'h-1/2';
  else if (heightMode === 'full') heightClasses = 'h-[88vh]';

  const toggleHeight = () => {
    if (heightMode === 'peek') setHeightMode('half');
    else if (heightMode === 'half') setHeightMode('full');
    else setHeightMode('peek');
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 transition-all duration-300 ease-out flex flex-col md:hidden ${heightClasses}`}
    >
      {/* Drag Handle Bar */}
      <div
        onClick={toggleHeight}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer select-none"
      >
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-1" />
        <div className="w-full px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {title && <span className="font-bold text-sm text-slate-900">{title}</span>}
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            {heightMode === 'full' ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sheet Content Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
