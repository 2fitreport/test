'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from '../notifications.module.css';
import NotificationItem, { Notification } from './NotificationItem';
import Pagination from '@/app/components/Pagination/Pagination';
import { FiInbox } from 'react-icons/fi';
import { getAdminData } from '@/lib/auth';

type SortColumn = 'type' | 'title' | 'sender_name' | 'created_at' | 'is_read';
type SortOrder = 'asc' | 'desc';

export default function NotificationList() {
    const router = useRouter();
    const [typeTab, setTypeTab] = useState<'all' | 'global' | 'personal'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const adminData = getAdminData();
                if (!adminData) {
                    setLoading(false);
                    return;
                }

                const userIdParam = adminData.id ? adminData.id : adminData.user_id;

                const res = await fetch(`/api/notifications?userId=${userIdParam}`);
                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data);
                }
            } catch (error) {
                console.error('알림 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, []);

    // 안 읽은 개수 계산
    const unreadCounts = {
        all: notifications.filter(n => !n.is_read).length,
        global: notifications.filter(n => n.type === 'global' && !n.is_read).length,
        personal: notifications.filter(n => n.type === 'personal' && !n.is_read).length
    };

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const getSortIcon = (column: SortColumn) => {
        const isActive = sortColumn === column;
        return (
            <span className={styles.sortIcon}>
                <span className={isActive && sortOrder === 'asc' ? styles.active : ''}>↑</span>
                <span className={isActive && sortOrder === 'desc' ? styles.active : ''}>↓</span>
            </span>
        );
    };

    const getFilteredAndSortedNotifications = () => {
        const filtered = notifications.filter(notif => {
            const matchesTab = typeTab === 'all' || notif.type === typeTab;
            const matchesSearch = notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 notif.content.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesUnread = unreadOnly ? !notif.is_read : true;

            return matchesTab && matchesSearch && matchesUnread;
        });

        const sorted = [...filtered].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortColumn) {
                case 'type':
                    aValue = a.type;
                    bValue = b.type;
                    break;
                case 'title':
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                case 'sender_name':
                    aValue = a.sender?.name || '';
                    bValue = b.sender?.name || '';
                    break;
                case 'created_at':
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    break;
                case 'is_read':
                    aValue = a.is_read ? 1 : 0;
                    bValue = b.is_read ? 1 : 0;
                    break;
                default:
                    aValue = '';
                    bValue = '';
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    };

    const filteredNotifications = getFilteredAndSortedNotifications();

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentNotifications = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem);

    const handleNotificationClick = (id: number) => {
        router.push(`/main/notifications/${id}`);
    };

    if (loading) {
        return <div style={{ padding: '100px', textAlign: 'center', color: '#999' }}>로딩 중...</div>;
    }

    return (
        <div className={styles.notificationContent}>
            <div className={styles.filterTabs}>
                <button
                    className={`${styles.tab} ${typeTab === 'all' ? styles.active : ''}`}
                    onClick={() => {
                        setTypeTab('all');
                        setCurrentPage(1);
                    }}
                >
                    전체
                    {unreadCounts.all > 0 && <span className={styles.tabBadge}>{unreadCounts.all}</span>}
                </button>
                <button
                    className={`${styles.tab} ${typeTab === 'global' ? styles.active : ''}`}
                    onClick={() => {
                        setTypeTab('global');
                        setCurrentPage(1);
                    }}
                >
                    전체 알림
                    {unreadCounts.global > 0 && <span className={styles.tabBadge}>{unreadCounts.global}</span>}
                </button>
                <button
                    className={`${styles.tab} ${typeTab === 'personal' ? styles.active : ''}`}
                    onClick={() => {
                        setTypeTab('personal');
                        setCurrentPage(1);
                    }}
                >
                    개인 알림
                    {unreadCounts.personal > 0 && <span className={styles.tabBadge}>{unreadCounts.personal}</span>}
                </button>
            </div>

            <div className={styles.notificationListContainer}>
                <div className={styles.header}>
                    <h2>알림 목록</h2>
                    <span className={styles.count}>총 {filteredNotifications.length}건</span>
                </div>

                <div className={styles.searchSection}>
                    <div className={styles.searchContainer}>
                        <Image
                            src="/search.svg"
                            alt="검색"
                            width={20}
                            height={20}
                            className={styles.searchIcon}
                        />
                        <input
                            type="text"
                            placeholder="검색..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    <div className={styles.filtersContainer}>
                        <label className={styles.unreadToggle}>
                            <input
                                type="checkbox"
                                checked={unreadOnly}
                                onChange={(e) => {
                                    setUnreadOnly(e.target.checked);
                                    setCurrentPage(1);
                                }}
                            />
                            읽지 않은 알림만 보기
                        </label>
                    </div>

                    <div className={styles.selectorsContainer}>
                        <div className={styles.itemsPerPageContainer}>
                            <label className={styles.itemsLabel}>표시 개수:</label>
                            <div className={styles.selectWrapper}>
                                <select
                                    className={styles.itemsSelect}
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5개씩 보기</option>
                                    <option value={10}>10개씩 보기</option>
                                    <option value={20}>20개씩 보기</option>
                                    <option value={30}>30개씩 보기</option>
                                    <option value={50}>50개씩 보기</option>
                                </select>
                                <Image
                                    src="/arrow.svg"
                                    alt="드롭다운"
                                    width={16}
                                    height={16}
                                    className={styles.selectArrow}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.documentTable}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '60px' }}>번호</th>
                                <th className={styles.sortableHeader} style={{ width: '120px' }} onClick={() => handleSort('type')}>
                                    유형{getSortIcon('type')}
                                </th>
                                <th className={styles.sortableHeader} onClick={() => handleSort('title')}>
                                    제목{getSortIcon('title')}
                                </th>
                                <th className={styles.sortableHeader} style={{ width: '120px' }} onClick={() => handleSort('sender_name')}>
                                    발신자{getSortIcon('sender_name')}
                                </th>
                                <th className={styles.sortableHeader} style={{ width: '180px' }} onClick={() => handleSort('created_at')}>
                                    일시{getSortIcon('created_at')}
                                </th>
                                <th className={styles.sortableHeader} style={{ width: '100px', textAlign: 'center' }} onClick={() => handleSort('is_read')}>
                                    상태{getSortIcon('is_read')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentNotifications.length > 0 ? (
                                currentNotifications.map((notification, index) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        index={indexOfFirstItem + index + 1}
                                        onClick={handleNotificationClick}
                                    />
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className={styles.emptyState}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}>
                                            <FiInbox className={styles.emptyIcon} />
                                            <p>검색 결과가 없습니다.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredNotifications.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
}
