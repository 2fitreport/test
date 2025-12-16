'use client';

import { useRef, useState } from 'react';
import DocumentSubmissionList from './DocumentSubmissionList';
import DocumentWriteForm from './DocumentWriteForm';
import styles from './page.module.css';

export default function DocumentSubmissionPage() {
    const documentListRef = useRef<any>(null);
    const [showWriteForm, setShowWriteForm] = useState(false);

    return (
        <div className={styles.container}>
            <div className={styles.titleWrapper}>
                <h1 className={styles.title}>서류 제출</h1>
                <button
                    className={styles.createButton}
                    onClick={() => setShowWriteForm(true)}
                >
                    + 서류 작성
                </button>
            </div>

            {showWriteForm && (
                <DocumentWriteForm
                    onClose={() => setShowWriteForm(false)}
                    onSuccess={() => {
                        setShowWriteForm(false);
                        documentListRef.current?.refreshDocuments();
                    }}
                />
            )}

            <div className={styles.contentWrapper}>
                <DocumentSubmissionList ref={documentListRef} />
            </div>
        </div>
    );
}
