import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { cx, haptic } from './ui';

/** Continuous rear-camera barcode scanning. Calls onDetected once, then stops the camera. */
export default function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onDetected);
  cb.current = onDetected;
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let stopped = false;
    const hints = new Map<DecodeHintType, unknown>([
      [
        DecodeHintType.POSSIBLE_FORMATS,
        [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128],
      ],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available here. Enter the barcode manually below.');
      return;
    }
    reader
      .decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current!,
        (result, _err, ctrl) => {
          if (!result || stopped) return;
          stopped = true;
          ctrl.stop();
          const code = result.getText();
          haptic(80);
          setHit(code);
          window.setTimeout(() => cb.current(code), 350);
        },
      )
      .then((c) => {
        controls = c;
        if (stopped) c.stop();
      })
      .catch((e: unknown) => {
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in Settings → Safari → Camera, or enter the barcode below.'
            : 'Could not start the camera. Enter the barcode manually below.',
        );
      });
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <div
      className={cx(
        'relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-4 bg-black transition-colors',
        hit ? 'border-accent' : 'border-transparent',
      )}
    >
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      {!error && !hit && (
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-bad/80 shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
      )}
      {hit && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/30 text-lg font-bold text-white">
          ✓ {hit}
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-200">{error}</div>}
    </div>
  );
}
