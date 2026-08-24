import React, { useState } from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: string;
  fallbackText?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  fallbackIcon = 'photo_camera',
  fallbackText,
  ...props
}) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`bg-[#e6f0e9] text-slate-500 flex flex-col items-center justify-center p-3 text-center ${className}`}>
        <span className="material-symbols-outlined text-[24px] text-slate-400 mb-1">{fallbackIcon}</span>
        {fallbackText && <span className="text-[11px] font-semibold text-slate-600">{fallbackText}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Image'}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};
