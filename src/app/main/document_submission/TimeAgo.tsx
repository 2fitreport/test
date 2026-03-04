'use client';

import { useEffect, useState, useRef } from 'react';
import { getTimeAgo } from './timeUtils';

interface TimeAgoProps {
    dateString: string;
}

export default function TimeAgo({ dateString }: TimeAgoProps) {
    const [timeAgo, setTimeAgo] = useState<string>(() => getTimeAgo(dateString));
    const dateStringRef = useRef(dateString);

    useEffect(() => {
        dateStringRef.current = dateString;
        setTimeAgo(getTimeAgo(dateString));
    }, [dateString]);

    useEffect(() => {
        // 1초마다 업데이트
        const interval = setInterval(() => {
            setTimeAgo(getTimeAgo(dateStringRef.current));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return <span>{timeAgo}</span>;
}
