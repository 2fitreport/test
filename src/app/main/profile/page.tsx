'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiUser, FiMail, FiPhone, FiCreditCard, FiLock, FiShield, FiBriefcase } from 'react-icons/fi';
import { getAdminData } from '@/lib/auth';
import Modal from '@/components/Modal/Modal';
import styles from './profile.module.css';

interface UserData {
  id: number;
  user_id: string;
  name: string;
  position?: { name: string };
  company_name: string;
  phone: string;
  email_display: string;
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

  if (isLoading) return <div className={styles.loading}>정보를 불러오는 중입니다...</div>;
  if (!userData) return null;

  return (
    <div className={styles.container}>
      <div className={styles.titleWrap}>
        <span className={styles.mainTitle}>마이페이지</span>
        <p className={styles.subTitle}>회원님의 계정 보안 및 상세 정보를 관리합니다.</p>
      </div>

      <div className={styles.contentWrap}>
        <div className={styles.layout}>
          
          {/* 좌측 프로필 카드 */}
          <div className={styles.profileCard}>
            <div className={styles.avatarCircle}>
              <FiUser />
            </div>
            <h2 className={styles.userName}>{userData.name}</h2>
            <span className={styles.userRole}>{userData.position?.name || '일반 사용자'}</span>
            
            <div className={styles.quickStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>아이디</span>
                <span className={styles.statValue}>{userData.user_id}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>소속</span>
                <span className={styles.statValue}>{userData.company_name || '미지정'}</span>
              </div>
            </div>
          </div>

          {/* 우측 상세 콘텐츠 */}
          <div className={styles.mainContent}>
            
            {/* 상세 정보 섹션 */}
            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <FiShield style={{color: 'var(--main-color)', fontSize: '20px'}} />
                <h3>상세 정보</h3>
              </div>
              
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.label}>연락처</span>
                  <div className={styles.value}><FiPhone style={{marginRight: '8px'}} /> {userData.phone}</div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}>이메일 주소</span>
                  <div className={styles.value}><FiMail style={{marginRight: '8px'}} /> {userData.email_display || '-'}</div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}>은행명</span>
                  <div className={styles.value}><FiBriefcase style={{marginRight: '8px'}} /> {userData.bank_name || '-'}</div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}>계좌번호</span>
                  <div className={styles.value}><FiCreditCard style={{marginRight: '8px'}} /> {userData.account_number || '-'}</div>
                </div>
                <div className={`${styles.infoItem} ${styles.fullWidth}`}>
                  <span className={styles.label}>예금주</span>
                  <div className={styles.value}>{userData.account_holder || '-'}</div>
                </div>
              </div>
            </section>

            {/* 비밀번호 변경 섹션 */}
            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <FiLock style={{color: 'var(--main-color)', fontSize: '20px'}} />
                <h3>비밀번호 보안 설정</h3>
              </div>
              
              <form className={styles.passwordForm} onSubmit={handlePasswordChange}>
                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label>현재 비밀번호</label>
                  <div className={styles.inputWrapper}>
                    <input 
                      type="password" 
                      value={passwords.currentPassword}
                      onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
                      placeholder="현재 사용 중인 비밀번호를 입력하세요"
                    />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label>새 비밀번호</label>
                  <div className={styles.inputWrapper}>
                    <input 
                      type="password" 
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                      placeholder="신규 비밀번호 설정"
                    />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label>비밀번호 재확인</label>
                  <div className={styles.inputWrapper}>
                    <input 
                      type="password" 
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                      placeholder="한 번 더 입력해주세요"
                    />
                  </div>
                </div>
                <button type="submit" className={styles.submitBtn}>
                  안전하게 비밀번호 업데이트
                </button>
              </form>
            </section>

          </div>
        </div>
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
