export type GuestEntry = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
};
export function validateMemo(name: string, message: string) {
  if (!name.trim() || [...name.trim()].length > 16)
    return "닉네임은 1~16자로 입력해주세요.";
  const m = message.trim();
  if (!m || [...m].length > 100) return "메시지는 1~100자로 입력해주세요.";
  if (
    /[\u0000-\u001f\u007f]/.test(name + m) ||
    /https?:\/\/|www\.|씨발|시발|병신|개새끼|fuck|shit/i.test(name + " " + m) ||
    /(.)\1{5,}/u.test(m)
  )
    return "링크, 비속어 또는 반복 문자는 사용할 수 없어요.";
  return null;
}
export function guestbookError(error: unknown) {
  const message =
    (error as { message?: string })?.message || "연결에 실패했어요.";
  if (/does not exist|schema cache|Could not find/i.test(message))
    return "방명록 SQL 마이그레이션이 아직 적용되지 않았어요.";
  if (/anonymous.*disabled|anonymous sign-ins.*disabled/i.test(message))
    return "Supabase에서 익명 로그인을 활성화해주세요.";
  if (/captcha/i.test(message))
    return "사람 확인을 완료해주세요. 계속 실패하면 CAPTCHA 설정을 확인해주세요.";
  if (/JWT|permission|policy|not authorized/i.test(message))
    return "방명록 인증 또는 권한 설정을 확인해주세요.";
  return message.slice(0, 180);
}
