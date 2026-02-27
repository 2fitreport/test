'use client';

import styles from '../notifications.module.css';

export interface Notification {
    id: number;
    title: string;
    content: string;
    type: 'global' | 'personal';
    created_at: string;
    is_read: boolean;
    sender?: {
        id: number;
        name: string;
        user_id: string;
    };
}

interface NotificationItemProps {
    notification: Notification;
    index: number;
    onClick: (id: number) => void;
}

export default function NotificationItem({ notification, index, onClick }: NotificationItemProps) {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    return (
        <tr
            className={`${styles.documentRow} ${!notification.is_read ? styles.unreadRow : ''}`}
            onClick={() => onClick(notification.id)}
        >
            <td style={{ textAlign: 'center', width: '60px' }}>{index}</td>
            <td style={{ width: '120px' }}>
                <span className={`${styles.itemType} ${notification.type === 'global' ? styles.typeGlobal : styles.typePersonal}`}>
                    {notification.type === 'global' ? '전체 알림' : '개인 알림'}
                </span>
            </td>
            <td>
                <div className={styles.itemTitle}>
                    {!notification.is_read && <span className={styles.unreadIndicator} />}
                    {notification.title}
                </div>
            </td>
            <td style={{ width: '120px' }}>
                <span className={styles.itemDate}>{notification.sender?.name || '-'}</span>
            </td>
            <td style={{ width: '180px' }}>
                <span className={styles.itemDate}>{formatDate(notification.created_at)}</span>
            </td>
            <td style={{ width: '100px', textAlign: 'center' }}>
                <span className={`${styles.statusBadge} ${notification.is_read ? styles.statusRead : styles.statusUnread}`}>
                    {notification.is_read ? '읽음' : '미확인'}
                </span>
            </td>
        </tr>
    );
}
