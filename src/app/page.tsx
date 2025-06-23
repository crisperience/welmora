"use client";

import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageOpen, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Default to today for calendar display
    return new Date();
  });

  const formatDateForUrl = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleShopping = () => {
    router.push(`/shopping/${formatDateForUrl(selectedDate)}`);
  };

  const handlePacking = () => {
    router.push(`/packing/${formatDateForUrl(selectedDate)}`);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welmora Scanner
            </h1>
            <p className="text-xl text-gray-600">
              WooCommerce Inventory Management System
            </p>
          </div>

          <div className="space-y-6">
            {/* Date Selection */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="text-center">
                <CardTitle className="text-xl text-gray-800">Select Order Date</CardTitle>
                <CardDescription>Choose the date for orders to process</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            {/* Shopping */}
            <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-blue-800">Shopping</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleShopping}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                  size="lg"
                >
                  Start Shopping
                </Button>
                <div className="text-center text-sm text-gray-500 mt-2">
                  Orders from {formatDisplayDate(selectedDate)}
                </div>
              </CardContent>
            </Card>

            {/* Packing */}
            <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <PackageOpen className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-green-800">Packing</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handlePacking}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
                  size="lg"
                >
                  Start Packing
                </Button>
                <div className="text-center text-sm text-gray-500 mt-2">
                  Orders from {formatDisplayDate(selectedDate)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p className="text-xs text-gray-400">
          Developed by{' '}
          <a
            href="https://crisp.hr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            CRISP
          </a>
        </p>
      </footer>
    </div>
  );
}
