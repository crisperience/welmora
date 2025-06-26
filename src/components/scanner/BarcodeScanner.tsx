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
  const [isInitializing, setIsInitializing] = useState(false);

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
      setIsInitializing(true);

      if (!videoRef.current) return;

      // Check if we're in a PWA context
      const isPWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

      // For PWA, we need to request camera permission explicitly first with better constraints
      if (isPWA) {
        try {
          // Use better constraints for mobile devices
          const constraints = {
            video: {
              facingMode: 'environment', // Use back camera by default
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30, min: 15 },
            },
            audio: false,
          };

          // Test camera access with enhanced constraints
          const testStream = await navigator.mediaDevices.getUserMedia(constraints);
          testStream.getTracks().forEach(track => track.stop());
        } catch (cameraError) {
          console.error('Camera permission error:', cameraError);

          if (cameraError instanceof Error) {
            if (cameraError.name === 'NotAllowedError') {
              throw new Error(
                'Camera access denied. Please allow camera access in your browser settings and try again.'
              );
            } else if (cameraError.name === 'NotFoundError') {
              throw new Error(
                'No camera found. Please check your device has a camera and try again.'
              );
            } else if (cameraError.name === 'NotReadableError') {
              throw new Error(
                'Camera is being used by another application. Please close other apps using the camera and try again.'
              );
            } else if (cameraError.name === 'OverconstrainedError') {
              // Try with more basic constraints
              try {
                const basicConstraints = { video: true, audio: false };
                const basicStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
                basicStream.getTracks().forEach(track => track.stop());
              } catch {
                throw new Error(
                  'Camera access failed. Please check your device permissions and try again.'
                );
              }
            } else {
              throw new Error(
                `Camera error: ${cameraError.message}. Please check your device settings.`
              );
            }
          } else {
            throw new Error(
              'Camera access failed. Please check your device permissions and try again.'
            );
          }
        }
      }

      // Start decoding with enhanced error handling and better constraints
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

      setIsInitializing(false);
    } catch (err) {
      console.error('Scanner error:', err);
      setIsInitializing(false);

      let errorMessage = 'Failed to start camera';

      if (err instanceof Error) {
        if (err.message.includes('Permission denied') || err.message.includes('permission')) {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (err.message.includes('not found') || err.message.includes('NotFoundError')) {
          errorMessage = 'No camera found. Please check your device has a camera.';
        } else if (err.message.includes('NotAllowedError')) {
          errorMessage =
            'Camera access blocked. Please check browser settings and allow camera access.';
        } else if (err.message.includes('NotReadableError')) {
          errorMessage =
            'Camera is being used by another application. Please close other apps using the camera.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    }
  };

  const stopScanning = () => {
    try {
      codeReader.reset();
      setIsInitializing(false);
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
            disabled={isInitializing}
          >
            {isInitializing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Starting Camera...
              </>
            ) : isActive ? (
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
              autoPlay
            />

            {/* Scanning Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-red-500 border-dashed rounded-lg flex items-center justify-center">
                <div className="text-white bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                  Position barcode here
                </div>
              </div>
            </div>

            {/* Loading overlay */}
            {isInitializing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                <div className="text-white text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto mb-2" />
                  <p className="text-sm">Initializing camera...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">
              <strong>Error:</strong> {error}
            </p>
            <div className="text-red-500 text-xs mt-2 space-y-1">
              <p>
                <strong>Troubleshooting:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Make sure you have granted camera permissions</li>
                <li>Check if another app is using the camera</li>
                <li>Try refreshing the page</li>
                <li>Ensure you&apos;re using HTTPS (required for camera access)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isActive && !error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-600 text-sm">
              <strong>Instructions:</strong>
            </p>
            <ul className="text-amber-500 text-xs mt-1 space-y-1">
              <li>• Click &quot;Start Scanner&quot; to activate the camera</li>
              <li>• Position the barcode or QR code in the scanning area</li>
              <li>• The app will automatically detect and process the code</li>
              <li>• For best results, ensure good lighting and hold device steady</li>
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
