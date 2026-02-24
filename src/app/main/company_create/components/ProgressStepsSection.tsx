'use client';

import { Check, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import styles from './ProgressStepsSection.module.css';

interface Step {
    id: number;
    label: string;
    status: 'completed' | 'current' | 'pending';
}

export default function ProgressStepsSection() {
    const steps: Step[] = [
        { id: 1, label: '상담', status: 'completed' },
        { id: 2, label: '서류요청', status: 'current' },
        { id: 3, label: '분석', status: 'pending' },
        { id: 4, label: '진행', status: 'pending' },
        { id: 5, label: '승인', status: 'pending' },
    ];

    const handlePrevious = () => {
        console.log('Previous');
    };

    const handleNext = () => {
        console.log('Next');
    };

    const handleRevision = () => {
        console.log('Revision');
    };

    const handleEnd = () => {
        console.log('End');
    };

    return (
        <div className={styles.progressWrap}>
            <div className={styles.progressTitle}>
                <h2>진행단계</h2>
                <h3>현재 진행 상태를 확인하고 관리할 수 있습니다.</h3>
            </div>

            <div className={styles.contentWrapper}>
                <div className={styles.stepsContainer}>
                <div className={styles.stepsList}>
                    {steps.map((step, index) => (
                        <div key={step.id} className={styles.stepItemWrapper}>
                            <div className={`${styles.stepItem} ${styles[step.status]}`}>
                                <div className={styles.stepCircle}>
                                    {step.status === 'completed' ? (
                                        <Check size={28} strokeWidth={3} />
                                    ) : (
                                        <span>{step.id}</span>
                                    )}
                                </div>
                                <p className={styles.stepLabel}>{step.label}</p>
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`${styles.stepLine} ${steps[index + 1].status !== 'pending' ? styles.active : ''}`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

                <div className={styles.actionButtons}>
                <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRevision}>
                    <span>●</span> 보완요청
                </button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrevious}>
                    <ChevronLeft size={18} /> 이전 단계로 이동
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext}>
                    다음 단계로 이동 <ChevronRight size={18} />
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleEnd}>
                    <XCircle size={18} /> 진행불가
                </button>
            </div>
            </div>
        </div>
    );
}
