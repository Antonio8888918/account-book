import { createTransactionApp } from "./app.js";
import { hasSupabaseConfig, supabase, supabaseConfigError } from "./supabase.js";

const elements = {
  authView: document.getElementById("authView"),
  appView: document.getElementById("appView"),
  statusBanner: document.getElementById("statusBanner"),
  statusText: document.getElementById("statusText"),
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

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  submitButton.disabled = true;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  submitButton.disabled = false;

  if (error) {
    showMessage(`登录失败：${error.message}`, "error");
    return;
  }

  event.currentTarget.reset();
}

async function handleRegister(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  if (password.length < 6) {
    showMessage("注册密码至少需要 6 位。", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("两次输入的密码不一致。", "error");
    return;
  }

  submitButton.disabled = true;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl
    }
  });

  submitButton.disabled = false;

  if (error) {
    showMessage(`注册失败：${error.message}`, "error");
    return;
  }

  event.currentTarget.reset();

  if (data.session) {
    showMessage("注册成功，已自动登录。", "success");
    return;
  }

  showAuthMode("login");
  showMessage("注册成功，请先去邮箱完成验证，然后再回来登录。", "success");
}

async function handleResetPassword(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  submitButton.disabled = true;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });

  submitButton.disabled = false;

  if (error) {
    showMessage(`发送重置邮件失败：${error.message}`, "error");
    return;
  }

  event.currentTarget.reset();
  showMessage("重置邮件已发送，请去邮箱点击链接并返回本站设置新密码。", "success");
}

async function handleUpdatePassword(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const password = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  if (password.length < 6) {
    showMessage("新密码至少需要 6 位。", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("两次输入的新密码不一致。", "error");
    return;
  }

  submitButton.disabled = true;

  const { error } = await supabase.auth.updateUser({
    password
  });

  submitButton.disabled = false;

  if (error) {
    showMessage(`更新密码失败：${error.message}`, "error");
    return;
  }

  event.currentTarget.reset();
  isPasswordRecoveryMode = false;
  showMessage("新密码已保存。", "success");
}

async function handleLogout() {
  elements.logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  elements.logoutButton.disabled = false;

  if (error) {
    showMessage(`退出登录失败：${error.message}`, "error");
  }
}
