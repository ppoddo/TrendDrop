/**
 * Date를 1시간 단위로 floor한 ISO 문자열로 변환한다.
 * 예: 2026-07-22T14:37:11Z → 2026-07-22T14:00:00.000Z
 * raw_items의 bucket_at 생성에 사용.
 */
export function hourBucket(date: Date): string {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}
