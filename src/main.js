import { createTransactionApp } from "./app.js";
import { hasSupabaseConfig, supabase, supabaseConfigError } from "./supabase.js";

const elements = {
  authView: document.getElementById("authView"),
  appView: document.getElementById("appView"),
  statusBanner: document.getElementById("statusBanner"),
  statusText: document.getElementById("statusText"),
  authFeedbackCard: document.getElementById("authFeedbackCard"),
  authFeedbackTitle: document.getElementById("authFeedbackTitle"),
  authFeedbackBody: document.getElementById("authFeedbackBody"),
  authModeButtons: Array.from(document.querySelectorAll("[data-auth-mode-button]")),
  authPanels: Array.from(document.querySelectorAll("[data-auth-panel]")),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  resetPasswordForm: document.getElementById("resetPasswordForm"),
  updatePasswordForm: document.getElementById("updatePasswordForm"),
  userEmail: document.getElementById("userEmail"),
  logoutButton: document.getElementById("logoutButton"),
  authHintText: document.getElementById("authHintText")
};

let currentAuthMode = "login";
let isPasswordRecoveryMode = false;
const redirectUrl = `${window.location.origin}${window.location.pathname}`;

const app = createTransactionApp({
  supabase,
  showMessage
});

initialize();

async function initialize() {
  bindAuthEvents();
  app.initialize();
  handleAuthRedirectMessages();

  if (!hasSupabaseConfig || !supabase) {
    showAuthView();
    showMessage(supabaseConfigError, "error");
    setAuthFormsDisabled(true);
    return;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showMessage(`读取登录状态失败：${error.message}`, "error");
  }

  await applySession(data?.session ?? null);

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecoveryMode = true;
      showAuthView();
      showAuthMode("update-password");
      showMessage("已进入密码重置模式，请输入新密码。", "info");
      return;
    }

    if (event === "SIGNED_OUT") {
      isPasswordRecoveryMode = false;
      await applySession(null);
      showAuthMode("login");
      showMessage("你已退出登录。", "info");
      return;
    }

    if (event === "USER_UPDATED" && isPasswordRecoveryMode) {
      isPasswordRecoveryMode = false;
      await applySession(session);
      showMessage("密码已更新。", "success");
      return;
    }

    await applySession(session);

    if (event === "SIGNED_IN") {
      showMessage("登录成功，欢迎回来。", "success");
    }
  });
}

function bindAuthEvents() {
  elements.authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showAuthMode(button.dataset.authModeButton);
    });
  });

  elements.loginForm.addEventListener("submit", handleLogin);
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.resetPasswordForm.addEventListener("submit", handleResetPassword);
  elements.updatePasswordForm.addEventListener("submit", handleUpdatePassword);
  elements.logoutButton.addEventListener("click", handleLogout);
}

async function applySession(session) {
  if (session?.user && !isPasswordRecoveryMode) {
    elements.userEmail.textContent = session.user.email || "当前用户";
    showAppView();
  } else {
    showAuthView();
  }

  await app.setSession(session);
}

function showAuthMode(mode) {
  currentAuthMode = mode;
  hideAuthFeedback();

  elements.authModeButtons.forEach((button) => {
    const isActive = button.dataset.authModeButton === mode;
    button.classList.toggle("active", isActive);
  });

  elements.authPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== mode);
  });

  if (mode === "update-password") {
    elements.authHintText.textContent = "请输入新的登录密码，保存后即可继续使用。";
    return;
  }

  const modeHints = {
    login: "输入邮箱和密码即可登录你的专属账本。",
    register: "新用户可以先注册账号，再通过邮箱密码登录使用。",
    reset: "输入注册邮箱，我们会发送密码重置链接到你的邮箱。"
  };

  elements.authHintText.textContent = modeHints[mode] || "";
}

function showAuthView() {
  elements.authView.classList.remove("hidden");
  elements.appView.classList.add("hidden");

  if (!isPasswordRecoveryMode && !["login", "register", "reset"].includes(currentAuthMode)) {
    showAuthMode("login");
  }
}

function showAppView() {
  elements.authView.classList.add("hidden");
  elements.appView.classList.remove("hidden");
}

function showMessage(message, type = "info") {
  if (!message) {
    elements.statusBanner.className = "status-banner hidden";
    elements.statusText.textContent = "";
    return;
  }

  elements.statusBanner.className = `status-banner ${type}`;
  elements.statusText.textContent = message;
}

function showAuthFeedback(title, body) {
  elements.authFeedbackTitle.textContent = title;
  elements.authFeedbackBody.textContent = body;
  elements.authFeedbackCard.classList.remove("hidden");
}

function hideAuthFeedback() {
  elements.authFeedbackCard.classList.add("hidden");
  elements.authFeedbackTitle.textContent = "";
  elements.authFeedbackBody.textContent = "";
}

function handleAuthRedirectMessages() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
  const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
  const type = searchParams.get("type") || hashParams.get("type");

  if (errorDescription) {
    showAuthMode("login");
    showAuthFeedback(
      "认证跳转没有完成",
      decodeURIComponent(errorDescription).replace(/\+/g, " ")
    );
    showMessage(`认证回跳失败：${decodeURIComponent(errorDescription).replace(/\+/g, " ")}`, "error");
    return;
  }

  if (errorCode) {
    showAuthMode("login");
    showAuthFeedback("认证跳转失败", `错误代码：${errorCode}`);
    return;
  }

  if (type === "signup") {
    showAuthMode("login");
    showAuthFeedback("邮箱验证已完成", "如果你已经确认过邮箱，现在可以直接返回登录。");
  }
}

