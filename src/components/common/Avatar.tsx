import React from 'react';

/** Photo when we have one, otherwise a neutral initial/person placeholder (never a stock face). */
export const Avatar: React.FC<{
  src?: string | null;
  name?: string | null;
  className?: string;
}> = ({ src, name, className = 'w-10 h-10' }) => {
  if (src) {
    return <img src={src} alt="" className={`rounded-full object-cover bg-surface-container-high ${className}`} />;
  }
  const initial = (name || '').trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className={`rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-extrabold select-none ${className}`}
    >
      {initial ? (
        <span className="text-[1.1em] leading-none">{initial}</span>
      ) : (
        <span aria-hidden="true" className="material-symbols-outlined text-[1.3em]" style={{ fontSize: '1.3em' }}>person</span>
      )}
    </span>
  );
};
