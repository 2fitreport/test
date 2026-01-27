'use client';

import { Suspense } from 'react';
import CreateUserPageContent from './CreateUserPageContent';
import styles from './createUser.module.css';

export default function CreateUserPage() {
    return (
        <Suspense
            fallback={
                <div className={styles.pageContainer}>
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <p className={styles.loadingText}>로딩 중...</p>
                    </div>
                </div>
            }
        >
            <CreateUserPageContent />
        </Suspense>
    );
}
