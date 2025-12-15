export function getTimeAgo(dateString: string): string {
    const now = new Date();
    const past = new Date(dateString);
    const totalSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    // 시간:분:초 계산
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // 두 자리 숫자로 포맷팅 (00:00:00 형식)
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}
