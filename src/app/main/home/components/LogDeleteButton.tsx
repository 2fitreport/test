'use client';

import { FiX } from 'react-icons/fi';
import styles from './logWrap.module.css';

export default function LogDeleteButton({ logId, onDeleted }: { logId: number; onDeleted?: () => void }) {
    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/documents/logs/${logId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (response.ok) {
                onDeleted?.();
            }
        } catch (error) {
            console.error('삭제 실패:', error);
        }
    };

    return (
        <button className={styles.deleteButton} onClick={handleDelete}>
            <FiX />
        </button>
    );
}
