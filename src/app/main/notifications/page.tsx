'use client';

import { useEffect, useState } from 'react';
import styles from './notifications.module.css';
import NotificationList from './components/NotificationList';
import { getAdminData, type AdminData } from '@/lib/auth';

import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
    const router = useRouter();
    const [adminData, setAdminData] = useState<AdminData | null>(null);

    useEffect(() => {
        const data = getAdminData();
        setAdminData(data);
    }, []);

    const isRepresentative = adminData?.position?.level === 1;

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div>
                    <h1 className={styles.mainTitle}>알림</h1>
                    <p className={styles.subTitle}>대표자 및 시스템에서 전달된 알림을 확인하세요.</p>
                </div>
                {isRepresentative && (
                    <div className={styles.btnWrap}>
                        <button onClick={() => router.push('/main/notifications/create')}>
                            알림 작성
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.contentWrap}>
                <NotificationList />
            </div>
        </div>
    );
}
