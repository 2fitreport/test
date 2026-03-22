'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import { getAdminData } from '@/lib/auth';
import styles from './ProgressStepsSection.module.css';

interface Worker {
    id: number;
    user_id: string;
    name: string;
    position_id: number;
    position?: { id: number; name: string; level: number };
    affiliation_name?: string | null;
}

interface Step {
    id: number;
    label: string;
    status: 'completed' | 'current' | 'pending';
}

interface Reply {
    id: string;
    author: string;
    author_id: string;
    content: string;
    created_at: string;
}

interface Memo {
    id: string;
    author: string;
    author_id: string;
    content: string;
    created_at: string;
    replies: Reply[];
}

interface ProgressStepsSectionProps {
    isViewMode?: boolean;
    documentId?: string | null;
    progressDetails?: string | null;
    progressStartDate?: string | null;
    managerId?: string | null;
    documentStatus?: string | null;
    documentUserId?: string | null;
    submitterId?: string | null;
    currentUserName?: string;
    currentUserId?: string;
    currentUserPositionLevel?: number | null;
    memos?: Memo[];
    onProgressUpdate?: (progressDetails: string, skipRedirect?: boolean) => void;
    onMemoUpdate?: () => void;
    onValidateAndNext?: () => Promise<boolean>;
    onSave?: (skipSuccessModal?: boolean) => Promise<void>;
    onStaffAssignSuccess?: () => void;
}

