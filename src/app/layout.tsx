import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
    title: '2FitReport',
    description: 'User management dashboard',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <head>
                <link
                    rel="stylesheet"
                    as="style"
                    crossOrigin="anonymous"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
                />
                <script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
            </head>
            <body>{children}</body>
        </html>
    );
}
