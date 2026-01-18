'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiUser, FiUsers, FiLogOut, FiFile, FiClock } from 'react-icons/fi';
import { clearAuthToken, getAdminData } from '@/lib/auth';
import styles from './sidebar.module.css';

interface MenuItem {
    path: string;
    label: string;
}

const menuItems: MenuItem[] = [
    { path: '/main/document_submission', label: '기업관리' },
    { path: '/main/user_management', label: '사용자 관리' },
    { path: '/main/history', label: '히스토리' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [adminData, setAdminData] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [supervisorInfo, setSupervisorInfo] = useState<{ name: string; user_id: string } | null>(null);

    const fetchNotificationCount = async () => {
        try {
            const adminData = getAdminData();
            const isSalesManager = adminData?.position?.level === 4;
            const userId = adminData?.user_id;

            // 영업자는 자신의 반려/보완만, 다른 직급은 전체 반려/보완 조회
            const url = isSalesManager && userId
                ? `/api/documents/notification-count?user_id=${userId}`
                : '/api/documents/notification-count';

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setNotificationCount(data.count || 0);
            }
        } catch (error) {
            console.error('알림 건수 조회 실패:', error);
        }
    };

    const fetchSupervisorInfo = async (supervisorId: number) => {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const users = await response.json();
                const supervisor = users.find((user: any) => user.id === supervisorId);
                if (supervisor) {
                    setSupervisorInfo({
                        name: supervisor.name,
                        user_id: supervisor.user_id
                    });
                }
            }
        } catch (error) {
            console.error('검수자 정보 조회 실패:', error);
        }
    };

    useEffect(() => {
        const data = getAdminData();
        if (data) {
            setAdminData(data);
        }
        fetchNotificationCount();

        // 영업자(Level 4)인 경우 담당검수자 정보 조회
        if (data?.position?.level === 4 && data?.supervisor_id) {
            fetchSupervisorInfo(data.supervisor_id);
        }

        // 알림 업데이트 이벤트 리스닝
        const handleNotificationUpdate = () => {
            fetchNotificationCount();
        };

        window.addEventListener('notificationUpdate', handleNotificationUpdate);
        return () => window.removeEventListener('notificationUpdate', handleNotificationUpdate);
    }, []);

    const handleMenuClick = (path: string) => {
        router.push(path);
        setIsMenuOpen(false);
    };

    const getNameDisplay = () => {
        if (!adminData?.name) return '';

        const positionLevel = adminData.position?.level;
        const positionName = adminData.position?.name;
        const isRepresentative = positionLevel === 1;

        if (isRepresentative) {
            return `${adminData.name} 대표님`;
        } else {
            return `${adminData.name}(${positionName})님`;
        }
    };

    const handleLogout = () => {
        clearAuthToken();
        document.cookie = 'auth_token=; path=/; max-age=0';
        localStorage.removeItem('auth_token');
        localStorage.removeItem('admin_data');
        // 전체 페이지를 새로고침하면서 로그인 페이지로 이동
        window.location.href = '/login';
    };

    return (
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
            <div className={styles.headerWrapper}>
                <button
                    className={styles.logoWrapper}
                    onClick={() => router.push('/main/document_submission')}
                    aria-label="메인페이지로 이동"
                >
                    <Image src="/logo.png" alt="로고" width={120} height={80} className={styles.logoImage} priority />
                </button>
                <div className={styles.headerUserName}>
                    <FiUser className={styles.headerUserIcon} />
                    <div className={styles.headerUserInfo}>
                        <p className={styles.headerUserText}>{getNameDisplay()}</p>
                        {adminData?.position?.level === 4 && supervisorInfo && (
                            <p className={styles.headerSupervisorText}>
                                검수자: {supervisorInfo.name} ({supervisorInfo.user_id})
                            </p>
                        )}
                    </div>
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
                    {menuItems.map((item) => {
                        // 사용자 관리는 대표자(level=1)만 접근 가능
                        if (item.path === '/main/user_management' && adminData?.position?.level !== 1) {
                            return null;
                        }
                        // 히스토리는 대표자(level=1)만 접근 가능
                        if (item.path === '/main/history' && adminData?.position?.level !== 1) {
                            return null;
                        }

                        const isActive = pathname === item.path ||
                            (item.path === '/main/document_submission' && pathname.startsWith('/main/company_create'));

                        return (
                            <li key={item.path} className={styles.menuItemWrapper}>
                                <button
                                    className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                                    onClick={() => handleMenuClick(item.path)}
                                >
                                    {item.path === '/main/user_management' ? (
                                        <FiUsers className={styles.menuIcon} />
                                    ) : item.path === '/main/history' ? (
                                        <FiClock className={styles.menuIcon} />
                                    ) : (
                                        <FiFile className={styles.menuIcon} />
                                    )}
                                    {item.label}
                                    {item.path === '/main/document_submission' && notificationCount > 0 && (
                                        <span className={styles.notificationBadge}>{notificationCount}</span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
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
                {adminData?.position?.level === 4 && supervisorInfo && (
                    <p className={styles.supervisorInfo}>
                        검수자: {supervisorInfo.name} ({supervisorInfo.user_id})
                    </p>
                )}
                <button className={styles.logoutButton} onClick={handleLogout}>
                    로그아웃
                </button>
            </div>
        </aside>
    );
}
