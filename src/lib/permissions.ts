/**
 * 문서 수정 권한 확인
 * @param userRoleLevel - 사용자 역할 레벨 (1:대표자, 2:대표실무자, 4:영업자, 6:검수자)
 * @param userId - 현재 로그인한 사용자의 user_id
 * @param documentUserId - 문서 작성자의 user_id
 * @param supervisorId - 검수자의 id (검수자인 경우만 필요)
 * @param assignedSalesManagerIds - 검수자가 담당하는 영업자들의 user_id 배열
 * @param inspectorId - 과거 담당했던 검수자의 user_id (과거 담당자는 수정 불가)
 * @param managerId - 배정된 실무자 ID (Level 1, 2의 경우 필요)
 * @param progressDetails - 문서의 현재 처리 단계 (영업자는 '영업자' 상태일 때만 수정 가능)
 * @returns 수정 권한 여부
 */
export function canEditDocument(
  userRoleLevel: number | undefined,
  userId: string,
  documentUserId: string,
  supervisorId?: number | null,
  assignedSalesManagerIds?: string[],
  inspectorId?: string | null,
  managerId?: string | null,
  progressDetails?: string | null
): boolean {
  // Level 1 (대표자): 모든 글 수정 가능
  if (userRoleLevel === 1) {
    return true;
  }

  // Level 2 (대표실무자): 모든 글 수정 가능
  if (userRoleLevel === 2) {
    return true;
  }

  // Level 4 (영업자): 자신이 작성한 문서이면서 '영업자' 상태일 때만 수정 가능
  if (userRoleLevel === 4) {
    return userId === documentUserId && progressDetails === '영업자';
  }

  // Level 6 (검수자): 자신의 소속과 일치하는 문서이면서 progress_details가 '검수자'일 때만 수정 가능
  if (userRoleLevel === 6) {
    const isAssignedDocument = assignedSalesManagerIds ? assignedSalesManagerIds.includes(documentUserId) : false;
    const isPastInspector = inspectorId === userId;
    // 담당하는 영업자의 문서이면서, 과거 담당자가 아니며, progress_details가 '검수자'인 경우만 수정 가능
    return isAssignedDocument && !isPastInspector && progressDetails === '검수자';
  }

  // 기타: 수정 불가
  return false;
}
