'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import styles from './CompanyInfoCard.module.css';

interface CompanyFormData {
    company_name: string;
    business_number: string;
    representative_name: string;
    phone: string;
    companyIndustry: string;
    companyRevenue: string;
    companyCreditRating: string;
    companyCreditRatingKCB: string;
    companyCreditRatingNICE: string;
}

export interface CompanyInfoCardHandle {
    getFormData: () => CompanyFormData;
    setFormData: (data: Partial<CompanyFormData>) => void;
}

interface CompanyInfoCardProps {
    isViewMode?: boolean;
}

const CompanyInfoCard = forwardRef<CompanyInfoCardHandle, CompanyInfoCardProps>(function CompanyInfoCard({ isViewMode = false }, ref) {
    const [formData, setFormData] = useState<CompanyFormData>({
        company_name: '',
        business_number: '',
        representative_name: '',
        phone: '',
        companyIndustry: '',
        companyRevenue: '',
        companyCreditRating: '',
        companyCreditRatingKCB: '',
        companyCreditRatingNICE: '',
    });

    const formatBusinessNumber = (value: string): string => {
        // 숫자만 추출 (최대 10자리)
        const numbers = value.replace(/\D/g, '').slice(0, 10);

        // XXX-XX-XXXXX 형식으로 변환
        if (numbers.length <= 3) {
            return numbers;
        } else if (numbers.length <= 5) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        } else {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
        }
    };

    const formatPhoneNumber = (value: string): string => {
        // 숫자만 추출 (최대 11자리)
        const numbers = value.replace(/\D/g, '').slice(0, 11);

        // 010-0000-0000 또는 02-000-0000 형식으로 변환
        if (numbers.length <= 2) {
            return numbers;
        } else if (numbers.length <= 6) {
            return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
        } else if (numbers.length <= 10) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
        } else {
            // 011, 016, 017 등의 경우
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let formattedValue = value;

        // 사업자 등록번호 포맷팅
        if (name === 'business_number') {
            formattedValue = formatBusinessNumber(value);
        }
        // 연락처 포맷팅
        else if (name === 'phone') {
            formattedValue = formatPhoneNumber(value);
        }

        setFormData((prev) => ({
            ...prev,
            [name]: formattedValue,
        }));
    };

    useImperativeHandle(ref, () => ({
        getFormData: () => formData,
        setFormData: (data: Partial<CompanyFormData>) => {
            setFormData(prev => ({ ...prev, ...data }));
        },
    }));

    return (
        <div className={styles.companyInfo}>
            <div className={styles.titleWrap}>
                <h2 className={styles.title}>기업정보</h2>
                <h3 className={styles.subtitle}>고객사의 핵심 정보를 확인할 수 있습니다.</h3>
            </div>

            <div className={styles.companyWrap}>
                {/* 좌측 정보 */}
                <ul className={styles.leftBox}>
                    <li className={styles.fieldItem}>
                        <label htmlFor="company_name" className={styles.label}>
                            기업명 <span style={{ color: '#ef5350', marginLeft: '4px' }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="company_name"
                            name="company_name"
                            className={styles.input}
                            value={formData.company_name}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="business_number" className={styles.label}>
                            사업자등록번호 <span style={{ color: '#ef5350', marginLeft: '4px' }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="business_number"
                            name="business_number"
                            className={styles.input}
                            value={formData.business_number}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="representative_name" className={styles.label}>
                            대표자명 <span style={{ color: '#ef5350', marginLeft: '4px' }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="representative_name"
                            name="representative_name"
                            className={styles.input}
                            value={formData.representative_name}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="phone" className={styles.label}>
                            연락처 <span style={{ color: '#ef5350', marginLeft: '4px' }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="phone"
                            name="phone"
                            className={styles.input}
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>
                </ul>

                {/* 우측 정보 */}
                <ul className={styles.rightBox}>
                    <li className={styles.fieldItem}>
                        <label htmlFor="companyIndustry" className={styles.label}>
                            업종
                        </label>
                        <input
                            type="text"
                            id="companyIndustry"
                            name="companyIndustry"
                            className={styles.input}
                            value={formData.companyIndustry}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyRevenue" className={styles.label}>
                            연매출
                        </label>
                        <input
                            type="text"
                            id="companyRevenue"
                            name="companyRevenue"
                            className={styles.input}
                            value={formData.companyRevenue}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyCreditRating" className={styles.label}>
                            기업신용등급
                        </label>
                        <input
                            type="text"
                            id="companyCreditRating"
                            name="companyCreditRating"
                            className={styles.input}
                            value={formData.companyCreditRating}
                            onChange={handleChange}
                            disabled={isViewMode}
                        />
                    </li>

                    <li className={`${styles.fieldItem} ${styles.CreditRating}`}>
                        <div>
                        <label htmlFor="companyCreditRatingKCB" className={styles.label}>
                            대표자신용점수
                        </label>
                            <div className={styles.ratingWrap}>
                                <b>KCB : </b>
                                <input
                                    type="text"
                                    id="companyCreditRatingKCB"
                                    name="companyCreditRatingKCB"
                                    className={styles.input}
                                    value={formData.companyCreditRatingKCB}
                                    onChange={handleChange}
                                    disabled={isViewMode}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="companyCreditRatingNICE" className={styles.label}>
                            대표자신용점수
                            </label>
                            <div className={styles.ratingWrap}>
                                <b>NICE :</b>
                                <input
                                    type="text"
                                    id="companyCreditRatingNICE"
                                    name="companyCreditRatingNICE"
                                    className={styles.input}
                                    value={formData.companyCreditRatingNICE}
                                    onChange={handleChange}
                                    disabled={isViewMode}
                                />
                                </div>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    );
});

CompanyInfoCard.displayName = 'CompanyInfoCard';

export default CompanyInfoCard;
