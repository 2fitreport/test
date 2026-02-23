'use client';

import styles from '../clients.module.css';

interface Client {
    id: number;
    name: string;
    businessNumber: string;
    industry: string;
    representative: string;
    annualSales: string;
    creditRating: string;
    totalCases: number;
    cumulativeApproval: string;
    isNew: boolean;
}

interface ClientCardProps {
    client: Client;
}

export default function ClientCard({ client }: ClientCardProps) {
    return (
        <div className={styles.clientCard}>
            {client.isNew && <div className={styles.newIndicator} />}
            <div className={styles.cardHeader}>
                <div className={styles.companyInfo}>
                    <h3>{client.name}</h3>
                    <p className={styles.businessNumber}>{client.businessNumber}</p>
                </div>
                <span className={styles.industryBadge}>{client.industry}</span>
            </div>

            <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>대표자</span>
                    <span className={styles.infoValue}>{client.representative}</span>
                </div>
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>연매출</span>
                    <span className={styles.infoValue}>{client.annualSales}</span>
                </div>
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>기업신용등급</span>
                    <span className={`${styles.infoValue} ${styles.creditBadge}`}>{client.creditRating}</span>
                </div>
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.footerRow}>
                    <span className={styles.footerLabel}>총 케이스</span>
                    <span className={styles.footerValue}>{client.totalCases}건</span>
                </div>
                <div className={styles.footerRow}>
                    <span className={styles.footerLabel}>누적 승인</span>
                    <span className={styles.footerValue}>{client.cumulativeApproval}</span>
                </div>
            </div>
        </div>
    );
}
