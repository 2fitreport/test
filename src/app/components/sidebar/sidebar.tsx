'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAuthToken, getAdminData } from '@/lib/auth';
import styles from './sidebar.module.css';

interface MenuItem {
    path: string;
    label: string;
}

interface AdminData {
    name?: string;
    position?: string;
}

const menuItems: MenuItem[] = [
    { path: '/main/user_management', label: '사용자 관리' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [adminData, setAdminData] = useState<AdminData | null>(null);

    useEffect(() => {
        const data = getAdminData();
        setAdminData(data);
    }, []);

    const getNameDisplay = () => {
        if (!adminData?.name) return '';

        const isRepresentative = adminData.position === '대표';
        const suffix = isRepresentative ? ' 대표님' : '님';

        return `${adminData.name}${suffix}`;
    };

    const handleLogout = () => {
        clearAuthToken();
        document.cookie = 'auth_token=; path=/; max-age=0';
        router.push('/login');
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logoWrapper}>
                <Image src="/logo.png" alt="로고" width={120} height={80} className={styles.logoImage} priority />
            </div>
            <nav className={styles.nav}>
                <ul className={styles.menuList}>
                    {menuItems.map((item) => (
                        <li key={item.path}>
                            <button
                                className={`${styles.menuItem} ${pathname === item.path ? styles.active : ''}`}
                                onClick={() => router.push(item.path)}
                            >
                                {item.label}
                            </button>
                        </li>
                    ))}
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
