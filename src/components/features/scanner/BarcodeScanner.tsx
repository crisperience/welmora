'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, CameraOff, Scan } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('scanner');

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

  const isPWA = () => {
    // Check if running as PWA
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      window.location.search.includes('utm_source=pwa')
    );
  };

  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  const isSecureContext = () => {
    return (
      window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'
    );
  };

  const requestCameraPermission = async (): Promise<MediaStream | null> => {
    if (!isSecureContext()) {
      throw new Error(
        'Camera access requires HTTPS or localhost. Please ensure you are using a secure connection.'
      );
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser. Please use a modern browser.');
    }

    try {
      // For PWA on iOS, we need to be more specific about constraints
      const isPWAMode = isPWA();
      const isIOSDevice = isIOS();

      let constraints: MediaStreamConstraints;

      if (isPWAMode && isIOSDevice) {
        // iOS PWA specific constraints - be more permissive initially
        constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 320 },
            height: { ideal: 720, min: 240 },
            frameRate: { ideal: 30, min: 10 },
          },
          audio: false,
        };
      } else if (isPWAMode) {
        // General PWA constraints
        constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 },
          },
          audio: false,
        };
      } else {
        // Regular browser constraints
        constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
          audio: false,
        };
      }

      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Verify we got a video track
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('No video track available');
      }

      console.log('Camera access granted:', {
        isPWA: isPWAMode,
        isIOS: isIOSDevice,
        tracks: videoTracks.length,
        settings: videoTracks[0].getSettings(),
      });

      return stream;
    } catch (error) {
      console.error('Camera permission error:', error);

      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            throw new Error(
              'Camera access denied. Please allow camera access in your browser settings and try again. ' +
              (isPWA() ? 'For PWA: Check device settings > Safari > Camera.' : '')
            );
          case 'NotFoundError':
            throw new Error(
              'No camera found. Please check your device has a camera and try again.'
            );
          case 'NotReadableError':
            throw new Error(
              'Camera is being used by another application. Please close other apps using the camera and try again.'
            );
          case 'OverconstrainedError':
            // Try with basic constraints
            try {
              console.log('Trying with basic constraints...');
              const basicStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
              return basicStream;
            } catch {
              throw new Error(
                'Camera constraints not supported. Please try with a different device or browser.'
              );
            }
          case 'SecurityError':
            throw new Error(
              'Camera access blocked due to security restrictions. Please ensure you are using HTTPS and allow camera access.'
            );
          default:
            throw new Error(`Camera error: ${error.message}. Please check your device settings.`);
        }
      } else {
        throw new Error(
          'Camera access failed. Please check your device permissions and try again.'
        );
      }
    }
  };

  const startScanning = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Request camera permission first
      const stream = await requestCameraPermission();
      if (!stream) {
        throw new Error('Failed to get camera stream');
      }

      // Clean up the test stream since ZXing will create its own
      stream.getTracks().forEach(track => track.stop());

      // Start decoding with ZXing
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
        errorMessage = err.message;
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
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Context Warning */}
        {!isSecureContext() && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">
              <strong>⚠️ Insecure Connection:</strong> Camera access requires HTTPS. Please access
              this app through a secure connection.
            </p>
          </div>
        )}

        {/* Scanner Controls */}
        <div className="flex gap-2">
          <Button
            onClick={onToggle}
            variant={isActive ? 'destructive' : 'default'}
            className="flex items-center gap-2"
            disabled={isInitializing || !isSecureContext()}
          >
            {isInitializing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('initializingCamera')}
              </>
            ) : isActive ? (
              <>
                <CameraOff className="h-4 w-4" />
                {t('stopScanner')}
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                {t('startScanner')}
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
                {isPWA() && isIOS() && (
                  <>
                    <li>
                      <strong>iOS PWA:</strong> Go to Settings &gt; Safari &gt; Camera &gt; Allow
                    </li>
                    <li>
                      <strong>iOS PWA:</strong> Make sure the app was added to home screen properly
                    </li>
                  </>
                )}
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
              <li>• Klikni &quot;Pokreni skener&quot; za aktivaciju kamere</li>
              <li>• Postavi barcode ili QR kod u područje skeniranja</li>
              <li>• Aplikacija će automatski detektirati i obraditi kod</li>
              <li>• Za najbolje rezultate, osiguraj dobro osvjetljenje i drži uređaj mirno</li>
              {isPWA() && (
                <li>
                  • <strong>PWA Mode:</strong> Ensure camera permissions are granted in device
                  settings
                </li>
              )}
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
