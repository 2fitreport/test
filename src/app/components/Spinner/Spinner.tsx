'use client';

import styles from './spinner.module.css';

interface SpinnerProps {
    fullScreen?: boolean;
}

export default function Spinner({ fullScreen = false }: SpinnerProps) {
    if (fullScreen) {
        return (
            <div className={styles.fullScreenContainer}>
                <div className={styles.spinner}>
                    <div className={styles.spinnerCircle}></div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.spinner}>
                <div className={styles.spinnerCircle}></div>
            </div>
        </div>
    );
}
