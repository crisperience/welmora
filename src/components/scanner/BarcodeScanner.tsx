'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, CameraOff, Scan } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  isActive: boolean;
  onToggle: () => void;
}

export default function BarcodeScanner({ onScan, isActive, onToggle }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [codeReader] = useState(() => new BrowserMultiFormatReader());
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    if (isActive && videoRef.current) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const startScanning = async () => {
    try {
      setError(null);

      if (!videoRef.current) return;

      // Start decoding from default video device
      await codeReader.decodeFromVideoDevice(
        null, // Use default camera
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedText = result.getText();

            // Avoid duplicate scans
            if (scannedText !== lastScanned) {
              setLastScanned(scannedText);
              onScan(scannedText);

              // Clear the last scanned after 2 seconds to allow rescanning
              setTimeout(() => setLastScanned(null), 2000);
            }
          }

          if (error && error.name !== 'NotFoundException') {
            console.warn('Scan error:', error);
          }
        }
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start camera');
    }
  };

  const stopScanning = () => {
    try {
      codeReader.reset();
    } catch (err) {
      console.warn('Error stopping scanner:', err);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" />
          Barcode Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scanner Controls */}
        <div className="flex gap-2">
          <Button
            onClick={onToggle}
            variant={isActive ? 'destructive' : 'default'}
            className="flex items-center gap-2"
          >
            {isActive ? (
              <>
                <CameraOff className="h-4 w-4" />
                Stop Scanner
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Start Scanner
              </>
            )}
          </Button>
        </div>

        {/* Video Preview */}
        {isActive && (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-64 bg-black rounded-lg object-cover"
              playsInline
              muted
            />

            {/* Scanning Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-red-500 border-dashed rounded-lg flex items-center justify-center">
                <div className="text-white bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                  Position barcode here
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">
              <strong>Error:</strong> {error}
            </p>
            <p className="text-red-500 text-xs mt-1">
              Make sure you have granted camera permissions and have a camera available.
            </p>
          </div>
        )}

        {/* Instructions */}
        {!isActive && !error && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-600 text-sm">
              <strong>Instructions:</strong>
            </p>
            <ul className="text-blue-500 text-xs mt-1 space-y-1">
              <li>• Click &quot;Start Scanner&quot; to activate the camera</li>
              <li>• Position the barcode or QR code in the scanning area</li>
              <li>• The app will automatically detect and process the code</li>
            </ul>
          </div>
        )}

        {/* Last Scanned Code */}
        {lastScanned && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm">
              <strong>Last Scanned:</strong> {lastScanned}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
