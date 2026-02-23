import styles from './companyCreate1.module.css';
import CompanyInfoCard from './components/CompanyInfoCard';
import ProgressStepsSection from './components/ProgressStepsSection';
import CompanyFile from './components/CompanyFile';
import MemoSection from './components/MemoSection';
import AdditionalFiles from './components/AdditionalFiles';

export default function Company1() {
    return (
        <div className={styles.container}>
            <div className={styles.companyTitle}>
                <h2>(주)테크이노베이션<b>진행중</b></h2>
                <p>고객사 상세 정보 및 업무 진행 현황</p>
            </div>
            <div className={styles.companyManagementWrap}>
                <CompanyInfoCard />
                <ProgressStepsSection />
                <CompanyFile/>
                <MemoSection />
                <AdditionalFiles />
            </div>
        </div>
    )
}