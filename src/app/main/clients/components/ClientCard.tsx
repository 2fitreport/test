'use client';

import { useRouter } from 'next/navigation';
import styles from '../clients.module.css';

interface Client {
    company_name: string;
    business_number: string;
    company_type: string;
    standard_classification: string | null;
    representative_name: string;
    company_credit_rating_kcb: string | null;
    company_credit_rating_nice: string | null;
    annual_sales: string | null;
    creditRatingImage: string | null;
    totalCases: number;
    documents: Array<{
        id: number;
        progress_details: string;
        status: string;
        created_at: string;
        approval_amount: number | null;
    }>;
}

interface ClientCardProps {
    client: Client;
}

export default function ClientCard({ client }: ClientCardProps) {
    const router = useRouter();
    const approvedDocs = client.documents.filter(doc => doc.progress_details === '승인');
    const approvedAmount = approvedDocs.reduce((sum, doc) => sum + (doc.approval_amount || 0), 0);

    const formatApprovalAmount = (manwon: number): string => {
        const eokValue = manwon / 10000;
        const eok = Math.floor(eokValue);
        const decimal = (eokValue - eok) * 10; // 소수점 첫자리
        const cheonman = Math.floor(decimal);
        const baekman = Math.floor((decimal - cheonman) * 10);

        if (eok > 0) {
            if (cheonman > 0) {
                if (baekman > 0) {
                    return `${eok}억 ${cheonman}천 ${baekman}백만원`;
                } else {
                    return `${eok}억 ${cheonman}천만원`;
                }
            } else {
                if (baekman > 0) {
                    return `${eok}억 ${baekman}백만원`;
                } else {
                    return `${eok}억원`;
                }
            }
        } else {
            if (cheonman > 0) {
                if (baekman > 0) {
                    return `${cheonman}천 ${baekman}백만원`;
                } else {
                    return `${cheonman}천만원`;
                }
            } else {
                if (baekman > 0) {
                    return `${baekman}백만원`;
                } else {
                    return '0원';
                }
            }
        }
    };

    const handleCardClick = () => {
        // 승인을 제외한 문서 중 가장 최근의 것을 찾기
        const nonApprovedDocs = client.documents.filter(doc => doc.progress_details !== '승인');
        if (nonApprovedDocs.length > 0) {
            const latestDoc = nonApprovedDocs[0]; // 이미 최신순 정렬됨
            router.push(`/main/company_create?view=${latestDoc.id}`);
        }
    };

    return (
        <div className={styles.clientCard} style={{ cursor: 'pointer' }} onClick={handleCardClick}>
            <div className={styles.cardHeader}>
                <div className={styles.companyInfo}>
                    <h3>{client.company_name}</h3>
                    <p className={styles.businessNumber}>{client.business_number}</p>
                </div>
                <span className={styles.industryBadge}>{client.standard_classification || client.company_type || '-'}</span>
            </div>

            <div className={styles.cardBody} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 2 }}>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>대표자</span>
                        <span className={styles.infoValue}>{client.representative_name}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>KCB</span>
                        <span className={styles.infoValue}>{client.company_credit_rating_kcb || '-'}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>NICE</span>
                        <span className={styles.infoValue}>{client.company_credit_rating_nice || '-'}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>연매출</span>
                        <span className={styles.infoValue}>{client.annual_sales || '-'}</span>
                    </div>
                </div>
                {client.creditRatingImage && (
                    <div style={{ flex: 1 }}>
                        <img src={client.creditRatingImage} alt="기업신용등급" style={{ width: '100%', height: 'auto', borderRadius: '4px' }} />
                    </div>
                )}
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.footerRow}>
                    <span className={styles.footerLabel}>총 케이스</span>
                    <span className={styles.footerValue}>{client.totalCases}건</span>
                </div>
                <div className={styles.footerRow}>
                    <span className={styles.footerLabel}>누적승인금액</span>
                    <span className={styles.footerValue}>{formatApprovalAmount(approvedAmount)}</span>
                </div>
            </div>
        </div>
    );
}
