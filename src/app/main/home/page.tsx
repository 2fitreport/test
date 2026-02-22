import styles from './home.module.css';
import StatisticsWrap from './components/StatisticsWrap';
import LogWrap from './components/LogWrap';
import RevisionRejectedWrap from './components/RevisionRejectedWrap';
import SalesWrap from './components/SalesWrap';
import ProgressWrap from './components/ProgressWrap';
import Link from 'next/link';

export const revalidate = 0;

export default function Home() {
    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div className={styles.mainTitleWrap}>
                    <h1 className={styles.mainTitle}>메인 홈</h1>
                    <p className={styles.subTitle}>오늘의 회사 현황을 한눈에 확인하세요.</p>
                </div>
                <div className={styles.btnWrap}>
                    <Link href="">지원 요청</Link>
                    <Link href="">기업 등록</Link>
                </div>
            </div>
            <div className={styles.homeWrap}>
                <StatisticsWrap />
                <div className={styles.logRow}>
                    <RevisionRejectedWrap />
                    <LogWrap />
                </div>
            <div className={styles.statusWrap}>
                <SalesWrap />
                <ProgressWrap />
            </div>
            </div>
        </div>
    );
}
