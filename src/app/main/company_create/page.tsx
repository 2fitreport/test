'use client';

import CompanyCreateForm from './CompanyCreateForm';
import styles from './page.module.css';

export default function CompanyCreatePage() {
    return (
        <div className={styles.container}>
            <CompanyCreateForm />
        </div>
    );
}