export default function ProgressStepsSection({
    isViewMode = false,
    documentId,
    progressDetails,
    memos = [],
    progressStartDate,
    managerId,
    documentStatus,
    documentUserId,
    submitterId,
    currentUserName,
    currentUserId,
    currentUserPositionLevel,
    onProgressUpdate,
    onMemoUpdate,
    onValidateAndNext,
    onSave,
    onStaffAssignSuccess
}: ProgressStepsSectionProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [nextStepModalOpen, setNextStepModalOpen] = useState(false);
    const [nextStepName, setNextStepName] = useState('');
    const [nextStepMessage, setNextStepMessage] = useState('');
    const [prevStepModalOpen, setPrevStepModalOpen] = useState(false);
    const [prevStepName, setPrevStepName] = useState('');
    const [staffAssignModalOpen, setStaffAssignModalOpen] = useState(false);
    const [securityCompleteModalOpen, setSecurityCompleteModalOpen] = useState(false);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedManager, setSelectedManager] = useState('');
    const [isDirectProceed, setIsDirectProceed] = useState(false);
    const [staffRequiredModalOpen, setStaffRequiredModalOpen] = useState(false);
    const [assignedManagerId, setAssignedManagerId] = useState('');
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successModalType, setSuccessModalType] = useState<'success' | 'error'>('success');
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [proceedModalOpen, setProceedModalOpen] = useState(false);
    const [securityType, setSecurityType] = useState<'inspection' | 'security' | null>(null);
    const [reason, setReason] = useState('');
    const [reasonModalType, setReasonModalType] = useState<'revision' | 'end' | null>(null);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalAmount, setApprovalAmount] = useState('');
    const [revenueAmount, setRevenueAmount] = useState('');
    const [approvalPassword, setApprovalPassword] = useState('');
    const [approvalApproved, setApprovalApproved] = useState(false);
    const [salesAssignModalOpen, setSalesAssignModalOpen] = useState(false);
    const [selectedSalesperson, setSelectedSalesperson] = useState('');

    const userLevel = getAdminData()?.position?.level;

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

    // 숫자 포맷팅 함수 (쉼표 추가)
    const formatNumberWithComma = (value: string) => {
        const numbers = value.replace(/[^0-9]/g, '');
        return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const allSteps = ['상담신청', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
    const stepOrder = allSteps.slice(0, -1); // '승인' 단계를 진행 단계 목록에서 제외
    // progressDetails가 있으면 사용 (뷰 모드, 수정 모드 모두)
    // 없으면 (신규 등록 모드) 모든 단계가 pending
    const currentProgress = progressDetails || null;
    const currentStepIndex = stepOrder.indexOf(currentProgress || '');

    const steps: Step[] = [
        { id: 1, label: '상담신청', status: currentStepIndex > 0 ? 'completed' : currentStepIndex === 0 ? 'current' : 'pending' },
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
                    status: '정상',
                    manager_id: null,
                    manager_name: null,
                    progress_start_date: null,
                    progress_end_time: null,
                    completed_date: null,
                    approval_amount: null,
                    revenue_amount: null,
                    reverted_from: null
                })
            });

            if (response.ok) {
                if (onProgressUpdate) {
                    onProgressUpdate('서류요청');
                }
                // 로컬 상태 초기화
                setApprovalAmount('');
                setRevenueAmount('');
                setApprovalPassword('');
                setApprovalApproved(false);

                setSuccessMessage('진행 단계가 초기화되었습니다.');
                setSuccessModalType('success');
                setSuccessModalOpen(true);
                // 사이드바 업데이트
                window.dispatchEvent(new Event('notificationUpdate'));
            }
        } catch (error) {
            console.error('초기화 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevious = () => {
        // 승인 단계에서는 승인요청으로 이동
        if (currentProgress === '승인') {
            setPrevStepName('승인요청');
            setPrevStepModalOpen(true);
        } else if (currentStepIndex > 0) {
            const prevStep = stepOrder[currentStepIndex - 1];
            setPrevStepName(prevStep);
            setPrevStepModalOpen(true);
        }
    };

    const handlePrevConfirm = async () => {
        setPrevStepModalOpen(false);
        setIsLoading(true);
        try {
            // 이전 단계로 이동
            if (!documentId) return;

            const updateBody: any = {
                progress_details: prevStepName,
                completed_date: null,
                progress_end_time: null
            };

            // 승인 단계에서 승인요청으로 이동할 때 승인금액과 매출액 초기화
            if (currentProgress === '승인' && prevStepName === '승인요청') {
                updateBody.approval_amount = null;
                updateBody.revenue_amount = null;
            }

            // 심사 단계에서 분석 단계로 이동할 때 실무자 초기화
            if (currentProgress === '심사' && prevStepName === '분석') {
                updateBody.manager_id = null;
                updateBody.manager_name = null;
            }

            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });

            if (response.ok) {
                if (onProgressUpdate) {
                    onProgressUpdate(prevStepName);
                }
                // 사이드바 업데이트
                window.dispatchEvent(new Event('notificationUpdate'));
                // 성공 메시지 표시
                setSuccessMessage(`${prevStepName}${getParticle(prevStepName)} 변경되었습니다.`);
                setSuccessModalType('success');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            console.error('이전 단계 이동 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getParticle = (stepName: string) => {
        const lastChar = stepName.charCodeAt(stepName.length - 1);
        const finalConsonantCode = (lastChar - 0xAC00) % 28;
        return finalConsonantCode === 0 || finalConsonantCode === 8 ? '로' : '으로';
    };

    const getBackgroundColor = () => {
        switch (currentProgress) {
            case '심사':
                return '#f3e5f5'; // 연한 보라색
            case '승인요청':
                return '#fff3e0'; // 연한 주황색
            case '진행':
                return '#ffebee'; // 연한 빨간색
            default:
                return '#ffffff'; // 흰색
        }
    };

    const handleNext = async () => {
        // 상담신청 단계에서는 영업자 배정 모달 열기
        if (currentProgress === '상담신청') {
            setSelectedSalesperson('');
            setSalesAssignModalOpen(true);
            return;
        }

        // 승인요청 단계에서는 승인 모달 열기
        if (currentProgress === '승인요청') {
            setApprovalModalOpen(true);
            return;
        }

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

            // 문서 상태가 "보완"이고 현재 진행 단계가 "서류요청"일 때 특별한 메시지
            if (documentStatus === '보완' && currentProgress === '서류요청') {
                setNextStepMessage(`보안완료 후 ${nextStep}${getParticle(nextStep)} 변경하시겠습니까?`);
            } else {
                setNextStepMessage(`${nextStep}${getParticle(nextStep)} 변경하시겠습니까?`);
            }

            setNextStepModalOpen(true);
        }
    };

    const handleNextConfirm = async () => {
        setNextStepModalOpen(false);

        // 승인요청 단계에서는 승인금액 입력 모달을 열기
        if (currentProgress === '승인요청') {
            setApprovalAmount('');
            setApprovalModalOpen(true);
            return;
        }

        if (!documentId) return;

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

            // 2. 상태를 "정상"으로 변경하고 진행 단계도 함께 업데이트
            const updateData: any = {
                status: '정상',
                progress_details: nextStepName,
                reverted_from: null,
            };

            // 분석 단계로 이동할 때 progress_start_date 설정
            if (nextStepName === '분석') {
                updateData.progress_start_date = String(Date.now());
            } else if (nextStepName === '승인') {
                // 승인 단계로 이동할 때 경과 시간 저장 (분석 시작~현재)
                const startTs = progressStartDate ? parseInt(progressStartDate) : 0;
                const elapsed = startTs > 0 ? Date.now() - startTs : 0;
                const tot = Math.floor(Math.max(0, elapsed) / 1000);
                const h = Math.floor(tot / 3600);
                const m = Math.floor((tot % 3600) / 60);
                const s = tot % 60;
                updateData.progress_end_time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                if (progressStartDate) {
                    updateData.progress_start_date = progressStartDate;
                }
            } else if (progressStartDate) {
                // 다른 단계로 이동할 때는 기존 progress_start_date 유지
                updateData.progress_start_date = progressStartDate;
            }

            const updateResponse = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (updateResponse.ok) {
                console.log('상태 및 진행 단계 업데이트 완료');
                if (onProgressUpdate) {
                    onProgressUpdate(nextStepName);
                }
                // 사이드바 업데이트
                window.dispatchEvent(new Event('notificationUpdate'));
                // 성공 메시지 표시
                setSuccessMessage(`${nextStepName}${getParticle(nextStepName)} 변경되었습니다.`);
                setSuccessModalType('success');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            console.error('다음 단계 이동 실패:', error);
            // 저장 실패 시 모달을 다시 열어서 사용자에게 알림
            setNextStepModalOpen(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprovalConfirm = async () => {
        if (!approvalAmount.trim() || !revenueAmount.trim() || !approvalPassword.trim() || !documentId) {
            setSuccessMessage('모든 항목을 입력해주세요.');
            setSuccessModalType('error');
            setSuccessModalOpen(true);
            return;
        }

        setIsLoading(true);
        try {
            // 비밀번호 검증
            const validateResponse = await fetch('/api/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: approvalPassword,
                    user_id: currentUserId
                })
            });

            if (!validateResponse.ok) {
                setSuccessMessage('비밀번호가 일치하지 않습니다.');
                setSuccessModalType('error');
                setSuccessModalOpen(true);
                setIsLoading(false);
                return;
            }

            // 비밀번호 검증 성공 시 문서 업데이트 (경과 시간 계산)
            const startTimestamp = progressStartDate ? parseInt(progressStartDate) : 0;
            const elapsedMs = startTimestamp > 0 ? Date.now() - startTimestamp : 0;
            const totalSecs = Math.floor(Math.max(0, elapsedMs) / 1000);
            const endH = Math.floor(totalSecs / 3600);
            const endM = Math.floor((totalSecs % 3600) / 60);
            const endS = totalSecs % 60;
            const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:${String(endS).padStart(2, '0')}`;

            const updateResponse = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: '정상',
                    progress_details: '승인',
                    approval_amount: parseInt(approvalAmount.replace(/,/g, '')),
                    revenue_amount: parseInt(revenueAmount.replace(/,/g, '')),
                    progress_end_time: endTime,
                    completed_date: new Date().toISOString()
                })
            });

            if (updateResponse.ok) {
                if (onProgressUpdate) {
                    onProgressUpdate('승인');
                }

                setApprovalApproved(true);
                setApprovalModalOpen(false);
                setApprovalAmount('');
                setRevenueAmount('');
                setApprovalPassword('');

                // 사이드바 업데이트
                window.dispatchEvent(new Event('notificationUpdate'));

                // 승인 처리 후 목록으로 리다이렉트
                router.push('/main/document_submission');
            }
        } catch (error) {
            console.error('승인 처리 실패:', error);
            setSuccessMessage('승인 처리 중 오류가 발생했습니다.');
            setSuccessModalType('error');
            setSuccessModalOpen(true);
        } finally {
            setIsLoading(false);
        }
    };

    const updateProgress = async (newProgressDetails: string, skipRedirect?: boolean) => {
        try {
            // documentId가 없으면 (신규 등록 모드) 업데이트하지 않음
            if (!documentId) return;

            const updateData: any = { progress_details: newProgressDetails, status: '정상' };

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
                    onProgressUpdate(newProgressDetails, skipRedirect);
                }
            }
        } catch (error) {
            console.error('진행단계 업데이트 실패:', error);
        }
    };

    const handleRevision = () => {
        setReason('');
        setReasonModalType('revision');
    };

    const handleRevisionConfirm = async () => {
        if (!reason.trim()) {
            setSuccessMessage('사유를 입력해주세요.');
            setSuccessModalType('error');
            setSuccessModalOpen(true);
            return;
        }
        setReasonModalType(null);
        if (!documentId) return;

        try {
            setIsLoading(true);

            // 상태를 보완으로 업데이트
            const updateData: any = { status: '보완' };
            if (progressStartDate) {
                updateData.progress_start_date = progressStartDate;
            }
            await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            // 정상 상태에서 보완으로: 새로운 메모 생성
            // 보완/검수 상태에서 보완으로: 직전 보완 메모의 답글에 추가
            if (documentStatus === '정상' || documentStatus === '보류') {
                // 정상 상태: 새 메모 생성
                await fetch(`/api/documents/${documentId}/memos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `[보완사유] ${reason}`,
                        is_admin: true,
                        user_name: currentUserName,
                        user_id: currentUserId
                    })
                });
            } else {
                // 보완/검수 상태: 직전 보완 메모에 답글 추가
                const revisionMemos = memos
                    .filter(m => m.content.startsWith('[보완사유]'))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                if (revisionMemos.length > 0) {
                    // 기존 보완 메모에 답글 추가
                    const lastRevisionMemoId = revisionMemos[0].id;
                    await fetch(`/api/documents/${documentId}/memos/${lastRevisionMemoId}/replies`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: reason,
                            author: currentUserName,
                            author_id: currentUserId
                        })
                    });
                } else {
                    // 보완 메모가 없으면 새 메모 생성
                    await fetch(`/api/documents/${documentId}/memos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: `[보완사유] ${reason}`,
                            is_admin: true,
                            user_name: currentUserName,
                            user_id: currentUserId
                        })
                    });
                }
            }

            setSuccessMessage('보완 요청이 완료되었습니다.');
            setSuccessModalType('success');
            setSuccessModalOpen(true);

            // 메모 섹션 리랜더링 유도
            if (onMemoUpdate) onMemoUpdate();
            if (onProgressUpdate && progressDetails) {
                onProgressUpdate(progressDetails);
            }
        } catch (error) {
            console.error('보완 요청 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnd = () => {
        setReason('');
        setReasonModalType('end');
    };

    const handleEndConfirm = async () => {
        if (!reason.trim()) {
            setSuccessMessage('사유를 입력해주세요.');
            setSuccessModalType('error');
            setSuccessModalOpen(true);
            return;
        }
        setReasonModalType(null);
        if (!documentId) return;

        try {
            setIsLoading(true);
            const updateData: any = {};

            // 심사 또는 진행 단계에서만 분석으로 돌림
            if (progressDetails === '심사' || progressDetails === '진행') {
                updateData.status = '보완';
                updateData.progress_details = '분석';
                updateData.manager_id = null;
                updateData.manager_name = null;
                updateData.reverted_from = progressDetails;
            } else {
                // 서류요청 또는 분석 단계에서는 단계 유지, 보류 상태만 설정
                updateData.status = '보류';
                updateData.reverted_from = null;
            }

            // progress_start_date 유지
            if (progressStartDate) {
                updateData.progress_start_date = progressStartDate;
            }

            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                // 메모 추가 (진행불가사유) - 현재 사용자 정보 포함
                await fetch(`/api/documents/${documentId}/memos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `[진행불가사유] ${reason}`,
                        is_admin: true,
                        user_name: currentUserName,
                        user_id: currentUserId
                    })
                });

                const successMsg = (progressDetails === '심사' || progressDetails === '진행')
                    ? '분석으로 변경되었습니다.'
                    : '보류되었습니다.';
                setSuccessMessage(successMsg);
                setSuccessModalType('success');
                setSuccessModalOpen(true);

                // 메모 섹션 리랜더링 유도
                if (onMemoUpdate) onMemoUpdate();
            }
        } catch (error) {
            console.error('진행 보류 처리 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProceed = () => {
        setProceedModalOpen(true);
    };

    const handleProceedConfirm = async () => {
        setProceedModalOpen(false);
        if (!documentId) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: '정상' })
            });

            if (response.ok) {
                setSuccessMessage('진행이 완료되었습니다.');
                setSuccessModalType('success');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            console.error('상태 변경 실패:', error);
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
        setIsDirectProceed(false);
        setStaffAssignModalOpen(true);
    };

    const handleStaffAssignConfirm = async () => {
        if (!documentId) {
            setStaffAssignModalOpen(false);
            return;
        }

        // 직접진행이 아닌 경우 실무자 선택 필수
        if (!isDirectProceed && !selectedManager) {
            setStaffAssignModalOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            // 1. 수정 모드인 경우 먼저 데이터 저장 (성공 모달 없이)
            if (!isViewMode && onSave) {
                await onSave(true);  // skipSuccessModal=true
            }

            // 2. 직접진행 여부에 따라 처리
            if (isDirectProceed) {
                // 직접진행: 현재 사용자를 실무자로 배정
                const response = await fetch(`/api/documents/${documentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        manager_id: currentUserId,
                        manager_name: currentUserName
                    })
                });

                if (response.ok) {
                    setAssignedManagerId(currentUserId || '');

                    // 실무자 배정 후 다음 단계로 즉시 업데이트
                    if (currentProgress === '분석') {
                        updateProgress('심사', true);
                    } else if (currentProgress === '심사') {
                        updateProgress('진행', true);
                    }

                    setSuccessMessage('직접진행으로 진행됩니다.');
                    setSuccessModalType('success');
                    setSuccessModalOpen(true);
                }
            } else {
                // 실무자 배정
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
                        updateProgress('심사', true);
                    } else if (currentProgress === '심사') {
                        updateProgress('진행', true);
                    }

                    setSuccessMessage('실무자가 배정되었습니다.');
                    setSuccessModalType('success');
                    setSuccessModalOpen(true);
                }
            }
        } catch (error) {
            console.error('실무자 배정 실패:', error);
        } finally {
            setIsLoading(false);
            setStaffAssignModalOpen(false);
            setSelectedManager('');
            setIsDirectProceed(false);
        }
    };

    const handleSalesAssignConfirm = async () => {
        if (!documentId || !selectedSalesperson) {
            setSalesAssignModalOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            // 현재 문서의 user_id(A영업자)를 submitter_id에 보존하고, user_id를 B영업자로 변경
            const selectedWorker = workers.find(w => w.user_id === selectedSalesperson);
            const response = await fetch(`/api/documents/${documentId}/assign-salesperson`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    new_user_id: selectedSalesperson,
                    new_user_name: selectedWorker?.name || '',
                    submitter_id: documentUserId || '',
                })
            });

            if (response.ok) {
                setSuccessMessage('영업자가 배정되었습니다.');
                setSuccessModalType('success');
                setSuccessModalOpen(true);
                window.dispatchEvent(new Event('notificationUpdate'));
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error('영업자 배정 API 실패:', response.status, errData);
                setSuccessMessage(errData?.error || '영업자 배정에 실패했습니다.');
                setSuccessModalType('error');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            console.error('영업자 배정 실패:', error);
        } finally {
            setIsLoading(false);
            setSalesAssignModalOpen(false);
            setSelectedSalesperson('');
        }
    };

    const handleSecurityComplete = () => {
        setSecurityType('inspection');
        setSecurityCompleteModalOpen(true);
    };

    const handleSecurityProcess = () => {
        setSecurityType('security');
        setSecurityCompleteModalOpen(true);
    };

    const handleSecurityCompleteConfirm = async () => {
        setSecurityCompleteModalOpen(false);
        if (!documentId) {
            return;
        }

        setIsLoading(true);
        try {
            const statusToSet = securityType === 'inspection' ? '정상' : '검수';
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: statusToSet })
            });

            const data = await response.json();

            if (response.ok) {
                const message = securityType === 'inspection' ? '검수가 완료되었습니다.' : '보안사항이 저장되었습니다.';
                setSuccessMessage(message);
                setSuccessModalType('success');
                setSuccessModalOpen(true);
                // 저장 완료 후 이벤트 발생
                window.dispatchEvent(new Event('notificationUpdate'));
            } else {
                throw new Error(data.error || '상태 변경 실패');
            }
        } catch (error) {
            console.error('상태 변경 실패:', error);
            setSuccessMessage(error instanceof Error ? error.message : '상태 변경 실패');
            setSuccessModalType('error');
            setSuccessModalOpen(true);
        } finally {
            setIsLoading(false);
            setSecurityType(null);
        }
    };

    return (
        <div className={styles.progressWrap}>
            <div className={styles.progressTitle}>
                <h2>진행단계</h2>
                <h3>현재 진행 상태를 확인하고 관리할 수 있습니다.</h3>
            </div>

            <div className={`${styles.contentWrapper} ${documentId ? styles.withDirection : ''}`}>
                {currentProgress === '승인' ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px 20px',
                        gap: '15px'
                    }}>
                        <Check size={48} color="#4caf50" strokeWidth={3} />
                        <p style={{ fontSize: '18px', fontWeight: '600', color: '#4caf50', fontFamily: 'Pretendard, sans-serif' }}>승인 완료되었습니다.</p>
                    </div>
                ) : currentProgress === '승인요청' ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px 20px',
                        gap: '20px'
                    }}>
                        {approvalApproved ? (
                            <>
                                <Check size={60} color="#4caf50" style={{ marginBottom: '10px' }} />
                                <p style={{ fontSize: '28px', fontWeight: '400', color: '#4caf50', fontFamily: "'Great Vibes', cursive", letterSpacing: '1px' }}>승인되었습니다.</p>
                                <button
                                    className={`${styles.btn} ${styles.btnSuccess}`}
                                    onClick={() => {
                                        setApprovalApproved(false);
                                        router.push('/main/document_submission');
                                    }}
                                    style={{ marginTop: '20px' }}
                                >
                                    확인
                                </button>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: '75px', fontWeight: '400', color: '#4a4a4a', fontFamily: "'Great Vibes', cursive", letterSpacing: '1px', marginBottom: '20px' }}>2FitReport</p>
                                <p style={{ fontSize: '28px', fontWeight: '400', color: '#4a4a4a', fontFamily: "'Great Vibes', cursive", letterSpacing: '1px' }}>승인대기중...</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className={styles.stepsContainer}>
                    <div className={styles.stepsList}>
                        {steps.map((step, index) => (
                            <div key={step.id} className={`${styles.stepItemWrapper} ${styles[step.status]}`}>
                                <div className={styles.stepCircleWrapper}>
                                    <div className={styles.stepCircle}>
                                        <img
                                            src={
                                                step.status === 'current' && (documentStatus === '보완' || documentStatus === '검수') ? '/보완.png' :
                                                step.status === 'current' && documentStatus === '보류' ? '/보류.png' :
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
                )}

                {documentId && currentProgress === '상담신청' && (userLevel === 4 || userLevel === 1 || userLevel === 6) && submitterId && documentUserId && submitterId !== documentUserId && currentUserId !== submitterId && (
                    <div style={{ padding: '12px 16px', marginBottom: '12px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', fontSize: '20px', color: '#f57c00', fontWeight: 500 }}>
                        수정버튼을 눌러 사업자를 선택하고 필수 첨부파일 서류를 업로드해주세요.
                    </div>
                )}

                {documentId && (
                    <div className={styles.actionButtons}>
                        {userLevel !== 4 && documentStatus !== '보류' && !(userLevel === 2 && progressDetails === '승인요청') && !(currentProgress === '승인요청' && userLevel !== 1) && !(currentProgress === '승인' && !userLevel) && !(userLevel === 6 && currentProgress === '분석' && documentStatus !== '보완') && !(currentProgress === '심사' && userLevel !== 1 && currentUserId !== managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && !(currentProgress === '상담신청' && userLevel !== 1 && userLevel !== 6) && !(currentProgress === '상담신청' && submitterId && documentUserId && submitterId !== documentUserId) && (
                            <div className={styles.buttonGroup}>
                                {!(userLevel === 6 && (currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행' || currentProgress === '승인요청')) && <h4>단계 관리</h4>}
                                <div className={styles.groupButtons}>
                                    {userLevel === 1 && (
                                        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrevious} disabled={isLoading || currentStepIndex === 0}>
                                            이전 단계로 이동
                                        </button>
                                    )}
                                    {!(userLevel === 1 && currentProgress === '승인') && !(userLevel === 2 && currentProgress === '승인요청') && !(currentProgress === '승인요청' && userLevel !== 1) && !(userLevel === 6 && (currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행' || currentProgress === '승인요청')) && !(currentProgress === '심사' && userLevel !== 1 && currentUserId !== managerId) && (
                                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext} disabled={isLoading || (currentStepIndex === stepOrder.length - 1 && currentProgress !== '승인요청')}>
                                            {isLoading ? '처리 중...' : '다음 단계로 이동'}
                                        </button>
                                    )}
                                    {userLevel === 1 && (
                                        <button className={`${styles.btn} ${styles.btnReset}`} onClick={handleReset} disabled={isLoading}>
                                            초기화
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {!(userLevel === 1 && currentProgress === '승인') &&
                         !(userLevel === 4 && (documentStatus !== '보완' || progressDetails === '분석')) &&
                         !(currentProgress === '승인' && !userLevel) &&
                         !(userLevel === 6 && progressDetails !== '서류요청' && progressDetails !== '상담신청' && documentStatus !== '보완') &&
                         !(currentProgress === '승인요청') &&
                         !(currentProgress === '심사' && userLevel !== 1 && currentUserId !== managerId) &&
                         !(currentProgress === '진행' && userLevel === 2 && documentStatus !== '보완' && currentUserId !== managerId) && (
                        <div className={styles.buttonGroup}>
                            <h4>진행 상태</h4>
                            <div className={styles.groupButtons}>
                                {userLevel === 4 ? (
                                    // 영업자: 보완 상태에서 보안완료 가능 (모든 단계)
                                    documentStatus === '보완' && (
                                        <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleSecurityProcess} disabled={isLoading}>
                                            보안완료
                                        </button>
                                    )
                                ) : (userLevel === 6 || (userLevel === 1 && currentProgress === '상담신청')) ? (
                                    <>
                                        {/* 상담신청 단계: 보완요청, 진행불가 */}
                                        {progressDetails === '상담신청' && documentStatus !== '보류' && (
                                            <>
                                                <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                    보완요청
                                                </button>
                                                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleEnd} disabled={isLoading}>
                                                    진행불가
                                                </button>
                                            </>
                                        )}
                                        {progressDetails === '서류요청' && documentStatus === '보완' && (
                                            <>
                                                <button className={`${styles.btn} ${styles.btnInspect}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                                    검수완료
                                                </button>
                                                <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                    보완요청
                                                </button>
                                            </>
                                        )}
                                        {progressDetails === '서류요청' && documentStatus === '보류' && (
                                            <button className={`${styles.btn} ${styles.btnProceed}`} onClick={handleProceed} disabled={isLoading}>
                                                진행
                                            </button>
                                        )}
                                        {progressDetails === '서류요청' && documentStatus === '검수' && (
                                            <>
                                                <button className={`${styles.btn} ${styles.btnInspect}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                                    검수완료
                                                </button>
                                                <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                    보완요청
                                                </button>
                                            </>
                                        )}
                                        {progressDetails === '서류요청' && documentStatus !== '보완' && documentStatus !== '보류' && documentStatus !== '검수' && (
                                            <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                보완요청
                                            </button>
                                        )}
                                        {progressDetails === '서류요청' && documentStatus !== '보류' && (
                                            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleEnd} disabled={isLoading}>
                                                진행불가
                                            </button>
                                        )}
                                        {progressDetails === '분석' && documentStatus === '보완' && (
                                            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleSecurityProcess} disabled={isLoading}>
                                                보안완료
                                            </button>
                                        )}
                                        {progressDetails === '분석' && documentStatus === '검수' && (
                                            <>
                                                <button className={`${styles.btn} ${styles.btnInspect}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                                    검수완료
                                                </button>
                                                <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                    보완요청
                                                </button>
                                            </>
                                        )}
                                        {progressDetails === '심사' && documentStatus === '보완' && (
                                            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleSecurityProcess} disabled={isLoading}>
                                                보안완료
                                            </button>
                                        )}
                                        {progressDetails === '진행' && documentStatus === '보완' && (
                                            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleSecurityProcess} disabled={isLoading}>
                                                보안완료
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {documentStatus === '보류' && (
                                            <button className={`${styles.btn} ${styles.btnProceed}`} onClick={handleProceed} disabled={isLoading}>
                                                진행
                                            </button>
                                        )}
                                        {documentStatus === '보완' && (
                                            <>
                                                {(currentProgress !== '심사' || userLevel === 1 || currentUserId === managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && (
                                                    <button className={`${styles.btn} ${styles.btnInspect}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                                        검수완료
                                                    </button>
                                                )}
                                                {(currentProgress !== '심사' || userLevel === 1 || currentUserId === managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && (
                                                    <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                        보완요청
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {documentStatus === '검수' && (
                                            <>
                                                {(currentProgress !== '심사' || userLevel === 1 || currentUserId === managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && (
                                                    <button className={`${styles.btn} ${styles.btnInspect}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                                        검수완료
                                                    </button>
                                                )}
                                                {(currentProgress !== '심사' || userLevel === 1 || currentUserId === managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && (
                                                    <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                        보완요청
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {documentStatus !== '보류' && documentStatus !== '보완' && documentStatus !== '검수' && (currentProgress !== '심사' || userLevel === 1 || currentUserId === managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && (
                                            <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision} disabled={isLoading}>
                                                보완요청
                                            </button>
                                        )}
                                        {!(currentProgress === '상담신청' || currentProgress === '서류요청' || currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행' || currentProgress === '승인요청') && (
                                            <button className={`${styles.btn} ${styles.btnInspect}`} onClick={handleSecurityComplete} disabled={isLoading}>
                                                검수완료
                                            </button>
                                        )}
                                        {!(currentProgress === '상담신청' || currentProgress === '서류요청' || currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행' || currentProgress === '승인요청') && (
                                            <button className={`${styles.btn} ${styles.btnApprove}`} onClick={() => console.log('승인')} disabled={isLoading}>
                                                승인
                                            </button>
                                        )}
                                        {!(currentProgress === '상담신청' || currentProgress === '서류요청' || currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행' || currentProgress === '승인요청') && (
                                            <button className={`${styles.btn} ${styles.btnInfo}`} onClick={handleStaffAssign} disabled={isLoading}>
                                                실무자배정
                                            </button>
                                        )}
                                        {!(currentProgress === '상담신청' || currentProgress === '서류요청' || currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행' || currentProgress === '승인요청') && (
                                            <button className={`${styles.btn} ${styles.btnProceed}`} onClick={handleProceed} disabled={isLoading}>
                                                진행
                                            </button>
                                        )}
                                        {currentProgress === '진행' && userLevel === 2 && documentStatus === '보완' && currentUserId !== managerId && (
                                            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleSecurityProcess} disabled={isLoading}>
                                                보안완료
                                            </button>
                                        )}
                                        {documentStatus !== '보류' && (currentProgress !== '심사' || userLevel === 1 || currentUserId === managerId) && !(currentProgress === '진행' && userLevel === 2 && currentUserId !== managerId) && (
                                            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleEnd} disabled={isLoading}>
                                                진행불가
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                )}
            </div>

            {/* 다음 단계 진행 모달 */}
            <ConfirmModal
                isOpen={nextStepModalOpen}
                message={nextStepMessage}
                onConfirm={handleNextConfirm}
                onCancel={() => setNextStepModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 이전 단계 모달 */}
            <ConfirmModal
                isOpen={prevStepModalOpen}
                message={`${prevStepName}${getParticle(prevStepName)} 돌아가시겠습니까?`}
                onConfirm={handlePrevConfirm}
                onCancel={() => setPrevStepModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 초기화 모달 */}
            <ConfirmModal
                isOpen={resetModalOpen}
                message="진행 단계를 초기화하시겠습니까?<br>(단계가 서류요청으로 변경되며 실무자 배정이 취소됩니다)"
                onConfirm={handleResetConfirm}
                onCancel={() => setResetModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 진행 모달 */}
            <ConfirmModal
                isOpen={proceedModalOpen}
                message="진행하시겠습니까?"
                onConfirm={handleProceedConfirm}
                onCancel={() => setProceedModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 검수/보안 완료 모달 */}
            <ConfirmModal
                isOpen={securityCompleteModalOpen}
                message={securityType === 'security' ? '보안사항을 저장하시겠습니까?' : '검수완료하시겠습니까?'}
                onConfirm={() => {
                    console.log('ConfirmModal onConfirm 실행됨');
                    handleSecurityCompleteConfirm();
                }}
                onCancel={() => {
                    console.log('ConfirmModal onCancel 실행됨');
                    setSecurityCompleteModalOpen(false);
                }}
                confirmButtonText="확인"
                hideCancel={false}
                type="warning"
            />

            {/* 사유 입력 모달 (보완요청/진행불가 공용) */}
            {reasonModalType && (
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
                        padding: '24px',
                        borderRadius: '12px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>
                            {reasonModalType === 'revision' ? '보완 요청 사유' : '진행 불가 사유'}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                            {reasonModalType === 'revision' ? '문서 보완을 위한 상세 사유를 입력해주세요.' : '진행을 중지하는 사유를 입력해주세요.'}
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="사유를 입력하세요..."
                            style={{
                                width: '100%',
                                height: '120px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                resize: 'none',
                                marginBottom: '20px',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setReasonModalType(null)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    backgroundColor: '#f5f5f5',
                                    border: '1px solid #ddd',
                                    cursor: 'pointer'
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={reasonModalType === 'revision' ? handleRevisionConfirm : handleEndConfirm}
                                disabled={!reason.trim() || isLoading}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    backgroundColor: reasonModalType === 'revision' ? '#ff9800' : '#ef5350',
                                    color: 'white',
                                    border: 'none',
                                    cursor: reason.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                    opacity: reason.trim() && !isLoading ? 1 : 0.6
                                }}
                            >
                                {isLoading ? '처리 중...' : '확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={isDirectProceed}
                                    onChange={(e) => {
                                        setIsDirectProceed(e.target.checked);
                                        if (e.target.checked) {
                                            setSelectedManager('');
                                        }
                                    }}
                                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                />
                                <span style={{ fontSize: '16px', color: '#333', fontWeight: '500' }}>직접진행</span>
                            </label>
                        </div>
                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                            <select
                                value={selectedManager}
                                onChange={(e) => setSelectedManager(e.target.value)}
                                disabled={isDirectProceed}
                                style={{
                                    width: '100%',
                                    padding: '10px 40px 10px 14px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    appearance: 'none',
                                    backgroundColor: isDirectProceed ? '#f5f5f5' : '#fff',
                                    color: isDirectProceed ? '#999' : '#333',
                                    cursor: isDirectProceed ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <option value="">실무자를 선택해주세요.</option>
                                {workers
                                    .filter(worker => worker.position?.level === 3 || worker.position?.level === 2)
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
                                    setIsDirectProceed(false);
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
                                disabled={(!selectedManager && !isDirectProceed) || isLoading}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    backgroundColor: ((selectedManager || isDirectProceed) && !isLoading) ? '#1c283c' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    cursor: ((selectedManager || isDirectProceed) && !isLoading) ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {isLoading ? '배정 중...' : '확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 영업자 배정 모달 (상담신청 → 서류요청) */}
            {salesAssignModalOpen && (
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
                        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>영업자 배정</h3>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>필수서류를 등록할 영업자를 선택해주세요.</p>
                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                            <select
                                value={selectedSalesperson}
                                onChange={(e) => setSelectedSalesperson(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 40px 10px 14px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    appearance: 'none',
                                    backgroundColor: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">영업자를 선택해주세요.</option>
                                {workers
                                    .filter(worker => {
                                        if (worker.position?.level !== 4) return false;
                                        if (worker.user_id === documentUserId) return false;
                                        const ownerAffiliation = workers.find(w => w.user_id === documentUserId)?.affiliation_name;
                                        if (!ownerAffiliation) return true;
                                        return worker.affiliation_name === ownerAffiliation;
                                    })
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
                                    setSalesAssignModalOpen(false);
                                    setSelectedSalesperson('');
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
                                onClick={handleSalesAssignConfirm}
                                disabled={!selectedSalesperson || isLoading}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    backgroundColor: (selectedSalesperson && !isLoading) ? '#1c283c' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    cursor: (selectedSalesperson && !isLoading) ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {isLoading ? '배정 중...' : '확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 승인금액 입력 모달 */}
            {approvalModalOpen && (
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
                        padding: '24px',
                        borderRadius: '12px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>
                            승인 정보 입력
                        </h3>

                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                            승인금액 (만원)
                        </label>
                        <input
                            type="text"
                            value={approvalAmount}
                            onChange={(e) => setApprovalAmount(formatNumberWithComma(e.target.value))}
                            placeholder="승인금액을 입력하세요..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                marginBottom: '16px',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                        />

                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                            매출액 (만원)
                        </label>
                        <input
                            type="text"
                            value={revenueAmount}
                            onChange={(e) => setRevenueAmount(formatNumberWithComma(e.target.value))}
                            placeholder="매출액을 입력하세요..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                marginBottom: '16px',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                        />

                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                            비밀번호
                        </label>
                        <input
                            type="password"
                            value={approvalPassword}
                            onChange={(e) => setApprovalPassword(e.target.value)}
                            placeholder="비밀번호를 입력하세요..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                marginBottom: '20px',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                        />

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setApprovalModalOpen(false);
                                    setApprovalAmount('');
                                    setRevenueAmount('');
                                    setApprovalPassword('');
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    backgroundColor: '#f5f5f5',
                                    border: '1px solid #ddd',
                                    cursor: 'pointer'
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleApprovalConfirm}
                                disabled={!approvalAmount.trim() || !revenueAmount.trim() || !approvalPassword.trim() || isLoading}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    backgroundColor: approvalAmount.trim() && revenueAmount.trim() && approvalPassword.trim() && !isLoading ? '#1c283c' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    cursor: approvalAmount.trim() && revenueAmount.trim() && approvalPassword.trim() && !isLoading ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {isLoading ? '처리 중...' : '확인'}
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
                    // 성공 메시지일 때만 리다이렉트
                    if (successModalType === 'success') {
                        if (onStaffAssignSuccess) {
                            onStaffAssignSuccess();
                        }
                        router.push('/main/document_submission');
                    }
                }}
                confirmButtonText="확인"
                hideCancel={true}
                type={successModalType}
            />
        </div>
    );
}
