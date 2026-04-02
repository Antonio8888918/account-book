import { CATEGORY_OPTIONS, CURRENCIES, PAYMENT_METHODS } from "./constants.js";

export function createTransactionApp({ supabase, showMessage }) {
  const elements = {
    recordForm: document.getElementById("recordForm"),
    formTitle: document.getElementById("formTitle"),
    date: document.getElementById("date"),
    type: document.getElementById("type"),
    amount: document.getElementById("amount"),
    category: document.getElementById("category"),
    paymentMethod: document.getElementById("paymentMethod"),
    currency: document.getElementById("currency"),
    note: document.getElementById("note"),
    submitButton: document.getElementById("submitButton"),
    cancelEditButton: document.getElementById("cancelEditButton"),
    statsGrid: document.getElementById("statsGrid"),
    recordsList: document.getElementById("recordsList"),
    recordsCountText: document.getElementById("recordsCountText"),
    filterStartDate: document.getElementById("filterStartDate"),
    filterEndDate: document.getElementById("filterEndDate"),
    filterType: document.getElementById("filterType"),
    filterCategory: document.getElementById("filterCategory"),
    filterCurrency: document.getElementById("filterCurrency"),
    resetFiltersButton: document.getElementById("resetFiltersButton"),
    recordItemTemplate: document.getElementById("recordItemTemplate"),
    refreshButton: document.getElementById("refreshButton")
  };

  const state = {
    records: [],
    editingRecordId: "",
    currentUser: null,
    initialized: false,
    isLoading: false
  };

  function initialize() {
    if (state.initialized) {
      return;
    }

    renderPaymentMethodOptions();
    setDefaultFormValues();
    renderCategoryOptions("expense");
    bindEvents();
    renderAll();
    state.initialized = true;
  }

  function bindEvents() {
    elements.type.addEventListener("change", handleTypeChange);
    elements.recordForm.addEventListener("submit", handleFormSubmit);
    elements.cancelEditButton.addEventListener("click", resetForm);
    elements.resetFiltersButton.addEventListener("click", resetFilters);
    elements.refreshButton.addEventListener("click", handleRefreshClick);

    [
      elements.filterStartDate,
      elements.filterEndDate,
      elements.filterType,
      elements.filterCategory,
      elements.filterCurrency
    ].forEach((filterElement) => {
      filterElement.addEventListener("input", renderAll);
      filterElement.addEventListener("change", renderAll);
    });
  }

  async function setSession(session) {
    state.currentUser = session?.user ?? null;
    state.editingRecordId = "";

    if (!state.currentUser) {
      state.records = [];
      resetFilters();
      resetForm();
      renderAll();
      return;
    }

    resetFilters();
    resetForm();
    await loadTransactions();
  }

  async function handleRefreshClick() {
    await loadTransactions(true);
  }

  async function loadTransactions(isManualRefresh = false) {
    if (!supabase || !state.currentUser) {
      return;
    }

    state.isLoading = true;
    renderRecords();

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    state.isLoading = false;

    if (error) {
      renderRecords();
      showMessage(`读取云端记账数据失败：${error.message}`, "error");
      return;
    }

    state.records = (data || []).map(normalizeRecord);
    renderAll();

    if (isManualRefresh) {
      showMessage("已从云端刷新最新数据。", "success");
    }
  }

  function normalizeRecord(record) {
    return {
      id: record.id,
      userId: record.user_id,
      date: record.date,
      type: record.type,
      amount: Number(record.amount),
      category: record.category,
      note: record.note || "",
      paymentMethod: record.payment_method,
      currency: record.currency,
      createdAt: record.created_at
    };
  }

  function serializeRecord(formData) {
    return {
      date: formData.date,
      type: formData.type,
      amount: formData.amount,
      category: formData.category,
      note: formData.note,
      payment_method: formData.paymentMethod,
      currency: formData.currency
    };
  }

  function renderPaymentMethodOptions() {
    elements.paymentMethod.innerHTML = PAYMENT_METHODS.map((method) => {
      return `<option value="${method}">${method}</option>`;
    }).join("");
  }

  function setDefaultFormValues() {
    elements.date.value = formatDateForInput(new Date());
    elements.type.value = "expense";
    elements.currency.value = "RUB";
    elements.note.value = "";
  }

  function handleTypeChange() {
    renderCategoryOptions(elements.type.value);
  }

  function renderCategoryOptions(type) {
    const categories = CATEGORY_OPTIONS[type];

    elements.category.innerHTML = categories.map((category) => {
      return `<option value="${category}">${category}</option>`;
    }).join("");
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    if (!supabase || !state.currentUser) {
      showMessage("当前未登录，请先登录后再保存记账记录。", "error");
      return;
    }

    const formData = getFormData();

    if (!formData) {
      return;
    }

    const isEditing = Boolean(state.editingRecordId);
    toggleFormSubmitting(true);

    const payload = serializeRecord(formData);
    let error = null;

    if (isEditing) {
      const response = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", state.editingRecordId);

      error = response.error;
    } else {
      const response = await supabase
        .from("transactions")
        .insert(payload);

      error = response.error;
    }

    toggleFormSubmitting(false);

    if (error) {
      showMessage(`保存记录失败：${error.message}`, "error");
      return;
    }

    resetForm();
    await loadTransactions();
    showMessage(isEditing ? "记录修改成功。" : "记录已保存到云端。", "success");
  }

  function toggleFormSubmitting(isSubmitting) {
    elements.submitButton.disabled = isSubmitting;
    elements.cancelEditButton.disabled = isSubmitting;
    elements.submitButton.textContent = isSubmitting
      ? state.editingRecordId ? "正在保存..." : "正在提交..."
      : state.editingRecordId ? "保存修改" : "保存记录";
  }

  function getFormData() {
    const amount = Number.parseFloat(elements.amount.value);

    if (!elements.date.value) {
      showMessage("请选择日期。", "error");
      return null;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage("请输入大于 0 的金额。", "error");
      return null;
    }

    return {
      date: elements.date.value,
      type: elements.type.value,
      amount: Number(amount.toFixed(2)),
      category: elements.category.value,
      note: elements.note.value.trim(),
      paymentMethod: elements.paymentMethod.value,
      currency: elements.currency.value
    };
  }

  function resetForm() {
    state.editingRecordId = "";
    elements.recordForm.reset();
    setDefaultFormValues();
    renderCategoryOptions("expense");
    elements.formTitle.textContent = "添加记账记录";
    elements.submitButton.textContent = "保存记录";
    elements.submitButton.disabled = false;
    elements.cancelEditButton.disabled = false;
    elements.cancelEditButton.classList.add("hidden");
  }

  function resetFilters() {
    elements.filterStartDate.value = "";
    elements.filterEndDate.value = "";
    elements.filterType.value = "all";
    elements.filterCategory.value = "all";
    elements.filterCurrency.value = "all";
    renderAll();
  }

  function renderAll() {
    renderFilterCategories();
    renderStats();
    renderRecords();
  }

  function renderFilterCategories() {
    const uniqueCategories = new Set();

    state.records.forEach((record) => {
      uniqueCategories.add(record.category);
    });

    const currentValue = elements.filterCategory.value || "all";
    const options = [
      '<option value="all">全部分类</option>',
      ...Array.from(uniqueCategories)
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
        .map((category) => `<option value="${category}">${category}</option>`)
    ];

    elements.filterCategory.innerHTML = options.join("");
    elements.filterCategory.value = uniqueCategories.has(currentValue) ? currentValue : "all";
  }

  function getFilteredRecords() {
    const startDate = elements.filterStartDate.value;
    const endDate = elements.filterEndDate.value;
    const type = elements.filterType.value;
    const category = elements.filterCategory.value;
    const currency = elements.filterCurrency.value;

    return [...state.records]
      .filter((record) => {
        if (startDate && record.date < startDate) {
          return false;
        }

        if (endDate && record.date > endDate) {
          return false;
        }

        if (type !== "all" && record.type !== type) {
          return false;
        }

        if (category !== "all" && record.category !== category) {
          return false;
        }

        if (currency !== "all" && record.currency !== currency) {
          return false;
        }

        return true;
      })
      .sort(compareRecordsDesc);
  }

  function renderStats() {
    const now = new Date();
    const todayString = formatDateForInput(now);
    const monthKey = todayString.slice(0, 7);

    const statsHtml = CURRENCIES.map((currency) => {
      const currencyRecords = state.records.filter((record) => record.currency === currency);
      const todayExpense = sumAmounts(currencyRecords, (record) => {
        return record.type === "expense" && record.date === todayString;
      });
      const monthExpense = sumAmounts(currencyRecords, (record) => {
        return record.type === "expense" && record.date.startsWith(monthKey);
      });
      const monthIncome = sumAmounts(currencyRecords, (record) => {
        return record.type === "income" && record.date.startsWith(monthKey);
      });
      const balance = calculateBalance(currencyRecords);
      const expenseCategorySummary = getMonthlyExpenseCategorySummary(currencyRecords, monthKey, currency);

      return `
        <section class="currency-card">
          <h3>${currency}</h3>
          <p>独立统计，互不换算</p>
          <div class="stat-row">
            <div class="stat-box expense">
              <span>今日支出</span>
              <strong>${formatCurrencyValue(todayExpense, currency)}</strong>
            </div>
            <div class="stat-box expense">
              <span>本月支出</span>
              <strong>${formatCurrencyValue(monthExpense, currency)}</strong>
            </div>
            <div class="stat-box income">
              <span>本月收入</span>
              <strong>${formatCurrencyValue(monthIncome, currency)}</strong>
            </div>
            <div class="stat-box balance">
              <span>当前结余</span>
              <strong>${formatCurrencyValue(balance, currency)}</strong>
            </div>
          </div>
          <div class="category-summary">
            <h4>本月支出分类</h4>
            ${expenseCategorySummary}
          </div>
        </section>
      `;
    }).join("");

    elements.statsGrid.innerHTML = statsHtml;
  }

  function sumAmounts(list, condition) {
    return list.reduce((total, record) => {
      return condition(record) ? total + Number(record.amount) : total;
    }, 0);
  }

  function calculateBalance(list) {
    return list.reduce((total, record) => {
      return total + (record.type === "income" ? Number(record.amount) : -Number(record.amount));
    }, 0);
  }

  function getMonthlyExpenseCategorySummary(currencyRecords, monthKey, currency) {
    const monthExpenses = currencyRecords.filter((record) => {
      return record.type === "expense" && record.date.startsWith(monthKey);
    });

    if (monthExpenses.length === 0) {
      return `
        <div class="inline-empty-state">
          <p>本月还没有 ${currency} 支出记录。</p>
        </div>
      `;
    }

    const totalExpense = monthExpenses.reduce((sum, record) => sum + Number(record.amount), 0);
    const categoryTotals = monthExpenses.reduce((accumulator, record) => {
      const currentTotal = accumulator[record.category] || 0;
      accumulator[record.category] = currentTotal + Number(record.amount);
      return accumulator;
    }, {});

    const items = Object.entries(categoryTotals)
      .sort((left, right) => right[1] - left[1])
      .map(([category, amount]) => {
        const percent = totalExpense === 0 ? 0 : (amount / totalExpense) * 100;

        return `
          <div class="category-item">
            <div class="category-line">
              <span>${category}</span>
              <strong>${formatCurrencyValue(amount, currency)} · ${percent.toFixed(0)}%</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${percent.toFixed(2)}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    return `<div class="category-list">${items}</div>`;
  }

  function renderRecords() {
    const filteredRecords = getFilteredRecords();

    if (state.isLoading) {
      elements.recordsCountText.textContent = "正在加载...";
      elements.recordsList.innerHTML = createEmptyState(
        "正在同步云端记录",
        "请稍等片刻，系统正在从 Supabase 读取你的记账数据。"
      );
      return;
    }

    elements.recordsCountText.textContent = `共 ${filteredRecords.length} 条记录`;

    if (state.records.length === 0) {
      elements.recordsList.innerHTML = createEmptyState(
        "还没有任何记账数据",
        "登录后你的记账数据会保存在云端。现在可以先添加第一条收入或支出记录。"
      );
      return;
    }

    if (filteredRecords.length === 0) {
      elements.recordsList.innerHTML = createEmptyState(
        "当前筛选条件下没有记录",
        "可以调整日期、类型、分类或币种筛选条件，或者点击“重置筛选”。"
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredRecords.slice(0, 100).forEach((record) => {
      const template = elements.recordItemTemplate.content.cloneNode(true);
      const root = template.querySelector(".record-item");
      const typeBadge = template.querySelector(".record-type-badge");
      const category = template.querySelector(".record-category");
      const amount = template.querySelector(".record-amount");
      const date = template.querySelector(".record-date");
      const payment = template.querySelector(".record-payment");
      const note = template.querySelector(".record-note");
      const editButton = template.querySelector(".edit-btn");
      const deleteButton = template.querySelector(".delete-btn");

      typeBadge.textContent = record.type === "expense" ? "支出" : "收入";
      typeBadge.classList.add(record.type);
      category.textContent = record.category;
      amount.textContent = formatCurrencyValue(record.amount, record.currency);
      amount.classList.add(record.type);
      date.textContent = formatDateForDisplay(record.date);
      payment.textContent = `${record.paymentMethod} · ${record.currency}`;
      note.textContent = record.note ? `备注：${record.note}` : "备注：无";

      editButton.addEventListener("click", () => startEditRecord(record.id));
      deleteButton.addEventListener("click", () => deleteRecord(record.id));

      root.dataset.recordId = record.id;
      fragment.appendChild(template);
    });

    elements.recordsList.innerHTML = "";
    elements.recordsList.appendChild(fragment);
  }

  function createEmptyState(title, text) {
    return `
      <div class="empty-state">
        <div>
          <h3>${title}</h3>
          <p>${text}</p>
        </div>
      </div>
    `;
  }

  function startEditRecord(recordId) {
    const record = state.records.find((item) => item.id === recordId);

    if (!record) {
      return;
    }

    state.editingRecordId = record.id;
    elements.date.value = record.date;
    elements.type.value = record.type;
    renderCategoryOptions(record.type);
    elements.amount.value = record.amount;
    elements.category.value = record.category;
    elements.paymentMethod.value = record.paymentMethod;
    elements.currency.value = record.currency;
    elements.note.value = record.note || "";
    elements.formTitle.textContent = "编辑记账记录";
    elements.submitButton.textContent = "保存修改";
    elements.cancelEditButton.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteRecord(recordId) {
    if (!supabase || !state.currentUser) {
      return;
    }

    const record = state.records.find((item) => item.id === recordId);

    if (!record) {
      return;
    }

    const shouldDelete = window.confirm(`确认删除这条${record.type === "expense" ? "支出" : "收入"}记录吗？`);

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", recordId);

    if (error) {
      showMessage(`删除失败：${error.message}`, "error");
      return;
    }

    if (state.editingRecordId === recordId) {
      resetForm();
    }

    await loadTransactions();
    showMessage("记录已删除。", "success");
  }

  function compareRecordsDesc(left, right) {
    const dateCompare = right.date.localeCompare(left.date);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return (right.createdAt || "").localeCompare(left.createdAt || "");
  }

  function formatCurrencyValue(amount, currency) {
    const normalized = Number.isFinite(amount) ? amount : Number(amount) || 0;
    return `${currency} ${normalized.toFixed(2)}`;
  }

  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateForDisplay(dateString) {
    const [year, month, day] = dateString.split("-");
    return `${year}年${month}月${day}日`;
  }

  return {
    initialize,
    setSession
  };
}
