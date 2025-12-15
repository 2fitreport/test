'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiUser, FiUsers, FiLogOut, FiFile } from 'react-icons/fi';
import { clearAuthToken, getAdminData } from '@/lib/auth';
import styles from './sidebar.module.css';

interface MenuItem {
    path: string;
    label: string;
}

const menuItems: MenuItem[] = [
    { path: '/main/user_management', label: '사용자 관리' },
    { path: '/main/document_submission', label: '서류 제출' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [adminData, setAdminData] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        setAdminData(getAdminData());
        fetchNotificationCount();
    }, []);

    const fetchNotificationCount = async () => {
        try {
            const response = await fetch('/api/documents/notification-count');
            if (response.ok) {
                const data = await response.json();
                setNotificationCount(data.count || 0);
            }
        } catch (error) {
            console.error('알림 건수 조회 실패:', error);
        }
    };

    const handleMenuClick = (path: string) => {
        router.push(path);
        setIsMenuOpen(false);
    };

    const getNameDisplay = () => {
        if (!adminData?.name) return '';

        const positionLevel = adminData.position?.level;
        const isRepresentative = positionLevel === 1;
        const suffix = isRepresentative ? ' 대표님' : '님';

        return `${adminData.name}${suffix}`;
    };

    const handleLogout = () => {
        clearAuthToken();
        document.cookie = 'auth_token=; path=/; max-age=0';
        router.push('/login');
    };

    return (
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
            <div className={styles.headerWrapper}>
                <div className={styles.logoWrapper}>
                    <Image src="/logo.png" alt="로고" width={120} height={80} className={styles.logoImage} priority />
                </div>
                <div className={styles.headerUserName}>
                    <FiUser className={styles.headerUserIcon} />
                    <p className={styles.headerUserText}>{getNameDisplay()}</p>
                </div>
                <button
                    className={`${styles.hamburger} ${isMenuOpen ? styles.active : ''}`}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="메뉴 토글"
                >
                    <Image src="/menu.svg" alt="메뉴" width={24} height={24} />
                </button>
            </div>
            <nav className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}>
                <ul className={styles.menuList}>
                    {menuItems.map((item) => (
                        <li key={item.path} className={styles.menuItemWrapper}>
                            <button
                                className={`${styles.menuItem} ${pathname === item.path ? styles.active : ''}`}
                                onClick={() => handleMenuClick(item.path)}
                            >
                                {item.path === '/main/user_management' ? (
                                    <FiUsers className={styles.menuIcon} />
                                ) : (
                                    <FiFile className={styles.menuIcon} />
                                )}
                                {item.label}
                                {item.path === '/main/document_submission' && notificationCount > 0 && (
                                    <span className={styles.notificationBadge}>{notificationCount}</span>
                                )}
                            </button>
                        </li>
                    ))}
                    <li className={styles.logoutMenuItem}>
                        <button
                            className={styles.menuItem}
                            onClick={() => {
                                handleLogout();
                                handleMenuClick('');
                            }}
                        >
                            <FiLogOut className={styles.menuIcon} />
                            로그아웃
                        </button>
                    </li>
                </ul>
            </nav>
            <div className={styles.userInfo}>
                <p className={styles.userName}>{getNameDisplay()}</p>
                <button className={styles.logoutButton} onClick={handleLogout}>
                    로그아웃
                </button>
            </div>
        </aside>
    );
}
