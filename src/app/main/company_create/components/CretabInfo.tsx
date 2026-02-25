'use client';

import { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { Check, X, CheckCircle2, File as FileIcon, Download } from 'lucide-react';
import JSZip from 'jszip';
import styles from './CretabInfo.module.css';

interface CretabFile {
    file?: File;
    fileName: string;
    fileSize: string;
    storagePath?: string;
    uploading?: boolean;
}

interface CretabFormData {
    companyCreditRatingKCB: string;
    companyCreditRatingNICE: string;
    companyType: string;
    standardClassification: string;
    establishmentDate: string;
    companyAddress: string;
}

export interface CretabInfoHandle {
    getFormData: () => CretabFormData;
    setFormData: (data: Partial<CretabFormData>) => void;
    validateFormData: () => { valid: boolean; message?: string };
    getCretabFileForUpload: () => { file: File; fileName: string } | null;
    getCretabStatus: () => 'none' | 'file' | null;
    setCretabFile: (file: CretabFile | null) => void;
    setCretabStatus: (status: 'none' | 'file' | null) => void;
}

interface CretabInfoProps {
    isViewMode?: boolean;
    viewId?: string | null;
    isEditMode?: boolean;
    onEditClick?: () => void;
}

const CretabInfo = forwardRef<CretabInfoHandle, CretabInfoProps>(function CretabInfo({ isViewMode = false, viewId = null, isEditMode = false, onEditClick }, ref) {
    const [formData, setFormData] = useState<CretabFormData>({
        companyCreditRatingKCB: '',
        companyCreditRatingNICE: '',
        companyType: '',
        standardClassification: '',
        establishmentDate: '',
        companyAddress: '',
    });
    const [cretabStatus, setCretabStatus] = useState<'none' | 'file' | null>(null);
    const [cretabFile, setCretabFile] = useState<CretabFile | null>(null);
    const [previewFile, setPreviewFile] = useState<CretabFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const cretabFileInputRef = useRef<HTMLInputElement | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatCreditRating = (value: string): string => {
        // 숫자만 추출 (최대 4자리)
        return value.replace(/\D/g, '').slice(0, 4);
    };

    const formatDate = (value: string): string => {
        // 숫자만 추출 (최대 8자리: YYYYMMDD)
        const numbers = value.replace(/\D/g, '').slice(0, 8);

        // YYYY-MM-DD 형식으로 변환
        if (numbers.length <= 4) {
            return numbers;
        } else if (numbers.length <= 6) {
            return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
        } else {
            return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6)}`;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let formattedValue = value;

        // 신용점수 포맷팅 (숫자만, 4자리까지)
        if (name === 'companyCreditRatingKCB' || name === 'companyCreditRatingNICE') {
            formattedValue = formatCreditRating(value);
        }
        // 설립일자 포맷팅 (YYYY-MM-DD)
        else if (name === 'establishmentDate') {
            formattedValue = formatDate(value);
        }

        setFormData((prev) => ({
            ...prev,
            [name]: formattedValue,
        }));
    };

    const handleCretabFileClick = () => {
        cretabFileInputRef.current?.click();
    };

    const handleCretabFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 파일 크기 검증 (5GB 제한)
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError('파일 크기는 5GB 이하여야 합니다.');
                return;
            }

            // 메모리에만 저장 (저장 시 업로드)
            setCretabFile({
                file,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
            });
            setCretabStatus('file');

            // input 초기화 (setTimeout으로 지연)
            setTimeout(() => {
                if (cretabFileInputRef.current) {
                    cretabFileInputRef.current.value = '';
                }
            }, 0);
        }
    };

    const handleCretabNoneClick = () => {
        setCretabStatus('none');
        setCretabFile(null);
    };

    const handleRemoveCretabFile = () => {
        setCretabFile(null);
        setCretabStatus(null);
        if (cretabFileInputRef.current) {
            cretabFileInputRef.current.value = '';
        }
    };

    const handleOpenPreview = async (file: CretabFile) => {
        setPreviewFile(file);

        // 새로 업로드한 파일 (File 객체 있음)
        if (file.file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result;
                if (typeof result === 'string') {
                    setPreviewUrl(result);
                }
            };
            reader.readAsDataURL(file.file);
        }
        // 저장된 파일 (storagePath 있음)
        else if (file.storagePath) {
            try {
                const response = await fetch('/api/file/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: file.storagePath }),
                });
                const data = await response.json();
                setPreviewUrl(data.url);
            } catch (error) {
                console.error('미리보기 로드 실패:', error);
            }
        }
    };

    const handleClosePreview = () => {
        setPreviewFile(null);
        setPreviewUrl(null);
    };

    const isImageFile = (fileName: string): boolean => {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        const ext = fileName.split('.').pop()?.toLowerCase();
        return ext ? imageExtensions.includes(ext) : false;
    };

    const isPdfFile = (fileName: string): boolean => {
        return fileName.toLowerCase().endsWith('.pdf');
    };

    const handleDownloadCretabZip = async () => {
        if (!cretabFile) {
            alert('다운로드할 크레탑 파일이 없습니다.');
            return;
        }

        try {
            const zip = new JSZip();

            if (cretabFile.file) {
                // 새로 업로드한 파일
                zip.file(cretabFile.fileName, cretabFile.file);
            } else if (cretabFile.storagePath) {
                // 저장된 파일 - URL에서 다운로드
                const response = await fetch('/api/file/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: cretabFile.storagePath }),
                });
                const data = await response.json();
                const fileResponse = await fetch(data.url);
                const blob = await fileResponse.blob();
                zip.file(cretabFile.fileName, blob);
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `크레탑파일_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('ZIP 생성 실패:', error);
            alert('파일 다운로드에 실패했습니다.');
        }
    };

    useImperativeHandle(ref, () => ({
        getFormData: () => formData,
        setFormData: (data: Partial<CretabFormData>) => {
            setFormData(prev => ({ ...prev, ...data }));
        },
        validateFormData: () => {
            if (!formData.companyCreditRatingKCB?.trim()) {
                return { valid: false, message: '신용점수 KCB를 입력해주세요.' };
            }
            if (!formData.companyCreditRatingNICE?.trim()) {
                return { valid: false, message: '신용점수 NICE를 입력해주세요.' };
            }
            if (!formData.companyType?.trim()) {
                return { valid: false, message: '기업유형을 입력해주세요.' };
            }
            if (!formData.standardClassification?.trim()) {
                return { valid: false, message: '표준분류를 입력해주세요.' };
            }
            if (!formData.establishmentDate?.trim()) {
                return { valid: false, message: '설립일자를 입력해주세요.' };
            }
            if (!formData.companyAddress?.trim()) {
                return { valid: false, message: '회사주소를 입력해주세요.' };
            }
            return { valid: true };
        },
        getCretabFileForUpload: () => {
            return cretabFile && cretabFile.file ? { file: cretabFile.file, fileName: cretabFile.fileName } : null;
        },
        getCretabStatus: () => cretabStatus,
        setCretabFile: (file: CretabFile | null) => {
            setCretabFile(file);
        },
        setCretabStatus: (status: 'none' | 'file' | null) => {
            setCretabStatus(status);
        },
    }));

    return (
        <div className={styles.cretabInfo}>
            <div className={styles.titleWrap}>
                <div className={styles.titleContent}>
                    <h2 className={styles.title}>기업상세정보</h2>
                    <h3 className={styles.subtitle}>기업상세정보를 입력해주세요.</h3>
                </div>
                <div className={styles.cretabFileSection}>
                    {cretabStatus === 'none' && (
                        <div className={styles.cretabStatusBadge}>
                            <Check size={16} />
                            크레탑 정보 없음
                        </div>
                    )}
                    {cretabFile && (
                        <div
                            className={styles.cretabFileInfo}
                            onClick={() => handleOpenPreview(cretabFile)}
                        >
                            <CheckCircle2 className={styles.cretabCheckIcon} />
                            <div className={styles.cretabFileDetail}>
                                <p className={styles.cretabFileName}>{cretabFile.fileName}</p>
                                <p className={styles.cretabFileSize}>{cretabFile.fileSize}</p>
                            </div>
                            {!isViewMode && (
                                <button
                                    className={styles.cretabRemoveBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCretabFile();
                                    }}
                                    title="삭제"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    )}
                    {cretabFile && (
                        <button
                            className={styles.downloadBtn}
                            onClick={handleDownloadCretabZip}
                            title="크레탑 파일 다운로드"
                        >
                            <Download size={18} />
                            다운로드
                        </button>
                    )}
                    {viewId && (
                        <>
                            {isViewMode ? (
                                <button className={styles.cretabFileBtn} onClick={onEditClick}>
                                    크레탑 파일 등록
                                </button>
                            ) : (
                                <>
                                    <button className={styles.cretabFileBtn} onClick={handleCretabFileClick}>
                                        크레탑 파일 등록
                                    </button>
                                    <button className={styles.cretabNoneBtn} onClick={handleCretabNoneClick}>
                                        크레탑 정보 없음
                                    </button>
                                </>
                            )}
                        </>
                    )}
                    <input
                        type="file"
                        ref={cretabFileInputRef}
                        onChange={handleCretabFileChange}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>

            <div className={styles.cretabWrap}>
                <ul className={styles.fieldList}>
                    <li className={styles.fieldItem}>
                        <label htmlFor="companyCreditRatingKCB" className={styles.label}>
                            대표자 신용점수 KCB
                        </label>
                        <input
                            type="text"
                            id="companyCreditRatingKCB"
                            name="companyCreditRatingKCB"
                            className={styles.input}
                            value={formData.companyCreditRatingKCB}
                            onChange={handleChange}
                            disabled={isViewMode}
                            placeholder="최대 4자리"
                            maxLength={4}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyCreditRatingNICE" className={styles.label}>
                            대표자 신용점수 NICE
                        </label>
                        <input
                            type="text"
                            id="companyCreditRatingNICE"
                            name="companyCreditRatingNICE"
                            className={styles.input}
                            value={formData.companyCreditRatingNICE}
                            onChange={handleChange}
                            disabled={isViewMode}
                            placeholder="최대 4자리"
                            maxLength={4}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyType" className={styles.label}>
                            기업유형
                        </label>
                        <input
                            type="text"
                            id="companyType"
                            name="companyType"
                            className={styles.input}
                            value={formData.companyType}
                            onChange={handleChange}
                            disabled={isViewMode}
                            placeholder="기업유형을 입력하세요"
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="standardClassification" className={styles.label}>
                            표준분류
                        </label>
                        <input
                            type="text"
                            id="standardClassification"
                            name="standardClassification"
                            className={styles.input}
                            value={formData.standardClassification}
                            onChange={handleChange}
                            disabled={isViewMode}
                            placeholder="표준분류를 입력하세요"
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="establishmentDate" className={styles.label}>
                            설립일자
                        </label>
                        <input
                            type="text"
                            id="establishmentDate"
                            name="establishmentDate"
                            className={styles.input}
                            value={formData.establishmentDate}
                            onChange={handleChange}
                            disabled={isViewMode}
                            placeholder="2000-01-02"
                            maxLength={10}
                        />
                    </li>

                    <li className={styles.fieldItem}>
                        <label htmlFor="companyAddress" className={styles.label}>
                            회사주소
                        </label>
                        <input
                            type="text"
                            id="companyAddress"
                            name="companyAddress"
                            className={styles.input}
                            value={formData.companyAddress}
                            onChange={handleChange}
                            disabled={isViewMode}
                            placeholder="회사주소를 입력하세요"
                        />
                    </li>
                </ul>
            </div>

            {/* 미리보기 모달 */}
            {previewFile && previewUrl && (
                <div className={styles.previewModal} onClick={handleClosePreview}>
                    <div className={styles.previewContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.previewCloseBtn} onClick={handleClosePreview}>
                            <X size={24} />
                        </button>
                        <div className={styles.previewBody}>
                            {isImageFile(previewFile.fileName) ? (
                                <img src={previewUrl} alt={previewFile.fileName} className={styles.previewImage} />
                            ) : isPdfFile(previewFile.fileName) ? (
                                <iframe src={previewUrl} className={styles.previewPdf} />
                            ) : (
                                <div className={styles.previewOther}>
                                    <FileIcon size={64} />
                                    <p className={styles.previewFileName}>{previewFile.fileName}</p>
                                    <p className={styles.previewFileSize}>{previewFile.fileSize}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

CretabInfo.displayName = 'CretabInfo';

export default CretabInfo;
