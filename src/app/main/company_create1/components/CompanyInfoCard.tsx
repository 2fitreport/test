'use client';

import { useState } from 'react';
import styles from './CompanyInfoCard.module.css';

interface CompanyFormData {
    companyName: string;
    companyNumber: string;
    companyPersonName: string;
    companyPhone: string;
    companyIndustry: string;
    companyRevenue: string;
    companyCreditRating: string;
    companyCreditRatingKCB: string;
    companyCreditRatingNICE: string;
}

export default function CompanyInfoCard() {
    const [formData, setFormData] = useState<CompanyFormData>({
        companyName: '',
        companyNumber: '',
        companyPersonName: '',
        companyPhone: '',
        companyIndustry: '',
        companyRevenue: '',
        companyCreditRating: '',
        companyCreditRatingKCB: '',
        companyCreditRatingNICE: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

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
                        <label htmlFor="companyName" className={styles.label}>
                            기업명
                        </label>
                        <input
                            type="text"
                            id="companyName"
                            name="companyName"
                            className={styles.input}
                            value={formData.companyName}
                            onChange={handleChange}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyNumber" className={styles.label}>
                            사업자등록번호
                        </label>
                        <input
                            type="text"
                            id="companyNumber"
                            name="companyNumber"
                            className={styles.input}
                            value={formData.companyNumber}
                            onChange={handleChange}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyPersonName" className={styles.label}>
                            대표자명
                        </label>
                        <input
                            type="text"
                            id="companyPersonName"
                            name="companyPersonName"
                            className={styles.input}
                            value={formData.companyPersonName}
                            onChange={handleChange}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyPhone" className={styles.label}>
                            연락처
                        </label>
                        <input
                            type="text"
                            id="companyPhone"
                            name="companyPhone"
                            className={styles.input}
                            value={formData.companyPhone}
                            onChange={handleChange}
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
                                />
                                </div>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    );
}
