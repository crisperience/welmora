'use client';
import { createContext, ReactNode, useContext, useState } from 'react';

export const DateContext = createContext<{
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}>({
  selectedDate: '',
  setSelectedDate: () => {},
});

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDateContext() {
  return useContext(DateContext);
}
