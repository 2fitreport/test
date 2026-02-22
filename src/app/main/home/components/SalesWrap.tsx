'use client';

import { useEffect, useState } from 'react';
import styles from './salesWrap.module.css';

interface SalesData {
    userId: string;
    name: string;
    inProgress: number;
    approved: number;
    rejected: number;
    approvalAmount: string;
    conversionRate: string;
}

function getConversionRateStyle(conversionRate: string) {
    if (conversionRate === '-') {
        return { color: '#999', fontWeight: 600 };
    }
    const rate = parseInt(conversionRate, 10);
    if (rate >= 75) {
        return {
            color: '#16a34a',
            fontWeight: 600,
            backgroundColor: '#dcfce7',
            padding: '4px 12px',
            borderRadius: '100px',
            display: 'inline-block'
        };
    } else {
        return {
            color: '#ea580c',
            fontWeight: 600,
            backgroundColor: '#fef3c7',
            padding: '4px 12px',
            borderRadius: '100px',
            display: 'inline-block'
        };
    }
}

export default function SalesWrap() {
    const [userLevel, setUserLevel] = useState<number>(0);
    const [salesData, setSalesData] = useState<SalesData[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [isRepresentative, setIsRepresentative] = useState(false);
    const [companyName, setCompanyName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const adminData = sessionStorage.getItem('admin_data');
        if (adminData) {
            try {
                const data = JSON.parse(adminData);
                setUserLevel(data.position?.level || 0);
                setCurrentUserId(data.user_id || '');
                setIsRepresentative(data.is_affiliation_representative || false);
                setCompanyName(data.company_name || '');
            } catch (error) {
                console.error('admin_data 파싱 실패:', error);
            }
        }
    }, []);

    // 영업자 데이터 로드
    useEffect(() => {
        if (userLevel === 0) return;

        const fetchSalesData = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();

                if (userLevel === 4) {
                    if (isRepresentative && companyName) {
                        // 소속대표: 같은 소속의 모든 영업자
                        params.append('companyName', companyName);
                    } else {
                        // 일반 영업자: 자신만
                        params.append('userId', currentUserId);
                    }
                }

                const response = await fetch(`/api/sales/stats?${params}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('영업자 데이터 조회 실패');
                }

                const data = await response.json();
                setSalesData(data);
            } catch (error) {
                console.error('영업자 데이터 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSalesData();
    }, [userLevel, currentUserId, isRepresentative, companyName]);

    // 대표(1), 대표실무자(2): 모든 영업자 데이터
    // 영업자(4): 자신의 데이터만
    // 나머지: 표시 안 함
    const shouldDisplay = userLevel === 1 || userLevel === 2 || userLevel === 4;

    if (!shouldDisplay) {
        return null;
    }

    return (
        <div className={styles.salesWrap}>
            <h2>영업자 현황</h2>
            <div className={styles.tableWrapper}>
                <table className={styles.salesTable}>
                    <thead>
                        <tr>
                            <th>영업자</th>
                            <th>진행</th>
                            <th>승인</th>
                            <th>반려</th>
                            <th>승인금액</th>
                            <th>전환율</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center' }}>로딩 중...</td>
                            </tr>
                        ) : salesData.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center' }}>데이터가 없습니다.</td>
                            </tr>
                        ) : (
                            salesData.map((row) => (
                                <tr key={row.userId}>
                                    <td>{row.name}</td>
                                    <td style={{ color: '#2563eb', fontWeight: 600, fontSize: '16px' }}>{row.inProgress}</td>
                                    <td style={{ color: '#16a34a', fontWeight: 600, fontSize: '16px' }}>{row.approved}</td>
                                    <td style={{ color: '#dc2626', fontWeight: 600, fontSize: '16px' }}>{row.rejected}</td>
                                    <td>{row.approvalAmount}</td>
                                    <td><span style={getConversionRateStyle(row.conversionRate)}>{row.conversionRate}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
