'use client';

import { useState } from 'react';
import Modal from '@/app/components/Modal/Modal';
import styles from '../createUser.module.css';

interface AffiliationSectionProps {
    allAffiliations: string[];
    takenAffiliations: string[];
    affiliationSearch: string;
    onAffiliationSearchChange: (value: string) => void;
    onAffiliationsChange?: (newAffiliations: string[]) => void;
}

export default function AffiliationSection({
    allAffiliations,
    takenAffiliations,
    affiliationSearch,
    onAffiliationSearchChange,
    onAffiliationsChange,
}: AffiliationSectionProps) {
    const [newAffiliation, setNewAffiliation] = useState('');
    const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successModal, setSuccessModal] = useState({ open: false, message: '' });
    const [errorModal, setErrorModal] = useState({ open: false, message: '' });

    const handleAddAffiliation = async () => {
        if (!newAffiliation.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/affiliations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newAffiliation.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '소속 추가 실패');
            }

            setNewAffiliation('');
            setSuccessModal({ open: true, message: '소속이 추가되었습니다.' });

            // 부모 컴포넌트에 새 소속 목록 전달
            if (onAffiliationsChange) {
                onAffiliationsChange([...allAffiliations, newAffiliation.trim()]);
            }
        } catch (error) {
            setErrorModal({
                open: true,
                message: error instanceof Error ? error.message : '소속 추가 실패',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSelectForDelete = (affName: string) => {
        setSelectedForDelete(prev => {
            if (prev.includes(affName)) {
                return prev.filter(a => a !== affName);
            } else {
                return [...prev, affName];
            }
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedForDelete.length === 0) return;

        setIsSubmitting(true);
        try {
            for (const affName of selectedForDelete) {
                const response = await fetch(`/api/affiliations?name=${encodeURIComponent(affName)}`, {
                    method: 'DELETE',
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || '소속 삭제 실패');
                }
            }

            setSuccessModal({
                open: true,
                message: `${selectedForDelete.length}개의 소속이 삭제되었습니다.`
            });
            setSelectedForDelete([]);

            // 부모 컴포넌트에 새 소속 목록 전달
            if (onAffiliationsChange) {
                const newList = allAffiliations.filter(a => !selectedForDelete.includes(a));
                onAffiliationsChange(newList);
            }
        } catch (error) {
            setErrorModal({
                open: true,
                message: error instanceof Error ? error.message : '소속 삭제 실패',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.affiliationSection}>
            <h3 className={styles.sectionTitle}>소속 관리</h3>

            {/* 소속 추가 */}
            <div className={styles.addAffiliationContainer}>
                <label className={styles.label}>소속 추가</label>
                <div className={styles.addAffiliationInputGroup}>
                    <input
                        type="text"
                        placeholder="새로운 소속 입력..."
                        className={styles.input}
                        value={newAffiliation}
                        onChange={(e) => setNewAffiliation(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAffiliation();
                            }
                        }}
                    />
                    <button
                        className={styles.addButton}
                        onClick={handleAddAffiliation}
                        type="button"
                    >
                        추가
                    </button>
                </div>
            </div>

            {/* 소속 검색 및 선택 */}
            <div className={styles.searchAffiliationContainer}>
                <label className={styles.label}>등록된 소속</label>
                <input
                    type="text"
                    placeholder="소속 검색..."
                    className={styles.input}
                    value={affiliationSearch}
                    onChange={(e) => onAffiliationSearchChange(e.target.value)}
                />
                <div className={styles.affiliationButtonsGrid}>
                    {allAffiliations
                        .filter(affName => affName.toLowerCase().includes(affiliationSearch.toLowerCase()))
                        .map((affName) => {
                            const isTaken = takenAffiliations.includes(affName);
                            const isSelected = selectedForDelete.includes(affName);
                            return (
                                <button
                                    key={affName}
                                    className={styles.affiliationSelectButton}
                                    style={{
                                        backgroundColor: isSelected ? '#ff4444' : '#fff',
                                        color: isSelected ? '#fff' : '#333',
                                        borderColor: isSelected ? '#ff4444' : '#e5e7eb',
                                        opacity: isTaken ? 0.5 : 1,
                                        cursor: isTaken ? 'not-allowed' : 'pointer',
                                    }}
                                    onClick={() => {
                                        if (!isTaken) {
                                            toggleSelectForDelete(affName);
                                        }
                                    }}
                                    disabled={isSubmitting || isTaken}
                                    type="button"
                                    title={isTaken ? '다른 검수자에게 배정된 소속입니다' : ''}
                                >
                                    {affName}
                                    {isTaken && ' (배정됨)'}
                                </button>
                            );
                        })}
                    {allAffiliations.filter(affName => affName.toLowerCase().includes(affiliationSearch.toLowerCase())).length === 0 && (
                        <p className={styles.noAffiliationText}>등록된 소속이 없습니다.</p>
                    )}
                </div>
            </div>

            {/* 선택된 소속 삭제 */}
            {selectedForDelete.length > 0 && (
                <div className={styles.selectedForDeleteContainer}>
                    <label className={styles.label}>삭제할 소속 ({selectedForDelete.length})</label>
                    <div className={styles.selectedForDeleteList}>
                        {selectedForDelete.map((affName) => (
                            <div key={affName} className={styles.selectedForDeleteItem}>
                                <span>{affName}</span>
                                <button
                                    className={styles.removeSelectButton}
                                    onClick={() => toggleSelectForDelete(affName)}
                                    disabled={isSubmitting}
                                    type="button"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        className={styles.deleteSelectedButton}
                        onClick={handleDeleteSelected}
                        disabled={isSubmitting}
                        type="button"
                    >
                        선택된 소속 삭제
                    </button>
                </div>
            )}

            {/* 성공 모달 */}
            <Modal
                isOpen={successModal.open}
                message={successModal.message}
                onClose={() => setSuccessModal({ open: false, message: '' })}
                type="success"
                showConfirmButton={true}
                confirmText="확인"
            />

            {/* 에러 모달 */}
            <Modal
                isOpen={errorModal.open}
                message={errorModal.message}
                onClose={() => setErrorModal({ open: false, message: '' })}
                type="error"
                showConfirmButton={false}
            />
        </div>
    );
}
