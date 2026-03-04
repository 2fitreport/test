'use client';

import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Check, X, CheckCircle2, File as FileIcon, Download, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import styles from './CretabInfo.module.css';

interface CretabFile {
    file?: File;
    fileName: string;
    fileSize: string;
    storagePath?: string;
    uploading?: boolean;
}

export interface CretabFormData {
    companyCreditRatingKCB: string;
    companyCreditRatingNICE: string;
    companyType: string;
    standardClassification: string;
    establishmentDate: string;
    companyAddress: string;
    assessmentDate: string;
    settlementDate: string;
    // 테이블 데이터
    years?: number[];
    assetTotal?: string[];
    debtTotal?: string[];
    capital?: string[];
    equityTotal?: string[];
    sales?: string[];
    netIncome?: string[];
    cashFlowGrade?: string[];
}

export interface CretabInfoHandle {
    getFormData: () => CretabFormData;
    setFormData: (data: Partial<CretabFormData>) => void;
    validateFormData: () => { valid: boolean; message?: string };
    getCretabFileForUpload: () => { file: File; fileName: string } | null;
    getCretabStatus: () => 'none' | 'file' | null;
    setCretabFile: (file: CretabFile | null) => void;
    setCretabStatus: (status: 'none' | 'file' | null) => void;
    getExtractedImages: () => { first: string | null; second: string | null };
    setExtractedImages: (images: { first: string | null; second: string | null }) => void;
}

interface CretabInfoProps {
    isViewMode?: boolean;
    viewId?: string | null;
    isEditMode?: boolean;
    onEditClick?: () => void;
    userLevel?: number;
    progressDetails?: string;
}

