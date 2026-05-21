import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  confirm: (config: { title: string; message: string; type: 'primary' | 'danger' }) => Promise<boolean>;
  prompt: (config: { title: string; message: string; defaultValue?: string }) => Promise<string | null>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; type: 'primary' | 'danger'; resolve: (val: boolean) => void } | null>(null);
  const [promptConfig, setPromptConfig] = useState<{ title: string; message: string; defaultValue: string; resolve: (val: string | null) => void } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const toast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const confirm = (config: { title: string; message: string; type: 'primary' | 'danger' }) => {
    return new Promise<boolean>((resolve) => {
      setModalConfig({ ...config, resolve });
    });
  };

  const prompt = (config: { title: string; message: string; defaultValue?: string }) => {
    return new Promise<string | null>((resolve) => {
      const def = config.defaultValue || '';
      setPromptValue(def);
      setPromptConfig({ ...config, defaultValue: def, resolve });
    });
  };

  return (
    <UIContext.Provider value={{ toast, confirm, prompt }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col space-y-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-8 duration-300 pointer-events-auto ${
            t.type === 'success' ? 'bg-emerald-600/95 border-emerald-400 text-white' :
            t.type === 'error' ? 'bg-red-600/95 border-red-400 text-white' :
            'bg-blue-600/95 border-blue-400 text-white'
          }`}>
            {t.type === 'success' ? <CheckCircle className="w-5 h-5 mr-3" /> : 
             t.type === 'error' ? <AlertCircle className="w-5 h-5 mr-3" /> : 
             <Info className="w-5 h-5 mr-3" />}
            <span className="text-sm font-bold tracking-wide">{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {modalConfig && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0B1120] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center ${modalConfig.type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {modalConfig.type === 'danger' ? <AlertCircle className="w-8 h-8" /> : <Info className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">{modalConfig.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{modalConfig.message}</p>
            </div>
            <div className="flex border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <button onClick={() => { modalConfig.resolve(false); setModalConfig(null); }} className="flex-1 px-6 py-4 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors border-r border-gray-100 dark:border-gray-800">Cancel</button>
              <button onClick={() => { modalConfig.resolve(true); setModalConfig(null); }} className={`flex-1 px-6 py-4 text-sm font-bold transition-colors ${modalConfig.type === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptConfig && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0B1120] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                 <Info className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">{promptConfig.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{promptConfig.message}</p>
              <input 
                type="text" 
                autoFocus
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { promptConfig.resolve(promptValue); setPromptConfig(null); }
                    if (e.key === 'Escape') { promptConfig.resolve(null); setPromptConfig(null); }
                }}
              />
            </div>
            <div className="flex border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <button onClick={() => { promptConfig.resolve(null); setPromptConfig(null); }} className="flex-1 px-6 py-4 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors border-r border-gray-100 dark:border-gray-800">Cancel</button>
              <button onClick={() => { promptConfig.resolve(promptValue); setPromptConfig(null); }} className="flex-1 px-6 py-4 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
