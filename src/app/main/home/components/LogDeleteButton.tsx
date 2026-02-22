'use client';

import { FiX } from 'react-icons/fi';
import styles from './logWrap.module.css';

export default function LogDeleteButton({ logId, onDeleted }: { logId: number; onDeleted?: () => void }) {
    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('LogDeleteButton 클릭:', logId);
        try {
            console.log('PATCH 요청 전송:', `/api/documents/logs/${logId}`);
            const response = await fetch(`/api/documents/logs/${logId}`, {
                method: 'PATCH',
                credentials: 'include'
            });
            console.log('PATCH 응답:', response.status, await response.json());
            if (response.ok) {
                console.log('읽음 처리 성공, onDeleted 호출');
                onDeleted?.();
            }
        } catch (error) {
            console.error('읽음 처리 실패:', error);
        }
    };

    return (
        <button className={styles.deleteButton} onClick={handleDelete}>
            <FiX />
        </button>
    );
}
