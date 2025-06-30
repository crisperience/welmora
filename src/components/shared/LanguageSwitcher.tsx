'use client';

import { Button } from '@/components/ui/button';
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

  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      // Store the language preference
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=lax`;

      // Refresh the page to apply the new locale
      window.location.reload();
    });
    setIsOpen(false);
  };

  const currentLanguage = languages.find(lang => lang.code === locale);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex items-center justify-center w-10 h-10 p-0 bg-white/90 backdrop-blur-sm border-gray-200 hover:bg-white/95 rounded-full"
      >
        <span className="text-lg">{currentLanguage?.flag}</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg">
            {languages.map(language => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                disabled={isPending}
                className={`w-12 h-12 flex items-center justify-center hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                  locale === language.code ? 'bg-amber-50' : ''
                }`}
                title={language.name}
              >
                <span className="text-lg">{language.flag}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
