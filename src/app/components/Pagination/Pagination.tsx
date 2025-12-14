'use client';

import Image from 'next/image';
import styles from './pagination.module.css';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 5;
        const halfWindow = Math.floor(maxPagesToShow / 2);

        let startPage = Math.max(1, currentPage - halfWindow);
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (startPage > 1) {
            pages.push(1);
            if (startPage > 2) {
                pages.push('...');
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push('...');
            }
            pages.push(totalPages);
        }

        return pages;
    };

    const handleMovePagesBack = () => {
        onPageChange(Math.max(1, currentPage - 5));
    };

    const handleMovePagesFront = () => {
        onPageChange(Math.min(totalPages, currentPage + 5));
    };

    return (
        <div className={styles.pagination}>
            <button
                className={styles.doubleNavButton}
                onClick={handleMovePagesBack}
                disabled={currentPage === 1}
                aria-label="5페이지 이전"
            >
                <Image
                    src="/arrow_left_double.svg"
                    alt="5페이지 이전"
                    width={20}
                    height={20}
                />
            </button>

            <button
                className={styles.navButton}
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="이전 페이지"
            >
                <Image
                    src="/arrow_left.svg"
                    alt="이전 페이지"
                    width={20}
                    height={20}
                />
            </button>

            <div className={styles.pageNumbers}>
                {getPageNumbers().map((page, index) => (
                    <button
                        key={index}
                        className={`${styles.pageButton} ${
                            page === currentPage ? styles.active : ''
                        }`}
                        onClick={() => {
                            if (typeof page === 'number') {
                                onPageChange(page);
                            }
                        }}
                        disabled={typeof page === 'string'}
                    >
                        {page}
                    </button>
                ))}
            </div>

            <button
                className={styles.navButton}
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="다음 페이지"
            >
                <Image
                    src="/arrow_right.svg"
                    alt="다음 페이지"
                    width={20}
                    height={20}
                />
            </button>

            <button
                className={styles.doubleNavButton}
                onClick={handleMovePagesFront}
                disabled={currentPage === totalPages}
                aria-label="5페이지 다음"
            >
                <Image
                    src="/arrow_right_double.svg"
                    alt="5페이지 다음"
                    width={20}
                    height={20}
                />
            </button>
        </div>
    );
}
