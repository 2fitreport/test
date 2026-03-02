'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Modal from '@/components/Modal/Modal';
import styles from './page.module.css';

interface ModalState {
  isOpen: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    user_id: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    email: '',
    company_name: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
  });
  
  // 상태 관리
  const [isIdChecked, setIsIdChecked] = useState(false);
  const [isIdAvailable, setIsIdAvailable] = useState(false);
  const [isCheckingId, setIsCheckingId] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  // 아이디 변경 시 상태 초기화
  useEffect(() => {
    setIsIdChecked(false);
    setIsIdAvailable(false);
  }, [formData.user_id]);

  // 연락처 자동 하이픈 함수
  const formatPhoneNumber = (value: string) => {
    const number = value.replace(/[^0-9]/g, '');
    let result = '';

    if (number.length <= 3) {
      result = number;
    } else if (number.length <= 7) {
      result = `${number.substring(0, 3)}-${number.substring(3)}`;
    } else {
      result = `${number.substring(0, 3)}-${number.substring(3, 7)}-${number.substring(7, 11)}`;
    }
    return result;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    // 아이디 입력 시 영문, 숫자 외 모든 문자 즉시 제거 및 20자 제한
    if (name === 'user_id') {
        processedValue = value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }
    
    // 연락처 자동 하이픈 및 13자 제한
    if (name === 'phone') {
        processedValue = formatPhoneNumber(value).substring(0, 13);
    }

    // 계좌번호 숫자만 허용
    if (name === 'account_number') {
        processedValue = value.replace(/[^0-9]/g, '');
    }

    setFormData((prev) => ({ 
      ...prev, 
      [name]: processedValue 
    }));
  };

  const handleCheckDuplicate = async () => {
    if (!formData.user_id.trim()) {
      setModal({ isOpen: true, message: '아이디를 입력해주세요.', type: 'error' });
      return;
    }

    if (formData.user_id.length < 4) {
      setModal({ isOpen: true, message: '아이디는 최소 4자 이상이어야 합니다.', type: 'error' });
      return;
    }

    setIsCheckingId(true);
    try {
      const response = await fetch(`/api/users/check-duplicate?user_id=${encodeURIComponent(formData.user_id)}`);
      if (response.ok) {
        const data = await response.json();
        setIsIdChecked(true);
        setIsIdAvailable(!data.exists);
        
        if (data.exists) {
          setModal({ isOpen: true, message: '이미 사용 중인 아이디입니다.', type: 'error' });
        } else {
          setModal({ isOpen: true, message: '사용 가능한 아이디입니다.', type: 'success' });
        }
      }
    } catch (error) {
      setModal({ isOpen: true, message: '중복 확인 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsCheckingId(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 순차적 모달 유효성 검사
    if (!formData.user_id) {
        setModal({ isOpen: true, message: '아이디를 입력해주세요.', type: 'error' });
        return;
    }
    if (formData.user_id.length < 4) {
        setModal({ isOpen: true, message: '아이디는 최소 4자 이상이어야 합니다.', type: 'error' });
        return;
    }
    if (!isIdChecked || !isIdAvailable) {
        setModal({ isOpen: true, message: '아이디 중복 확인을 해주세요.', type: 'error' });
        return;
    }
    
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!formData.password) {
        setModal({ isOpen: true, message: '비밀번호를 입력해주세요.', type: 'error' });
        return;
    }
    if (!passwordRegex.test(formData.password)) {
        setModal({ isOpen: true, message: '영문, 숫자, 특수문자를 포함하여 8자 이상 입력해야 합니다.', type: 'error' });
        return;
    }
    
    if (formData.password !== formData.confirmPassword) {
        setModal({ isOpen: true, message: '비밀번호가 일치하지 않습니다.', type: 'error' });
        return;
    }
    if (!formData.name) {
        setModal({ isOpen: true, message: '이름을 입력해주세요.', type: 'error' });
        return;
    }
    if (!formData.email) {
        setModal({ isOpen: true, message: '이메일을 입력해주세요.', type: 'error' });
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        setModal({ isOpen: true, message: '올바른 이메일 형식이 아닙니다.', type: 'error' });
        return;
    }
    if (!formData.phone) {
        setModal({ isOpen: true, message: '연락처를 입력해주세요.', type: 'error' });
        return;
    }
    if (formData.phone.length < 12) {
        setModal({ isOpen: true, message: '올바른 연락처 형식이 아닙니다.', type: 'error' });
        return;
    }

    // 계좌 정보 필수 검증 추가
    if (!formData.bank_name) {
        setModal({ isOpen: true, message: '은행명을 입력해주세요.', type: 'error' });
        return;
    }
    if (!formData.account_holder) {
        setModal({ isOpen: true, message: '예금주를 입력해주세요.', type: 'error' });
        return;
    }
    if (!formData.account_number) {
        setModal({ isOpen: true, message: '계좌번호를 입력해주세요.', type: 'error' });
        return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setModal({ isOpen: true, message: data.message, type: 'success' });
      } else {
        setModal({ isOpen: true, message: data.message || '가입 신청 중 오류가 발생했습니다.', type: 'error' });
      }
    } catch (error) {
      setModal({ isOpen: true, message: '서버와 통신 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    if (modal.type === 'success' && modal.message.includes('완료')) {
      router.push('/login');
    }
    setModal({ ...modal, isOpen: false });
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <Image src="/logo.png" alt="로고" fill className={styles.logo} priority />
      </div>
      
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>회원가입 신청</h2>
        <p className={styles.subtitle}>정확한 정보를 입력해 주세요. 관리자 승인 후 이용 가능합니다.</p>

        {/* 아이디 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>아이디 <span className={styles.required}>*</span></label>
          <div className={styles.inputRow}>
            <input
              className={`${styles.input} ${styles.inputWithButton}`}
              name="user_id"
              type="text"
              placeholder="영문, 숫자만 입력 가능"
              value={formData.user_id}
              onChange={handleChange}
              disabled={isLoading || isCheckingId}
            />
            <button 
              type="button" 
              className={styles.checkButton}
              onClick={handleCheckDuplicate}
              disabled={isLoading || isCheckingId || !formData.user_id}
            >
              중복 확인
            </button>
          </div>
          {isIdChecked && isIdAvailable && (
            <p className={`${styles.availabilityMessage} ${styles.available}`}>✓ 사용 가능한 아이디입니다.</p>
          )}
        </div>

        {/* 비밀번호 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>비밀번호 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            name="password"
            type="password"
            placeholder="비밀번호 입력"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
          />
          <p className={styles.helperText}>영문, 숫자, 특수문자를 포함하여 8자 이상 입력해야 합니다.</p>
        </div>

        {/* 비밀번호 확인 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>비밀번호 확인 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            name="confirmPassword"
            type="password"
            placeholder="비밀번호 재입력"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        {/* 이름 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>이름 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            name="name"
            type="text"
            placeholder="성함을 입력하세요"
            value={formData.name}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        {/* 이메일 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>이메일 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            name="email"
            type="email"
            placeholder="example@company.com"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        {/* 연락처 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>연락처 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            name="phone"
            type="tel"
            placeholder="010-0000-0000"
            value={formData.phone}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        {/* 소속 */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>소속 (선택)</label>
          <input
            className={styles.input}
            name="company_name"
            type="text"
            placeholder="소속 회사명을 입력하세요"
            value={formData.company_name}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        <div className={styles.sectionDivider}>계좌 정보</div>

        <div className={styles.inputRow}>
            <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label className={styles.label}>은행명 <span className={styles.required}>*</span></label>
                <input
                    className={styles.input}
                    name="bank_name"
                    type="text"
                    placeholder="은행명"
                    value={formData.bank_name}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
            <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label className={styles.label}>예금주 <span className={styles.required}>*</span></label>
                <input
                    className={styles.input}
                    name="account_holder"
                    type="text"
                    placeholder="예금주"
                    value={formData.account_holder}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>계좌번호 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            name="account_number"
            type="text"
            placeholder="숫자만 입력하세요"
            value={formData.account_number}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        <button 
          className={styles.button} 
          type="submit" 
          disabled={isLoading}
          style={{ marginTop: '30px' }}
        >
          {isLoading ? '신청 처리 중...' : '회원가입 신청 완료'}
        </button>

        <div className={styles.linkWrapper}>
          <button type="button" onClick={() => router.push('/login')} className={styles.linkButton}>
            이미 계정이 있으신가요? 로그인하기
          </button>
        </div>
      </form>

      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onClose={closeModal}
        showConfirmButton={false}
        confirmText="확인"
      />
    </div>
  );
}
