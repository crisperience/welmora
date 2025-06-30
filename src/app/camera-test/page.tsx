'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, CameraOff } from 'lucide-react';
import { useRef, useState } from 'react';

export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown> | null>(null);

  const detectEnvironment = () => {
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSecure =
      window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';

    return {
      isPWA,
      isIOS,
      isSecure,
      userAgent: navigator.userAgent,
      protocol: location.protocol,
      hostname: location.hostname,
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    };
  };

  const startCamera = async () => {
    try {
      setError(null);
      const env = detectEnvironment();
      setDeviceInfo(env);

      if (!env.isSecure) {
        throw new Error('Camera requires HTTPS or localhost');
      }

      if (!env.hasGetUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
        },
        audio: false,
      };

      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
      }

      // Log stream info
      const videoTrack = stream.getVideoTracks()[0];
      console.log('Camera stream info:', {
        settings: videoTrack.getSettings(),
        capabilities: videoTrack.getCapabilities(),
        constraints: videoTrack.getConstraints(),
      });
    } catch (err) {
      console.error('Camera error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Camera Test - PWA Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Environment Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Environment Info:</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(detectEnvironment(), null, 2)}
            </pre>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              onClick={isActive ? stopCamera : startCamera}
              variant={isActive ? 'destructive' : 'default'}
              className="flex items-center gap-2"
            >
              {isActive ? (
                <>
                  <CameraOff className="h-4 w-4" />
                  Stop Camera
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Start Camera
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
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Device Info */}
          {deviceInfo && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Device Info:</h3>
              <pre className="text-xs overflow-auto">{JSON.stringify(deviceInfo, null, 2)}</pre>
            </div>
          )}

          {/* Instructions */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-600 text-sm">
              <strong>Instructions:</strong>
            </p>
            <ul className="text-amber-500 text-xs mt-1 space-y-1">
              <li>• This page helps debug camera access in PWA mode</li>
              <li>• Check the environment info above</li>
              <li>• Try starting the camera and check for errors</li>
              <li>• For iOS PWA: Settings &gt; Safari &gt; Camera &gt; Allow</li>
              <li>• Make sure the app was properly added to home screen</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