function setFormSubmitting(form, isSubmitting, loadingText) {
  const submitButton = form.querySelector('button[type="submit"]');
  const inputs = form.querySelectorAll("input, button");

  inputs.forEach((element) => {
    element.disabled = isSubmitting;
  });

  if (!submitButton) {
    return;
  }

  submitButton.textContent = isSubmitting
    ? loadingText
    : submitButton.dataset.defaultText || submitButton.textContent;
}

function setAuthFormsDisabled(disabled) {
  [
    ...elements.loginForm.querySelectorAll("input, button"),
    ...elements.registerForm.querySelectorAll("input, button"),
    ...elements.resetPasswordForm.querySelectorAll("input, button"),
    ...elements.updatePasswordForm.querySelectorAll("input, button")
  ].forEach((element) => {
    element.disabled = disabled;
  });
}

async function handleLogin(event) {
  event.preventDefault();
  hideAuthFeedback();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const form = event.currentTarget;

  setFormSubmitting(form, true, "正在登录...");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showMessage(`登录失败：${error.message}`, "error");
      showAuthFeedback("登录失败", "请检查邮箱、密码是否正确，或者先确认邮箱验证是否已经完成。");
      return;
    }

    form.reset();
  } catch (error) {
    console.error("登录时发生未捕获异常：", error);
    showMessage("登录时出现异常，请稍后重试。", "error");
    showAuthFeedback("登录过程异常", "请求已经发出，但页面处理结果时出现异常。请刷新页面后重试。");
  } finally {
    setFormSubmitting(form, false, "正在登录...");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  hideAuthFeedback();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const form = event.currentTarget;

  if (password.length < 6) {
    showMessage("注册密码至少需要 6 位。", "error");
    showAuthFeedback("注册信息还不完整", "密码长度至少需要 6 位，请重新输入后再提交。");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("两次输入的密码不一致。", "error");
    showAuthFeedback("两次密码不一致", "请确认两次输入的密码完全一致后，再重新注册。");
    return;
  }

  setFormSubmitting(form, true, "正在注册...");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      showMessage(`注册失败：${error.message}`, "error");
      showAuthFeedback("注册失败", "这通常是邮箱已存在，或者认证配置中的跳转地址还没有配好。");
      return;
    }

    form.reset();

    if (data.session) {
      showMessage("注册成功，已自动登录。", "success");
      showAuthFeedback("注册成功", "系统已经自动为你登录，马上就会进入记账页面。");
      return;
    }

    showAuthMode("login");
    showMessage("注册请求已提交，请查看邮箱确认或直接尝试登录。", "success");
    showAuthFeedback(
      "注册请求已提交",
      "如果这是新邮箱，系统通常会发送确认邮件；如果这个邮箱之前已经注册过，也可以直接尝试登录或使用“忘记密码”。"
    );
  } catch (error) {
    console.error("注册时发生未捕获异常：", error);
    showMessage("注册流程发生异常，请稍后重试。", "error");
    showAuthFeedback(
      "注册过程异常",
      "注册请求很可能已经发送成功，但页面在处理返回结果时出现异常。请刷新页面后尝试直接登录，或去邮箱检查确认邮件。"
    );
  } finally {
    setFormSubmitting(form, false, "正在注册...");
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  hideAuthFeedback();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const form = event.currentTarget;

  setFormSubmitting(form, true, "发送中...");

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      showMessage(`发送重置邮件失败：${error.message}`, "error");
      showAuthFeedback("发送失败", "请确认邮箱地址是否填写正确，以及 Supabase 的 URL Configuration 是否已配置站点地址。");
      return;
    }

    form.reset();
    showMessage("重置邮件已发送，请去邮箱点击链接并返回本站设置新密码。", "success");
    showAuthFeedback("邮件已发送", "请打开邮箱中的重置链接，返回本页后系统会自动进入“设置新密码”状态。");
  } catch (error) {
    console.error("重置密码邮件发送时发生未捕获异常：", error);
    showMessage("发送重置邮件时出现异常，请稍后再试。", "error");
    showAuthFeedback("发送过程异常", "请求可能已经发出，但页面处理结果时出错。请刷新页面后再次尝试。");
  } finally {
    setFormSubmitting(form, false, "发送中...");
  }
}

async function handleUpdatePassword(event) {
  event.preventDefault();
  hideAuthFeedback();

  const formData = new FormData(event.currentTarget);
  const password = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const form = event.currentTarget;

  if (password.length < 6) {
    showMessage("新密码至少需要 6 位。", "error");
    showAuthFeedback("新密码太短", "为了安全起见，请把新密码设置为至少 6 位。");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("两次输入的新密码不一致。", "error");
    showAuthFeedback("两次密码不一致", "请确认两次输入的新密码完全一致后再保存。");
    return;
  }

  setFormSubmitting(form, true, "正在保存...");

  try {
    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      showMessage(`更新密码失败：${error.message}`, "error");
      showAuthFeedback("更新密码失败", "请重新打开邮件里的链接后再试，或者确认链接没有过期。");
      return;
    }

    form.reset();
    isPasswordRecoveryMode = false;
    showMessage("新密码已保存。", "success");
    showAuthMode("login");
    showAuthFeedback("密码已更新", "现在可以使用新密码直接登录你的云端账本。");
  } catch (error) {
    console.error("更新密码时发生未捕获异常：", error);
    showMessage("更新密码时出现异常，请稍后再试。", "error");
    showAuthFeedback("保存过程异常", "请求可能已经提交，但页面处理结果时出错。请重新打开邮件链接后重试。");
  } finally {
    setFormSubmitting(form, false, "正在保存...");
  }
}

async function handleLogout() {
  elements.logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  elements.logoutButton.disabled = false;

  if (error) {
    showMessage(`退出登录失败：${error.message}`, "error");
  }
}
