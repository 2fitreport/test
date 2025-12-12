'use client';

import Sidebar from '../components/sidebar/sidebar';
import styles from './layout.module.css';

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={styles.container}>
            <Sidebar />
            <main className={styles.main}>{children}</main>
        </div>
    );
}

