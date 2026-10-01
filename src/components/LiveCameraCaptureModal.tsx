import React, { useRef, useState, useEffect } from 'react';
import { Modal } from './common/Modal';

interface LiveCameraCaptureModalProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
  title?: string;
}

export const LiveCameraCaptureModal: React.FC<LiveCameraCaptureModalProps> = ({
  onCapture,
  onClose,
  title = 'Live Camera Snapshot',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isPermissionRequested, setIsPermissionRequested] = useState(false);
  // Ticks while the stream is live so the preview watermark matches the one burned into the photo.
  const [previewTime, setPreviewTime] = useState(() => new Date());

  const stopCurrentStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    setCameraError(null);
    setIsPermissionRequested(true);

    try {
      stopCurrentStream();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Live camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please tap "Enable Camera" and select "Allow" when prompted.');
      } else {
        setCameraError('Unable to connect to live camera stream. Tap "Enable Camera" to try again.');
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      stopCurrentStream();
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
      }
    };
  }, [facingMode]);

  useEffect(() => {
    if (!stream) return;
    const id = setInterval(() => setPreviewTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [stream]);

  const toggleCameraFacing = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Cap the snapshot at 1280px on the long side (phone cameras give 1080p+).
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const s = Math.min(1, 1280 / Math.max(vw, vh));
    canvas.width = Math.round(vw * s);
    canvas.height = Math.round(vh * s);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw video frame onto canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Add Anti-Misinformation Live Watermark Overlay
      const timestamp = new Date().toLocaleTimeString();
      const dateStr = new Date().toLocaleDateString();

      ctx.fillStyle = 'rgba(31, 41, 35, 0.85)';
      ctx.fillRect(15, canvas.height - 55, 340, 40);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#57C06A';
      ctx.fillText('VERIFIED LIVE CAMERA SNAPSHOT', 25, canvas.height - 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${dateStr} ${timestamp} • Live Verified`, 25, canvas.height - 20);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

      captureTimerRef.current = setTimeout(() => {
        setIsCapturing(false);
        stopCurrentStream();
        onCapture(dataUrl);
      }, 300);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={title}
      bare
      overlayClassName="bg-black"
      className="fixed inset-0 w-full h-full max-w-full max-h-full p-0 rounded-none bg-[#0B0D10] text-white sm:inset-0 sm:left-0 sm:top-0 sm:w-full sm:h-full sm:max-h-full sm:translate-x-0 sm:translate-y-0 sm:rounded-none"
    >
      {/* design_handoff_cng_connect 8: full-bleed viewfinder, floating controls, no chrome bar */}
      <div className="relative w-full h-full overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center text-status-red max-w-sm flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-status-red/20 text-status-red flex items-center justify-center mb-3">
                <span aria-hidden="true" className="material-symbols-outlined text-[36px]">videocam_off</span>
              </div>
              <h3 className="font-geist font-bold text-[1.125rem] text-white">Enable Camera Access</h3>
              <p className="text-[0.875rem] mt-1 text-white/70 font-normal leading-relaxed mb-5">
                {cameraError}
              </p>

              <button
                onClick={() => startCamera(facingMode)}
                className="px-6 py-3.5 bg-rd-available text-white font-geist font-bold text-[0.9062rem] rounded-full shadow-lg flex items-center gap-2 active:scale-95 transition-all"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">photo_camera</span>
                <span>Allow &amp; Enable Camera</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Viewfinder target framing — not in the reference, kept as a useful framing cue */}
            <div className="absolute inset-8 border-2 border-white/25 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-2 border-l-2 border-rd-available/80" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-rd-available/80" />
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-2 border-l-2 border-rd-available/80" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-rd-available/80" />
              </div>
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Floating top controls — 36px translucent circles over the viewfinder, per spec */}
        <div className="absolute top-[max(env(safe-area-inset-top,0px),1.25rem)] inset-x-5 flex items-center justify-between z-10">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-all"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
          </button>
          <span className="font-geist-mono text-[10px] font-semibold tracking-wide text-white/70 uppercase truncate max-w-[50%] text-center">
            {title}
          </span>
          {stream ? (
            <button
              onClick={toggleCameraFacing}
              aria-label="Switch camera"
              className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">flip_camera_ios</span>
            </button>
          ) : (
            <div className="w-9 h-9" aria-hidden="true" />
          )}
        </div>

        {/* Floating bottom stack — watermark preview, gallery-blocked notice, shutter */}
        {!cameraError && stream && (
          <div className="absolute bottom-[max(env(safe-area-inset-bottom,0px),1.75rem)] inset-x-0 flex flex-col items-center gap-3 z-10">
            <div className="bg-black/55 backdrop-blur-sm text-rd-available font-geist-mono text-[10px] font-medium px-3 py-1.5 rounded-md">
              Verified live snapshot &middot; {previewTime.toLocaleDateString()}, {previewTime.toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-1.5 text-white/85 text-[11px] font-geist font-medium">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">lock</span>
              Gallery access disabled
            </div>
            <button
              onClick={takeSnapshot}
              disabled={isCapturing}
              className="w-[68px] h-[68px] rounded-full bg-white border-4 border-white/30 active:scale-90 transition-all flex items-center justify-center shadow-2xl disabled:opacity-50"
              aria-label="Take Live Snapshot"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[28px] text-rd-ink">photo_camera</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
