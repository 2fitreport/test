'use client';

import { useEffect, useState } from 'react';
import { getTimeAgo } from './timeUtils';

interface TimeAgoProps {
    dateString: string;
}

export default function TimeAgo({ dateString }: TimeAgoProps) {
    const [timeAgo, setTimeAgo] = useState<string>('');

    useEffect(() => {
        // 초기값 설정
        setTimeAgo(getTimeAgo(dateString));

        // 1초마다 업데이트
        const interval = setInterval(() => {
            setTimeAgo(getTimeAgo(dateString));
        }, 1000);

        return () => clearInterval(interval);
    }, [dateString]);

    return <span>{timeAgo}</span>;
}
