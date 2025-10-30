'use client';

import React, { useState, useEffect } from 'react';

interface DebugInfo {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export function DebugPanel({ enabled = true }: { enabled?: boolean }) {
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // windowオブジェクトにデバッグ情報を保存
    (window as any).__DEBUG_INFO__ = {
      logs: debugLogs,
      show: () => setIsVisible(true),
      hide: () => setIsVisible(false),
      toggle: () => setIsVisible(prev => !prev),
      clear: () => setDebugLogs([]),
    };

    // カスタムロガーを作成
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: 'info' | 'warn' | 'error', ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      const logEntry: DebugInfo = {
        timestamp: Date.now(),
        level,
        message,
        data: args.length > 1 ? args : args[0],
      };

      setDebugLogs(prev => [...prev.slice(-99), logEntry]); // 最新100件を保持

      // 元のconsoleメソッドも実行
      if (level === 'info') originalLog(...args);
      if (level === 'warn') originalWarn(...args);
      if (level === 'error') originalError(...args);
    };

    console.log = (...args: any[]) => {
      if (args[0]?.includes?.('[DashboardLayout]') || args[0]?.includes?.('[AuthContext]')) {
        addLog('info', ...args);
      } else {
        originalLog(...args);
      }
    };

    console.warn = (...args: any[]) => {
      if (args[0]?.includes?.('[DashboardLayout]') || args[0]?.includes?.('[AuthContext]')) {
        addLog('warn', ...args);
      } else {
        originalWarn(...args);
      }
    };

    console.error = (...args: any[]) => {
      addLog('error', ...args);
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [debugLogs, enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* デバッグパネル表示ボタン */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-700 text-sm font-bold"
        style={{ zIndex: 9999 }}
      >
        🐛 Debug ({debugLogs.length})
      </button>

      {/* デバッグパネル */}
      {isVisible && (
        <div
          className="fixed bottom-20 right-4 w-96 max-h-96 bg-white border-2 border-red-600 rounded-lg shadow-2xl overflow-hidden z-50"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-red-600 text-white px-4 py-2 flex justify-between items-center">
            <h3 className="font-bold">Debug Panel</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="p-2 flex gap-2 border-b">
            <button
              onClick={() => setDebugLogs([])}
              className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
            >
              Clear
            </button>
            <button
              onClick={() => {
                const data = JSON.stringify(debugLogs, null, 2);
                navigator.clipboard.writeText(data);
                alert('Copied to clipboard!');
              }}
              className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
            >
              Copy
            </button>
          </div>
          <div className="overflow-y-auto max-h-80 p-2 text-xs font-mono">
            {debugLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No logs yet</div>
            ) : (
              debugLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`mb-2 p-2 rounded ${
                    log.level === 'error'
                      ? 'bg-red-50 border-l-4 border-red-500'
                      : log.level === 'warn'
                      ? 'bg-yellow-50 border-l-4 border-yellow-500'
                      : 'bg-gray-50 border-l-4 border-gray-300'
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span className={`font-bold ${
                      log.level === 'error'
                        ? 'text-red-700'
                        : log.level === 'warn'
                        ? 'text-yellow-700'
                        : 'text-gray-700'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-800 break-words">{log.message}</div>
                  {log.data && typeof log.data === 'object' && (
                    <pre className="mt-1 text-xs overflow-x-auto bg-white p-1 rounded">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
