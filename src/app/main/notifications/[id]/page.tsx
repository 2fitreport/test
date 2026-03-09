'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './view.module.css';
import { Notification } from '../components/NotificationItem';
import { getAdminData } from '@/lib/auth';
import Modal from '@/app/components/Modal/Modal';
import Spinner from '@/app/components/Spinner/Spinner';

export default function NotificationViewPage() {
    const router = useRouter();
    const params = useParams();
    const [notification, setNotification] = useState<Notification | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorModal, setErrorModal] = useState({ open: false, message: '' });

    useEffect(() => {
        const fetchNotification = async () => {
            try {
                const adminData = getAdminData();
                if (!adminData?.id) return;

                const id = params.id;
                const res = await fetch(`/api/notifications/${id}?userId=${adminData.id}`);
                if (!res.ok) throw new Error('알림 조회 실패');

                const data = await res.json();
                setNotification(data);

                // 읽음 처리
                if (!data.is_read) {
                    await fetch(`/api/notifications/${id}/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: adminData.id }),
                    });
                    window.dispatchEvent(new Event('notificationUpdate'));
                }
            } catch (error) {
                console.error('알림 조회 실패:', error);
                setErrorModal({ open: true, message: '알림을 불러올 수 없습니다.' });
            } finally {
                setLoading(false);
            }
        };

        fetchNotification();
    }, [params.id]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    if (loading) {
        return <Spinner fullScreen />;
    }

    if (!notification) {
        return (
            <div style={{ padding: '100px', textAlign: 'center' }}>
                <p>알림을 찾을 수 없습니다.</p>
                <button onClick={() => router.push('/main/notifications')} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
                    목록으로 돌아가기
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div>
                    <h1 className={styles.mainTitle}>알림 상세</h1>
                    <p className={styles.subTitle}>알림의 세부 내용을 확인하세요.</p>
                </div>
            </div>

            <div className={styles.contentWrap}>
                <div className={styles.viewCard}>
                    <div className={styles.header}>
                        <span className={`${styles.notificationType} ${notification.type === 'global' ? styles.typeGlobal : styles.typePersonal}`}>
                            {notification.type === 'global' ? '전체 공지' : '개인 알림'}
                        </span>
                        <h2 className={styles.title}>{notification.title}</h2>
                        <div className={styles.metaInfo}>
                            <span>발신자: {notification.sender?.name || '-'}</span>
                            <span>|</span>
                            <span>작성일: {formatDate(notification.created_at)}</span>
                        </div>
                    </div>
                    <div className={styles.content}>
                        {notification.content}
                    </div>
                </div>

                <div className={styles.btnWrap}>
                    <button className={styles.listBtn} onClick={() => router.push('/main/notifications')}>
                        목록으로 돌아가기
                    </button>
                </div>
            </div>

            <Modal
                isOpen={errorModal.open}
                message={errorModal.message}
                type="error"
                onClose={() => {
                    setErrorModal({ open: false, message: '' });
                    router.push('/main/notifications');
                }}
            />
        </div>
    );
}
