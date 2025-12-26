/**
 * 문서 수정 권한 확인
 * @param userRoleLevel - 사용자 역할 레벨 (1:대표자, 2:대표실무자, 4:영업자, 6:검수자)
 * @param userId - 현재 로그인한 사용자의 user_id
 * @param documentUserId - 문서 작성자의 user_id
 * @returns 수정 권한 여부
 */
export function canEditDocument(
  userRoleLevel: number | undefined,
  userId: string,
  documentUserId: string
): boolean {
  // Level 1 (대표자): 모든 문서 수정 가능
  if (userRoleLevel === 1) return true;

  // Level 2 (대표실무자): 모든 문서 수정 가능
  if (userRoleLevel === 2) return true;

  // Level 4 (영업자): 자신이 작성한 문서만 수정 가능
  if (userRoleLevel === 4) return userId === documentUserId;

  // Level 6 (검수자): 모든 문서 수정 가능
  if (userRoleLevel === 6) return true;

  // 기타: 수정 불가
  return false;
}
