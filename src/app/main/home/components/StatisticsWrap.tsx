import styles from './statisticsWrap.module.css';

export default function StatisticsWrap() {
    return (
        <div className={styles.statisticsWrap}>
            <ul className={styles.statistics}>
                <li>
                    <h2>진행중 케이스</h2>
                    <span>1</span>
                    <p>3 from yester day</p>
                </li>
                <li>
                    <h2>이번달 승인금액</h2>
                    <span>82억</span>
                    <p>원</p>
                </li>
                <li>
                    <h2>이번달 매출</h2>
                    <span>3.2억</span>
                    <p>예상 수수료</p>
                </li>
                <li>
                    <h2>이번달 신규</h2>
                    <span>12</span>
                    <p>4 from avg</p>
                </li>
                <li>
                    <h2>이번달 승인 건수</h2>
                    <span>8</span>
                    <p>건</p>
                </li>
            </ul>
        </div>
    );
}
