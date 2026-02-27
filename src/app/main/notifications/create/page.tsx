'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './create.module.css';
import { getAdminData } from '@/lib/auth';
import Modal from '@/app/components/Modal/Modal';

interface User {
    id: number;
    name: string;
    user_id: string;
    position: { name: string };
}

export default function NotificationCreatePage() {
    const router = useRouter();
    const [type, setType] = useState<'global' | 'personal'>('global');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorModal, setErrorModal] = useState({ open: false, message: '' });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/users');
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data.map((u: any) => ({
                        id: u.id,
                        name: u.name,
                        user_id: u.user_id,
                        position: u.position || { name: '-' }
                    })));
                }
            } catch (error) {
                console.error('유저 조회 실패:', error);
            }
        };
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(user =>
        user.name.includes(searchQuery) || user.user_id.includes(searchQuery)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !content.trim()) {
            setErrorModal({ open: true, message: '제목과 내용을 입력해주세요.' });
            return;
        }

        if (type === 'personal' && !selectedUser) {
            setErrorModal({ open: true, message: '수신할 유저를 선택해주세요.' });
            return;
        }

        const adminData = getAdminData();
        if (!adminData?.id) {
            setErrorModal({ open: true, message: '로그인 정보를 확인할 수 없습니다.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    type,
                    sender_id: adminData.id,
                    receiver_id: type === 'personal' ? selectedUser?.id : null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '알림 발송 실패');
            }

            window.dispatchEvent(new Event('notificationUpdate'));
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorModal({
                open: true,
                message: error instanceof Error ? error.message : '알림 발송 실패'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div>
                    <h1 className={styles.mainTitle}>알림 작성</h1>
                    <p className={styles.subTitle}>유저들에게 새로운 알림을 발송합니다.</p>
                </div>
            </div>

            <div className={styles.contentWrap}>
                <form className={styles.formCard} onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label>알림 대상 구분</label>
                        <div className={styles.radioGroup}>
                            <label className={styles.radioOption}>
                                <input
                                    type="radio"
                                    name="type"
                                    value="global"
                                    checked={type === 'global'}
                                    onChange={() => setType('global')}
                                />
                                전체 공지 (모든 유저)
                            </label>
                            <label className={styles.radioOption}>
                                <input
                                    type="radio"
                                    name="type"
                                    value="personal"
                                    checked={type === 'personal'}
                                    onChange={() => setType('personal')}
                                />
                                개인 알림 (특정 유저 선택)
                            </label>
                        </div>
                    </div>

                    {type === 'personal' && (
                        <div className={styles.formGroup}>
                            <label>수신 유저 선택</label>
                            <div className={styles.userSelectSection}>
                                <div className={styles.userSearchBox}>
                                    <input
                                        type="text"
                                        className={styles.inputField}
                                        placeholder="이름 또는 아이디로 검색..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className={styles.userList}>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <div
                                                key={user.id}
                                                className={`${styles.userItem} ${selectedUser?.id === user.id ? styles.selected : ''}`}
                                                onClick={() => setSelectedUser(user)}
                                            >
                                                <div className={styles.userInfo}>
                                                    <span className={styles.userName}>{user.name} ({user.user_id})</span>
                                                    <span className={styles.userDept}>{user.position.name}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                            검색된 유저가 없습니다.
                                        </div>
                                    )}
                                </div>
                                {selectedUser && (
                                    <div style={{ marginTop: '10px', color: 'var(--main-color)', fontWeight: '700' }}>
                                        선택됨: {selectedUser.name} ({selectedUser.user_id})
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label htmlFor="title">알림 제목</label>
                        <input
                            id="title"
                            type="text"
                            className={styles.inputField}
                            placeholder="제목을 입력하세요."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="content">알림 상세 내용</label>
                        <textarea
                            id="content"
                            className={styles.textareaField}
                            placeholder="전달하고자 하는 상세 내용을 입력하세요."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>

                    <div className={styles.btnWrap}>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={() => router.push('/main/notifications')}
                        >
                            취소
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                            {isSubmitting ? '발송 중...' : '알림 발송하기'}
                        </button>
                    </div>
                </form>
            </div>

            <Modal
                isOpen={successModalOpen}
                message="알림이 성공적으로 발송되었습니다."
                type="success"
                confirmText="확인"
                onClose={() => router.push('/main/notifications')}
                onConfirm={() => router.push('/main/notifications')}
            />

            <Modal
                isOpen={errorModal.open}
                message={errorModal.message}
                type="error"
                confirmText="닫기"
                onClose={() => setErrorModal({ open: false, message: '' })}
            />
        </div>
    );
}
