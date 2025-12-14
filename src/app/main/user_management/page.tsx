'use client';

import { useState } from 'react';
import UserStats from './UserStats';
import UserList from './UserList';
import styles from './page.module.css';

export default function UserManagementPage() {
    const [activeTab, setActiveTab] = useState<'stats' | 'users'>('stats');

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>사용자 관리</h1>

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
                        <UserList />
                    </div>
                </div>
            )}
        </div>
    );
}

