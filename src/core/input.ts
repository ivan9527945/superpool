// 手機觸控輸入:左下角虛擬搖桿寫入這裡,Player 每幀與鍵盤一起讀。
// forward 前為正、right 右為正,各為 -1..1。

export const touchAxis = { forward: 0, right: 0 };

export function setTouchAxis(forward: number, right: number): void {
  touchAxis.forward = forward;
  touchAxis.right = right;
}

export function clearTouchAxis(): void {
  touchAxis.forward = 0;
  touchAxis.right = 0;
}
