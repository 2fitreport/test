'use client';

import styles from '../clients.module.css';

interface StatCardProps {
    label: string;
    value: string;
}

export default function StatCard({ label, value }: StatCardProps) {
    return (
        <div className={styles.statCard}>
            <p className={styles.statLabel}>{label}</p>
            <p className={styles.statValue}>{value}</p>
        </div>
    );
}
