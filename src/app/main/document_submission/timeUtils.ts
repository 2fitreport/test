export function getTimeAgo(dateString: string): string {
    const now = Date.now();
    let past: number;

    // ISO 문자열인지 확인 (T 문자가 있으면 ISO 형식)
    if (dateString.includes('T')) {
        past = new Date(dateString).getTime();
    } else {
        // 타임스탐프 (숫자 문자열)
        const pastTimestamp = parseInt(dateString);
        past = !isNaN(pastTimestamp) ? pastTimestamp : new Date(dateString).getTime();
    }

    // 밀리초 단위로 정확하게 계산
    const totalSeconds = Math.floor((now - past) / 1000);

    // 음수가 되지 않도록 처리 (미래 날짜 방지)
    const safeTotalSeconds = Math.max(0, totalSeconds);

    // 시간:분:초 계산
    const hours = Math.floor(safeTotalSeconds / 3600);
    const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
    const seconds = safeTotalSeconds % 60;

    // 두 자리 숫자로 포맷팅 (00:00:00 형식)
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}
