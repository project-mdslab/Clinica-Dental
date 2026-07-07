import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        {/* Círculo de color principal de la web */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#6d5b4b" width="32" height="32">
          <circle cx="16" cy="16" r="16" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
