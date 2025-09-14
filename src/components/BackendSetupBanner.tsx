import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getBackendBaseUrl, saveBackendBaseUrl, isBackendConfigured } from '@/config/backend';

const BackendSetupBanner = () => {
  const [show, setShow] = useState<boolean>(false);
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const configured = isBackendConfigured();
    setShow(!configured);
    setValue(getBackendBaseUrl() || '');
  }, []);

  const handleSave = () => {
    try {
      setError('');
      const url = value.trim();
      saveBackendBaseUrl(url);
      // Full reload so services pick the new backend
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Geçersiz URL');
    }
  };

  if (!show) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-foreground font-medium">Backend gerekli: Akışları proxy üzerinden oynatmak için PHP backend adresini girin</div>
            <div className="text-xs text-muted-foreground mt-1">Örnek: https://your-domain.com (Bu adreste /api/proxy ve /api/channels çalışmalı)</div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input
              placeholder="https://your-domain.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="md:w-[360px]"
            />
            <Button onClick={handleSave} variant="default">Kaydet</Button>
            <Button onClick={() => setShow(false)} variant="ghost">Gizle</Button>
          </div>
        </div>
        {error && <div className="text-xs text-destructive mt-2">{error}</div>}
      </div>
    </div>
  );
};

export default BackendSetupBanner;
