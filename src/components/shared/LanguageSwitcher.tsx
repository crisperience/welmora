'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState, useTransition } from 'react';

const languages = [
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { logout } = useAuth();

  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      // Store the language preference
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=lax`;

      // Refresh the page to apply the new locale
      window.location.reload();
    });
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
  };

  const currentLanguage = languages.find(lang => lang.code === locale);

  return (
    <div className="flex items-center gap-2">
      {/* Logout Button */}
      <Button
        onClick={handleLogout}
        variant="outline"
        size="sm"
        className="flex items-center gap-1 bg-white/90 backdrop-blur-sm border-gray-200 hover:bg-white/95 rounded-full p-2"
        title="Logout"
      >
        <LogOut className="h-4 w-4" />
      </Button>

      {/* Language Switcher */}
      <div className="relative">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          variant="outline"
          className="flex items-center justify-center w-10 h-10 p-0 bg-white/90 backdrop-blur-sm border-gray-200 hover:bg-white/95 rounded-full"
        >
          <span className="text-lg">{currentLanguage?.flag}</span>
        </Button>

        {isOpen && (
          <div className="absolute top-12 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
            {languages.map(language => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                disabled={isPending}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
              >
                <span className="text-lg">{language.flag}</span>
                <span className="text-sm">{language.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
