'use client';

import { Suspense } from 'react';
import CompanyCreateForm from './CompanyCreateForm';
import styles from './page.module.css';

export default function CompanyCreatePage() {
    return (
        <div className={styles.container}>
            <Suspense fallback={<div>로딩 중...</div>}>
                <CompanyCreateForm />
            </Suspense>
        </div>
    );
}
