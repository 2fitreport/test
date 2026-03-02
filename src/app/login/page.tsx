'use client';

import Image from 'next/image';
import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal/Modal';
import { setAuthToken, getAuthToken } from '@/lib/auth';
import styles from './page.module.css';

interface ModalState {
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

export default function LoginPage() {
    const router = useRouter();
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [rememberUserId, setRememberUserId] = useState(false);
    const [modal, setModal] = useState<ModalState>({
        isOpen: false,
        message: '',
        type: 'info',
    });

    useEffect(() => {
        // 이미 로그인된 상태면 문서 제출 페이지로 리다이렉트
        const authToken = getAuthToken();
        if (authToken) {
            router.push('/main/home');
        }

        // localStorage에서 저장된 아이디 불러오기
        const savedUserId = localStorage.getItem('saved_user_id');
        if (savedUserId) {
            setUserId(savedUserId);
            setRememberUserId(true);
        }
    }, [router]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // 아이디 저장 여부에 따라 처리
                if (rememberUserId) {
                    localStorage.setItem('saved_user_id', userId);
                } else {
                    localStorage.removeItem('saved_user_id');
                }

                // 쿠키에 토큰 저장 (브라우저 종료 시 자동 삭제)
                document.cookie = `auth_token=${data.token}; path=/`;
                // 세션스토리지에 저장 (브라우저 종료 시 자동 삭제)
                setAuthToken(data.token, data.admin);
                // 문서 제출 페이지로 이동
                router.push('/main/home');
            } else {
                setModal({
                    isOpen: true,
                    message: data.message || '아이디 또는 비밀번호가 올바르지 않습니다.',
                    type: 'error',
                });
            }
        } catch {
            setModal({
                isOpen: true,
                message: '로그인 중 오류가 발생했습니다. 다시 시도해주세요.',
                type: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const closeModal = () => {
        setModal({ ...modal, isOpen: false });
    };

    return (
        <div className={styles.container}>
            <div className={styles.logoWrapper}>
                <Image src="/logo.png" alt="로고" fill className={styles.logo} priority />
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
                <input
                    className={styles.input}
                    type="text"
                    placeholder="아이디"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                />
                <input
                    className={styles.input}
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                />
                <div className={styles.rememberWrapper}>
                    <input
                        className={styles.checkbox}
                        type="checkbox"
                        id="rememberUserId"
                        checked={rememberUserId}
                        onChange={(e) => setRememberUserId(e.target.checked)}
                        disabled={isLoading}
                    />
                    <label htmlFor="rememberUserId" className={styles.checkboxLabel}>
                        아이디 저장
                    </label>
                </div>
                <button className={styles.button} type="submit" disabled={isLoading}>
                    {isLoading ? '로그인 중...' : '로그인'}
                </button>
                <div className={styles.signupLinkWrapper}>
                    <button 
                        type="button" 
                        onClick={() => router.push('/signup')} 
                        className={styles.signupLinkButton}
                        disabled={isLoading}
                    >
                        계정이 없으신가요? 회원가입 신청
                    </button>
                </div>
            </form>

            <Modal
                isOpen={modal.isOpen}
                message={modal.message}
                type={modal.type}
                onClose={closeModal}
                showConfirmButton={false}
            />
        </div>
    );
}
