'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminData } from '@/lib/auth';
import DocumentSubmissionList from './DocumentSubmissionList';
import styles from './page.module.css';

export default function DocumentSubmissionPage() {
    const [userLevel, setUserLevel] = useState<number | undefined>(undefined);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const adminData = getAdminData();
        setUserLevel(adminData?.position?.level);
        setIsLoaded(true);
    }, []);

    if (!isLoaded) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.titleWrapper}>
                <h1 className={styles.title}>기업관리</h1>
                {userLevel !== 6 && (
                    <Link href="/main/company_create">
                        <button className={styles.createButton}>
                            + 기업 생성
                        </button>
                    </Link>
                )}
            </div>

            <div className={styles.contentWrapper}>
                <DocumentSubmissionList />
            </div>
        </div>
    );
}
