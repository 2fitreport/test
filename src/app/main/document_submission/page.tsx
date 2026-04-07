'use client';

import { useEffect, useState } from 'react';
import { getAdminData } from '@/lib/auth';
import DocumentSubmissionList from './documentSubmissionList';
import styles from './page.module.css';

export default function DocumentSubmissionPage() {
    const [userLevel, setUserLevel] = useState<number | undefined>(undefined);
    const [isAffiliationRep, setIsAffiliationRep] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const adminData = getAdminData();
        setUserLevel(adminData?.position?.level);
        setIsAffiliationRep(adminData?.is_affiliation_representative || false);
        setIsLoaded(true);
    }, []);

    if (!isLoaded) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.titleWrapper}>
                <div>
                    <h1 className={styles.title}>기업관리</h1>
                    <p className={styles.subTitle}>고객사 정보를 관리하고 진행 현황을 확인하세요.</p>
                </div>
                {!(userLevel === 4 && isAffiliationRep) && (
                    <div className={styles.btnWrap}>
                        <a href="/main/company_create?create=true&consultation=true">상담요청</a>
                        {userLevel !== 6 && (
                            <a href="/main/company_create?create=true">기업등록</a>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.contentWrapper}>
                <DocumentSubmissionList />
            </div>
        </div>
    );
}
