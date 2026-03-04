'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal/Modal';
import styles from './approvals.module.css';
import { getAdminData } from '@/lib/auth';

interface PendingUser {
  id: number;
  user_id: string;
  name: string;
  phone: string;
  email_display: string;
  address: string;
  resident_id: string;
  company_name: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  created_at: string;
  status: string;
}

interface RepresentativeInfo {
  hasRepresentative: boolean;
  representative: {
    user_id: string;
    name: string;
  } | null;
}

interface ModalState {
  isOpen: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onConfirm?: () => void;
  showConfirmButton?: boolean;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 승인용 상세 설정 상태
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [selectedAffiliation, setSelectedAffiliation] = useState('');
  const [isRepresentative, setIsRepresentative] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [currentRepInfo, setCurrentRepInfo] = useState<RepresentativeInfo | null>(null);
  const [isCheckingRep, setIsCheckingRep] = useState(false);

  const [modal, setModal] = useState<ModalState>({ 
    isOpen: false, 
    message: '', 
    type: 'info',
    showConfirmButton: false 
  });

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // 대기 유저 조회
      const userRes = await fetch('/api/users?status=pending');
      if (userRes.ok) setUsers(await userRes.json());
      
      // 소속 목록 조회
      const affRes = await fetch('/api/affiliations');
      if (affRes.ok) {
          const data = await affRes.json();
          setAffiliations(data);
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const adminData = getAdminData();
    const level = adminData?.position?.level;
    if (!adminData || (level !== 1 && level !== 2)) {
      router.replace('/main/home');
      return;
    }
    fetchInitialData();
  }, []);

  // 소속이 변경될 때 현재 대표자 정보 가져오기
  useEffect(() => {
    if (!selectedAffiliation || !isApprovalModalOpen) {
      setCurrentRepInfo(null);
      return;
    }

    const checkRepresentative = async () => {
      setIsCheckingRep(true);
      try {
        const response = await fetch(`/api/affiliations/representative?company_name=${encodeURIComponent(selectedAffiliation)}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentRepInfo(data);
        }
      } catch (error) {
        console.error('소속대표 확인 실패:', error);
      } finally {
        setIsCheckingRep(false);
      }
    };

    checkRepresentative();
  }, [selectedAffiliation, isApprovalModalOpen]);

  const openApprovalDialog = (user: PendingUser) => {
    setSelectedUser(user);
    const companyInList = affiliations.includes(user.company_name || '');
    setSelectedAffiliation(companyInList ? user.company_name : '');
    setIsRepresentative(false);
    setIsApprovalModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedUser || !selectedAffiliation) {
      setModal({ isOpen: true, message: '소속을 선택해주세요.', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'active',
          company_name: selectedAffiliation,
          is_affiliation_representative: isRepresentative,
          affiliations: [selectedAffiliation]
        }),
      });

      if (res.ok) {
        setIsApprovalModalOpen(false);
        setModal({
          isOpen: true,
          message: `가입 승인이 완료되었습니다.`,
          type: 'success',
          showConfirmButton: false
        });
        fetchInitialData();
        window.dispatchEvent(new Event('notificationUpdate'));
      } else {
        const data = await res.json();
        setModal({ isOpen: true, message: data.message || '승인 중 오류가 발생했습니다.', type: 'error' });
      }
    } catch (error) {
      setModal({ isOpen: true, message: '서버 오류가 발생했습니다.', type: 'error' });
    }
  };

  const handleReject = async (userId: number) => {
    setModal({
      isOpen: true,
      message: '가입 신청을 거절하시겠습니까?',
      type: 'warning',
      showConfirmButton: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected' }),
          });
          if (res.ok) {
            setModal({ isOpen: true, message: '가입 거절이 완료되었습니다.', type: 'success', showConfirmButton: false });
            fetchInitialData();
            window.dispatchEvent(new Event('notificationUpdate'));
          }
        } catch (error) {
          setModal({ isOpen: true, message: '서버 오류가 발생했습니다.', type: 'error' });
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.titleWrap}>
            <span className={styles.mainTitle}>가입 승인 관리</span>
            <p className={styles.subTitle}>데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleWrap}>
          <span className={styles.mainTitle}>가입 승인 관리</span>
          <p className={styles.subTitle}>신규 가입 신청 내역입니다. 정보를 확인 후 소속을 지정하여 승인해주세요.</p>
      </div>

      <div className={styles.contentWrap}>
          {users.length === 0 ? (
            <div className={styles.empty}>승인 대기 중인 유저가 없습니다.</div>
          ) : (
            <div className={styles.tableCard}>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                        <tr>
                            <th>가입일</th>
                            <th>아이디</th>
                            <th>이름</th>
                            <th>주민등록번호</th>
                            <th>주소</th>
                            <th>연락처</th>
                            <th>이메일</th>
                            <th>은행명</th>
                            <th>계좌번호</th>
                            <th>작업</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                            <td>{new Date(user.created_at).toLocaleDateString().slice(0, -1)}</td>
                            <td>{user.user_id}</td>
                            <td>{user.name}</td>
                            <td>{user.resident_id || '-'}</td>
                            <td>{user.address || '-'}</td>
                            <td>{user.phone || '-'}</td>
                            <td>{user.email_display || '-'}</td>
                            <td>{user.bank_name || '-'}</td>
                            <td>{user.account_number || '-'}</td>
                            <td className={styles.actions}>
                                <button className={styles.approveBtn} onClick={() => openApprovalDialog(user)}>승인</button>
                                <button className={styles.rejectBtn} onClick={() => handleReject(user.id)}>거절</button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}
      </div>

      {/* 승인 모달 */}
      {isApprovalModalOpen && selectedUser && (
        <div className={styles.modalOverlay} onClick={() => setIsApprovalModalOpen(false)}>
          <div className={styles.approvalModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>가입 승인</h3>
            
            <div className={styles.userInfoBox}>
                <div className={`${styles.infoItem} ${styles.nameItem}`}>
                    <span className={styles.infoLabel}>이름</span>
                    <span className={styles.infoValue}>{selectedUser.name}</span>
                </div>
                <div className={styles.infoDivider} />
                <div className={`${styles.infoItem} ${styles.compItem}`}>
                    <span className={styles.infoLabel}>아이디</span>
                    <span className={styles.infoValue}>{selectedUser.user_id}</span>
                </div>
                <div className={styles.infoDivider} />
                <div className={`${styles.infoItem} ${styles.compItem}`}>
                    <span className={styles.infoLabel}>주민등록번호</span>
                    <span className={styles.infoValue}>{selectedUser.resident_id || '-'}</span>
                </div>
                <div className={styles.infoDivider} />
                <div className={`${styles.infoItem} ${styles.compItem}`}>
                    <span className={styles.infoLabel}>주소</span>
                    <span className={styles.infoValue}>{selectedUser.address || '-'}</span>
                </div>
                <div className={styles.infoDivider} />
                <div className={`${styles.infoItem} ${styles.phoneItem}`}>
                    <span className={styles.infoLabel}>연락처</span>
                    <span className={styles.infoValue}>{selectedUser.phone}</span>
                </div>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.formLabel}>배정 소속 <span style={{color: '#e03131'}}>*</span></label>
                <select 
                    className={styles.select}
                    value={selectedAffiliation}
                    onChange={(e) => {
                        setSelectedAffiliation(e.target.value);
                        setIsRepresentative(false); // 소속 변경 시 체크 초기화
                    }}
                >
                    <option value="">소속을 선택하세요</option>
                    {affiliations.map(aff => (
                        <option key={aff} value={aff}>{aff}</option>
                    ))}
                </select>
            </div>

            <div 
                className={`${styles.checkboxContainer} ${!selectedAffiliation ? styles.disabled : ''}`}
                onClick={() => {
                    if (selectedAffiliation) setIsRepresentative(!isRepresentative);
                }}
            >
                <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={isRepresentative}
                    disabled={!selectedAffiliation}
                    onChange={(e) => setIsRepresentative(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                />
                <span className={styles.checkboxLabel}>소속대표로 선임</span>
            </div>

            {isRepresentative && currentRepInfo?.hasRepresentative && (
                <div className={styles.warningBox}>
                  <p className={styles.warningText}>
                    ※ 선임 시 기존 소속대표 <strong>{currentRepInfo.representative?.name} ({currentRepInfo.representative?.user_id})</strong>님은 자동으로 해임됩니다.
                  </p>
                </div>
            )}
            {isRepresentative && !currentRepInfo?.hasRepresentative && !isCheckingRep && (
                <div className={styles.warningBox} style={{backgroundColor: '#e6f7ff', borderColor: '#91d5ff'}}>
                    <p className={styles.warningText} style={{color: '#0050b3'}}>※ 현재 해당 소속에 등록된 소속대표가 없습니다.</p>
                </div>
            )}

            <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setIsApprovalModalOpen(false)}>취소</button>
                <button className={styles.submitBtn} onClick={handleApprove}>승인</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={modal.onConfirm}
        showConfirmButton={modal.showConfirmButton}
        confirmText="확인"
      />
    </div>
  );
}
