'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, XCircle, Loader } from 'lucide-react';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import styles from './ProgressStepsSection.module.css';

interface Worker {
    id: number;
    user_id: string;
    name: string;
    position_id: number;
    position?: { id: number; name: string; level: number };
}

interface Step {
    id: number;
    label: string;
    status: 'completed' | 'current' | 'pending';
}

interface ProgressStepsSectionProps {
    isViewMode?: boolean;
    documentId?: string | null;
    progressDetails?: string | null;
    progressStartDate?: string | null;
    managerId?: string | null;
    onProgressUpdate?: (progressDetails: string) => void;
    onValidateAndNext?: () => Promise<boolean>;
    onSave?: (skipSuccessModal?: boolean) => Promise<void>;
    onStaffAssignSuccess?: () => void;
}

export default function ProgressStepsSection({
    isViewMode = false,
    documentId,
    progressDetails,
    progressStartDate,
    managerId,
    onProgressUpdate,
    onValidateAndNext,
    onSave,
    onStaffAssignSuccess
}: ProgressStepsSectionProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [revisionModalOpen, setRevisionModalOpen] = useState(false);
    const [nextStepModalOpen, setNextStepModalOpen] = useState(false);
    const [nextStepName, setNextStepName] = useState('');
    const [prevStepModalOpen, setPrevStepModalOpen] = useState(false);
    const [prevStepName, setPrevStepName] = useState('');
    const [endModalOpen, setEndModalOpen] = useState(false);
    const [staffAssignModalOpen, setStaffAssignModalOpen] = useState(false);
    const [securityCompleteModalOpen, setSecurityCompleteModalOpen] = useState(false);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedManager, setSelectedManager] = useState('');
    const [staffRequiredModalOpen, setStaffRequiredModalOpen] = useState(false);
    const [assignedManagerId, setAssignedManagerId] = useState('');
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [resetModalOpen, setResetModalOpen] = useState(false);

    // 실무자 목록 조회 (뷰 모드 및 수정 모드 모두)
    useEffect(() => {
        if (documentId) {
            fetchWorkers();
        }
    }, [documentId]);

    const fetchWorkers = async () => {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setWorkers(data);
            }
        } catch (error) {
            console.error('실무자 목록 조회 실패:', error);
        }
    };

    const allSteps = ['상담', '서류요청', '분석', '심사', '진행', '승인'];
    const stepOrder = allSteps.slice(0, -1); // '승인' 단계를 진행 단계 목록에서 제외
    // progressDetails가 있으면 사용 (뷰 모드, 수정 모드 모두)
    // 없으면 (신규 등록 모드) 모든 단계가 pending
    const currentProgress = progressDetails || null;
    const currentStepIndex = stepOrder.indexOf(currentProgress || '');

    const steps: Step[] = [
        { id: 1, label: '상담', status: currentStepIndex > 0 ? 'completed' : currentStepIndex === 0 ? 'current' : 'pending' },
        { id: 2, label: '서류요청', status: currentStepIndex > 1 ? 'completed' : currentStepIndex === 1 ? 'current' : 'pending' },
        { id: 3, label: '분석', status: currentStepIndex > 2 ? 'completed' : currentStepIndex === 2 ? 'current' : 'pending' },
        { id: 4, label: '심사', status: currentStepIndex > 3 ? 'completed' : currentStepIndex === 3 ? 'current' : 'pending' },
        { id: 5, label: '진행', status: currentStepIndex > 4 ? 'completed' : currentStepIndex === 4 ? 'current' : 'pending' },
    ];

    const handleReset = () => {
        setResetModalOpen(true);
    };

    const handleResetConfirm = async () => {
        setResetModalOpen(false);
        if (!documentId) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progress_details: '서류요청',
                    manager_id: null,
                    manager_name: null,
                    progress_start_date: null
                })
            });

            if (response.ok) {
                if (onProgressUpdate) {
                    onProgressUpdate('서류요청');
                }
                setSuccessMessage('진행 단계가 초기화되었습니다.');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            console.error('초기화 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            const prevStep = stepOrder[currentStepIndex - 1];
            setPrevStepName(prevStep);
            setPrevStepModalOpen(true);
        }
    };

    const handlePrevConfirm = async () => {
        setPrevStepModalOpen(false);
        setIsLoading(true);
        try {
            // 이전 단계로 이동 시 배정된 실무자 제거
            if (!documentId) return;

            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progress_details: prevStepName,
                    manager_id: null,
                    manager_name: null
                })
            });

            if (response.ok) {
                if (onProgressUpdate) {
                    onProgressUpdate(prevStepName);
                }
            }
        } catch (error) {
            console.error('이전 단계 이동 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = async () => {
        if (currentStepIndex < stepOrder.length - 1) {
            // 1. 먼저 유효성 검사 수행 (뷰 모드에서도)
            const isValid = onValidateAndNext ? await onValidateAndNext() : true;
            if (!isValid) {
                return;
            }

            const nextStep = stepOrder[currentStepIndex + 1];

            // 분석 단계에서 다음 단계(심사)로 이동할 때 실무자 배정 필수
            if (currentProgress === '분석' && nextStep === '심사' && !managerId && !assignedManagerId) {
                setSelectedManager('');
                setStaffAssignModalOpen(true);
                return;
            }

            // 심사 단계에서 다음 단계(진행)로 이동할 때 실무자 배정 필수
            if (currentProgress === '심사' && nextStep === '진행' && !managerId && !assignedManagerId) {
                setSelectedManager('');
                setStaffAssignModalOpen(true);
                return;
            }

            setNextStepName(nextStep);
            setNextStepModalOpen(true);
        }
    };

    const handleNextConfirm = async () => {
        setNextStepModalOpen(false);
        setIsLoading(true);
        try {
            // 유효성 검사는 handleNext에서 이미 수행됨
            // 여기서는 저장 및 단계 이동만 진행

            console.log('다음 단계 이동:', { isViewMode, onSave: !!onSave, nextStepName });
            // 1. 뷰모드가 아닌 경우(수정 모드)에만 데이터 저장
            if (!isViewMode && onSave) {
                console.log('저장 시작...');
                // 성공 모달을 띄우지 않고 저장 (다음 단계로 진행할 예정)
                await onSave(true);
                console.log('저장 완료');
            }
            // 2. 저장 완료 후 진행 상태 업데이트
            console.log('진행 단계 업데이트:', nextStepName);
            await updateProgress(nextStepName);
        } catch (error) {
            console.error('다음 단계 이동 실패:', error);
            // 저장 실패 시 모달을 다시 열어서 사용자에게 알림
            setNextStepModalOpen(true);
        } finally {
            setIsLoading(false);
        }
    };

    const updateProgress = async (newProgressDetails: string) => {
        try {
            // documentId가 없으면 (신규 등록 모드) 업데이트하지 않음
            if (!documentId) return;

            const updateData: any = { progress_details: newProgressDetails };

            // 서류요청 → 분석으로 변경될 때 시간 경과 시작
            if (newProgressDetails === '분석') {
                updateData.progress_start_date = String(Date.now());
            } else if (progressStartDate) {
                // 이미 시작 시간이 있으면 다른 단계로 이동할 때도 유지 (API로 명시적으로 전달)
                updateData.progress_start_date = progressStartDate;
            }

            const response = await fetch(`/api/documents/${documentId}/progress`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                if (onProgressUpdate) {
                    onProgressUpdate(newProgressDetails);
                }
            }
        } catch (error) {
            console.error('진행단계 업데이트 실패:', error);
        }
    };

    const handleRevision = () => {
        setRevisionModalOpen(true);
    };

    const handleRevisionConfirm = async () => {
        setRevisionModalOpen(false);
        if (!documentId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: '보완' })
            });

            if (response.ok) {
                // 성공 메시지 표시
                setSuccessMessage('보완 요청이 완료되었습니다.');
                setSuccessModalOpen(true);
                
                // 페이지 새로고침 또는 상위 상태 업데이트 (onProgressUpdate 재사용 가능 여부 확인)
                if (onProgressUpdate && progressDetails) {
                    onProgressUpdate(progressDetails); // 현재 단계를 다시 보내서 갱신 유도
                }
            }
        } catch (error) {
            console.error('보완 요청 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnd = () => {
        setEndModalOpen(true);
    };

    const handleEndConfirm = async () => {
        setEndModalOpen(false);
        if (!documentId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progress_status: 'stopped' })
            });

            if (response.ok) {
                console.log('진행 중지 완료');
            }
        } catch (error) {
            console.error('진행 중지 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStaffAssign = async () => {
        // 수정 모드에서는 유효성 검사 먼저
        if (!isViewMode && onValidateAndNext) {
            const isValid = await onValidateAndNext();
            if (!isValid) {
                return;
            }
        }
        setSelectedManager('');
        setStaffAssignModalOpen(true);
    };

    const handleStaffAssignConfirm = async () => {
        if (!selectedManager || !documentId) {
            setStaffAssignModalOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            // 1. 수정 모드인 경우 먼저 데이터 저장 (성공 모달 없이)
            if (!isViewMode && onSave) {
                await onSave(true);  // skipSuccessModal=true
            }

            // 2. 저장 완료 후 실무자 배정
            const selectedWorker = workers.find(w => w.user_id === selectedManager);
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manager_id: selectedManager,
                    manager_name: selectedWorker?.name || ''
                })
            });

            if (response.ok) {
                console.log('실무자 배정 완료');
                setAssignedManagerId(selectedManager);

                // 실무자 배정 후 다음 단계로 즉시 업데이트
                if (currentProgress === '분석') {
                    updateProgress('심사');
                } else if (currentProgress === '심사') {
                    updateProgress('진행');
                }

                setSuccessMessage('실무자가 배정되었습니다.');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            console.error('실무자 배정 실패:', error);
        } finally {
            setIsLoading(false);
            setStaffAssignModalOpen(false);
            setSelectedManager('');
        }
    };

    const handleSecurityComplete = () => {
        setSecurityCompleteModalOpen(true);
    };

    const handleSecurityCompleteConfirm = () => {
        setSecurityCompleteModalOpen(false);
        console.log('보안 완료 처리');
    };

    return (
        <div className={styles.progressWrap}>
            <div className={styles.progressTitle}>
                <h2>진행단계</h2>
                <h3>현재 진행 상태를 확인하고 관리할 수 있습니다.</h3>
            </div>

            <div className={`${styles.contentWrapper} ${documentId ? styles.withDirection : ''}`}>
                <div className={styles.stepsContainer}>
                <div className={styles.stepsList}>
                    {steps.map((step, index) => (
                        <div key={step.id} className={`${styles.stepItemWrapper} ${styles[step.status]}`}>
                            <div className={styles.stepCircleWrapper}>
                                <div className={styles.stepCircle}>
                                    <img
                                        src={
                                            step.status === 'current' ? '/step2.png' :
                                            step.status === 'completed' ? '/step1.png' :
                                            '/step3.png'
                                        }
                                        alt={step.label}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`${styles.stepLine} ${(step.status === 'current' || step.status === 'completed') ? styles.active : ''}`} />
                                )}
                            </div>
                            <div className={`${styles.stepItem} ${styles[step.status]}`}>
                                <p className={styles.stepLabel}>{step.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

                {documentId && (
                    <div className={styles.actionButtons}>
                        <div className={styles.buttonGroup}>
                            <h4>단계 관리</h4>
                            <div className={styles.groupButtons}>
                                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrevious} disabled={isLoading || currentStepIndex === 0}>
                                    이전 단계로 이동
                                </button>
                                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext} disabled={isLoading || currentStepIndex === stepOrder.length - 1}>
                                    {isLoading ? '처리 중...' : '다음 단계로 이동'}
                                </button>
                                <button className={`${styles.btn} ${styles.btnProceed}`} onClick={() => console.log('진행')} disabled={isLoading}>
                                    진행
                                </button>
                                <button className={`${styles.btn} ${styles.btnReset}`} onClick={handleReset} disabled={isLoading}>
                                    초기화
                                </button>
                            </div>
                        </div>

                        <div className={styles.buttonGroup}>
                            <h4>진행 상태</h4>
                            <div className={styles.groupButtons}>
                                <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                    보완요청
                                </button>
                                <button className={`${styles.btn} ${styles.btnInspect}`} onClick={() => console.log('검수완료')} disabled={isLoading}>
                                    검수완료
                                </button>
                                <button className={`${styles.btn} ${styles.btnApprove}`} onClick={() => console.log('승인')} disabled={isLoading}>
                                    승인
                                </button>
                                <button className={`${styles.btn} ${styles.btnInfo}`} onClick={handleStaffAssign} disabled={isLoading}>
                                    실무자배정
                                </button>
                                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                    보안완료
                                </button>
                                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleEnd} disabled={isLoading}>
                                    진행불가
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 보완 요청 모달 */}
            <ConfirmModal
                isOpen={revisionModalOpen}
                message="해당 문서를 보완 요청하시겠습니까?"
                onConfirm={handleRevisionConfirm}
                onCancel={() => setRevisionModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 다음 단계 진행 모달 */}
            <ConfirmModal
                isOpen={nextStepModalOpen}
                message={`${nextStepName}으로 진행하시겠습니까?`}
                onConfirm={handleNextConfirm}
                onCancel={() => setNextStepModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 이전 단계 모달 */}
            <ConfirmModal
                isOpen={prevStepModalOpen}
                message={`${prevStepName}으로 돌아가시겠습니까?`}
                onConfirm={handlePrevConfirm}
                onCancel={() => setPrevStepModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 진행 중지 모달 */}
            <ConfirmModal
                isOpen={endModalOpen}
                message="진행을 중지하시겠습니까?"
                onConfirm={handleEndConfirm}
                onCancel={() => setEndModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="error"
            />

            {/* 초기화 모달 */}
            <ConfirmModal
                isOpen={resetModalOpen}
                message="진행 단계를 초기화하시겠습니까?<br>(단계가 서류요청으로 변경되며 실무자 배정이 취소됩니다)"
                onConfirm={handleResetConfirm}
                onCancel={() => setResetModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="error"
            />

            {/* 보안 완료 모달 */}
            <ConfirmModal
                isOpen={securityCompleteModalOpen}
                message="보안 검사를 완료하시겠습니까?"
                onConfirm={handleSecurityCompleteConfirm}
                onCancel={() => setSecurityCompleteModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="success"
            />

            {/* 실무자 배정 필수 모달 */}
            <ConfirmModal
                isOpen={staffRequiredModalOpen}
                message="실무자를 먼저 배정해주세요."
                onConfirm={() => setStaffRequiredModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={true}
                type="error"
            />

            {/* 실무자 선택 모달 */}
            {staffAssignModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1001
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>실무자 선택</h3>
                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                            <select
                                value={selectedManager}
                                onChange={(e) => setSelectedManager(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 40px 10px 14px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    appearance: 'none'
                                }}
                            >
                                <option value="">실무자를 선택해주세요.</option>
                                {workers
                                    .filter(worker => worker.position?.level === 3)
                                    .map((worker) => (
                                    <option key={worker.id} value={worker.user_id}>
                                        {worker.name}({worker.user_id})
                                    </option>
                                ))}
                            </select>
                            <img
                                src="/arrow.svg"
                                alt="드롭다운"
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '10px',
                                    width: '16px',
                                    height: '16px',
                                    pointerEvents: 'none'
                                }}
                            />
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => {
                                    setStaffAssignModalOpen(false);
                                    setSelectedManager('');
                                }}
                                disabled={isLoading}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    backgroundColor: '#f5f5f5',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    opacity: isLoading ? 0.6 : 1
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleStaffAssignConfirm}
                                disabled={!selectedManager || isLoading}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    backgroundColor: selectedManager && !isLoading ? '#1c283c' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    cursor: selectedManager && !isLoading ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {isLoading ? '배정 중...' : '확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 실무자 배정 성공 모달 */}
            <ConfirmModal
                isOpen={successModalOpen}
                message={successMessage}
                onConfirm={() => {
                    setSuccessModalOpen(false);
                    if (onStaffAssignSuccess) {
                        onStaffAssignSuccess();
                    }
                }}
                confirmButtonText="확인"
                hideCancel={true}
                type="success"
            />
        </div>
    );
}
