'use client';

import { useRef } from 'react';
import DocumentSubmissionList from './DocumentSubmissionList';
import styles from './page.module.css';

export default function DocumentSubmissionPage() {
    const documentListRef = useRef<any>(null);

    return (
        <div className={styles.container}>
            <div className={styles.titleWrapper}>
                <h1 className={styles.title}>서류 제출</h1>
            </div>

            <div className={styles.contentWrapper}>
                <DocumentSubmissionList ref={documentListRef} />
            </div>
        </div>
    );
}
