'use client';

import { useState, useRef } from 'react';
import UserStats from './UserStats';
import UserList from './UserList';
import DocumentSubmission from './DocumentSubmission';
import styles from './page.module.css';

export default function UserManagementPage() {
    const [activeTab, setActiveTab] = useState<'stats' | 'users'>('stats');
    const userListRef = useRef<any>(null);

    const handleCreateUser = () => {
        userListRef.current?.openCreateModal();
    };

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

