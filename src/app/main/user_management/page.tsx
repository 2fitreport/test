'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import Spinner from '@/app/components/Spinner/Spinner';
import UserStats from './UserStats';
import UserList from './UserList';
import styles from './page.module.css';

export default function UserManagementPage() {
    const [activeTab, setActiveTab] = useState<'stats' | 'users'>('stats');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
    const userListRef = useRef<any>(null);
    const router = useRouter();

    useEffect(() => {
        const adminData = getAdminData();
        // level이 1(대표자)인지 확인
        if (adminData?.position?.level === 1) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            setShowAccessDeniedModal(true);
        }
        setLoading(false);
    }, []);

    const handleCreateUser = () => {
        userListRef.current?.openCreateModal();
    };

    const handleAccessDeniedConfirm = () => {
        setShowAccessDeniedModal(false);
        router.push('/main/document_submission');
    };

    if (loading) {
        return <Spinner fullScreen />;
    }

    if (!isAuthorized) {
        return (
            <>
                <ConfirmModal
                    isOpen={showAccessDeniedModal}
                    message="사용자 관리는 대표자만 접근할 수 있습니다."
                    type="error"
                    onConfirm={handleAccessDeniedConfirm}
                    confirmButtonText="확인"
                    hideCancel={true}
                />
            </>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.titleWrapper}>
                <h1 className={styles.title}>사용자 관리</h1>
                {activeTab === 'users' && (
                    <button className={styles.createButton} onClick={handleCreateUser}>
                        + 사용자 생성
                    </button>
                )}
            </div>

            <div className={styles.tabMenu}>
                <ul>
                    <li
                        className={activeTab === 'stats' ? styles.on : ''}
                        onClick={() => setActiveTab('stats')}
                    >
                        통계 정보
                    </li>
                    <li
                        className={activeTab === 'users' ? styles.on : ''}
                        onClick={() => setActiveTab('users')}
                    >
                        회원 정보
                    </li>
                </ul>
            </div>

            {activeTab === 'stats' && (
                <div className={styles.tabContent}>
                    <UserStats />
                </div>
            )}

            {activeTab === 'users' && (
                <div className={styles.tabContent}>
                    <div className={styles.userListSection}>
                        <UserList ref={userListRef} />
                    </div>
                </div>
            )}
        </div>
    );
}

