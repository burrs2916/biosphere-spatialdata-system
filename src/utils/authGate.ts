/**
 * 配置面门禁助手 —— 复用项目已有的配置驱动登录（authStore）。
 *
 * 语义（与 authStore 的配置驱动模型一致）：
 * - authStore.enabled === false（默认）：不门禁，全部免费（与备份行为一致）。
 * - authStore.enabled === true 且已登录：放行并执行 then。
 * - authStore.enabled === true 且未登录：唤起已配置的 webhook 登录（performLogin），
 *   登录成功后**自动补执行**被拦的 then（解决「登录成功却没反应」）；
 *   登录失败则弹 toast + 控制台报错（不再静默吞掉）。
 *
 * 注意：登录 UI 在 authStore 配置的认证服务端，本助手只负责「拦截 + 唤起登录 + 兜底执行」。
 */
import { useAuthStore } from "../store/authStore";
import { showToast } from "./toastStore";

// 记住最近一次被拦的动作，登录成功后补执行（多次调用以最后一次为准）。
let pendingAction: (() => void) | null = null;

function reportLoginError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[authGate] 登录失败:", msg);
  showToast(`登录失败：${msg}`, "error");
}

export function requireConfigAccess(then?: () => void): boolean {
  const store = useAuthStore.getState();
  if (!store.enabled) {
    then?.();
    return true;
  }
  if (store.isAuthenticated()) {
    then?.();
    return true;
  }

  // 已启用但未登录：记住被拦动作，唤起登录；成功后自动补执行。
  pendingAction = then ?? null;
  void store
    .performLogin()
    .then(() => {
      if (useAuthStore.getState().isAuthenticated() && pendingAction) {
        const action = pendingAction;
        pendingAction = null;
        action();
      } else {
        // 登录流程结束但未产生登录态（如接口未映射出用户信息 / token）
        pendingAction = null;
        console.warn("[authGate] 登录流程结束但未建立登录态，请检查认证配置的用户/Token 映射");
        showToast("登录成功但未获取到用户信息，请检查认证配置的用户映射", "warning");
      }
    })
    .catch((err) => {
      pendingAction = null;
      reportLoginError(err);
    });

  return false;
}
