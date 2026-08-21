import React, { useRef, useState, useEffect } from 'react';

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isPermissionRequested, setIsPermissionRequested] = useState(false);

  const startCamera = async (mode: 'environment' | 'user') => {
    setCameraError(null);
    setIsPermissionRequested(true);

    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

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
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCameraFacing = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw video frame onto canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Add Anti-Misinformation Live Watermark Overlay
      const timestamp = new Date().toLocaleTimeString();
      const dateStr = new Date().toLocaleDateString();

      ctx.fillStyle = 'rgba(0, 77, 64, 0.85)';
      ctx.fillRect(15, canvas.height - 55, 340, 40);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#00E676';
      ctx.fillText('📷 VERIFIED LIVE CAMERA SNAPSHOT', 25, canvas.height - 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${dateStr} ${timestamp} • Live Verified`, 25, canvas.height - 20);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      setTimeout(() => {
        setIsCapturing(false);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        onCapture(dataUrl);
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 font-['Plus_Jakarta_Sans',sans-serif] animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between text-white z-10 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-status-green animate-pulse" />
          <span className="font-bold text-[16px] text-status-green">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {stream && (
            <button
              onClick={toggleCameraFacing}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-md active:scale-95 transition-all"
              title="Switch Camera (Rear/Front)"
            >
              <span className="material-symbols-outlined text-[20px]">flip_camera_ios</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white backdrop-blur-md active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
      </div>

      {/* Camera Viewfinder & Permission Card */}
      <div className="relative flex-1 bg-slate-900 rounded-3xl overflow-hidden flex items-center justify-center border border-white/10 my-2">
        {cameraError ? (
          <div className="p-6 text-center text-status-red max-w-sm flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-status-red/20 text-status-red flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[36px]">videocam_off</span>
            </div>
            <h3 className="font-bold text-[18px] text-white">Enable Camera Access</h3>
            <p className="text-[13px] mt-1 text-slate-300 font-normal leading-relaxed mb-5">
              {cameraError}
            </p>

            <button
              onClick={() => startCamera(facingMode)}
              className="px-6 py-3.5 bg-status-green hover:opacity-95 text-on-surface font-bold text-[14.5px] rounded-full shadow-lg flex items-center gap-2 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span>Allow &amp; Enable Camera</span>
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Viewfinder Target Framing Grid */}
            <div className="absolute inset-8 border-2 border-status-green/40 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-2 border-l-2 border-status-green" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-status-green" />
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-2 border-l-2 border-status-green" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-status-green" />
              </div>
            </div>

            {/* Live Watermark Preview Pill */}
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-full border border-status-green/40 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-green animate-ping" />
              <span>LIVE CAMERA ACTIVE • Gallery Uploads Blocked</span>
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center pt-2 pb-4 z-10">
        {!cameraError && stream && (
          <button
            onClick={takeSnapshot}
            disabled={isCapturing}
            className="w-20 h-20 rounded-full border-4 border-white bg-status-green hover:opacity-95 active:scale-90 transition-all flex items-center justify-center shadow-2xl disabled:opacity-50"
            aria-label="Take Live Snapshot"
          >
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[32px]">photo_camera</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
