'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import Modal from '@/components/Modal/Modal';
import Spinner from '@/app/components/Spinner/Spinner';
import styles from './profile.module.css';

interface UserData {
  id: number;
  user_id: string;
  name: string;
  position?: { name: string };
  company_name: string;
  phone: string;
  email_display: string;
  address: string;
  resident_id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [modal, setModal] = useState({ 
    isOpen: false, 
    message: '', 
    type: 'info' as 'success' | 'error' | 'warning'
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const admin = getAdminData();
      if (!admin?.id) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`/api/users/${admin.id}`);
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
        }
      } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      setModal({ isOpen: true, message: '모든 비밀번호 필드를 입력해주세요.', type: 'error' });
      return;
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(passwords.newPassword)) {
      setModal({ isOpen: true, message: '새 비밀번호는 영문, 숫자, 특수문자를 포함하여 8자 이상이어야 합니다.', type: 'error' });
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setModal({ isOpen: true, message: '새 비밀번호가 일치하지 않습니다.', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`/api/users/${userData?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          password: passwords.newPassword,
        }),
      });

      if (res.ok) {
        setModal({ isOpen: true, message: '비밀번호가 성공적으로 변경되었습니다.', type: 'success' });
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = await res.json();
        setModal({ isOpen: true, message: data.message || '변경 실패', type: 'error' });
      }
    } catch (error) {
      setModal({ isOpen: true, message: '서버 오류가 발생했습니다.', type: 'error' });
    }
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  if (isLoading) return <Spinner fullScreen />;
  if (!userData) return null;

  return (
    <div className={styles.container}>
      <div className={styles.titleWrap}>
        <h1 className={styles.pageTitle}>마이페이지</h1>
        <p className={styles.pageSubtitle}>회원님의 정보를 확인하고 보안 설정을 관리합니다.</p>
      </div>

      <div className={styles.contentWrap}>
            
        {/* 사용자 정보 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>회원 정보</h2>
          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>이름</div>
              <div className={styles.infoValue}>{userData.name}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>아이디</div>
              <div className={styles.infoValue}>{userData.user_id}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>주민등록번호</div>
              <div className={styles.infoValue}>{userData.resident_id || '-'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>주소</div>
              <div className={styles.infoValue}>{userData.address || '-'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>직책</div>
              <div className={styles.infoValue}>{userData.position?.name || '미지정'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>소속</div>
              <div className={styles.infoValue}>{userData.company_name || '미지정'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>연락처</div>
              <div className={styles.infoValue}>{userData.phone}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>이메일</div>
              <div className={styles.infoValue}>{userData.email_display || '-'}</div>
            </div>
          </div>
        </section>

        {/* 계좌 정보 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>계좌 정보</h2>
          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>은행명</div>
              <div className={styles.infoValue}>{userData.bank_name || '-'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>계좌번호</div>
              <div className={styles.infoValue}>{userData.account_number || '-'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>예금주</div>
              <div className={styles.infoValue}>{userData.account_holder || '-'}</div>
            </div>
          </div>
        </section>

        {/* 비밀번호 변경 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>보안 설정</h2>
              
          <form className={styles.passwordForm} onSubmit={handlePasswordChange}>
            <div className={styles.formGroup}>
              <label>현재 비밀번호</label>
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
                placeholder="현재 비밀번호를 입력하세요"
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>새 비밀번호</label>
              <input
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                placeholder="새 비밀번호를 입력하세요"
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>비밀번호 재확인</label>
              <input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                placeholder="비밀번호를 다시 입력하세요"
                className={styles.input}
              />
            </div>
            <button type="submit" className={styles.submitBtn}>
              비밀번호 변경
            </button>
          </form>
        </section>
      </div>

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
