'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiUser, FiUsers, FiLogOut, FiFile, FiClock, FiHome, FiBriefcase, FiBarChart2, FiBell, FiCheckCircle } from 'react-icons/fi';
import { clearAuthToken, getAdminData, type AdminData } from '@/lib/auth';
import styles from './sidebar.module.css';

interface MenuItem {
    path: string;
    label: string;
}

const menuItems: MenuItem[] = [
    { path: '/main/home', label: '메인홈' },
    { path: '/main/profile', label: '마이페이지' },
    { path: '/main/clients', label: '고객사' },
    { path: '/main/document_submission', label: '기업관리' },
    { path: '/main/notifications', label: '알림' },
    { path: '/main/performance_settlement', label: '성과 정산' },
    { path: '/main/admin/approvals', label: '가입 승인' },
    { path: '/main/user_management', label: '사용자 관리' },
    { path: '/main/history', label: '히스토리' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [adminData, setAdminData] = useState<AdminData | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
    const [approvalRequestCount, setApprovalRequestCount] = useState(0);
    const [supervisorInfo, setSupervisorInfo] = useState<{ name: string; user_id: string } | null>(null);


    const fetchUnreadNotificationCount = async () => {
        try {
            const adminData = getAdminData();
            if (!adminData) return;
            const userIdParam = adminData.id ? adminData.id : adminData.user_id;

            const res = await fetch(`/api/notifications?userId=${userIdParam}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const unread = data.filter((n: any) => !n.is_read).length;
                setUnreadNotificationCount(unread);
            }
        } catch (error) {
            console.error('알림 갯수 조회 실패:', error);
        }
    };

    const fetchPendingApprovalCount = async () => {
        try {
            const adminData = getAdminData();
            // 대표(level 1), 대표실무자(level 2)만 조회 가능
            const level = adminData?.position?.level;
            if (level !== 1 && level !== 2) return;

            const res = await fetch('/api/users?status=pending', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setPendingApprovalCount(data.length || 0);
            }
        } catch (error) {
            console.error('승인 대기 수 조회 실패:', error);
        }
    };

    const fetchApprovalRequestCount = async () => {
        try {
            const adminData = getAdminData();
            // 대표(level 1)만 조회 가능
            const level = adminData?.position?.level;
            if (level !== 1) return;

            const res = await fetch('/api/documents/approval-request-count', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setApprovalRequestCount(data.count || 0);
            }
        } catch (error) {
            console.error('승인요청 건수 조회 실패:', error);
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
        const initAdminData = async () => {
            let data = getAdminData();
            if (!data) {
                // 새 탭 등 sessionStorage가 비어있으면 쿠키로 API 조회
                try {
                    const res = await fetch('/api/auth/me');
                    if (res.ok) {
                        data = await res.json();
                        sessionStorage.setItem('admin_data', JSON.stringify(data));
                    }
                } catch (e) {
                    console.error('사용자 정보 조회 실패:', e);
                }
            }
            if (data) {
                setAdminData(data);
                if (data.position?.level === 4 && data.supervisor_id) {
                    fetchSupervisorInfo(data.supervisor_id);
                }
            }
            fetchUnreadNotificationCount();
            fetchPendingApprovalCount();
        };

        initAdminData();
        fetchApprovalRequestCount();

        // 알림 업데이트 이벤트 리스닝
        const handleNotificationUpdate = () => {
            fetchUnreadNotificationCount();
            fetchPendingApprovalCount();
            fetchApprovalRequestCount();
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
        // 뒤로가기 비활성화 (로그인 페이지에서 뒤로갈 수 없게)
        window.history.pushState(null, '', '/login');
        window.addEventListener('popstate', function(e) {
            window.history.pushState(null, '', '/login');
        });
        window.location.href = '/login';
    };

    return (
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
            <div className={styles.headerWrapper}>
                <button
                    className={styles.logoWrapper}
                    onClick={() => router.push('/main/home')}
                    aria-label="메인페이지로 이동"
                >
                    <Image src="/logo.png" alt="로고" width={220} height={120} className={styles.logoImage} priority />
                </button>
                <div 
                    className={styles.headerUserName}
                    onClick={() => router.push('/main/profile')}
                    style={{ cursor: 'pointer' }}
                >
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
                        // 가입 승인은 대표(level=1)만 접근 가능
                        if (item.path === '/main/admin/approvals' && adminData?.position?.level !== 1) {
                            return null;
                        }
                        // 사용자 관리는 대표자(level=1)만 접근 가능
                        if (item.path === '/main/user_management' && adminData?.position?.level !== 1) {
                            return null;
                        }
                        // 히스토리는 대표자(level=1)만 접근 가능
                        if (item.path === '/main/history' && adminData?.position?.level !== 1) {
                            return null;
                        }
                        // 성과 정산은 대표자(level=1)만 접근 가능
                        if (item.path === '/main/performance_settlement' && adminData?.position?.level !== 1) {
                            return null;
                        }

                        const isActive = pathname === item.path ||
                            (item.path === '/main/document_submission' && pathname.startsWith('/main/company_create')) ||
                            (item.path === '/main/performance_settlement' && pathname.startsWith('/main/performance_settlement')) ||
                            (item.path === '/main/user_management' && pathname.startsWith('/main/user_create')) ||
                            (item.path === '/main/notifications' && pathname.startsWith('/main/notifications'));

                        return (
                            <li key={item.path} className={styles.menuItemWrapper}>
                                <button
                                    className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                                    onClick={() => handleMenuClick(item.path)}
                                >
                                    {item.path === '/main/user_management' ? (
                                        <FiUsers className={styles.menuIcon} />
                                    ) : item.path === '/main/admin/approvals' ? (
                                        <FiCheckCircle className={styles.menuIcon} />
                                    ) : item.path === '/main/profile' ? (
                                        <FiUser className={styles.menuIcon} />
                                    ) : item.path === '/main/clients' ? (
                                        <FiBriefcase className={styles.menuIcon} />
                                    ) : item.path === '/main/performance_settlement' ? (
                                        <FiBarChart2 className={styles.menuIcon} />
                                    ) : item.path === '/main/history' ? (
                                        <FiClock className={styles.menuIcon} />
                                    ) : item.path === '/main/home' ? (
                                        <FiHome className={styles.menuIcon} />
                                    ) : item.path === '/main/notifications' ? (
                                        <FiBell className={styles.menuIcon} />
                                    ) : (
                                        <FiFile className={styles.menuIcon} />
                                    )}
                                    {item.label}
                                    {item.path === '/main/document_submission' && approvalRequestCount > 0 && (
                                        <span className={styles.notificationBadge} style={{ backgroundColor: '#e03131' }}>{approvalRequestCount}</span>
                                    )}
                                    {item.path === '/main/admin/approvals' && pendingApprovalCount > 0 && (
                                        <span className={styles.notificationBadge} style={{ backgroundColor: '#e03131' }}>{pendingApprovalCount}</span>
                                    )}
                                    {item.path === '/main/notifications' && unreadNotificationCount > 0 && (
                                        <span className={styles.notificationBadge} style={{ backgroundColor: '#e03131' }}>{unreadNotificationCount}</span>
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
