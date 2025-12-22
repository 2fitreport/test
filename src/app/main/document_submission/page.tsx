'use client';

import Link from 'next/link';
import DocumentSubmissionList from './DocumentSubmissionList';
import styles from './page.module.css';

export default function DocumentSubmissionPage() {
    return (
        <div className={styles.container}>
            <div className={styles.titleWrapper}>
                <h1 className={styles.title}>기업관리</h1>
                <Link href="/main/company_create">
                    <button className={styles.createButton}>
                        + 기업 생성
                    </button>
                </Link>
            </div>

            <div className={styles.contentWrapper}>
                <DocumentSubmissionList />
            </div>
        </div>
    );
}
