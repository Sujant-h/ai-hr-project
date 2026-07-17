import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../store/session';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export const AuditLog: React.FC = () => {
  const { t } = useTranslation();
  const { auditLog, clearAuditLog } = useSessionStore();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('audit.title')}</h2>
          <p className="text-slate-600">{t('audit.desc')}</p>
        </div>
        {auditLog.length > 0 && (
          <Button variant="outline" onClick={clearAuditLog} className="rounded-xl border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">
            {t('audit.clear')}
          </Button>
        )}
      </div>

      {!auditLog || auditLog.length === 0 ? (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-8 text-center text-indigo-800 font-medium">
          {t('audit.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[...auditLog].reverse().map((entry, idx) => (
            <Card key={idx} className="bg-white/80 backdrop-blur shadow-sm hover:shadow-md transition-shadow border-slate-200/60 rounded-2xl">
              <CardContent className="p-5">
                <div className="text-slate-900 text-lg mb-1">
                  <span className="text-sm text-slate-500 font-medium mr-2">{entry.timestamp}</span> &middot;{' '}
                  <span className="font-bold text-indigo-700 ml-2">{entry.agent}</span> &mdash; {entry.action}
                </div>
                <div className="text-slate-600 mt-2 text-sm leading-relaxed">
                  {entry.detail}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