const CretabInfo = forwardRef<CretabInfoHandle, CretabInfoProps>(function CretabInfo({ isViewMode = false, viewId = null, isEditMode = false, onEditClick, userLevel = 0, progressDetails = '' }, ref) {
    const [formData, setFormData] = useState<CretabFormData>({
        companyCreditRatingKCB: '',
        companyCreditRatingNICE: '',
        companyType: '',
        standardClassification: '',
        establishmentDate: '',
        companyAddress: '',
        assessmentDate: '',
        settlementDate: '',
    });
    const [cretabStatus, setCretabStatus] = useState<'none' | 'file' | null>(null);
    const [cretabFile, setCretabFile] = useState<CretabFile | null>(null);
    const [previewFile, setPreviewFile] = useState<CretabFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extractedImages, setExtractedImages] = useState<{ first: string | null; second: string | null }>({ first: null, second: null });
    const [tableHeaders, setTableHeaders] = useState<string[]>(['년도', '년도', '년도']);
    const [tableData, setTableData] = useState<{ [key: string]: string[] }>({
        // 첫 번째 테이블
        assetTotal: ['', '', ''],
        debtTotal: ['', '', ''],
        capital: ['', '', ''],
        equityTotal: ['', '', ''],
        // 두 번째 테이블
        sales: ['', '', ''],
        netIncome: ['', '', ''],
        cashFlowGrade: ['', '', '']
    });
    const cretabFileInputRef = useRef<HTMLInputElement | null>(null);
    const pdfjsLibRef = useRef<any>(null);

    // PDF.js 동적 로드
    useEffect(() => {
        const loadPdfjs = async () => {
            try {
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
                pdfjsLibRef.current = pdfjsLib;
            } catch (error) {
                console.error('PDF.js 로드 실패:', error);
            }
        };
        loadPdfjs();
    }, []);

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

    // PDF 2페이지에서 설립일자 추출
    const extractEstablishmentDateFromPDF = async (file: File): Promise<string | null> => {
        try {
            if (!pdfjsLibRef.current) return null;

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            if (pdf.numPages < 2) return null;

            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');


            // "설 립 년 월" 패턴 찾기 (더 느슨한 경계)
            const pattern = /설[\s]*립[\s]*년[\s]*월[\s]+([\s\S]*?)(?=[\n\r기기업법사]|$)/;
            const match = text.match(pattern);

            if (match && match[1]) {
                // 날짜 형식 찾기 (공백이 많이 포함될 수 있음)
                // 2 0 2 0 - 1 2 - 1 0 형식도 처리
                const dateMatch = match[1].match(/(\d[\s\d]*\d)[\s\-]*(\d[\s\d]*\d)[\s\-]*(\d[\s\d]*\d)/);
                if (dateMatch) {
                    // 숫자만 추출
                    const year = dateMatch[1].replace(/\s/g, '');
                    const month = dateMatch[2].replace(/\s/g, '').padStart(2, '0');
                    const day = dateMatch[3].replace(/\s/g, '').padStart(2, '0');

                    if (year.length >= 4) {
                        const formatted = `${year.slice(0, 4)}-${month}-${day}`;
                        return formatted;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('설립일자 추출 실패:', error);
            return null;
        }
    };

    // PDF 2페이지에서 주소 추출 ("주 소" ~ "표 준 산 업 분 류" 사이)
    const extractCompanyAddressFromPDF = async (file: File): Promise<string | null> => {
        try {
            if (!pdfjsLibRef.current) return null;

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            if (pdf.numPages < 2) return null;

            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');


            // "주 소" ~ "표 준 산 업 분 류" 사이의 텍스트 추출
            const pattern = /주[\s]*소[\s]+([\s\S]*?)표[\s]*준[\s]*산[\s]*업[\s]*분[\s]*류/;
            const match = text.match(pattern);

            if (match && match[1]) {
                // 공백 제거 후 한글 주소만 추출
                const extracted = match[1]
                    .trim()
                    .split(/[\n\r]/)[0]
                    .trim()
                    .replace(/\s+/g, ' '); // 다중 공백을 단일 공백으로

                if (extracted && extracted.length > 5 && /[가-힣]/.test(extracted)) {
                    return extracted;
                }
            }

            return null;
        } catch (error) {
            console.error('주소 추출 실패:', error);
            return null;
        }
    };

    // PDF 2페이지에서 표준산업분류 추출 (마지막 것)
    const extractStandardClassificationFromPDF = async (file: File): Promise<string | null> => {
        try {
            if (!pdfjsLibRef.current) {
                return null;
            }

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            if (pdf.numPages < 2) return null;

            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');


            // "표준산업분류" 또는 "표 준 산 업 분 류" 패턴 (마지막 것)
            const lastMatch = text.lastIndexOf('표');
            if (lastMatch === -1) return null;

            // lastMatch 이후로 텍스트 추출
            let searchText = text.substring(lastMatch, lastMatch + 100);

            // "표준산업분류" 패턴 확인
            const isValidPattern = /표[\s]*준[\s]*산[\s]*업[\s]*분[\s]*류/.test(searchText);
            if (!isValidPattern) return null;

            // 패턴 뒤의 한글만 추출 (괄호와 코드 무시하고 순수 한글만)
            const koreanMatch = searchText.match(/[가-힣]+[가-힣\s]*/);
            if (koreanMatch) {
                const extracted = koreanMatch[0].replace(/\s+/g, '').match(/^[가-힣]+/)?.[0];
                if (extracted) {
                    return extracted;
                }
            }

            return null;
        } catch (error) {
            console.error('표준산업분류 추출 실패:', error);
            return null;
        }
    };

    // PDF 2페이지에서 평가일자 추출
    const extractAssessmentDateFromPDF = async (file: File): Promise<string | null> => {
        try {
            if (!pdfjsLibRef.current) return null;

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            if (pdf.numPages < 2) return null;

            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join('');
            const cleanedText = text.replace(/\s/g, '');

            console.log('평가일자 검색 원본:', text.substring(0, 300));
            console.log('평가일자 검색 (공백제거):', cleanedText.substring(0, 300));

            // "평가일자" 또는 "평 가 일 자" 패턴 찾기 (공백 제거된 텍스트에서)
            const pattern = /평가일자:?([\s\S]*?)(?=결산|기|$)/;
            const match = cleanedText.match(pattern);

            console.log('평가일자 매치 결과:', match ? '찾음' : '못찾음', match?.[1]?.substring(0, 50));

            if (match && match[1]) {
                // YYYY-MM-DD 또는 YYYYMMDD 형식 찾기
                const dateMatch = match[1].match(/(\d{4})[-\s]?(\d{2})[-\s]?(\d{2})/);
                if (dateMatch) {
                    const year = dateMatch[1];
                    const month = dateMatch[2];
                    const day = dateMatch[3];
                    const formatted = `${year}-${month}-${day}`;
                    console.log('✓ 추출된 평가일자:', formatted);
                    return formatted;
                }
            }
            console.log('✗ 평가일자 추출 실패: 날짜 형식 매칭 불가');

            return null;
        } catch (error) {
            console.error('평가일자 추출 실패:', error);
            return null;
        }
    };

    // PDF 2페이지에서 결산일자 추출
    const extractSettlementDateFromPDF = async (file: File): Promise<string | null> => {
        try {
            if (!pdfjsLibRef.current) return null;

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            if (pdf.numPages < 2) return null;

            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join('');
            const cleanedText = text.replace(/\s/g, '');

            console.log('결산일자 검색 원본:', text.substring(0, 300));
            console.log('결산일자 검색 (공백제거):', cleanedText.substring(0, 300));

            // "결산일자" 또는 "결 산 일 자" 패턴 찾기 (공백 제거된 텍스트에서)
            const pattern = /결산일자:?([\s\S]*?)(?=기|$)/;
            const match = cleanedText.match(pattern);

            console.log('결산일자 매치 결과:', match ? '찾음' : '못찾음', match?.[1]?.substring(0, 50));

            if (match && match[1]) {
                // YYYY-MM-DD 또는 YYYYMMDD 형식 찾기
                const dateMatch = match[1].match(/(\d{4})[-\s]?(\d{2})[-\s]?(\d{2})/);
                if (dateMatch) {
                    const year = dateMatch[1];
                    const month = dateMatch[2];
                    const day = dateMatch[3];
                    const formatted = `${year}-${month}-${day}`;
                    console.log('✓ 추출된 결산일자:', formatted);
                    return formatted;
                }
            }
            console.log('✗ 결산일자 추출 실패: 날짜 형식 매칭 불가');

            return null;
        } catch (error) {
            console.error('결산일자 추출 실패:', error);
            return null;
        }
    };

    // PDF 2페이지에서 이미지 추출
    const extractImagesFromPDF = async (file: File): Promise<{ first: string | null; second: string | null }> => {
        try {
            if (!pdfjsLibRef.current) return { first: null, second: null };

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            if (pdf.numPages < 2) return { first: null, second: null };

            const page = await pdf.getPage(2);
            const viewport = page.getViewport({ scale: 2 }); // 2배 스케일로 렌더링

            // Canvas 생성
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            if (!context) return { first: null, second: null };

            // 페이지 렌더링
            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            // 텍스트 위치 찾기
            const textContent = await page.getTextContent();


            let firstImage = null;
            let secondImage = null;

            // 첫 번째 이미지: 기업신용등급 ~ 결산일자 중간 영역
            // 텍스트 항목 기반으로 대략적인 높이 계산
            // 총 항목: ~650개, 페이지 높이: 1683.78px
            // index 545 ~ 550 범위를 crop (더 작은 범위로 추출)

            const totalItems = 650;
            const startItemIndex = 545;
            const endItemIndex = 550;

            // 각 항목의 대략적인 위치 계산
            const firstStartY = (startItemIndex / totalItems) * viewport.height - 100; // 위쪽 여유
            const firstEndY = (endItemIndex / totalItems) * viewport.height + 100; // 아래쪽 여유
            const firstCropHeight = firstEndY - firstStartY;

            const firstCanvas = document.createElement('canvas');
            const firstContext = firstCanvas.getContext('2d');
            const firstCropWidth = viewport.width * (1 / 3) - 40; // 오른쪽 40px 자르기
            firstCanvas.width = firstCropWidth;
            firstCanvas.height = firstCropHeight;

            if (firstContext) {
                const leftCrop = 30; // 왼쪽 30px 자르기
                firstContext.drawImage(
                    canvas,
                    leftCrop, Math.max(0, firstStartY),
                    firstCropWidth, Math.min(firstCropHeight, viewport.height - Math.max(0, firstStartY)),
                    0, 0,
                    firstCropWidth, firstCropHeight
                );
                firstImage = firstCanvas.toDataURL('image/png');
            }

            // 두 번째 이미지: EW등급 영역 (넓은 범위)
            const secondStartItemIndex = 500; // 위쪽 10px 늘림
            const secondEndItemIndex = 640; // 밑쪽 20px 늘림

            const secondStartY = (secondStartItemIndex / totalItems) * viewport.height;
            const secondEndY = (secondEndItemIndex / totalItems) * viewport.height;
            let secondCropHeight = secondEndY - secondStartY - 80; // 아래 80px만 제외

            secondCropHeight = Math.max(0, secondCropHeight);

            const secondCropWidth = viewport.width - 20; // 왼쪽 10px + 오른쪽 10px 자르기
            const secondCanvas = document.createElement('canvas');
            const secondContext = secondCanvas.getContext('2d');
            secondCanvas.width = secondCropWidth;
            secondCanvas.height = secondCropHeight;

            if (secondContext) {
                secondContext.drawImage(
                    canvas,
                    10, Math.max(0, secondStartY),
                    secondCropWidth, Math.min(secondCropHeight, viewport.height - Math.max(0, secondStartY)),
                    0, 0,
                    secondCropWidth, secondCropHeight
                );
                secondImage = secondCanvas.toDataURL('image/png');
            }

            return { first: firstImage, second: secondImage };
        } catch (error) {
            console.error('이미지 추출 실패:', error);
            return { first: null, second: null };
        }
    };

    // PDF 페이지 5에서 손익 데이터 추출
    const extractIncomeDataFromPDF = async (file: File): Promise<any | null> => {
        try {
            if (!pdfjsLibRef.current) return null;

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            // 페이지 5 (인덱스는 4)
            if (pdf.numPages < 5) return null;

            const page = await pdf.getPage(5);
            const textContent = await page.getTextContent();
            const rawText = textContent.items.map((item: any) => item.str).join('');

            console.log('=== 페이지 5 원본 텍스트 ===');
            console.log(rawText);

            const text = rawText;

            const incomeData: any = {
                sales: [],
                netIncome: [],
                cashFlowGrade: []
            };

            // 각 항목 다음의 숫자들 추출 함수 (공백 포함)
            const extractNumbersAfterLabel = (textInput: string, label: string, nextLabels: string[]): (number | string)[] => {
                const index = textInput.indexOf(label);
                if (index === -1) return [];

                let endIndex = textInput.length;
                for (const nextLabel of nextLabels) {
                    const nextIndex = textInput.indexOf(nextLabel, index + label.length);
                    if (nextIndex !== -1 && nextIndex < endIndex) {
                        endIndex = nextIndex;
                    }
                }

                const rangeText = textInput.substring(index + label.length, endIndex).trim();
                const tokens = rangeText.split(/\s+/);
                const result: (number | string)[] = [];

                for (const token of tokens) {
                    if (result.length >= 3) break;

                    // "-" 또는 "—" 또는 "–" 처리 (공백 표시)
                    if (token === '-' || token === '—' || token === '–') {
                        result.push('-');
                    } else {
                        // 숫자 추출
                        const num = parseInt(token.replace(/[^\d-]/g, ''));
                        if (!isNaN(num)) {
                            result.push(num);
                        }
                    }
                }

                return result;
            };

            // 현금흐름등급 추출 함수 (공백 포함)
            const extractGradeAfterLabel = (textInput: string, label: string, nextLabels: string[]): string[] => {
                const index = textInput.indexOf(label);
                if (index === -1) return [];

                let endIndex = textInput.length;
                for (const nextLabel of nextLabels) {
                    const nextIndex = textInput.indexOf(nextLabel, index + label.length);
                    if (nextIndex !== -1 && nextIndex < endIndex) {
                        endIndex = nextIndex;
                    }
                }

                const rangeText = textInput.substring(index + label.length, endIndex).trim();
                const tokens = rangeText.split(/\s+/);
                const result: string[] = [];

                for (const token of tokens) {
                    if (result.length >= 3) break;

                    // "-" 또는 "—" 또는 "–" 처리 (공백 표시)
                    if (token === '-' || token === '—' || token === '–') {
                        result.push('-');
                    } else if (token === 'NR' || token === 'NF' || token.startsWith('CR')) {
                        // NR, NF, CR1~CR5 등의 등급 코드
                        result.push(token);
                    }
                }

                return result;
            };

            // 매출액 데이터 추출 (영업이익까지만)
            incomeData.sales = extractNumbersAfterLabel(text, '매출액', ['영업이익']);

            // 당기순이익 데이터 추출 (구분 또는 요약까지)
            incomeData.netIncome = extractNumbersAfterLabel(text, '당기순이익', ['구분', '요약']);

            // 현금흐름등급 데이터 추출 (구분 또는 요약까지) - 특수 함수 사용
            incomeData.cashFlowGrade = extractGradeAfterLabel(text, '현금흐름등급', ['구분', '요약']);

            return (incomeData.sales.length > 0 || incomeData.netIncome.length > 0 || incomeData.cashFlowGrade.length > 0) ? incomeData : null;
        } catch (error) {
            console.error('손익 데이터 추출 실패:', error);
            return null;
        }
    };

    // PDF 페이지 4에서 재무 데이터 추출
    const extractFinancialDataFromPDF = async (file: File): Promise<any | null> => {
        try {
            if (!pdfjsLibRef.current) return null;

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            const financialData: any = {
                years: [],
                assetTotal: [],
                debtTotal: [],
                capital: [],
                equityTotal: []
            };

            // 각 항목 다음의 숫자들 추출 함수 (공백 포함)
            const extractNumbersAfterLabel = (text: string, label: string, nextLabels: string[]): (number | string)[] => {
                const index = text.indexOf(label);
                if (index === -1) return [];

                // 다음 레이블까지의 범위 찾기
                let endIndex = text.length;
                for (const nextLabel of nextLabels) {
                    const nextIndex = text.indexOf(nextLabel, index + label.length);
                    if (nextIndex !== -1 && nextIndex < endIndex) {
                        endIndex = nextIndex;
                    }
                }

                // 범위 내에서 숫자 추출 (공백 처리)
                const rangeText = text.substring(index + label.length, endIndex).trim();
                const tokens = rangeText.split(/\s+/);
                const result: (number | string)[] = [];

                for (const token of tokens) {
                    if (result.length >= 3) break;

                    // "-" 또는 "—" 또는 "–" 처리 (공백 표시)
                    if (token === '-' || token === '—' || token === '–') {
                        result.push('-');
                    } else {
                        // 숫자 추출
                        const num = parseInt(token.replace(/[^\d-]/g, ''));
                        if (!isNaN(num)) {
                            result.push(num);
                        }
                    }
                }

                return result;
            };

            // 페이지 4 시도 (인덱스는 3)
            if (pdf.numPages >= 4) {
                const page = await pdf.getPage(4);
                const textContent = await page.getTextContent();
                const text = textContent.items.map((item: any) => item.str).join('');

                console.log('=== 페이지 4 재무 데이터 추출 시도 ===');
                console.log('자산총계 포함여부:', text.includes('자산총계'));

                // 맨 마지막에 있는 년도 3개 추출
                const yearMatches = text.match(/(\d{4})/g);
                if (yearMatches && yearMatches.length >= 3) {
                    financialData.years = yearMatches.slice(-3).map(Number);
                    console.log('페이지 4 년도 추출됨:', financialData.years);
                }

                // 자산총계 데이터 추출
                financialData.assetTotal = extractNumbersAfterLabel(text, '자산총계', ['부채총계']);
                financialData.debtTotal = extractNumbersAfterLabel(text, '부채총계', ['자본금']);
                financialData.capital = extractNumbersAfterLabel(text, '자본금', ['자본총계']);
                financialData.equityTotal = extractNumbersAfterLabel(text, '자본총계', ['구분']);
            }

            // 페이지 4에서 금융 데이터를 못 찾으면 페이지 5 시도
            if (financialData.assetTotal.length === 0 && pdf.numPages >= 5) {
                const page = await pdf.getPage(5);
                const textContent = await page.getTextContent();
                const text = textContent.items.map((item: any) => item.str).join('');

                console.log('=== 페이지 5 재무 데이터 추출 시작 ===');
                console.log('전체 텍스트:', text);

                // 맨 마지막에 있는 년도 3개 추출
                const yearMatches = text.match(/(\d{4})/g);
                if (yearMatches && yearMatches.length >= 3) {
                    financialData.years = yearMatches.slice(-3).map(Number);
                }
                console.log('추출된 년도:', financialData.years);

                // 자산총계 데이터 추출
                financialData.assetTotal = extractNumbersAfterLabel(text, '자산총계', ['부채총계']);
                console.log('자산총계:', financialData.assetTotal);

                financialData.debtTotal = extractNumbersAfterLabel(text, '부채총계', ['자본금']);
                console.log('부채총계:', financialData.debtTotal);

                financialData.capital = extractNumbersAfterLabel(text, '자본금', ['자본총계']);
                console.log('자본금:', financialData.capital);

                financialData.equityTotal = extractNumbersAfterLabel(text, '자본총계', ['구분']);
                console.log('자본총계:', financialData.equityTotal);

                console.log('=== 페이지 5 재무 데이터 추출 완료 ===');
            }

            return financialData.years.length > 0 ? financialData : null;
        } catch (error) {
            console.error('재무 데이터 추출 실패:', error);
            return null;
        }
    };

    // PDF 2페이지에서 기업유형 추출
    const extractCompanyTypeFromPDF = async (file: File): Promise<string | null> => {
        try {
            if (!pdfjsLibRef.current) {
                console.error('PDF.js가 아직 로드되지 않았습니다.');
                return null;
            }

            const pdfjsLib = pdfjsLibRef.current;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;


            // 2페이지만 추출 (페이지 번호는 1부터 시작)
            if (pdf.numPages < 2) {
                console.warn('PDF이 2페이지 미만입니다.');
                return null;
            }

            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');


            // "기 업 유 형" 과 "기 업 규 모" 사이의 텍스트 추출
            // 예: "기 업 유 형   일 반 법 인   기 업 규 모" → "일반법인"
            const pattern = /기[\s]*업[\s]*유[\s]*형[\s]+([\s\S]*?)[\s]*기[\s]*업[\s]*규[\s]*모/;
            const match = text.match(pattern);

            if (match && match[1]) {
                // 추출된 문자열에서 공백 제거 후 한글만 추출
                const extracted = match[1]
                    .replace(/\s+/g, '')  // 모든 공백 제거
                    .match(/[가-힣]+/)?.[0]; // 처음 나오는 한글 단어만

                if (extracted) {
                    return extracted;
                }
            }

            console.warn('기업유형 정보를 찾을 수 없습니다.');
            return null;
        } catch (error) {
            console.error('PDF 텍스트 추출 실패:', error);
            return null;
        }
    };

    const handleCretabFileClick = () => {
        cretabFileInputRef.current?.click();
    };

    const handleCretabFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

            // PDF 파일이면 정보 자동 추출
            if (file.type === 'application/pdf') {
                setIsLoading(true);
                try {
                    const extractedCompanyType = await extractCompanyTypeFromPDF(file);
                    const extractedStandardClassification = await extractStandardClassificationFromPDF(file);
                    const extractedEstablishmentDate = await extractEstablishmentDateFromPDF(file);
                    const extractedAddress = await extractCompanyAddressFromPDF(file);
                    const extractedAssessmentDate = await extractAssessmentDateFromPDF(file);
                    const extractedSettlementDate = await extractSettlementDateFromPDF(file);
                    const images = await extractImagesFromPDF(file);
                    const financialData = await extractFinancialDataFromPDF(file);
                    const incomeData = await extractIncomeDataFromPDF(file);

                    console.log('=== 최종 추출 결과 ===');
                    console.log('재무 데이터:', financialData);
                    console.log('손익 데이터:', incomeData);

                    setFormData((prev) => ({
                        ...prev,
                        ...(extractedCompanyType && { companyType: extractedCompanyType }),
                        ...(extractedStandardClassification && { standardClassification: extractedStandardClassification }),
                        ...(extractedEstablishmentDate && { establishmentDate: extractedEstablishmentDate }),
                        ...(extractedAddress && { companyAddress: extractedAddress }),
                        // 평가일자/결산일자: 추출 안 되면 하이픈 처리
                        assessmentDate: extractedAssessmentDate || '-',
                        settlementDate: extractedSettlementDate || '-',
                    }));

                    setExtractedImages(images);

                    // 배열 길이를 맞추는 헬퍼 함수 (부족한 부분은 앞에 공백 추가)
                    const padArrayToLength = (arr: (number | string)[], targetLength: number): string[] => {
                        const result = arr.map(v => String(v === '' ? '-' : v));
                        while (result.length < targetLength) {
                            result.unshift('-'); // 앞에 하이픈 추가
                        }
                        return result.slice(0, targetLength);
                    };

                    // 재무 데이터 설정
                    if (financialData && financialData.years.length > 0) {
                        const expectedLength = financialData.years.length;

                        console.log('테이블 데이터 설정:', {
                            headers: financialData.years.map(String),
                            assetTotal: financialData.assetTotal.map(String),
                            debtTotal: financialData.debtTotal.map(String),
                            capital: financialData.capital.map(String),
                            equityTotal: financialData.equityTotal.map(String)
                        });
                        setTableHeaders(financialData.years.map(String));
                        setTableData((prev) => ({
                            ...prev,
                            assetTotal: padArrayToLength(financialData.assetTotal, expectedLength),
                            debtTotal: padArrayToLength(financialData.debtTotal, expectedLength),
                            capital: padArrayToLength(financialData.capital, expectedLength),
                            equityTotal: padArrayToLength(financialData.equityTotal, expectedLength),
                            // 손익 데이터: incomeData가 없으면 기본값으로 하이픈 처리
                            sales: incomeData?.sales?.length ? padArrayToLength(incomeData.sales, expectedLength) : Array(expectedLength).fill('-'),
                            netIncome: incomeData?.netIncome?.length ? padArrayToLength(incomeData.netIncome, expectedLength) : Array(expectedLength).fill('-'),
                            cashFlowGrade: incomeData?.cashFlowGrade?.length ? padArrayToLength(incomeData.cashFlowGrade, expectedLength) : Array(expectedLength).fill('-')
                        }));
                    } else {
                        console.log('재무 데이터가 비어있음:', financialData);
                    }
                } finally {
                    setIsLoading(false);
                }
            }

            // input 초기화 (setTimeout으로 지연)
            setTimeout(() => {
                if (cretabFileInputRef.current) {
                    cretabFileInputRef.current.value = '';
                }
            }, 0);
        }
    };

    const handleCretabNoneClick = () => {
        // 기업상세정보가 없거나 파일이 등록되어 있지 않은 경우: 초기화하지 않음
        if (cretabStatus === 'none' || !cretabFile) {
            setCretabStatus('none');
            setCretabFile(null);
            return;
        }

        // 파일이 있었는데 기업상세정보 없음으로 변경: 데이터 초기화
        setCretabStatus('none');
        setCretabFile(null);
        // 폼 데이터 초기화 (년도 제외)
        setFormData({
            companyCreditRatingKCB: '',
            companyCreditRatingNICE: '',
            companyType: '',
            standardClassification: '',
            establishmentDate: '',
            companyAddress: '',
            assessmentDate: '',
            settlementDate: '',
        });
        // 이미지 초기화
        setExtractedImages({ first: null, second: null });
        // 테이블 데이터 초기화
        setTableHeaders(['년도', '년도', '년도']);
        setTableData({
            assetTotal: ['', '', ''],
            debtTotal: ['', '', ''],
            capital: ['', '', ''],
            equityTotal: ['', '', ''],
            sales: ['', '', ''],
            netIncome: ['', '', ''],
            cashFlowGrade: ['', '', '']
        });
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
            alert('다운로드할 기업상세정보 파일이 없습니다.');
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
            a.download = `기업상세정보_${new Date().getTime()}.zip`;
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
        getFormData: () => ({
            ...formData,
            years: tableHeaders.map(Number),
            assetTotal: tableData.assetTotal,
            debtTotal: tableData.debtTotal,
            capital: tableData.capital,
            equityTotal: tableData.equityTotal,
            sales: tableData.sales,
            netIncome: tableData.netIncome,
            cashFlowGrade: tableData.cashFlowGrade,
        }),
        setFormData: (data: Partial<CretabFormData>) => {
            setFormData(prev => ({ ...prev, ...data }));
            // 테이블 데이터 설정 - 기본 구조 유지
            if (data.years !== undefined) {
                if (data.years?.length) {
                    // years가 유효한 숫자만 포함하는지 확인 (null이나 NaN 제외)
                    const validYears = data.years.filter(y => y != null && !isNaN(Number(y)));
                    if (validYears.length > 0) {
                        setTableHeaders(validYears.map(String));
                    } else {
                        // 유효한 년도가 없으면 기본값으로 리셋
                        setTableHeaders(['년도', '년도', '년도']);
                    }
                } else {
                    // 빈 배열이면 기본값으로 리셋
                    setTableHeaders(['년도', '년도', '년도']);
                }
            }

            // 테이블 데이터 설정
            const hasTableData = data.assetTotal || data.debtTotal || data.capital || data.equityTotal || data.sales || data.netIncome || data.cashFlowGrade;
            if (hasTableData) {
                setTableData(prev => ({
                    ...prev,
                    assetTotal: data.assetTotal?.length ? data.assetTotal : (data.assetTotal ? ['', '', ''] : prev.assetTotal),
                    debtTotal: data.debtTotal?.length ? data.debtTotal : (data.debtTotal ? ['', '', ''] : prev.debtTotal),
                    capital: data.capital?.length ? data.capital : (data.capital ? ['', '', ''] : prev.capital),
                    equityTotal: data.equityTotal?.length ? data.equityTotal : (data.equityTotal ? ['', '', ''] : prev.equityTotal),
                    sales: data.sales?.length ? data.sales : (data.sales ? ['', '', ''] : prev.sales),
                    netIncome: data.netIncome?.length ? data.netIncome : (data.netIncome ? ['', '', ''] : prev.netIncome),
                    cashFlowGrade: data.cashFlowGrade?.length ? data.cashFlowGrade : (data.cashFlowGrade ? ['', '', ''] : prev.cashFlowGrade),
                }));
            }
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
        getExtractedImages: () => extractedImages,
        setExtractedImages: (images: { first: string | null; second: string | null }) => {
            setExtractedImages(images);
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
                    {cretabStatus === 'none' && userLevel !== 4 && (
                        <div className={styles.cretabStatusBadge}>
                            <Check size={16} />
                            기업상세정보 없음
                        </div>
                    )}
                    {cretabFile && userLevel !== 4 && (
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
                    {cretabFile && userLevel !== 4 && (
                        <button
                            className={styles.downloadBtn}
                            onClick={handleDownloadCretabZip}
                            title="기업상세정보 파일 다운로드"
                        >
                            <Download size={18} />
                            다운로드
                        </button>
                    )}
                    {viewId && !isViewMode && userLevel !== 4 && (
                        <>
                            <button className={styles.cretabFileBtn} onClick={handleCretabFileClick}>
                                기업상세정보 파일 등록
                            </button>
                            <button className={styles.cretabNoneBtn} onClick={handleCretabNoneClick}>
                                기업상세정보 없음
                            </button>
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
                            disabled={isViewMode || userLevel === 4}
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
                            disabled={isViewMode || userLevel === 4}
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
                            disabled={isViewMode || userLevel === 4}
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
                            disabled={isViewMode || userLevel === 4}
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
                            disabled={isViewMode || userLevel === 4}
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
                            disabled={isViewMode || userLevel === 4}
                            placeholder="회사주소를 입력하세요"
                        />
                    </li>
                </ul>

                {/* 오른쪽 섹션: 이미지 + 테이블 */}
                <div className={styles.rightSection}>
                    {/* 이미지 영역 */}
                    <div className={styles.imageArea}>
                        <div className={styles.imagePlaceholder}>
                            {extractedImages.first ? (
                                <img src={extractedImages.first} alt="기업신용등급" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                            ) : (
                                <span></span>
                            )}
                        </div>
                        <div className={styles.imagePlaceholder}>
                            <table className={styles.dataTable} style={{ width: '100%', marginBottom: '0' }}>
                                <tbody>
                                    <tr>
                                        <td className={styles.rowLabel}>평가일자</td>
                                        <td><input type="text" className={styles.cellInput} value={formData.assessmentDate} onChange={(e) => setFormData(prev => ({ ...prev, assessmentDate: e.target.value }))} disabled={isViewMode || userLevel === 4} /></td>
                                    </tr>
                                    <tr>
                                        <td className={styles.rowLabel}>결산일자</td>
                                        <td><input type="text" className={styles.cellInput} value={formData.settlementDate} onChange={(e) => setFormData(prev => ({ ...prev, settlementDate: e.target.value }))} disabled={isViewMode || userLevel === 4} /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 테이블 영역 */}
                    <div className={styles.tableArea}>
                        {/* 첫번째 테이블 - 재무 현황 */}
                        <table className={styles.dataTable}>
                            <thead>
                                <tr className={styles.tableHeader}>
                                    <th>구분</th>
                                    {tableHeaders.map((header, idx) => (
                                        <th key={idx}><input type="text" value={header} onChange={(e) => setTableHeaders(prev => { const newHeaders = [...prev]; newHeaders[idx] = e.target.value; return newHeaders; })} className={styles.headerInput} disabled={isViewMode || userLevel === 4} /></th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={styles.rowLabel}>자산총계</td>
                                    {tableData.assetTotal.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, assetTotal: prev.assetTotal.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={styles.rowLabel}>부채총계</td>
                                    {tableData.debtTotal.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, debtTotal: prev.debtTotal.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={styles.rowLabel}>자본금</td>
                                    {tableData.capital.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, capital: prev.capital.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={styles.rowLabel}>자본총계</td>
                                    {tableData.equityTotal.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, equityTotal: prev.equityTotal.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>

                        {/* 두번째 테이블 - 손익 현황 */}
                        <table className={styles.dataTable}>
                            <thead>
                                <tr className={styles.tableHeader}>
                                    <th>구분</th>
                                    {tableHeaders.map((header, idx) => (
                                        <th key={idx}><input type="text" value={header} onChange={(e) => setTableHeaders(prev => { const newHeaders = [...prev]; newHeaders[idx] = e.target.value; return newHeaders; })} className={styles.headerInput} disabled={isViewMode || userLevel === 4} /></th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={styles.rowLabel}>매출액</td>
                                    {tableData.sales.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, sales: prev.sales.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={styles.rowLabel}>당기순이익</td>
                                    {tableData.netIncome.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, netIncome: prev.netIncome.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={styles.rowLabel}>현금흐름등급</td>
                                    {tableData.cashFlowGrade.map((value, idx) => (
                                        <td key={idx}><input type="text" value={value} onChange={(e) => setTableData(prev => ({ ...prev, cashFlowGrade: prev.cashFlowGrade.map((v, i) => i === idx ? e.target.value : v) }))} className={styles.cellInput}  disabled={isViewMode || userLevel === 4} /></td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
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

            {/* 로딩 오버레이 */}
            {isLoading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <Loader2 size={48} color="#fff" className={styles.spinner} />
                    <p style={{ color: '#fff', fontSize: '16px', fontWeight: 500, margin: 0 }}>
                        텍스트 추출중...
                    </p>
                </div>
            )}
        </div>
    );
});

CretabInfo.displayName = 'CretabInfo';

export default CretabInfo;
