'use client';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '2FitReport',
};

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>오류가 발생했습니다.</h2>
        <button onClick={() => reset()}>다시 시도</button>
      </body>
    </html>
  );
}
